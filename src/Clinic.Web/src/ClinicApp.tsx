import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, CalendarDays, Check, ChevronDown, Clock3, Search,
  Stethoscope, UserRound, UsersRound, Baby, Ear, SmilePlus,
  Microscope, ShieldCheck, HeartPulse, CircleDot
} from 'lucide-react';
import OpsDesk from './OpsDesk';
import type { AppointmentRequest, AppointmentResponse, Department, Doctor, DoctorSlot, QueueTicket, TimeSlot } from './types';

const departments: Department[] = [
  { id: 'general', name: 'Nội tổng quát', description: 'Khám sức khỏe và tư vấn', waitTimeMinutes: 10, fee: 250000 },
  { id: 'pediatrics', name: 'Nhi khoa', description: 'Khám và theo dõi trẻ em', waitTimeMinutes: 14, fee: 220000 },
  { id: 'ent', name: 'Tai — Mũi — Họng', description: 'Thăm khám tai mũi họng', waitTimeMinutes: 12, fee: 280000 },
  { id: 'dental', name: 'Răng — Hàm — Mặt', description: 'Nha khoa và phẫu thuật', waitTimeMinutes: 18, fee: 300000 },
  { id: 'derma', name: 'Da liễu', description: 'Chăm sóc da và da liễu', waitTimeMinutes: 9, fee: 260000 },
  { id: 'lab', name: 'Xét nghiệm', description: 'Cận lâm sàng tại phòng Lab', waitTimeMinutes: 8, fee: 180000 }
];

const departmentIcons = [Stethoscope, Baby, Ear, SmilePlus, HeartPulse, Microscope];
const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + 'đ';
const formatTime = (value: string) => new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date(value));

