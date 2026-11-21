using System.Text;
using Microsoft.Extensions.Configuration;
using RabbitMQ.Client;

namespace Clinic.Infrastructure;

public sealed class RabbitMqPublisher(IConfiguration configuration)
{
    public const string ExchangeName = "clinic.events";

    private readonly ConnectionFactory _factory = new()
    {
        HostName = configuration["RabbitMq:HostName"] ?? "localhost",
        UserName = configuration["RabbitMq:UserName"] ?? "guest",
        Password = configuration["RabbitMq:Password"] ?? "guest",
        AutomaticRecoveryEnabled = true,
        NetworkRecoveryInterval = TimeSpan.FromSeconds(5)
    };

    public void Publish(string routingKey, string payload)
    {
        using var connection = _factory.CreateConnection();
        using var channel = connection.CreateModel();
        channel.ExchangeDeclare(ExchangeName, ExchangeType.Topic, durable: true);
        channel.ConfirmSelect();

        var properties = channel.CreateBasicProperties();
        properties.Persistent = true;
        properties.ContentType = "application/json";
        channel.BasicPublish(ExchangeName, routingKey, properties, Encoding.UTF8.GetBytes(payload));
        channel.WaitForConfirmsOrDie(TimeSpan.FromSeconds(5));
    }
}