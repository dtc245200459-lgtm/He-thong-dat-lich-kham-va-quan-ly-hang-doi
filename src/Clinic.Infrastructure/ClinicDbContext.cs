using Clinic.Domain;
using Microsoft.EntityFrameworkCore;

namespace Clinic.Infrastructure;

public sealed class ClinicDbContext(DbContextOptions<ClinicDbContext> options) : DbContext(options)
{
    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<Doctor> Doctors => Set<Doctor>();
    public DbSet<TimeSlot> TimeSlots => Set<TimeSlot>();
    public DbSet<Appointment> Appointments => Set<Appointment>();
    public DbSet<QueueEntry> QueueEntries => Set<QueueEntry>();
    public DbSet<QueueState> QueueStates => Set<QueueState>();
    public DbSet<QueueCounter> QueueCounters => Set<QueueCounter>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Patient>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.FullName).HasMaxLength(160).IsRequired();
            entity.Property(x => x.PhoneNumber).HasMaxLength(40).IsRequired();
            entity.HasIndex(x => x.PhoneNumber);
        });

        modelBuilder.Entity<Doctor>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Specialty).HasMaxLength(120).IsRequired();
            entity.Property(x => x.RoomName).HasMaxLength(80).IsRequired();
        });

        modelBuilder.Entity<TimeSlot>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasOne(x => x.Doctor).WithMany(x => x.TimeSlots).HasForeignKey(x => x.DoctorId);
            entity.HasIndex(x => new { x.DoctorId, x.StartTime }).IsUnique();
            entity.ToTable(table => table.HasCheckConstraint(
                "ck_time_slot_capacity", "capacity > 0 AND booked_count >= 0 AND booked_count <= capacity"));
            entity.Property(x => x.Capacity).HasColumnName("capacity");
            entity.Property(x => x.BookedCount).HasColumnName("booked_count");
        });

        modelBuilder.Entity<Appointment>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasOne(x => x.Patient).WithMany(x => x.Appointments).HasForeignKey(x => x.PatientId);
            entity.HasOne(x => x.Doctor).WithMany().HasForeignKey(x => x.DoctorId);
            entity.HasOne(x => x.TimeSlot).WithMany().HasForeignKey(x => x.TimeSlotId);
            entity.Property(x => x.QueueNumber).HasColumnName("queue_number");
            entity.HasIndex(x => new { x.DoctorId, x.ServiceDate, x.QueueNumber })
                .IsUnique().HasFilter("queue_number IS NOT NULL");
            entity.HasIndex(x => new { x.TimeSlotId, x.Status });
        });

        modelBuilder.Entity<QueueEntry>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasOne(x => x.Appointment).WithMany().HasForeignKey(x => x.AppointmentId);
            entity.HasIndex(x => x.AppointmentId).IsUnique();
            entity.HasIndex(x => new { x.DoctorId, x.ServiceDate, x.Number }).IsUnique();
        });

        modelBuilder.Entity<QueueState>().HasKey(x => new { x.DoctorId, x.ServiceDate });
        modelBuilder.Entity<QueueCounter>().HasKey(x => new { x.DoctorId, x.ServiceDate });
    }
}