namespace Clinic.AppointmentApi.Services;

public interface IClinicService
{
    Task<IReadOnlyList<DoctorResponse>> GetDoctorsAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<TimeSlotResponse>> GetAvailableSlotsAsync(Guid doctorId, CancellationToken cancellationToken);
    Task<AppointmentResponse?> GetAppointmentAsync(Guid appointmentId, CancellationToken cancellationToken);
    Task<AppointmentResponse> CreateAppointmentAsync(CreateAppointmentRequest request, CancellationToken cancellationToken);
    Task CancelAppointmentAsync(Guid appointmentId, CancellationToken cancellationToken);
    Task<QueueResponse> GetQueueAsync(Guid doctorId, DateOnly? serviceDate, CancellationToken cancellationToken);
    Task<QueueResponse> ServeNextAsync(Guid doctorId, DateOnly? serviceDate, CancellationToken cancellationToken);
}