import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowLeft, ArrowRight, Bell, CalendarDays, Check, ChevronDown,
  CircleUserRound, Clock3, HeartPulse, Microscope, Search, ShieldCheck,
  Stethoscope, Syringe, UserRound, UsersRound, X
} from 'lucide-react';
import type { AppointmentRequest, AppointmentResponse, Doctor, DoctorSlot } from './types';

const departments = [
  { id: 'general', name: 'Nội tổng quát', icon: Stethoscope, duration: 20, fee: '150.000đ', detail: 'Khám và tư vấn sức khỏe tổng thể' },
  { id: 'pediatrics', name: 'Nhi khoa', icon: UsersRound, duration: 20, fee: '180.000đ', detail: 'Sức khỏe trẻ em và tiêm chủng' },
  { id: 'ent', name: 'Tai Mũi Họng', icon: Activity, duration: 15, fee: '200.000đ', detail: 'Tai, mũi, họng và thính giác' },
  { id: 'dental', name: 'Răng Hàm Mặt', icon: ShieldCheck, duration: 30, fee: '250.000đ', detail: 'Nha khoa và chăm sóc răng miệng' },
  { id: 'derma', name: 'Da liễu', icon: HeartPulse, duration: 20, fee: '220.000đ', detail: 'Da, móng và các bệnh ngoài da' },
  { id: 'lab', name: 'Xét nghiệm', icon: Microscope, duration: 10, fee: '100.000đ', detail: 'Xét nghiệm cận lâm sàng' }
];

const mockDoctors = [
  { experience: '12 năm kinh nghiệm', rating: '4.9', accent: 'bg-teal-100 text-teal-700' },
  { experience: '9 năm kinh nghiệm', rating: '4.8', accent: 'bg-sky-100 text-sky-700' }
];

const formatTime = (value: string) => new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(new Date(value));

