using System.Text;
using System.Text.Json;
using System.Data.Common;
using Clinic.Contracts;
using Clinic.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore.Storage;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace Clinic.QueueWorker;

public sealed class QueueWorker(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<QueueWorker> logger) : BackgroundService
{
    private const string QueueName = QueueEventNames.TicketRequestsQueue;
    private const string RetryExchange = "clinic.ticket-retries";
    private const string DeadLetterExchange = "clinic.dead-letter";
    private const string DeadLetterQueue = "clinic.ticket-dead-letters";
    private const string DeadLetterRoutingKey = "ticket.dead";
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
                logger.LogError(exception, "RabbitMQ consumer session failed; reconnecting in 5 seconds.");
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
                logger.LogWarning("RabbitMQ channel closed: {ReplyText} ({ReplyCode}).", args.ReplyText, args.ReplyCode);
            sessionEnded.TrySetResult();
        };

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.Received += async (_, delivery) => await HandleDeliveryAsync(channel, delivery, stoppingToken);
        channel.BasicConsume(queue: QueueName, autoAck: false, consumer: consumer);
        logger.LogInformation("Consuming durable RabbitMQ queue {QueueName}.", QueueName);
        await sessionEnded.Task.WaitAsync(stoppingToken);
    }

    private async Task HandleDeliveryAsync(
        IModel channel, BasicDeliverEventArgs delivery, CancellationToken stoppingToken)
    {
        TicketRequested ticket;
        try
        {
            ticket = JsonSerializer.Deserialize<TicketRequested>(delivery.Body.ToArray())
                ?? throw new JsonException("Ticket request payload was empty.");
        }
        catch (JsonException exception)
        {
            logger.LogError(exception, "Rejecting malformed ticket message {DeliveryTag} to the dead-letter queue.",
                delivery.DeliveryTag);
            if (channel.IsOpen)
                channel.BasicNack(delivery.DeliveryTag, multiple: false, requeue: false);
            return;
        }

        try
        {
            using var scope = scopeFactory.CreateScope();
            var processor = scope.ServiceProvider.GetRequiredService<IQueueTicketProcessor>();
            var result = await processor.ProcessAsync(ticket, stoppingToken);
            if (channel.IsOpen)
                channel.BasicAck(delivery.DeliveryTag, multiple: false);
            logger.LogInformation("Ticket request {AppointmentId} handled with result {Result}.",
                ticket.AppointmentId, result);
        }
        catch (PermanentQueueMessageException exception)
        {
            logger.LogError(exception, "Rejecting permanent ticket message for appointment {AppointmentId}.",
                ticket.AppointmentId);
            if (channel.IsOpen)
                channel.BasicNack(delivery.DeliveryTag, multiple: false, requeue: false);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
        catch (Exception exception)
        {
            if (!IsTransient(exception))
            {
                logger.LogError(exception, "Rejecting non-transient ticket failure for appointment {AppointmentId} to the dead-letter queue.",
                    ticket.AppointmentId);
                if (channel.IsOpen)
                    channel.BasicNack(delivery.DeliveryTag, multiple: false, requeue: false);
                return;
            }

            try
            {
                ScheduleRetry(channel, delivery, ticket.AppointmentId, exception);
                channel.BasicAck(delivery.DeliveryTag, multiple: false);
            }
            catch (Exception retryException)
            {
                logger.LogError(retryException,
                    "Could not publish retry for appointment {AppointmentId}; requeueing original delivery.",
                    ticket.AppointmentId);
                if (channel.IsOpen)
                    channel.BasicNack(delivery.DeliveryTag, multiple: false, requeue: true);
            }
        }
    }

    private static bool IsTransient(Exception exception) =>
        exception is TimeoutException or IOException or RetryLimitExceededException ||
        exception is DbException { IsTransient: true } ||
        exception.GetBaseException() is DbException { IsTransient: true };

    private void ScheduleRetry(IModel channel, BasicDeliverEventArgs delivery, Guid appointmentId, Exception exception)
    {
        var previousRetries = GetRetryCount(delivery.BasicProperties.Headers);
        var retryCount = previousRetries + 1;
        var delayIndex = Math.Min(previousRetries, RetryDelaysMilliseconds.Length - 1);
        var delayMilliseconds = RetryDelaysMilliseconds[delayIndex];
        var routingKey = $"delay.{delayMilliseconds}";
        var headers = delivery.BasicProperties.Headers is null
            ? new Dictionary<string, object>()
            : new Dictionary<string, object>(delivery.BasicProperties.Headers);
        headers["x-retry-count"] = retryCount;

        var properties = channel.CreateBasicProperties();
        properties.Persistent = true;
        properties.ContentType = delivery.BasicProperties.ContentType ?? "application/json";
        properties.MessageId = delivery.BasicProperties.MessageId ?? appointmentId.ToString("N");
        properties.CorrelationId = delivery.BasicProperties.CorrelationId;
        properties.Headers = headers;

        channel.BasicPublish(RetryExchange, routingKey, mandatory: true,
            basicProperties: properties, body: delivery.Body);
        channel.WaitForConfirmsOrDie(TimeSpan.FromSeconds(5));
        logger.LogWarning(exception,
            "Scheduled retry {RetryCount} for appointment {AppointmentId} after {DelayMilliseconds}ms.",
            retryCount, appointmentId, delayMilliseconds);
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
        channel.ExchangeDeclare(RabbitMqPublisher.ExchangeName, ExchangeType.Topic, durable: true);
        channel.ExchangeDeclare(RetryExchange, ExchangeType.Direct, durable: true);
        channel.ExchangeDeclare(DeadLetterExchange, ExchangeType.Direct, durable: true);

        channel.QueueDeclare(DeadLetterQueue, durable: true, exclusive: false, autoDelete: false);
        channel.QueueBind(DeadLetterQueue, DeadLetterExchange, DeadLetterRoutingKey);

        var mainQueueArguments = new Dictionary<string, object>
        {
            ["x-dead-letter-exchange"] = DeadLetterExchange,
            ["x-dead-letter-routing-key"] = DeadLetterRoutingKey
        };
        channel.QueueDeclare(QueueName, durable: true, exclusive: false, autoDelete: false,
            arguments: mainQueueArguments);
        channel.QueueBind(QueueName, RabbitMqPublisher.ExchangeName, QueueEventNames.TicketRequested);

        foreach (var delay in RetryDelaysMilliseconds)
        {
            var retryQueue = $"{QueueName}.retry.{delay}ms";
            var arguments = new Dictionary<string, object>
            {
                ["x-message-ttl"] = delay,
                ["x-dead-letter-exchange"] = RabbitMqPublisher.ExchangeName,
                ["x-dead-letter-routing-key"] = QueueEventNames.TicketRequested
            };
            channel.QueueDeclare(retryQueue, durable: true, exclusive: false, autoDelete: false,
                arguments: arguments);
            channel.QueueBind(retryQueue, RetryExchange, $"delay.{delay}");
        }
    }
}