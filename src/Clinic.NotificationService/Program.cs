var builder = WebApplication.CreateBuilder(args);
builder.Logging.AddJsonConsole();
builder.Services.AddSignalR();

var app = builder.Build();
app.MapGet("/health/live", () => Results.Ok(new { status = "live" }));
app.MapHub<QueueHub>("/hubs/queue");
app.Run();

public sealed class QueueHub : Microsoft.AspNetCore.SignalR.Hub
{
    public Task JoinDoctorQueue(Guid doctorId) =>
        Groups.AddToGroupAsync(Context.ConnectionId, $"doctor:{doctorId}");
}