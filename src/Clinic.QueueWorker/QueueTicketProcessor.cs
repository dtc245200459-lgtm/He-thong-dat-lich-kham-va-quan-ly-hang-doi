using System.Data;
using System.Text.Json;
using Clinic.Contracts;
using Clinic.Domain;
using Clinic.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Clinic.QueueWorker;

public sealed class QueueTicketProcessor(ClinicDbContext db, ILogger<QueueTicketProcessor> logger)
    : IQueueTicketProcessor
{
    public async Task<string> ProcessAsync(TicketRequested ticket, CancellationToken cancellationToken)
    {
        if (ticket.AppointmentId == Guid.Empty || ticket.DoctorId == Guid.Empty)
            throw new PermanentQueueMessageException("Ticket request must contain appointment and doctor IDs.");

        var result = "allocated";
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);

            var lockedAppointmentId = await db.Database.SqlQuery<Guid?>($$"""
                SELECT "Id" AS "Value"
                FROM "Appointments"
                WHERE "Id" = {{ticket.AppointmentId}}
                FOR UPDATE
                """).SingleOrDefaultAsync(cancellationToken);
            if (lockedAppointmentId is null)
                throw new PermanentQueueMessageException($"Appointment {ticket.AppointmentId} does not exist.");

            var appointment = await db.Appointments.SingleAsync(
                x => x.Id == ticket.AppointmentId, cancellationToken);
            if (appointment.DoctorId != ticket.DoctorId || appointment.ServiceDate != ticket.ServiceDate)
                throw new PermanentQueueMessageException("Ticket request doctor/date does not match the appointment.");

            if (appointment.Status == AppointmentStatus.Cancelled)
            {
                result = "cancelled-no-op";
                await transaction.CommitAsync(cancellationToken);
                return;
            }

            if (appointment.QueueNumber is not null)
            {
                result = "already-allocated-no-op";
                await transaction.CommitAsync(cancellationToken);
                return;
            }

            if (appointment.Status != AppointmentStatus.PendingTicket)
                throw new PermanentQueueMessageException(
                    $"Appointment {appointment.Id} is in unexpected status {appointment.Status} without a queue number.");

            var queueNumber = await db.Database.SqlQuery<int>($$"""
                INSERT INTO "QueueCounters" ("DoctorId", "ServiceDate", "LastIssuedNumber")
                VALUES ({{ticket.DoctorId}}, {{ticket.ServiceDate}}, 1)
                ON CONFLICT ("DoctorId", "ServiceDate")
                DO UPDATE SET "LastIssuedNumber" = "QueueCounters"."LastIssuedNumber" + 1
                RETURNING "LastIssuedNumber" AS "Value"
                """).SingleAsync(cancellationToken);

            var queueState = await db.QueueStates.SingleOrDefaultAsync(
                x => x.DoctorId == ticket.DoctorId && x.ServiceDate == ticket.ServiceDate,
                cancellationToken);
            var currentServingNumber = queueState?.CurrentServingNumber ?? 0;
            if (queueState is null)
            {
                queueState = new QueueState
                {
                    DoctorId = ticket.DoctorId,
                    ServiceDate = ticket.ServiceDate,
                    CurrentServingNumber = 0
                };
                db.QueueStates.Add(queueState);
            }

            appointment.QueueNumber = queueNumber;
            appointment.Status = AppointmentStatus.Confirmed;
            db.QueueEntries.Add(new QueueEntry
            {
                Id = Guid.NewGuid(),
                AppointmentId = appointment.Id,
                DoctorId = ticket.DoctorId,
                ServiceDate = ticket.ServiceDate,
                Number = queueNumber
            });
            db.OutboxMessages.Add(new OutboxMessage
            {
                Id = Guid.NewGuid(),
                RoutingKey = QueueEventNames.QueueUpdated,
                Payload = JsonSerializer.Serialize(new QueueUpdated(
                    ticket.DoctorId, ticket.ServiceDate, currentServingNumber, queueNumber)),
                CreatedAt = DateTimeOffset.UtcNow
            });

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            logger.LogInformation("Allocated queue number {QueueNumber} to appointment {AppointmentId} for doctor {DoctorId} on {ServiceDate}.",
                queueNumber, appointment.Id, ticket.DoctorId, ticket.ServiceDate);
        });

        return result;
    }
}