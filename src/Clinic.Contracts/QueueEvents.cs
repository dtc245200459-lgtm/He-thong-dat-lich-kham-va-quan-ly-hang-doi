namespace Clinic.Contracts;

public static class QueueEventNames
{
    public const string TicketRequested = "ticket.requested";
    public const string QueueUpdated = "queue.updated";
}

public sealed record TicketRequested(Guid AppointmentId, Guid DoctorId, DateOnly ServiceDate);
public sealed record QueueUpdated(Guid DoctorId, DateOnly ServiceDate, int CurrentServingNumber, int LastIssuedNumber);