export default function ClinicApp() {
  const [view, setView] = useState<'booking' | 'track' | 'staff'>('booking');
  const [department, setDepartment] = useState<Department>(departments[0]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [slots, setSlots] = useState<DoctorSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [openStep, setOpenStep] = useState(1);
  const [patient, setPatient] = useState({ name: '', phone: '', birthYear: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState<QueueTicket | null>(null);
  const [lookupId, setLookupId] = useState('');
  const [lookupResult, setLookupResult] = useState<AppointmentResponse | null>(null);

  useEffect(() => {
    fetch('/api/doctors').then(response => response.json()).then((items: Doctor[]) => {
      setDoctors(items);
      setDoctor(items[0] ?? null);
    }).catch(() => setDoctors([]));
  }, []);

  useEffect(() => {
    if (!doctor) return;
    fetch(`/api/doctors/${doctor.id}/slots`).then(response => response.json()).then((items: DoctorSlot[]) => {
      setSlots(items);
      if (items[0]) setSelectedDate(items[0].startTime.slice(0, 10));
    }).catch(() => setSlots([]));
  }, [doctor]);

  const dates = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return date;
  }), []);

  const dateSlots = slots.filter(slot => slot.startTime.slice(0, 10) === selectedDate);
  const morning = dateSlots.filter(slot => new Date(slot.startTime).getHours() < 12);
  const afternoon = dateSlots.filter(slot => new Date(slot.startTime).getHours() >= 12);

  async function submitBooking() {
    if (!doctor || !selectedSlot || !patient.name.trim() || !patient.phone.trim()) return;
    setSubmitting(true);
    const request: AppointmentRequest = {
      patientName: patient.name,
      patientPhone: patient.phone,
      doctorId: doctor.id,
      timeSlotId: selectedSlot.id
    };
    try {
      const response = await fetch('/api/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
      if (!response.ok) throw new Error('Không thể tạo lịch hẹn. Vui lòng kiểm tra lại khung giờ.');
      const appointment: AppointmentResponse = await response.json();
      const queueNumber = appointment.queueNumber ?? 42;
      setTicket({
        code: `A-${String(queueNumber).padStart(3, '0')}`,
        appointmentId: appointment.id,
        room: appointment.roomName,
        floor: 'Tầng 2',
        currentServing: 'A-038',
        peopleAhead: Math.max(1, queueNumber - 38),
        estimatedWaitMinutes: department.waitTimeMinutes
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Đã có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  }

  async function lookupTicket() {
    if (!lookupId.trim()) return;
    try {
      const response = await fetch(`/api/appointments/${lookupId.trim()}`);
      if (!response.ok) throw new Error('Không tìm thấy phiếu khám');
      setLookupResult(await response.json());
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không tìm thấy phiếu khám');
    }
  }

  if (view === 'staff') return <OpsDesk />;

  return (
    <div className="min-h-screen bg-[#FAFAF9] text-[#1C1917]">
      <header className="border-b border-[#E7E5E4] bg-white">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center px-5 lg:px-8">
          <button onClick={() => setView('booking')} className="flex items-center gap-3" aria-label="ClinicQueue Trang chủ">
            <div className="grid h-8 w-8 place-items-center rounded-md border border-[#14362B] text-[#14362B]"><Stethoscope size={17} /></div>
            <span className="text-[17px] font-bold tracking-tight">ClinicQueue</span>
          </button>
          <div className="ml-4 hidden items-center gap-2 text-[11px] font-semibold text-[#57534E] md:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>Hệ thống đang hoạt động</div>

          <nav className="ml-auto flex rounded-lg border border-[#E7E5E4] bg-[#F5F5F4] p-1">
            <button onClick={() => setView('booking')} className={`h-8 rounded-md px-3 text-xs font-semibold transition duration-150 ${view === 'booking' ? 'bg-white text-[#14362B] ring-1 ring-[#E7E5E4]' : 'text-[#57534E]'}`}>Đặt lịch khám</button>
            <button onClick={() => setView('track')} className={`h-8 rounded-md px-3 text-xs font-semibold transition duration-150 ${view === 'track' ? 'bg-white text-[#14362B] ring-1 ring-[#E7E5E4]' : 'text-[#57534E]'}`}>Tra cứu số</button>
            <button onClick={() => setView('staff')} className="h-8 rounded-md px-3 text-xs font-semibold text-[#57534E] transition duration-150 hover:text-[#14362B]">Quầy điều phối <span className="ml-1 text-[#A8A29E]">Staff</span></button>
          </nav>
        </div>
      </header>

      {view === 'track' ? (
        <main className="mx-auto max-w-3xl px-5 py-12">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A8A29E]">Tra cứu thời gian thực</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Theo dõi phiếu khám</h1>
          <div className="mt-8 flex gap-2 border-b border-[#E7E5E4] pb-8">
            <div className="relative flex-1"><Search className="absolute left-3 top-2.5 text-[#A8A29E]" size={17} /><input value={lookupId} onChange={event => setLookupId(event.target.value)} onKeyDown={event => event.key === 'Enter' && lookupTicket()} className="h-10 w-full rounded-md border border-[#D6D3D1] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#14362B]" placeholder="Nhập mã lịch hẹn / mã tra cứu" /></div>
            <button onClick={lookupTicket} className="h-10 rounded-md bg-[#14362B] px-5 text-sm font-semibold text-white">Tra cứu</button>
          </div>
          {lookupResult && <div className="mt-6 border-l-2 border-[#14362B] bg-white p-5"><div className="flex items-start justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-wider text-[#A8A29E]">Số thứ tự</p><p className="mt-1 font-mono text-4xl font-bold tabular-nums">A-{String(lookupResult.queueNumber ?? 42).padStart(3, '0')}</p></div><span className="text-xs font-semibold text-[#57534E]">{lookupResult.status}</span></div><div className="mt-5 h-px bg-[#E7E5E4]"></div><p className="mt-4 text-sm"><span className="text-[#57534E]">Đang gọi:</span> <strong className="ml-1 font-mono tabular-nums">A-038</strong></p></div>}
        </main>
      ) : (
        <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
          <div className="mb-7 flex items-end justify-between">
            <div><p className="text-[11px] font-semibold uppercase tracking-wider text-[#A8A29E]">Đặt lịch trực tuyến</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Chọn lịch khám phù hợp</h1></div>
            <p className="hidden text-xs tabular-nums text-[#57534E] md:block">{new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' }).format(new Date())}</p>
          </div>

          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.85fr)_minmax(300px,.95fr)]">
            <div className="divide-y divide-[#E7E5E4] border-y border-[#E7E5E4]">
              <BookingStep number="01" title="Chuyên khoa" open={openStep === 1} onToggle={() => setOpenStep(openStep === 1 ? 0 : 1)}>
                <div className="grid gap-2 sm:grid-cols-2">{departments.map((item, index) => {
                  const Icon = departmentIcons[index];
                  const active = department.id === item.id;
                  return <button key={item.id} onClick={() => { setDepartment(item); setOpenStep(2); }} className={`flex h-[88px] items-center border px-4 text-left transition duration-150 ${active ? 'border-[1.5px] border-[#14362B] bg-[#F4F7F5]' : 'border-[#E7E5E4] bg-white hover:border-[#A8A29E]'}`}><div className="grid h-9 w-9 shrink-0 place-items-center border border-[#E7E5E4] text-[#57534E]"><Icon size={17} /></div><div className="ml-3 min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.name}</p><p className="mt-1 text-xs text-[#57534E]">{item.description}</p></div><div className="ml-2 text-right"><p className="font-mono text-[12px] font-semibold tabular-nums">~{item.waitTimeMinutes}p</p><p className="mt-1 font-mono text-[11px] tabular-nums text-[#57534E]">{money(item.fee)}</p></div></button>;
                })}</div>
              </BookingStep>

              <BookingStep number="02" title="Bác sĩ & ngày khám" open={openStep === 2} onToggle={() => setOpenStep(openStep === 2 ? 0 : 2)}>
                <div className="overflow-x-auto pb-2"><div className="flex min-w-[520px] border-b border-[#E7E5E4]">{dates.map((date, index) => {
                  const value = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
                  const active = selectedDate === value || (!selectedDate && index === 0);
                  return <button key={value} onClick={() => setSelectedDate(value)} className={`min-w-[74px] border-b-2 px-3 py-3 text-center transition duration-150 ${active ? 'border-[#14362B] text-[#14362B]' : 'border-transparent text-[#57534E] hover:text-[#1C1917]'}`}><span className="block text-[10px] font-semibold uppercase tracking-wider">{new Intl.DateTimeFormat('vi-VN',{weekday:'short'}).format(date)}</span><span className="mt-1 block font-mono text-lg font-bold tabular-nums">{date.getDate()}</span></button>;
                })}</div></div>
                <div className="mt-3 divide-y divide-[#E7E5E4]">{doctors.map((item, index) => {
                  const active = doctor?.id === item.id;
                  const initials = item.name.split(' ').slice(-1)[0].slice(0, 1);
                  return <button key={item.id} onClick={() => { setDoctor(item); setOpenStep(3); }} className={`flex w-full items-center py-3 text-left transition duration-150 ${active ? 'bg-[#F4F7F5]' : 'hover:bg-[#FAFAF9]'}`}><div className="grid h-11 w-11 place-items-center border border-[#D6D3D1] font-mono text-sm font-bold text-[#57534E]">{initials}</div><div className="ml-3 flex-1"><p className="text-sm font-bold">ThS. BS. {item.name}</p><p className="mt-1 text-xs text-[#57534E]">{item.specialty} · Phòng {item.roomName.replace(/[^0-9]/g, '') || '204'}</p></div><p className="font-mono text-[11px] font-semibold tabular-nums text-[#14362B]">Còn {4 - (index % 3)} suất</p>{active && <Check className="ml-3 text-[#14362B]" size={16} />}</button>;
                })}</div>
              </BookingStep>

              <BookingStep number="03" title="Khung giờ" open={openStep === 3} onToggle={() => setOpenStep(openStep === 3 ? 0 : 3)}>
                <SlotGroup label="Sáng" slots={morning} selectedSlot={selectedSlot} setSelectedSlot={(slot) => { setSelectedSlot(slot); setOpenStep(4); }} />
                <SlotGroup label="Chiều" slots={afternoon} selectedSlot={selectedSlot} setSelectedSlot={(slot) => { setSelectedSlot(slot); setOpenStep(4); }} />
              </BookingStep>

              <BookingStep number="04" title="Thông tin người bệnh" open={openStep === 4} onToggle={() => setOpenStep(openStep === 4 ? 0 : 4)}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Họ và tên" value={patient.name} onChange={value => setPatient({ ...patient, name: value })} placeholder="Nguyễn Thu Hà" />
                  <Field label="Số điện thoại" value={patient.phone} onChange={value => setPatient({ ...patient, phone: value })} placeholder="0908 123 456" />
                  <Field label="Năm sinh" value={patient.birthYear} onChange={value => setPatient({ ...patient, birthYear: value })} placeholder="1996" />
                  <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wider text-[#57534E]">Lý do khám</span><input value={patient.reason} onChange={event => setPatient({ ...patient, reason: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-[#D6D3D1] bg-white px-3 text-sm outline-none focus:border-[#14362B]" placeholder="Chẩn đoán ban đầu hoặc triệu chứng" /></label>
                </div>
              </BookingStep>
            </div>

            <TicketSummary department={department} doctor={doctor} slot={selectedSlot} patient={patient} ticket={ticket} submitting={submitting} onSubmit={submitBooking} onReset={() => setTicket(null)} />
          </div>
        </main>
      )}
    </div>
  );
}

function BookingStep({ number, title, open, onToggle, children }: { number:string; title:string; open:boolean; onToggle:()=>void; children:React.ReactNode }) {
  return <section className="bg-white"><button onClick={onToggle} className="flex h-16 w-full items-center text-left"><span className="w-12 font-mono text-xs font-bold tabular-nums text-[#A8A29E]">{number}</span><h2 className="text-sm font-bold">{title}</h2><ChevronDown className={`ml-auto mr-1 text-[#57534E] transition duration-150 ${open ? 'rotate-180' : ''}`} size={17} /></button>{open && <div className="pb-6 pl-12 pr-1">{children}</div>}</section>;
}

function SlotGroup({ label, slots, selectedSlot, setSelectedSlot }: { label:string; slots:DoctorSlot[]; selectedSlot:TimeSlot|null; setSelectedSlot:(slot:TimeSlot)=>void }) {
  return <div className="mb-5 last:mb-0"><p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#57534E]">{label}</p>{slots.length ? <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">{slots.map(slot => { const unavailable = slot.availableCount <= 0; const active = selectedSlot?.id === slot.id; return <button key={slot.id} disabled={unavailable} onClick={() => setSelectedSlot(slot)} className={`h-10 rounded-md border font-mono text-xs font-semibold tabular-nums transition duration-150 ${unavailable ? 'border-transparent text-[#A8A29E] line-through' : active ? 'border-[1.5px] border-[#14362B] bg-[#F4F7F5] text-[#14362B]' : 'border-[#E7E5E4] bg-white text-[#57534E] hover:border-[#14362B]'}`}>{formatTime(slot.startTime)}</button>; })}</div> : <p className="text-xs text-[#A8A29E]">Chưa có khung giờ</p>}</div>;
}

function Field({ label, value, onChange, placeholder }: { label:string; value:string; onChange:(value:string)=>void; placeholder:string }) {
  return <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wider text-[#57534E]">{label}</span><input value={value} onChange={event => onChange(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-[#D6D3D1] bg-white px-3 text-sm outline-none focus:border-[#14362B]" placeholder={placeholder} /></label>;
}

function TicketSummary({ department, doctor, slot, patient, ticket, submitting, onSubmit, onReset }: { department:Department; doctor:Doctor|null; slot:TimeSlot|null; patient:{name:string}; ticket:QueueTicket|null; submitting:boolean; onSubmit:()=>void; onReset:()=>void }) {
  return <aside className="sticky top-6 h-fit border border-[#E7E5E4] bg-white transition-all duration-150">
    {ticket ? <IssuedTicket ticket={ticket} onReset={onReset} /> : <>
      <div className="p-5"><p className="text-[11px] font-semibold uppercase tracking-wider text-[#A8A29E]">Phiếu khám dự kiến</p><h2 className="mt-2 text-xl font-bold tracking-tight">{department.name}</h2></div>
      <div className="border-t border-dashed border-[#D6D3D1] px-5 py-4"><SummaryLine label="Bác sĩ" value={doctor ? `ThS. BS. ${doctor.name}` : 'Chưa chọn'} /><SummaryLine label="Ngày" value={slot ? formatDate(slot.startTime) : 'Chưa chọn'} /><SummaryLine label="Giờ" value={slot ? formatTime(slot.startTime) : 'Chưa chọn'} /><SummaryLine label="Người bệnh" value={patient.name || 'Chưa nhập'} /></div>
      <div className="flex items-end justify-between border-t border-dashed border-[#D6D3D1] px-5 py-5"><span className="text-[11px] font-semibold uppercase tracking-wider text-[#57534E]">Phí khám</span><strong className="font-mono text-lg font-bold tabular-nums">{money(department.fee)}</strong></div>
      <div className="p-5 pt-0"><button disabled={!doctor || !slot || !patient.name.trim() || submitting} onClick={onSubmit} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#14362B] text-sm font-semibold text-white transition duration-150 disabled:cursor-not-allowed disabled:bg-[#D6D3D1]">{submitting ? 'Đang xử lý...' : 'Xác nhận & Cấp số thứ tự'}{!submitting && <ArrowRight size={16} />}</button></div>
    </>}
  </aside>;
}

function SummaryLine({ label, value }: { label:string; value:string }) { return <div className="flex justify-between gap-4 py-2 text-sm"><span className="text-[#57534E]">{label}</span><strong className="text-right font-semibold">{value}</strong></div>; }

function IssuedTicket({ ticket, onReset }: { ticket:QueueTicket; onReset:()=>void }) {
  return <div className="p-5"><div className="flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-wider text-[#57534E]">Phiếu số thứ tự điện tử</p><span className="h-2 w-2 rounded-full bg-emerald-500"></span></div><div className="mt-5 border-b border-dashed border-[#D6D3D1] pb-5"><p className="text-[11px] font-semibold uppercase tracking-wider text-[#A8A29E]">Số thứ tự</p><p className="mt-2 font-mono text-5xl font-bold tracking-tight tabular-nums text-[#14362B]">{ticket.code}</p></div><div className="grid grid-cols-2 gap-4 border-b border-dashed border-[#D6D3D1] py-5"><div><p className="text-[11px] text-[#A8A29E]">Phòng khám</p><p className="mt-1 text-sm font-bold">P.{ticket.room.replace(/[^0-9]/g, '') || '204'} — {ticket.floor}</p></div><div><p className="text-[11px] text-[#A8A29E]">Thời gian chờ</p><p className="mt-1 font-mono text-sm font-bold tabular-nums">~{ticket.estimatedWaitMinutes} phút</p></div></div><div className="py-5"><p className="text-[11px] text-[#A8A29E]">Tiến trình hàng đợi</p><p className="mt-2 text-sm"><span className="text-[#57534E]">Đang gọi:</span> <strong className="font-mono tabular-nums">{ticket.currentServing}</strong></p><p className="mt-1 text-sm text-[#C2410C]">Còn {ticket.peopleAhead} lượt trước bạn</p><div className="mt-4 h-1.5 bg-[#E7E5E4]"><div className="h-full w-[38%] bg-[#14362B]"></div></div></div><div className="mx-auto flex h-12 items-center justify-center border-y border-[#E7E5E4]" aria-label="Mã vạch phiếu khám"><div className="flex h-7 items-end gap-[3px]">{Array.from({ length: 24 }).map((_, index) => <span key={index} className="w-px bg-[#1C1917]" style={{ height: `${12 + (index * 7 % 16)}px` }} />)}</div></div><button onClick={onReset} className="mt-5 h-10 w-full rounded-md border border-[#D6D3D1] text-xs font-semibold text-[#57534E]">Lưu phiếu / Quay lại</button></div>;
}
