namespace Clinic.Contracts;

public static class QueueEventNames
{
    public const string ExchangeName = "clinic.events";
    public const string TicketRequestsQueue = "clinic.ticket-requests";
    public const string QueueUpdatesQueue = "clinic.queue-updates";
    public const string TicketRequested = "ticket.requested";
    public const string QueueUpdated = "queue.updated";
}

public sealed record TicketRequested(Guid AppointmentId, Guid DoctorId, DateOnly ServiceDate);
public sealed record QueueUpdated(Guid DoctorId, DateOnly ServiceDate, int CurrentServingNumber, int LastIssuedNumber);