using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Clinic.Infrastructure;

public sealed class OutboxDispatcher(
    IServiceScopeFactory scopeFactory,
    RabbitMqPublisher publisher,
    ILogger<OutboxDispatcher> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ClinicDbContext>();
                var now = DateTimeOffset.UtcNow;
                var messageId = await db.OutboxMessages.AsNoTracking()
                    .Where(x => x.PublishedAt == null && (x.LockedUntil == null || x.LockedUntil <= now))
                    .OrderBy(x => x.CreatedAt)
                    .Select(x => x.Id)
                    .FirstOrDefaultAsync(stoppingToken);

                if (messageId == Guid.Empty)
                {
                    await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken);
                    continue;
                }

                var lockToken = Guid.NewGuid();
                var claimed = await db.OutboxMessages
                    .Where(x => x.Id == messageId && x.PublishedAt == null && (x.LockedUntil == null || x.LockedUntil <= now))
                    .ExecuteUpdateAsync(update => update
                        .SetProperty(x => x.LockToken, lockToken)
                        .SetProperty(x => x.LockedUntil, now.AddMinutes(1))
                        .SetProperty(x => x.Attempts, x => x.Attempts + 1), stoppingToken);

                if (claimed == 0)
                    continue;

                var message = await db.OutboxMessages.AsNoTracking()
                    .SingleAsync(x => x.Id == messageId && x.LockToken == lockToken, stoppingToken);

                try
                {
                    publisher.Publish(message.RoutingKey, message.Payload);
                    var publishedAt = DateTimeOffset.UtcNow;
                    await db.OutboxMessages
                        .Where(x => x.Id == messageId && x.LockToken == lockToken)
                        .ExecuteUpdateAsync(update => update
                            .SetProperty(x => x.PublishedAt, publishedAt)
                            .SetProperty(x => x.LockToken, (Guid?)null)
                            .SetProperty(x => x.LockedUntil, (DateTimeOffset?)null), stoppingToken);
                    logger.LogInformation("Published outbox {MessageId} with key {RoutingKey} after {Attempts} attempt(s).",
                        message.Id, message.RoutingKey, message.Attempts);
                }
                catch (Exception exception) when (exception is not OperationCanceledException)
                {
                    var retryDelay = TimeSpan.FromSeconds(Math.Min(60, Math.Pow(2, Math.Min(message.Attempts, 6))));
                    await db.OutboxMessages
                        .Where(x => x.Id == messageId && x.LockToken == lockToken)
                        .ExecuteUpdateAsync(update => update
                            .SetProperty(x => x.LockToken, (Guid?)null)
                            .SetProperty(x => x.LockedUntil, DateTimeOffset.UtcNow.Add(retryDelay)), stoppingToken);
                    logger.LogWarning(exception, "Publishing outbox {MessageId} failed; retrying in {RetryDelaySeconds}s.",
                        message.Id, retryDelay.TotalSeconds);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Outbox dispatcher iteration failed; it will retry.");
                await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
            }
        }
    }
}