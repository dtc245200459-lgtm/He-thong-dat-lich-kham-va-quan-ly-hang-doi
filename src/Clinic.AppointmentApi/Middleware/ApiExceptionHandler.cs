using System.Data.Common;
using Clinic.AppointmentApi.Services;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Clinic.AppointmentApi.Middleware;

public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is OperationCanceledException)
            return false;

        var apiException = exception as ClinicApiException;
        var isDatabaseUnavailable = exception is DbException or TimeoutException ||
            exception.GetBaseException() is DbException || exception is RetryLimitExceededException;
        if (apiException is null && !isDatabaseUnavailable)
            return false;

        var status = apiException?.StatusCode ?? StatusCodes.Status503ServiceUnavailable;
        var title = apiException?.Title ?? "Database temporarily unavailable";
        var detail = apiException?.Message ?? "The database could not complete the request. Retry shortly.";
        if (status >= 500)
            logger.LogWarning(exception, "Request to {Path} failed with {StatusCode}.", httpContext.Request.Path, status);
        else
            logger.LogInformation("Request to {Path} rejected with {StatusCode}: {Detail}.",
                httpContext.Request.Path, status, detail);

        httpContext.Response.StatusCode = status;
        if (isDatabaseUnavailable)
            httpContext.Response.Headers["Retry-After"] = "3";
        await TypedResults.Problem(
            statusCode: status,
            title: title,
            detail: detail,
            instance: httpContext.Request.Path)
            .ExecuteAsync(httpContext);
        return true;
    }
}