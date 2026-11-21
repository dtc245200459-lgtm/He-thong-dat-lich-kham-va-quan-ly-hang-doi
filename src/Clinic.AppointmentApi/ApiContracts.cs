using System.ComponentModel.DataAnnotations;
using Clinic.Domain;

namespace Clinic.AppointmentApi;

/// <summary>Patient, doctor and slot identifiers required to book a visit.</summary>
public sealed record CreateAppointmentRequest
{
    [Required, MaxLength(160)]
    public required string PatientName { get; init; }

    [Required, RegularExpression(@"^[0-9+()\-\s]{6,40}$")]
    public required string PatientPhone { get; init; }

    [Required]
    public Guid DoctorId { get; init; }

    [Required]
    public Guid TimeSlotId { get; init; }
}

/// <summary>Public information about an active doctor.</summary>
public sealed record DoctorResponse(Guid Id, string Name, string Specialty, string RoomName, bool IsActive);

/// <summary>A bookable time slot and its remaining capacity.</summary>
public sealed record TimeSlotResponse(Guid Id, Guid DoctorId, DateTimeOffset StartTime, DateTimeOffset EndTime,
    int Capacity, int BookedCount, int AvailableCount);

/// <summary>Appointment details returned to the caller.</summary>
public sealed record AppointmentResponse(Guid Id, Guid PatientId, string PatientName, string PatientPhone,
    Guid DoctorId, string DoctorName, string RoomName, Guid TimeSlotId, DateTimeOffset StartTime,
    DateTimeOffset EndTime, DateOnly ServiceDate, int? QueueNumber, AppointmentStatus Status, DateTimeOffset CreatedAt);

/// <summary>One appointment in a doctor's daily queue.</summary>
public sealed record QueueEntryResponse(int Number, Guid AppointmentId, string PatientName,
    AppointmentStatus Status, bool IsCancelled);

/// <summary>Current serving position and appointment entries for one doctor and date.</summary>
public sealed record QueueResponse(Guid DoctorId, string DoctorName, string RoomName, DateOnly ServiceDate,
    int CurrentServingNumber, int LastIssuedNumber, IReadOnlyList<QueueEntryResponse> Entries);

/// <summary>Health status returned by the API readiness probe.</summary>
public sealed record ApiHealthResponse(string Status, string Database);