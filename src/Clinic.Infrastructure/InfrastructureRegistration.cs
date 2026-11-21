using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Clinic.Infrastructure;

public static class InfrastructureRegistration
{
    public static IServiceCollection AddClinicDatabase(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Clinic")
            ?? throw new InvalidOperationException("ConnectionStrings:Clinic is required.");
        services.AddDbContext<ClinicDbContext>(options => options.UseNpgsql(connectionString));
        return services;
    }
}