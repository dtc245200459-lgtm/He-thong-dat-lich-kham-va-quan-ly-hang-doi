using Microsoft.AspNetCore.SignalR;

namespace Clinic.NotificationService;

public sealed class QueueHub(ILogger<QueueHub> logger) : Hub
{
    public async Task JoinDoctorQueue(Guid doctorId)
    {
        if (doctorId == Guid.Empty)
            throw new HubException("doctorId must be a non-empty GUID.");

        var group = QueueGroups.ForDoctor(doctorId);
        await Groups.AddToGroupAsync(Context.ConnectionId, group);
        logger.LogInformation("SignalR connection {ConnectionId} joined queue group {Group}.",
            Context.ConnectionId, group);
    }

    public async Task LeaveDoctorQueue(Guid doctorId)
    {
        var group = QueueGroups.ForDoctor(doctorId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, group);
        logger.LogInformation("SignalR connection {ConnectionId} left queue group {Group}.",
            Context.ConnectionId, group);
    }
}

public static class QueueGroups
{
    public static string ForDoctor(Guid doctorId) => $"doctor:{doctorId}";
}