using System.Text.Json.Serialization;
using Clinic.AppointmentApi;
using Clinic.AppointmentApi.Endpoints;
using Clinic.AppointmentApi.Middleware;
using Clinic.AppointmentApi.Services;
using Clinic.Infrastructure;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.AddJsonConsole();
builder.Services.AddClinicDatabase(builder.Configuration);
builder.Services.AddScoped<IClinicService, ClinicService>();
builder.Services.AddHostedService<OutboxDispatcher>();
builder.Services.AddValidation();
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

var app = builder.Build();
await DatabaseSeeder.InitializeAsync(app.Services, app.Lifetime.ApplicationStopping);
app.UseExceptionHandler();
app.UseStatusCodePages();
app.MapOpenApi();

app.MapGet("/health/live", () => TypedResults.Ok(new { status = "live" }))
    .WithTags("Health").WithSummary("Check whether the API process is alive.");
app.MapGet("/health/ready", async Task<Results<Ok<ApiHealthResponse>, StatusCodeHttpResult>> (
    ClinicDbContext db, CancellationToken cancellationToken) =>
        await db.Database.CanConnectAsync(cancellationToken)
            ? TypedResults.Ok(new ApiHealthResponse("ready", "connected"))
            : TypedResults.StatusCode(StatusCodes.Status503ServiceUnavailable))
    .WithTags("Health").WithSummary("Check API database readiness.");

app.MapDoctorEndpoints();
app.MapAppointmentEndpoints();
app.MapQueueEndpoints();
app.Run();