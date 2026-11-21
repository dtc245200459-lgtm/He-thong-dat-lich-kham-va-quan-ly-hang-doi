namespace Clinic.QueueWorker;

public sealed class QueueWorker(ILogger<QueueWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Queue Worker started; broker consumer is an implementation step for Part 2.");
        await Task.Delay(Timeout.Infinite, stoppingToken);
    }
}