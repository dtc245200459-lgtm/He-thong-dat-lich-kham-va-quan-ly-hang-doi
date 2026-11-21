namespace Clinic.Domain;

public enum AppointmentStatus
{
    PendingTicket,
    Confirmed,
    InProgress,
    Completed,
    Cancelled
}

public sealed class Patient
{
    public Guid Id { get; set; }
    public required string FullName { get; set; }
    public required string PhoneNumber { get; set; }
    public ICollection<Appointment> Appointments { get; set; } = [];
}

public sealed class Doctor
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public required string Specialty { get; set; }
    public required string RoomName { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<TimeSlot> TimeSlots { get; set; } = [];
}

public sealed class TimeSlot
{
    public Guid Id { get; set; }
    public Guid DoctorId { get; set; }
    public DateTimeOffset StartTime { get; set; }
    public DateTimeOffset EndTime { get; set; }
    public int Capacity { get; set; }
    public int BookedCount { get; set; }
    public Doctor? Doctor { get; set; }
}

public sealed class Appointment
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Guid DoctorId { get; set; }
    public Guid TimeSlotId { get; set; }
    public DateOnly ServiceDate { get; set; }
    public int? QueueNumber { get; set; }
    public AppointmentStatus Status { get; set; } = AppointmentStatus.PendingTicket;
    public DateTimeOffset CreatedAt { get; set; }
    public Patient? Patient { get; set; }
    public Doctor? Doctor { get; set; }
    public TimeSlot? TimeSlot { get; set; }
}

public sealed class QueueEntry
{
    public Guid Id { get; set; }
    public Guid AppointmentId { get; set; }
    public Guid DoctorId { get; set; }
    public DateOnly ServiceDate { get; set; }
    public int Number { get; set; }
    public bool IsCancelled { get; set; }
    public Appointment? Appointment { get; set; }
}

public sealed class QueueState
{
    public Guid DoctorId { get; set; }
    public DateOnly ServiceDate { get; set; }
    public int CurrentServingNumber { get; set; }
}

public sealed class QueueCounter
{
    public Guid DoctorId { get; set; }
    public DateOnly ServiceDate { get; set; }
    public int LastIssuedNumber { get; set; }
}

public sealed class OutboxMessage
{
    public Guid Id { get; set; }
    public required string RoutingKey { get; set; }
    public required string Payload { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? PublishedAt { get; set; }
    public DateTimeOffset? LockedUntil { get; set; }
    public Guid? LockToken { get; set; }
    public int Attempts { get; set; }
}