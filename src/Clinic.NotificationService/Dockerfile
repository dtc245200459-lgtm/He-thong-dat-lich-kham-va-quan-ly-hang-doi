FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Directory.Build.props ./
COPY src/Clinic.Contracts/Clinic.Contracts.csproj src/Clinic.Contracts/
COPY src/Clinic.NotificationService/Clinic.NotificationService.csproj src/Clinic.NotificationService/
RUN dotnet restore src/Clinic.NotificationService/Clinic.NotificationService.csproj
COPY src/ src/
RUN dotnet publish src/Clinic.NotificationService/Clinic.NotificationService.csproj -c Release --no-restore -o /app/publish
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8081
EXPOSE 8081
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Clinic.NotificationService.dll"]