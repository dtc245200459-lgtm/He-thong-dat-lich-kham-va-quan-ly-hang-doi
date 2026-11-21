var baseUrl = Environment.GetEnvironmentVariable("Client__ApiBaseUrl") ?? "http://localhost:8080";
using var client = new HttpClient { BaseAddress = new Uri(baseUrl) };
Console.WriteLine($"Clinic demo client: checking {baseUrl}/health/live");
var response = await client.GetAsync("/health/live");
Console.WriteLine($"Appointment API returned {(int)response.StatusCode} {response.StatusCode}");
return response.IsSuccessStatusCode ? 0 : 1;