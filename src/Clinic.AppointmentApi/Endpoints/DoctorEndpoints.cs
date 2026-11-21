using Clinic.AppointmentApi.Services;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Clinic.AppointmentApi.Endpoints;

public static class DoctorEndpoints
{
    public static IEndpointRouteBuilder MapDoctorEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/doctors").WithTags("Doctors");
        group.MapGet("/", async Task<Ok<IReadOnlyList<DoctorResponse>>> (
            IClinicService service, CancellationToken cancellationToken) =>
                TypedResults.Ok(await service.GetDoctorsAsync(cancellationToken)))
            .WithName("GetDoctors")
            .WithSummary("List active doctors and clinics.")
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        group.MapGet("/{id:guid}/slots", async Task<Ok<IReadOnlyList<TimeSlotResponse>>> (
            Guid id, IClinicService service, CancellationToken cancellationToken) =>
                TypedResults.Ok(await service.GetAvailableSlotsAsync(id, cancellationToken)))
            .WithName("GetDoctorSlots")
            .WithSummary("List future time slots that still have capacity.")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);
        return endpoints;
    }
}