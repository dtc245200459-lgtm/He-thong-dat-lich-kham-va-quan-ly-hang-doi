using Clinic.NotificationService;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.AddJsonConsole();
builder.Services.AddSignalR(options =>
{
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(45);
});
builder.Services.AddHostedService<QueueNotificationConsumer>();

var app = builder.Build();
app.MapGet("/health/live", () => TypedResults.Ok(new { status = "live" }));
app.MapHub<QueueHub>("/hubs/queue");
app.Run();