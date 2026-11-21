using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clinic.Contracts;

namespace Clinic.ConsoleClient;

public sealed class ClinicApiClient : IDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly HttpClient _httpClient;

    public ClinicApiClient(string baseUrl)
    {
        var normalizedBaseUrl = baseUrl.EndsWith('/') ? baseUrl : $"{baseUrl}/";
        _httpClient = new HttpClient { BaseAddress = new Uri(normalizedBaseUrl) };
    }

    public async Task<IReadOnlyList<DoctorDto>> GetDoctorsAsync(CancellationToken cancellationToken = default) =>
        await _httpClient.GetFromJsonAsync<List<DoctorDto>>("doctors", JsonOptions, cancellationToken) ?? [];

    public async Task<IReadOnlyList<TimeSlotDto>> GetSlotsAsync(Guid doctorId, CancellationToken cancellationToken = default) =>
        await _httpClient.GetFromJsonAsync<List<TimeSlotDto>>($"doctors/{doctorId}/slots", JsonOptions, cancellationToken) ?? [];

    public async Task<AppointmentDto> CreateAppointmentAsync(
        CreateAppointmentRequest request, CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.PostAsJsonAsync("appointments", request, JsonOptions, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return await ReadRequiredAsync<AppointmentDto>(response, cancellationToken);
    }

    public async Task<AppointmentDto> GetAppointmentAsync(Guid appointmentId, CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.GetAsync($"appointments/{appointmentId}", cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return await ReadRequiredAsync<AppointmentDto>(response, cancellationToken);
    }

    public async Task CancelAppointmentAsync(Guid appointmentId, CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.DeleteAsync($"appointments/{appointmentId}", cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
    }

    public async Task<QueueDto> GetQueueAsync(
        Guid doctorId, DateOnly serviceDate, CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.GetAsync(
            $"queues/{doctorId}?serviceDate={serviceDate:yyyy-MM-dd}", cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return await ReadRequiredAsync<QueueDto>(response, cancellationToken);
    }

    public async Task<QueueDto> ServeNextAsync(
        Guid doctorId, DateOnly serviceDate, CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.PostAsync(
            $"queues/{doctorId}/next?serviceDate={serviceDate:yyyy-MM-dd}", content: null, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return await ReadRequiredAsync<QueueDto>(response, cancellationToken);
    }

    public void Dispose() => _httpClient.Dispose();

    private static async Task<T> ReadRequiredAsync<T>(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        return await response.Content.ReadFromJsonAsync<T>(JsonOptions, cancellationToken)
            ?? throw new InvalidOperationException("API returned an empty response body.");
    }

    private static async Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        if (response.IsSuccessStatusCode)
            return;

        var detail = await response.Content.ReadAsStringAsync(cancellationToken);
        throw new HttpRequestException(
            $"Appointment API returned {(int)response.StatusCode} {response.StatusCode}: {detail}",
            inner: null, response.StatusCode);
    }
}

public sealed record CreateAppointmentRequest(string PatientName, string PatientPhone, Guid DoctorId, Guid TimeSlotId);
public sealed record DoctorDto(Guid Id, string Name, string Specialty, string RoomName, bool IsActive);
public sealed record TimeSlotDto(Guid Id, Guid DoctorId, DateTimeOffset StartTime, DateTimeOffset EndTime,
    int Capacity, int BookedCount, int AvailableCount);
public sealed record AppointmentDto(Guid Id, Guid PatientId, string PatientName, string PatientPhone,
    Guid DoctorId, string DoctorName, string RoomName, Guid TimeSlotId, DateTimeOffset StartTime,
    DateTimeOffset EndTime, DateOnly ServiceDate, int? QueueNumber, string Status, DateTimeOffset CreatedAt);
public sealed record QueueEntryDto(int Number, Guid AppointmentId, string PatientName, string Status, bool IsCancelled);
public sealed record QueueDto(Guid DoctorId, string DoctorName, string RoomName, DateOnly ServiceDate,
    int CurrentServingNumber, int LastIssuedNumber, IReadOnlyList<QueueEntryDto> Entries);