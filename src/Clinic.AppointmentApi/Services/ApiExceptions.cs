namespace Clinic.AppointmentApi.Services;

public abstract class ClinicApiException(int statusCode, string title, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public string Title { get; } = title;
}

public sealed class NotFoundException(string message)
    : ClinicApiException(StatusCodes.Status404NotFound, "Resource not found", message);

public sealed class ConflictException(string message)
    : ClinicApiException(StatusCodes.Status409Conflict, "Request conflict", message);

public sealed class RequestValidationException(string message)
    : ClinicApiException(StatusCodes.Status400BadRequest, "Invalid request", message);