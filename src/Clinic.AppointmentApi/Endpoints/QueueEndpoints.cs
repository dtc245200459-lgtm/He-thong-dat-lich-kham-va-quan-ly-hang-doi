using Clinic.AppointmentApi.Services;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Clinic.AppointmentApi.Endpoints;

public static class QueueEndpoints
{
    public static IEndpointRouteBuilder MapQueueEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/queues").WithTags("Queues");
        group.MapGet("/{doctorId:guid}", async Task<Ok<QueueResponse>> (
            Guid doctorId, DateOnly? serviceDate, IClinicService service, CancellationToken cancellationToken) =>
                TypedResults.Ok(await service.GetQueueAsync(doctorId, serviceDate, cancellationToken)))
            .WithName("GetQueue")
            .WithSummary("Get the serving position and ticket list for a doctor and date.")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        group.MapPost("/{doctorId:guid}/next", async Task<Ok<QueueResponse>> (
            Guid doctorId, DateOnly? serviceDate, IClinicService service, CancellationToken cancellationToken) =>
                TypedResults.Ok(await service.ServeNextAsync(doctorId, serviceDate, cancellationToken)))
            .WithName("ServeNextAppointment")
            .WithSummary("Complete the current appointment and start serving the next confirmed ticket.")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);
        return endpoints;
    }
}