export default function App() {
  const [mode, setMode] = useState<'patient' | 'reception' | 'doctor'>('patient');
  const [page, setPage] = useState<'book' | 'track'>('book');
  const [step, setStep] = useState(1);
  const [department, setDepartment] = useState(departments[0]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [slots, setSlots] = useState<DoctorSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<DoctorSlot | null>(null);
  const [patient, setPatient] = useState({ name: '', phone: '', dob: '', gender: '', symptoms: '' });
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState<AppointmentResponse | null>(null);
  const [lookupId, setLookupId] = useState('');
  const [lookupResult, setLookupResult] = useState<AppointmentResponse | null>(null);

  useEffect(() => {
    fetch('/api/doctors').then(r => r.json()).then((items: Doctor[]) => {
      setDoctors(items);
      setDoctor(items[0] ?? null);
    }).catch(() => setDoctors([]));
  }, []);

  useEffect(() => {
    if (!doctor) return;
    fetch(`/api/doctors/${doctor.id}/slots`).then(r => r.json()).then((items: DoctorSlot[]) => {
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
  const morningSlots = dateSlots.filter(slot => new Date(slot.startTime).getHours() < 12);
  const afternoonSlots = dateSlots.filter(slot => new Date(slot.startTime).getHours() >= 12);

  const canContinue = step === 1 ? true : step === 2 ? Boolean(doctor) : step === 3 ? Boolean(selectedSlot) : Boolean(patient.name && patient.phone);

  async function confirmBooking() {
    if (!doctor || !selectedSlot) return;
    setSubmitting(true);
    const request: AppointmentRequest = {
      patientName: patient.name,
      patientPhone: patient.phone,
      doctorId: doctor.id,
      timeSlotId: selectedSlot.id
    };
    try {
      const response = await fetch('/api/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
      if (!response.ok) throw new Error('Không thể tạo lịch hẹn');
      const result: AppointmentResponse = await response.json();
      setTicket(result);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Đã có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  }

  async function lookupAppointment() {
    if (!lookupId.trim()) return;
    try {
      const response = await fetch(`/api/appointments/${lookupId.trim()}`);
      if (!response.ok) throw new Error('Không tìm thấy lịch hẹn');
      setLookupResult(await response.json());
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không tìm thấy lịch hẹn');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center px-4 lg:px-8">
          <button onClick={() => setPage('book')} className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-600 text-white shadow-sm"><HeartPulse size={21} /></div>
            <div className="text-left"><p className="text-[17px] font-bold tracking-tight">ClinicQueue</p><p className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 sm:block">Healthcare center</p></div>
          </button>
          <nav className="ml-10 hidden items-center gap-1 md:flex">
            <button onClick={() => setPage('book')} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${page === 'book' ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:text-slate-900'}`}>Đặt lịch khám</button>
            <button onClick={() => setPage('track')} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${page === 'track' ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:text-slate-900'}`}>Tra cứu số thứ tự</button>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button className="hidden h-10 w-10 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:border-teal-200 hover:text-teal-700 sm:grid"><Bell size={18} /></button>
            <div className="relative hidden sm:block">
              <select value={mode} onChange={e => setMode(e.target.value as typeof mode)} className="h-10 appearance-none rounded-full border border-slate-200 bg-white pl-4 pr-9 text-sm font-semibold text-slate-700 outline-none focus:border-teal-500">
                <option value="patient">Bệnh nhân</option><option value="reception">Lễ tân</option><option value="doctor">Bác sĩ</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 text-slate-400" size={16} />
            </div>
          </div>
        </div>
      </header>

      {page === 'book' ? (
        <main className="mx-auto max-w-[1440px] px-4 py-6 lg:px-8 lg:py-8">
          <div className="mb-6 flex items-end justify-between">
            <div><p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-teal-600">Đặt lịch trực tuyến</p><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Chọn lịch khám phù hợp</h1></div>
            <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-500"></span>Hệ thống đang hoạt động</div>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_370px]">
            <div className="min-w-0">
              <Stepper step={step} setStep={setStep} />
              <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-6">
                {step === 1 && <DepartmentStep department={department} setDepartment={setDepartment} />}
                {step === 2 && <DoctorStep doctors={doctors} doctor={doctor} setDoctor={setDoctor} dates={dates} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />}
                {step === 3 && <SlotStep morning={morningSlots} afternoon={afternoonSlots} selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot} />}
                {step === 4 && <PatientStep patient={patient} setPatient={setPatient} />}

                <div className="mt-7 flex justify-between border-t border-slate-100 pt-5">
                  <button disabled={step === 1} onClick={() => setStep(v => v - 1)} className="flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold text-slate-500 disabled:opacity-30"><ArrowLeft size={17} />Quay lại</button>
                  {step < 4 ? <button disabled={!canContinue} onClick={() => setStep(v => v + 1)} className="flex h-11 items-center gap-2 rounded-xl bg-teal-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-200">Tiếp tục<ArrowRight size={17} /></button> : null}
                </div>
              </section>
            </div>

            <SummaryCard department={department} doctor={doctor} date={selectedDate} slot={selectedSlot} step={step} submitting={submitting} onConfirm={() => { if (step < 4) setStep(4); else confirmBooking(); }} />
          </div>
        </main>
      ) : <TrackPage lookupId={lookupId} setLookupId={setLookupId} lookup={lookupAppointment} result={lookupResult} />}

      {page === 'book' && <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,.08)] lg:hidden"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Phí khám dự kiến</p><strong className="text-base tabular-nums text-teal-700">{department.fee}</strong></div><button onClick={() => { if (step < 4) setStep(4); else confirmBooking(); }} disabled={submitting} className="h-11 rounded-xl bg-teal-600 px-5 text-sm font-bold text-white">{submitting ? 'Đang xử lý...' : 'Xác nhận & lấy số'}</button></div>}

      {ticket && <TicketModal ticket={ticket} onClose={() => setTicket(null)} />}
    </div>
  );
}

function Stepper({ step, setStep }: { step: number; setStep: (value: number) => void }) {
  const items = ['Chuyên khoa', 'Bác sĩ & ngày', 'Khung giờ', 'Thông tin'];
  return <div className="grid grid-cols-4 rounded-2xl border border-slate-200 bg-white px-2 py-3 shadow-soft sm:px-5">
    {items.map((item, index) => {
      const number = index + 1;
      return <button key={item} onClick={() => number < step && setStep(number)} className="group flex min-w-0 items-center gap-2 text-left">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition ${number < step ? 'bg-teal-600 text-white' : number === step ? 'border-2 border-teal-600 bg-white text-teal-700' : 'border border-slate-200 bg-slate-50 text-slate-400'}`}>{number < step ? <Check size={15} /> : number}</span>
        <span className={`hidden text-xs font-bold sm:block ${number === step ? 'text-slate-900' : 'text-slate-400'}`}>{item}</span>
      </button>;
    })}
  </div>;
}

function DepartmentStep({ department, setDepartment }: { department: typeof departments[number]; setDepartment: (value: typeof departments[number]) => void }) {
  return <div><SectionTitle eyebrow="Bước 1" title="Chọn chuyên khoa & dịch vụ" subtitle="Chọn lĩnh vực khám để chúng tôi đề xuất bác sĩ phù hợp." />
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{departments.map(item => { const Icon = item.icon; const active = department.id === item.id; return <button key={item.id} onClick={() => setDepartment(item)} className={`relative min-h-[148px] rounded-xl border p-4 text-left transition duration-200 ${active ? 'border-teal-500 bg-teal-50/50 shadow-[0_0_0_3px_rgba(13,148,136,.08)]' : 'border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md'}`}>
      {active && <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-teal-600 text-white"><Check size={12} /></span>}<div className={`mb-4 grid h-10 w-10 place-items-center rounded-lg ${active ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}><Icon size={19} /></div><h3 className="font-bold text-slate-900">{item.name}</h3><p className="mt-1 min-h-[32px] text-xs leading-4 text-slate-500">{item.detail}</p><div className="mt-3 flex items-center justify-between text-xs"><span className="flex items-center gap-1 text-slate-500"><Clock3 size={13} />~{item.duration} phút</span><strong className="text-teal-700 tabular-nums">{item.fee}</strong></div>
    </button>; })}</div>
  </div>;
}

function SectionTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) { return <div><p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-teal-600">{eyebrow}</p><h2 className="text-xl font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>; }

function DoctorStep({ doctors, doctor, setDoctor, dates, selectedDate, setSelectedDate }: { doctors: Doctor[]; doctor: Doctor | null; setDoctor: (doctor: Doctor) => void; dates: Date[]; selectedDate: string; setSelectedDate: (date: string) => void }) {
  return <div><SectionTitle eyebrow="Bước 2" title="Chọn bác sĩ & ngày khám" subtitle="Chọn ngày và bác sĩ còn lịch trống." />
    <div className="mt-5 overflow-x-auto pb-2"><div className="flex min-w-max gap-2">{dates.map((date, index) => { const value = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; const active = selectedDate === value || (!selectedDate && index === 0); return <button key={value} onClick={() => setSelectedDate(value)} className={`w-[76px] rounded-xl border px-2 py-3 text-center transition ${active ? 'border-teal-600 bg-teal-600 text-white shadow-md' : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300'}`}><span className="block text-[11px] font-bold uppercase">{new Intl.DateTimeFormat('vi-VN',{weekday:'short'}).format(date)}</span><strong className="mt-1 block text-lg tabular-nums">{date.getDate()}</strong><span className="mt-1 block text-[10px]">Tháng {date.getMonth()+1}</span></button>; })}</div></div>
    <div className="mt-5 grid gap-3 md:grid-cols-2">{doctors.map((item, index) => { const active = doctor?.id === item.id; const mock = mockDoctors[index % mockDoctors.length]; return <button key={item.id} onClick={() => setDoctor(item)} className={`flex items-center gap-4 rounded-xl border p-4 text-left transition ${active ? 'border-teal-500 bg-teal-50/40 shadow-[0_0_0_3px_rgba(13,148,136,.06)]' : 'border-slate-200 hover:border-slate-300'}`}><div className={`grid h-14 w-14 shrink-0 place-items-center rounded-full text-lg font-bold ${mock.accent}`}>{item.name.split(' ').slice(-1)[0].slice(0,1)}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between"><h3 className="truncate text-sm font-bold">BS. {item.name}</h3>{active && <span className="grid h-5 w-5 place-items-center rounded-full bg-teal-600 text-white"><Check size={12} /></span>}</div><p className="mt-1 text-xs text-slate-500">{item.specialty}</p><div className="mt-2 flex gap-2 text-[11px]"><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{mock.experience}</span><span className="rounded-full bg-amber-50 px-2 py-1 font-bold text-amber-700">★ {mock.rating}</span></div></div></button>; })}</div>
  </div>;
}

function SlotStep({ morning, afternoon, selectedSlot, setSelectedSlot }: { morning: DoctorSlot[]; afternoon: DoctorSlot[]; selectedSlot: DoctorSlot | null; setSelectedSlot: (slot: DoctorSlot) => void }) {
  const renderSlots = (slots: DoctorSlot[]) => slots.length ? <div className="flex flex-wrap gap-2">{slots.map(slot => { const active = selectedSlot?.id === slot.id; const disabled = slot.availableCount <= 0; return <button key={slot.id} disabled={disabled} onClick={() => setSelectedSlot(slot)} className={`h-11 min-w-[92px] rounded-xl border px-3 text-sm font-bold tabular-nums transition ${disabled ? 'cursor-not-allowed border-slate-100 bg-slate-100 text-slate-300 line-through' : active ? 'border-teal-600 bg-teal-50 text-teal-700 shadow-[0_0_0_3px_rgba(13,148,136,.08)]' : 'border-slate-200 bg-white text-slate-700 hover:border-teal-400'}`}>{formatTime(slot.startTime)}</button>; })}</div> : <p className="rounded-xl border border-dashed border-slate-200 py-5 text-center text-sm text-slate-400">Không còn khung giờ trống</p>;
  return <div><SectionTitle eyebrow="Bước 3" title="Chọn khung giờ khám" subtitle="Các khung màu nhạt đã được đặt hoặc hết chỗ." /><div className="mt-6 space-y-6"><div><div className="mb-3 flex items-center gap-2 text-sm font-bold"><span className="h-2 w-2 rounded-full bg-amber-400"></span>Buổi sáng</div>{renderSlots(morning)}</div><div><div className="mb-3 flex items-center gap-2 text-sm font-bold"><span className="h-2 w-2 rounded-full bg-sky-500"></span>Buổi chiều</div>{renderSlots(afternoon)}</div></div></div>;
}

function PatientStep({ patient, setPatient }: { patient: { name:string;phone:string;dob:string;gender:string;symptoms:string }; setPatient: (value: typeof patient) => void }) {
  const update = (field: keyof typeof patient, value: string) => setPatient({ ...patient, [field]: value });
  return <div><SectionTitle eyebrow="Bước 4" title="Thông tin bệnh nhân" subtitle="Thông tin này được dùng để xác nhận lịch khám và liên hệ khi cần." /><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700">Họ và tên<input value={patient.name} onChange={e => update('name', e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 font-normal outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-50" placeholder="Nguyễn Minh Anh" /></label><label className="text-sm font-bold text-slate-700">Số điện thoại<input value={patient.phone} onChange={e => update('phone', e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 font-normal outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-50" placeholder="0908 888 766" /></label><label className="text-sm font-bold text-slate-700">Ngày sinh<input type="date" value={patient.dob} onChange={e => update('dob', e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 font-normal outline-none focus:border-teal-500" /></label><label className="text-sm font-bold text-slate-700">Giới tính<select value={patient.gender} onChange={e => update('gender', e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none focus:border-teal-500"><option value="">Chọn giới tính</option><option>Nam</option><option>Nữ</option><option>Khác</option></select></label><label className="text-sm font-bold text-slate-700 sm:col-span-2">Triệu chứng / ghi chú<textarea value={patient.symptoms} onChange={e => update('symptoms', e.target.value)} rows={4} className="mt-2 w-full resize-none rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-50" placeholder="Mô tả ngắn gọn triệu chứng hoặc yêu cầu hỗ trợ..." /></label></div></div>;
}

function SummaryCard({ department, doctor, date, slot, step, submitting, onConfirm }: { department: typeof departments[number]; doctor: Doctor | null; date: string; slot: DoctorSlot | null; step: number; submitting: boolean; onConfirm: () => void }) {
  return <aside className="sticky top-[92px] hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-soft lg:block"><p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-600">Tóm tắt đặt lịch</p><h2 className="mt-1 text-xl font-bold">Phiếu khám</h2><div className="mt-5 space-y-4"><SummaryLine label="Chuyên khoa" value={department.name} /><SummaryLine label="Bác sĩ" value={doctor ? `BS. ${doctor.name}` : 'Chưa chọn'} /><SummaryLine label="Ngày khám" value={date ? formatDate(date) : 'Chưa chọn'} /><SummaryLine label="Giờ khám" value={slot ? formatTime(slot.startTime) : 'Chưa chọn'} /></div><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-sm text-slate-500">Phí khám dự kiến</span><strong className="text-lg tabular-nums text-teal-700">{department.fee}</strong></div><button onClick={onConfirm} disabled={submitting} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-wait disabled:bg-teal-400">{submitting ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>Đang xử lý...</> : step < 4 ? 'Xác nhận đặt lịch & lấy số' : 'Xác nhận đặt lịch & lấy số'}</button><p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-slate-400"><ShieldCheck size={13} />Thông tin được bảo mật</p></aside>;
}

function SummaryLine({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3"><span className="text-xs text-slate-500">{label}</span><strong className="max-w-[170px] text-right text-sm text-slate-800">{value}</strong></div>; }

function TrackPage({ lookupId, setLookupId, lookup, result }: { lookupId: string; setLookupId: (value:string)=>void; lookup:()=>void; result: AppointmentResponse|null }) {
  return <main className="mx-auto max-w-3xl px-4 py-10"><SectionTitle eyebrow="Theo dõi trực tuyến" title="Tra cứu số thứ tự" subtitle="Nhập mã lịch hẹn để xem tình trạng và số đang khám." /><div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"><div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-3.5 text-slate-400" size={18} /><input value={lookupId} onChange={e => setLookupId(e.target.value)} onKeyDown={e => e.key === 'Enter' && lookup()} className="h-12 w-full rounded-xl border border-slate-200 pl-10 pr-3 outline-none focus:border-teal-500" placeholder="Nhập mã lịch hẹn (UUID)" /></div><button onClick={lookup} className="h-12 rounded-xl bg-teal-600 px-5 text-sm font-bold text-white">Tra cứu</button></div>{result && <div className="mt-5 border-t border-slate-100 pt-5"><p className="text-sm text-slate-500">Bạn đang đứng ở số</p><div className="mt-1 flex items-end justify-between"><strong className="text-5xl tabular-nums text-teal-700">A-{String(result.queueNumber ?? 0).padStart(3,'0')}</strong><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Đang chờ</span></div><div className="mt-5 h-2 rounded-full bg-slate-100"><div className="h-full w-2/5 rounded-full bg-teal-500"></div></div><p className="mt-2 text-xs text-slate-500">Số đang khám hiện tại: <strong>A-038</strong></p></div>}</div></main>;
}

function TicketModal({ ticket, onClose }: { ticket: AppointmentResponse; onClose: () => void }) {
  const code = `A-${String(ticket.queueNumber ?? 42).padStart(3,'0')}`;
  return <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-4"><div className="w-full max-w-md rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-600">Đặt lịch thành công</p><h2 className="mt-1 text-lg font-bold">Phiếu khám điện tử</h2></div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500"><X size={18} /></button></div><div className="p-5"><div className="relative overflow-hidden rounded-2xl bg-teal-700 p-5 text-white"><div className="absolute -right-12 -top-12 h-32 w-32 rounded-full border-[24px] border-white/5"></div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-100">Số thứ tự của bạn</p><div className="mt-2 flex items-end justify-between"><strong className="text-6xl font-bold tabular-nums tracking-tight">{code}</strong><div className="grid h-16 w-16 place-items-center rounded-lg border-4 border-white bg-white text-slate-900"><div className="grid h-10 w-10 grid-cols-4 gap-[2px]">{Array.from({length:16}).map((_,i)=><span key={i} className={`${(i*7)%5===0?'bg-slate-900':'bg-slate-300'} rounded-[1px]`}></span>)}</div></div></div></div><div className="mt-4 grid grid-cols-2 gap-3"><TicketInfo label="Phòng khám" value={ticket.roomName} /><TicketInfo label="Thời gian chờ" value="~15 phút" /><TicketInfo label="Bác sĩ" value={ticket.doctorName} /><TicketInfo label="Giờ khám" value={formatTime(ticket.startTime)} /></div><div className="mt-5 rounded-xl bg-slate-50 p-4"><div className="flex justify-between text-xs"><span className="text-slate-500">Tiến trình hàng đợi</span><strong className="text-teal-700">A-038 đang khám</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full w-[72%] rounded-full bg-teal-500"></div></div></div><button onClick={onClose} className="mt-5 h-12 w-full rounded-xl border border-teal-200 text-sm font-bold text-teal-700">Hoàn tất</button></div></div></div>;
}

function TicketInfo({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-100 p-3"><p className="text-[11px] text-slate-400">{label}</p><strong className="mt-1 block text-sm text-slate-800">{value}</strong></div>; }
