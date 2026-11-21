using Clinic.Infrastructure;
using Clinic.QueueWorker;

var builder = Host.CreateApplicationBuilder(args);
builder.Logging.AddJsonConsole();
builder.Services.AddClinicDatabase(builder.Configuration);
builder.Services.AddHostedService<QueueWorker>();
await builder.Build().RunAsync();