using Clinic.AppointmentApi.Services;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Clinic.AppointmentApi.Endpoints;

public static class AppointmentEndpoints
{
    public static IEndpointRouteBuilder MapAppointmentEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/appointments").WithTags("Appointments");
        group.MapPost("/", async Task<Created<AppointmentResponse>> (
            CreateAppointmentRequest request, IClinicService service, CancellationToken cancellationToken) =>
        {
            var appointment = await service.CreateAppointmentAsync(request, cancellationToken);
            return TypedResults.Created($"/appointments/{appointment.Id}", appointment);
        })
            .WithName("CreateAppointment")
            .WithSummary("Book an available slot and request an asynchronous queue ticket.")
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        group.MapGet("/{id:guid}", async Task<Results<Ok<AppointmentResponse>, NotFound>> (
            Guid id, IClinicService service, CancellationToken cancellationToken) =>
        {
            var appointment = await service.GetAppointmentAsync(id, cancellationToken);
            return appointment is null ? TypedResults.NotFound() : TypedResults.Ok(appointment);
        })
            .WithName("GetAppointment")
            .WithSummary("Get appointment details and current ticket status.")
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        group.MapDelete("/{id:guid}", async Task<NoContent> (
            Guid id, IClinicService service, CancellationToken cancellationToken) =>
        {
            await service.CancelAppointmentAsync(id, cancellationToken);
            return TypedResults.NoContent();
        })
            .WithName("CancelAppointment")
            .WithSummary("Cancel an appointment and release its slot capacity.")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);
        return endpoints;
    }
}