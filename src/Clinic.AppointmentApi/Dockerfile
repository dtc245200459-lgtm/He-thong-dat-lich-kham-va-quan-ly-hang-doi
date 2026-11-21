FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Directory.Build.props ./
COPY src/Clinic.Domain/Clinic.Domain.csproj src/Clinic.Domain/
COPY src/Clinic.Contracts/Clinic.Contracts.csproj src/Clinic.Contracts/
COPY src/Clinic.Infrastructure/Clinic.Infrastructure.csproj src/Clinic.Infrastructure/
COPY src/Clinic.AppointmentApi/Clinic.AppointmentApi.csproj src/Clinic.AppointmentApi/
RUN dotnet restore src/Clinic.AppointmentApi/Clinic.AppointmentApi.csproj
COPY src/ src/
RUN dotnet publish src/Clinic.AppointmentApi/Clinic.AppointmentApi.csproj -c Release --no-restore -o /app/publish
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Clinic.AppointmentApi.dll"]