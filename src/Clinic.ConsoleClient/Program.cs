using Clinic.Contracts;
using Clinic.ConsoleClient;
using Microsoft.AspNetCore.SignalR.Client;

var apiBaseUrl = Environment.GetEnvironmentVariable("Client__ApiBaseUrl") ?? "http://localhost:8080";
var hubUrl = Environment.GetEnvironmentVariable("Client__NotificationHubUrl") ?? "http://localhost:8081/hubs/queue";
using var api = new ClinicApiClient(apiBaseUrl);

while (true)
{
	PrintMenu();
	var choice = Console.ReadLine()?.Trim();
	if (choice == "0")
		break;

	try
	{
		switch (choice)
		{
			case "1":
				PrintDoctors(await api.GetDoctorsAsync());
				break;
			case "2":
			{
				var doctorId = ReadGuid("Doctor ID: ");
				PrintSlots(await api.GetSlotsAsync(doctorId));
				break;
			}
			case "3":
			{
				var request = new CreateAppointmentRequest(
					ReadRequired("Patient name: "), ReadRequired("Patient phone: "),
					ReadGuid("Doctor ID: "), ReadGuid("Time slot ID: "));
				var appointment = await api.CreateAppointmentAsync(request);
				WriteLog($"Appointment created: {appointment.Id}, status={appointment.Status}, ticket pending.");
				PrintAppointment(appointment);
				break;
			}
			case "4":
			{
				var appointment = await api.GetAppointmentAsync(ReadGuid("Appointment ID: "));
				PrintAppointment(appointment);
				break;
			}
			case "5":
			{
				await api.CancelAppointmentAsync(ReadGuid("Appointment ID: "));
				WriteLog("Appointment cancellation completed.");
				break;
			}
			case "6":
			{
				var doctorId = ReadGuid("Doctor ID: ");
				var serviceDate = ReadDateOrToday();
				PrintQueue(await api.GetQueueAsync(doctorId, serviceDate));
				break;
			}
			case "7":
			{
				var doctorId = ReadGuid("Doctor ID to watch: ");
				var serviceDate = ReadDateOrToday();
				await WatchQueueAsync(hubUrl, doctorId, serviceDate);
				break;
			}
			case "8":
			{
				var doctorId = ReadGuid("Doctor ID: ");
				var serviceDate = ReadDateOrToday();
				PrintQueue(await api.ServeNextAsync(doctorId, serviceDate));
				break;
			}
			default:
				Console.WriteLine("Choose one of the listed commands.");
				break;
		}
	}
	catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException or InvalidOperationException)
	{
		WriteLog($"Request failed: {exception.Message}");
	}

	Console.WriteLine();
}

static void PrintMenu()
{
	Console.WriteLine("Clinic Appointment Client");
	Console.WriteLine("1. List doctors");
	Console.WriteLine("2. List available slots");
	Console.WriteLine("3. Book appointment");
	Console.WriteLine("4. Get appointment");
	Console.WriteLine("5. Cancel appointment");
	Console.WriteLine("6. Get queue");
	Console.WriteLine("7. Watch queue updates (SignalR)");
	Console.WriteLine("8. Serve next appointment");
	Console.WriteLine("0. Exit");
	Console.Write("Command: ");
}

static void PrintDoctors(IEnumerable<DoctorDto> doctors)
{
	foreach (var doctor in doctors)
		Console.WriteLine($"{doctor.Id} | {doctor.Name} | {doctor.Specialty} | {doctor.RoomName}");
}

static void PrintSlots(IEnumerable<TimeSlotDto> slots)
{
	foreach (var slot in slots)
		Console.WriteLine($"{slot.Id} | {slot.StartTime:O} - {slot.EndTime:O} | available {slot.AvailableCount}/{slot.Capacity}");
}

static void PrintAppointment(AppointmentDto appointment) =>
	Console.WriteLine($"{appointment.Id} | {appointment.PatientName} | {appointment.DoctorName} ({appointment.RoomName}) | " +
		$"{appointment.StartTime:O} | queue={appointment.QueueNumber?.ToString() ?? "pending"} | {appointment.Status}");

static void PrintQueue(QueueDto queue)
{
	Console.WriteLine($"{queue.DoctorName} ({queue.RoomName}) on {queue.ServiceDate}: serving {queue.CurrentServingNumber}, last ticket {queue.LastIssuedNumber}");
	foreach (var entry in queue.Entries)
		Console.WriteLine($"#{entry.Number} | {entry.PatientName} | {entry.Status}{(entry.IsCancelled ? " (cancelled)" : "")}");
}

static async Task WatchQueueAsync(string hubUrl, Guid doctorId, DateOnly serviceDate)
{
	await using var connection = new HubConnectionBuilder()
		.WithUrl(hubUrl)
		.WithAutomaticReconnect([TimeSpan.Zero, TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(15)])
		.Build();

	connection.On<QueueUpdated>("QueueUpdated", update =>
	{
		if (update.DoctorId == doctorId && update.ServiceDate == serviceDate)
			WriteLog($"SignalR queue update: doctor={update.DoctorId}, date={update.ServiceDate}, " +
				$"serving={update.CurrentServingNumber}, lastTicket={update.LastIssuedNumber}.");
	});
	connection.Reconnecting += exception =>
	{
		WriteLog($"SignalR reconnecting: {exception?.Message ?? "connection lost"}");
		return Task.CompletedTask;
	};
	connection.Reconnected += connectionId =>
	{
		WriteLog($"SignalR reconnected ({connectionId}); rejoining doctor group.");
		return connection.InvokeAsync("JoinDoctorQueue", doctorId);
	};
	connection.Closed += exception =>
	{
		WriteLog($"SignalR connection closed: {exception?.Message ?? "closed"}");
		return Task.CompletedTask;
	};

	await connection.StartAsync();
	await connection.InvokeAsync("JoinDoctorQueue", doctorId);
	WriteLog($"Watching doctor {doctorId} for {serviceDate}. Press Enter to stop.");
	Console.ReadLine();
	if (connection.State == HubConnectionState.Connected)
	{
		await connection.InvokeAsync("LeaveDoctorQueue", doctorId);
		await connection.StopAsync();
	}
}

static Guid ReadGuid(string prompt)
{
	while (true)
	{
		Console.Write(prompt);
		if (Guid.TryParse(Console.ReadLine(), out var value) && value != Guid.Empty)
			return value;
		Console.WriteLine("Enter a valid non-empty GUID.");
	}
}

static string ReadRequired(string prompt)
{
	while (true)
	{
		Console.Write(prompt);
		var value = Console.ReadLine()?.Trim();
		if (!string.IsNullOrWhiteSpace(value))
			return value;
		Console.WriteLine("A value is required.");
	}
}

static DateOnly ReadDateOrToday()
{
	Console.Write("Service date (YYYY-MM-DD, blank for UTC today): ");
	var value = Console.ReadLine()?.Trim();
	if (string.IsNullOrEmpty(value))
		return DateOnly.FromDateTime(DateTime.UtcNow);
	if (DateOnly.TryParse(value, out var date))
		return date;
	throw new InvalidOperationException("Service date must use YYYY-MM-DD format.");
}

static void WriteLog(string message) => Console.WriteLine($"{DateTimeOffset.UtcNow:O} [Client] {message}");