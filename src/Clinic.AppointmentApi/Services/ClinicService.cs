using System.Data;
using System.Text.Json;
using Clinic.Contracts;
using Clinic.Domain;
using Clinic.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Clinic.AppointmentApi.Services;

public sealed class ClinicService(ClinicDbContext db, ILogger<ClinicService> logger) : IClinicService
{
    public async Task<IReadOnlyList<DoctorResponse>> GetDoctorsAsync(CancellationToken cancellationToken) =>
        await db.Doctors.AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.Name)
            .Select(x => new DoctorResponse(x.Id, x.Name, x.Specialty, x.RoomName, x.IsActive))
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<TimeSlotResponse>> GetAvailableSlotsAsync(Guid doctorId, CancellationToken cancellationToken)
    {
        var doctorExists = await db.Doctors.AsNoTracking().AnyAsync(
            x => x.Id == doctorId && x.IsActive, cancellationToken);
        if (!doctorExists)
            throw new NotFoundException("Active doctor was not found.");

        var now = DateTimeOffset.UtcNow;
        return await db.TimeSlots.AsNoTracking()
            .Where(x => x.DoctorId == doctorId && x.StartTime > now && x.BookedCount < x.Capacity)
            .OrderBy(x => x.StartTime)
            .Select(x => new TimeSlotResponse(x.Id, x.DoctorId, x.StartTime, x.EndTime,
                x.Capacity, x.BookedCount, x.Capacity - x.BookedCount))
            .ToListAsync(cancellationToken);
    }

    public async Task<AppointmentResponse?> GetAppointmentAsync(Guid appointmentId, CancellationToken cancellationToken) =>
        await db.Appointments.AsNoTracking()
            .Where(x => x.Id == appointmentId)
            .Select(x => new AppointmentResponse(x.Id, x.PatientId, x.Patient!.FullName, x.Patient.PhoneNumber,
                x.DoctorId, x.Doctor!.Name, x.Doctor.RoomName, x.TimeSlotId, x.TimeSlot!.StartTime,
                x.TimeSlot.EndTime, x.ServiceDate, x.QueueNumber, x.Status, x.CreatedAt))
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<AppointmentResponse> CreateAppointmentAsync(
        CreateAppointmentRequest request, CancellationToken cancellationToken)
    {
        if (request.DoctorId == Guid.Empty || request.TimeSlotId == Guid.Empty)
            throw new RequestValidationException("DoctorId and TimeSlotId must be non-empty GUIDs.");

        var appointmentId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var outboxId = Guid.NewGuid();
        var createdAt = DateTimeOffset.UtcNow;
        AppointmentResponse? response = null;
        var strategy = db.Database.CreateExecutionStrategy();

        await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            response = await GetAppointmentAsync(appointmentId, cancellationToken);
            if (response is not null)
                return;

            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            var doctor = await db.Doctors.AsNoTracking()
                .SingleOrDefaultAsync(x => x.Id == request.DoctorId && x.IsActive, cancellationToken);
            if (doctor is null)
                throw new NotFoundException("Active doctor was not found.");

            var bookingTime = DateTimeOffset.UtcNow;
            var updated = await db.TimeSlots
                .Where(x => x.Id == request.TimeSlotId && x.DoctorId == request.DoctorId &&
                    x.StartTime > bookingTime && x.BookedCount < x.Capacity)
                .ExecuteUpdateAsync(update => update.SetProperty(x => x.BookedCount, x => x.BookedCount + 1), cancellationToken);
            if (updated != 1)
                throw new ConflictException("Time slot is unavailable, expired, or full.");

            var slot = await db.TimeSlots.AsNoTracking()
                .SingleAsync(x => x.Id == request.TimeSlotId, cancellationToken);
            var patient = new Patient
            {
                Id = patientId,
                FullName = request.PatientName.Trim(),
                PhoneNumber = request.PatientPhone.Trim()
            };
            var serviceDate = DateOnly.FromDateTime(slot.StartTime.UtcDateTime);
            var appointment = new Appointment
            {
                Id = appointmentId,
                PatientId = patientId,
                DoctorId = doctor.Id,
                TimeSlotId = slot.Id,
                ServiceDate = serviceDate,
                Status = AppointmentStatus.PendingTicket,
                CreatedAt = createdAt
            };

            db.Patients.Add(patient);
            db.Appointments.Add(appointment);
            db.OutboxMessages.Add(new OutboxMessage
            {
                Id = outboxId,
                RoutingKey = QueueEventNames.TicketRequested,
                Payload = JsonSerializer.Serialize(new TicketRequested(appointmentId, doctor.Id, serviceDate)),
                CreatedAt = createdAt
            });
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            response = new AppointmentResponse(appointment.Id, patient.Id, patient.FullName, patient.PhoneNumber,
                doctor.Id, doctor.Name, doctor.RoomName, slot.Id, slot.StartTime, slot.EndTime,
                serviceDate, null, appointment.Status, appointment.CreatedAt);
            logger.LogInformation("Created appointment {AppointmentId} for doctor {DoctorId} and slot {TimeSlotId}.",
                appointment.Id, doctor.Id, slot.Id);
        });

        return response ?? throw new InvalidOperationException("Appointment transaction completed without a response.");
    }

    public async Task CancelAppointmentAsync(Guid appointmentId, CancellationToken cancellationToken)
    {
        var outboxId = Guid.NewGuid();
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            if (await db.OutboxMessages.AsNoTracking().AnyAsync(x => x.Id == outboxId, cancellationToken))
                return;

            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            var appointment = await db.Appointments.AsNoTracking()
                .SingleOrDefaultAsync(x => x.Id == appointmentId, cancellationToken);
            if (appointment is null)
                throw new NotFoundException("Appointment was not found.");
            if (appointment.Status == AppointmentStatus.Cancelled)
                return;
            if (appointment.Status is AppointmentStatus.InProgress or AppointmentStatus.Completed)
                throw new ConflictException("An appointment in progress or completed cannot be cancelled.");

            var changed = await db.Appointments
                .Where(x => x.Id == appointmentId && x.Status == appointment.Status)
                .ExecuteUpdateAsync(update => update.SetProperty(x => x.Status, AppointmentStatus.Cancelled), cancellationToken);
            if (changed != 1)
                throw new ConflictException("Appointment status changed; reload and retry the cancellation.");

            var released = await db.TimeSlots
                .Where(x => x.Id == appointment.TimeSlotId && x.BookedCount > 0)
                .ExecuteUpdateAsync(update => update.SetProperty(x => x.BookedCount, x => x.BookedCount - 1), cancellationToken);
            if (released != 1)
                throw new ConflictException("The appointment slot capacity could not be released.");

            await db.QueueEntries.Where(x => x.AppointmentId == appointmentId)
                .ExecuteUpdateAsync(update => update.SetProperty(x => x.IsCancelled, true), cancellationToken);

            var currentServing = await db.QueueStates.AsNoTracking()
                .Where(x => x.DoctorId == appointment.DoctorId && x.ServiceDate == appointment.ServiceDate)
                .Select(x => (int?)x.CurrentServingNumber).SingleOrDefaultAsync(cancellationToken) ?? 0;
            var lastIssued = await db.QueueCounters.AsNoTracking()
                .Where(x => x.DoctorId == appointment.DoctorId && x.ServiceDate == appointment.ServiceDate)
                .Select(x => (int?)x.LastIssuedNumber).SingleOrDefaultAsync(cancellationToken) ?? 0;
            db.OutboxMessages.Add(CreateQueueOutbox(outboxId, appointment.DoctorId, appointment.ServiceDate,
                currentServing, lastIssued));
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            logger.LogInformation("Cancelled appointment {AppointmentId}; slot {TimeSlotId} capacity released.",
                appointmentId, appointment.TimeSlotId);
        });
    }

    public async Task<QueueResponse> GetQueueAsync(Guid doctorId, DateOnly? serviceDate, CancellationToken cancellationToken)
    {
        var date = serviceDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var doctor = await db.Doctors.AsNoTracking()
            .Where(x => x.Id == doctorId)
            .Select(x => new { x.Id, x.Name, x.RoomName })
            .SingleOrDefaultAsync(cancellationToken);
        if (doctor is null)
            throw new NotFoundException("Doctor was not found.");

        var current = await db.QueueStates.AsNoTracking()
            .Where(x => x.DoctorId == doctorId && x.ServiceDate == date)
            .Select(x => (int?)x.CurrentServingNumber).SingleOrDefaultAsync(cancellationToken) ?? 0;
        var lastIssued = await db.QueueCounters.AsNoTracking()
            .Where(x => x.DoctorId == doctorId && x.ServiceDate == date)
            .Select(x => (int?)x.LastIssuedNumber).SingleOrDefaultAsync(cancellationToken) ?? 0;
        var entries = await db.QueueEntries.AsNoTracking()
            .Where(x => x.DoctorId == doctorId && x.ServiceDate == date)
            .OrderBy(x => x.Number)
            .Select(x => new QueueEntryResponse(x.Number, x.AppointmentId, x.Appointment!.Patient!.FullName,
                x.Appointment.Status, x.IsCancelled))
            .ToListAsync(cancellationToken);

        return new QueueResponse(doctor.Id, doctor.Name, doctor.RoomName, date, current, lastIssued, entries);
    }

    public async Task<QueueResponse> ServeNextAsync(Guid doctorId, DateOnly? serviceDate, CancellationToken cancellationToken)
    {
        var date = serviceDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var outboxId = Guid.NewGuid();
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            if (await db.OutboxMessages.AsNoTracking().AnyAsync(x => x.Id == outboxId, cancellationToken))
                return;

            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
            var doctorExists = await db.Doctors.AsNoTracking().AnyAsync(x => x.Id == doctorId && x.IsActive, cancellationToken);
            if (!doctorExists)
                throw new NotFoundException("Active doctor was not found.");

            var state = await db.QueueStates.SingleOrDefaultAsync(
                x => x.DoctorId == doctorId && x.ServiceDate == date, cancellationToken);
            var current = state?.CurrentServingNumber ?? 0;
            var next = await db.QueueEntries.Include(x => x.Appointment)
                .Where(x => x.DoctorId == doctorId && x.ServiceDate == date && x.Number > current &&
                    !x.IsCancelled && x.Appointment!.Status == AppointmentStatus.Confirmed)
                .OrderBy(x => x.Number)
                .FirstOrDefaultAsync(cancellationToken);
            if (next is null)
                throw new ConflictException("No confirmed appointment is waiting in this queue.");

            if (current > 0)
                await db.Appointments.Where(x => x.DoctorId == doctorId && x.ServiceDate == date &&
                    x.QueueNumber == current && x.Status == AppointmentStatus.InProgress)
                    .ExecuteUpdateAsync(update => update.SetProperty(x => x.Status, AppointmentStatus.Completed), cancellationToken);

            if (state is null)
            {
                state = new QueueState { DoctorId = doctorId, ServiceDate = date };
                db.QueueStates.Add(state);
            }
            state.CurrentServingNumber = next.Number;
            next.Appointment!.Status = AppointmentStatus.InProgress;

            var lastIssued = await db.QueueCounters.AsNoTracking()
                .Where(x => x.DoctorId == doctorId && x.ServiceDate == date)
                .Select(x => (int?)x.LastIssuedNumber).SingleOrDefaultAsync(cancellationToken) ?? next.Number;
            db.OutboxMessages.Add(CreateQueueOutbox(outboxId, doctorId, date, next.Number, lastIssued));
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            logger.LogInformation("Doctor {DoctorId} started serving queue number {QueueNumber} on {ServiceDate}.",
                doctorId, next.Number, date);
        });

        return await GetQueueAsync(doctorId, date, cancellationToken);
    }

    private static OutboxMessage CreateQueueOutbox(
        Guid id, Guid doctorId, DateOnly serviceDate, int currentServingNumber, int lastIssuedNumber) => new()
    {
        Id = id,
        RoutingKey = QueueEventNames.QueueUpdated,
        Payload = JsonSerializer.Serialize(new QueueUpdated(doctorId, serviceDate, currentServingNumber, lastIssuedNumber)),
        CreatedAt = DateTimeOffset.UtcNow
    };
}