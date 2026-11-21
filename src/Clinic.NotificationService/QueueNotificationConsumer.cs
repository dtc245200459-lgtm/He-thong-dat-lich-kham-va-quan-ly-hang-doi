using System.Text;
using System.Text.Json;
using Clinic.Contracts;
using Microsoft.AspNetCore.SignalR;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace Clinic.NotificationService;

public sealed class QueueNotificationConsumer(
    IHubContext<QueueHub> hub,
    IConfiguration configuration,
    ILogger<QueueNotificationConsumer> logger) : BackgroundService
{
    private const string RetryExchange = "clinic.ticket-retries";
    private const string DeadLetterExchange = "clinic.dead-letter";
    private const string DeadLetterQueue = "clinic.queue-update-dead-letters";
    private const string DeadLetterRoutingKey = "queue.dead";
    private static readonly int[] RetryDelaysMilliseconds = [1000, 5000, 15000, 30000, 60000];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var factory = new ConnectionFactory
        {
            HostName = configuration["RabbitMq:HostName"] ?? "localhost",
            UserName = configuration["RabbitMq:UserName"] ?? "guest",
            Password = configuration["RabbitMq:Password"] ?? "guest",
            AutomaticRecoveryEnabled = true,
            TopologyRecoveryEnabled = true,
            NetworkRecoveryInterval = TimeSpan.FromSeconds(5),
            RequestedHeartbeat = TimeSpan.FromSeconds(30)
        };

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ConsumeSessionAsync(factory, stoppingToken);
                if (!stoppingToken.IsCancellationRequested)
                    await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "RabbitMQ notification consumer failed; reconnecting in 5 seconds.");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }

    private async Task ConsumeSessionAsync(ConnectionFactory factory, CancellationToken stoppingToken)
    {
        using var connection = factory.CreateConnection();
        using var channel = connection.CreateModel();
        DeclareTopology(channel);
        channel.ConfirmSelect();
        channel.BasicQos(prefetchSize: 0, prefetchCount: 1, global: false);

        var sessionEnded = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        channel.ModelShutdown += (_, args) =>
        {
            if (!stoppingToken.IsCancellationRequested)
                logger.LogWarning("RabbitMQ notification channel closed: {ReplyText} ({ReplyCode}).",
                    args.ReplyText, args.ReplyCode);
            sessionEnded.TrySetResult();
        };

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.Received += async (_, delivery) => await HandleDeliveryAsync(channel, delivery, stoppingToken);
        channel.BasicConsume(QueueEventNames.QueueUpdatesQueue, autoAck: false, consumer);
        logger.LogInformation("Consuming durable RabbitMQ queue {QueueName} for SignalR notifications.",
            QueueEventNames.QueueUpdatesQueue);
        await sessionEnded.Task.WaitAsync(stoppingToken);
    }

    private async Task HandleDeliveryAsync(
        IModel channel, BasicDeliverEventArgs delivery, CancellationToken stoppingToken)
    {
        QueueUpdated update;
        try
        {
            update = JsonSerializer.Deserialize<QueueUpdated>(delivery.Body.ToArray())
                ?? throw new JsonException("Queue update payload was empty.");
            if (update.DoctorId == Guid.Empty)
                throw new JsonException("Queue update doctor ID was empty.");
        }
        catch (JsonException exception)
        {
            logger.LogError(exception, "Rejecting malformed queue update {DeliveryTag} to the dead-letter queue.",
                delivery.DeliveryTag);
            if (channel.IsOpen)
                channel.BasicNack(delivery.DeliveryTag, multiple: false, requeue: false);
            return;
        }

        try
        {
            logger.LogInformation("Received queue update for doctor {DoctorId}, date {ServiceDate}, serving {CurrentServingNumber}, last ticket {LastIssuedNumber}.",
                update.DoctorId, update.ServiceDate, update.CurrentServingNumber, update.LastIssuedNumber);
            await hub.Clients.Group(QueueGroups.ForDoctor(update.DoctorId))
                .SendAsync("QueueUpdated", update, stoppingToken);
            if (channel.IsOpen)
                channel.BasicAck(delivery.DeliveryTag, multiple: false);
            logger.LogInformation("Broadcast queue update for doctor {DoctorId} and date {ServiceDate} to SignalR group {Group}; delivery acked.",
                update.DoctorId, update.ServiceDate, QueueGroups.ForDoctor(update.DoctorId));
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
        catch (Exception exception)
        {
            try
            {
                ScheduleRetry(channel, delivery, update, exception);
                channel.BasicAck(delivery.DeliveryTag, multiple: false);
            }
            catch (Exception retryException)
            {
                logger.LogError(retryException,
                    "Could not schedule queue update retry for doctor {DoctorId}; requeueing original delivery.",
                    update.DoctorId);
                if (channel.IsOpen)
                    channel.BasicNack(delivery.DeliveryTag, multiple: false, requeue: true);
            }
        }
    }

    private void ScheduleRetry(IModel channel, BasicDeliverEventArgs delivery, QueueUpdated update, Exception exception)
    {
        var previousRetries = GetRetryCount(delivery.BasicProperties.Headers);
        var retryCount = previousRetries + 1;
        var delayIndex = Math.Min(previousRetries, RetryDelaysMilliseconds.Length - 1);
        var delayMilliseconds = RetryDelaysMilliseconds[delayIndex];
        var headers = delivery.BasicProperties.Headers is null
            ? new Dictionary<string, object>()
            : new Dictionary<string, object>(delivery.BasicProperties.Headers);
        headers["x-retry-count"] = retryCount;

        var properties = channel.CreateBasicProperties();
        properties.Persistent = true;
        properties.ContentType = delivery.BasicProperties.ContentType ?? "application/json";
        properties.MessageId = delivery.BasicProperties.MessageId ?? update.DoctorId.ToString("N");
        properties.CorrelationId = delivery.BasicProperties.CorrelationId;
        properties.Headers = headers;

        channel.BasicPublish(RetryExchange, $"notify.delay.{delayMilliseconds}", mandatory: true,
            basicProperties: properties, body: delivery.Body);
        channel.WaitForConfirmsOrDie(TimeSpan.FromSeconds(5));
        logger.LogWarning(exception,
            "Scheduled queue update retry {RetryCount} for doctor {DoctorId} after {DelayMilliseconds}ms.",
            retryCount, update.DoctorId, delayMilliseconds);
    }

    private static int GetRetryCount(IDictionary<string, object>? headers)
    {
        if (headers is null || !headers.TryGetValue("x-retry-count", out var value))
            return 0;
        return value switch
        {
            int count => Math.Max(0, count),
            long count => (int)Math.Clamp(count, 0, int.MaxValue),
            byte[] bytes when int.TryParse(Encoding.UTF8.GetString(bytes), out var count) => Math.Max(0, count),
            _ => 0
        };
    }

    private static void DeclareTopology(IModel channel)
    {
        channel.ExchangeDeclare(QueueEventNames.ExchangeName, ExchangeType.Topic, durable: true);
        channel.ExchangeDeclare(RetryExchange, ExchangeType.Direct, durable: true);
        channel.ExchangeDeclare(DeadLetterExchange, ExchangeType.Direct, durable: true);

        channel.QueueDeclare(DeadLetterQueue, durable: true, exclusive: false, autoDelete: false);
        channel.QueueBind(DeadLetterQueue, DeadLetterExchange, DeadLetterRoutingKey);

        var mainQueueArguments = new Dictionary<string, object>
        {
            ["x-dead-letter-exchange"] = DeadLetterExchange,
            ["x-dead-letter-routing-key"] = DeadLetterRoutingKey
        };
        channel.QueueDeclare(QueueEventNames.QueueUpdatesQueue, durable: true, exclusive: false,
            autoDelete: false, arguments: mainQueueArguments);
        channel.QueueBind(QueueEventNames.QueueUpdatesQueue, QueueEventNames.ExchangeName,
            QueueEventNames.QueueUpdated);

        foreach (var delay in RetryDelaysMilliseconds)
        {
            var retryQueue = $"{QueueEventNames.QueueUpdatesQueue}.retry.{delay}ms";
            var arguments = new Dictionary<string, object>
            {
                ["x-message-ttl"] = delay,
                ["x-dead-letter-exchange"] = QueueEventNames.ExchangeName,
                ["x-dead-letter-routing-key"] = QueueEventNames.QueueUpdated
            };
            channel.QueueDeclare(retryQueue, durable: true, exclusive: false, autoDelete: false,
                arguments: arguments);
            channel.QueueBind(retryQueue, RetryExchange, $"notify.delay.{delay}");
        }
    }
}