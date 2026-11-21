using Clinic.Domain;
using Clinic.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Clinic.AppointmentApi;

public static class DatabaseSeeder
{
    public static readonly Guid CardiologyDoctorId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public static readonly Guid FirstSlotId = Guid.Parse("22222222-2222-2222-2222-222222222221");
    public static readonly Guid SecondSlotId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    public static readonly Guid FirstAppointmentId = Guid.Parse("44444444-4444-4444-4444-444444444441");

    public static async Task InitializeAsync(IServiceProvider services, CancellationToken cancellationToken = default)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicDbContext>();
        await db.Database.EnsureCreatedAsync(cancellationToken);
        if (await db.Doctors.AnyAsync(cancellationToken))
            return;

        var cardiologist = new Doctor
        {
            Id = CardiologyDoctorId,
            Name = "Nguyen Minh Anh",
            Specialty = "Cardiology",
            RoomName = "Room 101"
        };
        var dermatologist = new Doctor
        {
            Id = Guid.Parse("11111111-1111-1111-1111-111111111112"),
            Name = "Tran Thu Ha",
            Specialty = "Dermatology",
            RoomName = "Room 203"
        };

        var serviceDay = DateTimeOffset.UtcNow.UtcDateTime.Date.AddDays(1);
        var slots = new[]
        {
            new TimeSlot { Id = FirstSlotId, DoctorId = cardiologist.Id, StartTime = AtUtc(serviceDay, 9), EndTime = AtUtc(serviceDay, 9).AddMinutes(45), Capacity = 8, BookedCount = 2 },
            new TimeSlot { Id = SecondSlotId, DoctorId = cardiologist.Id, StartTime = AtUtc(serviceDay, 10), EndTime = AtUtc(serviceDay, 10).AddMinutes(45), Capacity = 8, BookedCount = 0 },
            new TimeSlot { Id = Guid.Parse("22222222-2222-2222-2222-222222222223"), DoctorId = dermatologist.Id, StartTime = AtUtc(serviceDay, 9), EndTime = AtUtc(serviceDay, 9).AddMinutes(45), Capacity = 8, BookedCount = 0 }
        };

        var firstPatient = new Patient
        {
            Id = Guid.Parse("33333333-3333-3333-3333-333333333331"),
            FullName = "Le Minh Khoa",
            PhoneNumber = "+84901234567"
        };
        var secondPatient = new Patient
        {
            Id = Guid.Parse("33333333-3333-3333-3333-333333333332"),
            FullName = "Pham Ngoc Linh",
            PhoneNumber = "+84907654321"
        };
        var serviceDate = DateOnly.FromDateTime(serviceDay);
        var firstAppointment = new Appointment
        {
            Id = FirstAppointmentId,
            PatientId = firstPatient.Id,
            DoctorId = cardiologist.Id,
            TimeSlotId = FirstSlotId,
            ServiceDate = serviceDate,
            QueueNumber = 1,
            Status = AppointmentStatus.InProgress,
            CreatedAt = DateTimeOffset.UtcNow.AddHours(-1)
        };
        var secondAppointment = new Appointment
        {
            Id = Guid.Parse("44444444-4444-4444-4444-444444444442"),
            PatientId = secondPatient.Id,
            DoctorId = cardiologist.Id,
            TimeSlotId = FirstSlotId,
            ServiceDate = serviceDate,
            QueueNumber = 2,
            Status = AppointmentStatus.Confirmed,
            CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-30)
        };

        db.Doctors.AddRange(cardiologist, dermatologist);
        db.TimeSlots.AddRange(slots);
        db.Patients.AddRange(firstPatient, secondPatient);
        db.Appointments.AddRange(firstAppointment, secondAppointment);
        db.QueueEntries.AddRange(
            new QueueEntry { Id = Guid.NewGuid(), AppointmentId = firstAppointment.Id, DoctorId = cardiologist.Id, ServiceDate = serviceDate, Number = 1 },
            new QueueEntry { Id = Guid.NewGuid(), AppointmentId = secondAppointment.Id, DoctorId = cardiologist.Id, ServiceDate = serviceDate, Number = 2 });
        db.QueueStates.Add(new QueueState { DoctorId = cardiologist.Id, ServiceDate = serviceDate, CurrentServingNumber = 1 });
        db.QueueCounters.Add(new QueueCounter { DoctorId = cardiologist.Id, ServiceDate = serviceDate, LastIssuedNumber = 2 });
        await db.SaveChangesAsync(cancellationToken);
    }

    private static DateTimeOffset AtUtc(DateTime date, int hour) =>
        new(date.AddHours(hour), TimeSpan.Zero);
}