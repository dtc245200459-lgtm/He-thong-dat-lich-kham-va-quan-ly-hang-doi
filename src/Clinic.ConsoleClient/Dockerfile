FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Directory.Build.props ./
COPY src/Clinic.ConsoleClient/Clinic.ConsoleClient.csproj src/Clinic.ConsoleClient/
RUN dotnet restore src/Clinic.ConsoleClient/Clinic.ConsoleClient.csproj
COPY src/Clinic.ConsoleClient/ src/Clinic.ConsoleClient/
RUN dotnet publish src/Clinic.ConsoleClient/Clinic.ConsoleClient.csproj -c Release --no-restore -o /app/publish
FROM mcr.microsoft.com/dotnet/runtime:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Clinic.ConsoleClient.dll"]