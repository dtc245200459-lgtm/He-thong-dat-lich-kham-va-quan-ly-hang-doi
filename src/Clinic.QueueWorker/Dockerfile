FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Directory.Build.props ./
COPY src/Clinic.Domain/Clinic.Domain.csproj src/Clinic.Domain/
COPY src/Clinic.Contracts/Clinic.Contracts.csproj src/Clinic.Contracts/
COPY src/Clinic.Infrastructure/Clinic.Infrastructure.csproj src/Clinic.Infrastructure/
COPY src/Clinic.QueueWorker/Clinic.QueueWorker.csproj src/Clinic.QueueWorker/
RUN dotnet restore src/Clinic.QueueWorker/Clinic.QueueWorker.csproj
COPY src/ src/
RUN dotnet publish src/Clinic.QueueWorker/Clinic.QueueWorker.csproj -c Release --no-restore -o /app/publish
FROM mcr.microsoft.com/dotnet/runtime:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Clinic.QueueWorker.dll"]