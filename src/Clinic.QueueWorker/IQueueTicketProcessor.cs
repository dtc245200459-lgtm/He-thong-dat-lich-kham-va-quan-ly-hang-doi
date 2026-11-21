using Clinic.Contracts;

namespace Clinic.QueueWorker;

public interface IQueueTicketProcessor
{
    Task<string> ProcessAsync(TicketRequested ticket, CancellationToken cancellationToken);
}

public sealed class PermanentQueueMessageException(string message) : Exception(message);