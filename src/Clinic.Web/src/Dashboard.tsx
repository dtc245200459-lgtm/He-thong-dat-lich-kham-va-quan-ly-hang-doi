import { useMemo, useState } from 'react';
import {
  Activity, BarChart3, Bell, CalendarDays, Check, ChevronDown, CircleUserRound,
  Clock3, LayoutDashboard, Menu, Monitor, MoreHorizontal, Plus, Search, Settings,
  Stethoscope, TestTube2, Trash2, UserPlus, Users, Volume2, VolumeX, X
} from 'lucide-react';
import type { QueueItem, QueueStatus, RoomState } from './types';

const initialQueue: QueueItem[] = [
  { id: '1', ticket: 'A-038', name: 'Nguyễn Thị Mai', age: 34, gender: 'Nữ', phone: '0901 234 567', type: 'Đã hẹn trước', appointmentTime: '08:30', waitedMinutes: 28, status: 'in-consultation', priority: true, symptoms: 'Đau bụng trên, buồn nôn 2 ngày', bookingTime: '08:15' },
  { id: '2', ticket: 'A-039', name: 'Trần Văn Long', age: 51, gender: 'Nam', phone: '0912 667 120', type: 'Đã hẹn trước', appointmentTime: '08:45', waitedMinutes: 18, status: 'waiting', priority: false, symptoms: 'Tăng huyết áp, chóng mặt', bookingTime: '08:32' },
  { id: '3', ticket: 'A-040', name: 'Phạm Thu Hà', age: 29, gender: 'Nữ', phone: '0938 420 111', type: 'Ưu tiên', appointmentTime: '09:00', waitedMinutes: 15, status: 'priority', priority: true, symptoms: 'Khó thở nhẹ, đau ngực', bookingTime: '08:40' },
  { id: '4', ticket: 'A-041', name: 'Lê Minh Quân', age: 42, gender: 'Nam', phone: '0977 301 228', type: 'Walk-in', appointmentTime: '09:10', waitedMinutes: 11, status: 'waiting', priority: false, symptoms: 'Đau lưng khi ngồi lâu', bookingTime: '08:55' },
  { id: '5', ticket: 'A-042', name: 'Vũ Hồng Anh', age: 25, gender: 'Nữ', phone: '0908 554 932', type: 'Đã hẹn trước', appointmentTime: '09:20', waitedMinutes: 8, status: 'waiting', priority: false, symptoms: 'Mệt mỏi, mất ngủ', bookingTime: '09:05' },
  { id: '6', ticket: 'A-043', name: 'Đỗ Gia Bảo', age: 67, gender: 'Nam', phone: '0981 882 006', type: 'Walk-in', appointmentTime: '09:30', waitedMinutes: 6, status: 'waiting', priority: false, symptoms: 'Đau khớp gối', bookingTime: '09:18' }
];

const statusStyles: Record<QueueStatus, string> = {
  waiting: 'border-amber-200 bg-amber-50 text-amber-700',
  priority: 'border-red-200 bg-red-50 text-red-700',
  'in-consultation': 'border-blue-200 bg-blue-50 text-blue-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'no-show': 'border-slate-200 bg-slate-100 text-slate-500',
  checkedin: 'border-sky-200 bg-sky-50 text-sky-700'
};

const statusLabels: Record<QueueStatus, string> = {
  waiting: 'Đang chờ', priority: 'Ưu tiên', 'in-consultation': 'Đang khám', completed: 'Hoàn thành', 'no-show': 'Vắng mặt', checkedin: 'Đã tiếp nhận'
};

export default function Dashboard() {
  const [collapsed, setCollapsed] = useState(false);
  const [section, setSection] = useState<'queue' | 'appointments' | 'analytics'>('queue');
  const [queue, setQueue] = useState(initialQueue);
  const [room, setRoom] = useState<RoomState>({ id: '01', name: 'Phòng khám Nội 01', doctor: 'BS. Nguyễn Văn An', currentTicket: 'A-038' });
  const [filter, setFilter] = useState<'all' | 'waiting' | 'priority' | 'online' | 'walkin'>('all');
  const [search, setSearch] = useState('');
  const [showTV, setShowTV] = useState(false);
  const [showWalkin, setShowWalkin] = useState(false);

  const current = queue.find(item => item.status === 'in-consultation') ?? queue.find(item => item.ticket === room.currentTicket);
  const waitingCount = queue.filter(item => item.status === 'waiting' || item.status === 'priority').length;
  const completedCount = queue.filter(item => item.status === 'completed').length;
  const priorityCount = queue.filter(item => item.status === 'priority').length;

  const filteredQueue = useMemo(() => queue.filter(item => {
    const matchesFilter = filter === 'all' || (filter === 'waiting' && (item.status === 'waiting' || item.status === 'checkedin')) || (filter === 'priority' && item.priority) || (filter === 'online' && item.type === 'Đã hẹn trước') || (filter === 'walkin' && item.type === 'Walk-in');
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || item.ticket.toLowerCase().includes(term) || item.name.toLowerCase().includes(term) || item.phone.includes(term);
    return matchesFilter && matchesSearch;
  }), [queue, filter, search]);

  function callNext() {
    setQueue(items => {
      const next = [...items];
      const currentIndex = next.findIndex(item => item.status === 'in-consultation');
      if (currentIndex >= 0) next[currentIndex] = { ...next[currentIndex], status: 'completed' };
      const nextIndex = next.findIndex(item => item.status === 'waiting' || item.status === 'priority' || item.status === 'checkedin');
      if (nextIndex >= 0) {
        next[nextIndex] = { ...next[nextIndex], status: 'in-consultation' };
        setRoom(old => ({ ...old, currentTicket: next[nextIndex].ticket }));
      }
      return next;
    });
  }

  function completeCurrent() {
    if (!current) return;
    setQueue(items => items.map(item => item.id === current.id ? { ...item, status: 'completed' } : item));
  }

  function markNoShow() {
    if (!current) return;
    setQueue(items => items.map(item => item.id === current.id ? { ...item, status: 'no-show' } : item));
  }

  function setPriority(id: string) {
    setQueue(items => items.map(item => item.id === id ? { ...item, priority: true, status: 'priority', type: 'Ưu tiên' } : item));
  }

  function cancelItem(id: string) {
    setQueue(items => items.map(item => item.id === id ? { ...item, status: 'no-show' } : item));
  }

  function checkIn(id: string) {
    setQueue(items => items.map(item => item.id === id ? { ...item, status: 'checkedin', waitedMinutes: 0 } : item));
  }

  function addWalkin(name: string, phone: string) {
    const ticket = `A-${Math.floor(44 + queue.length).toString().padStart(3, '0')}`;
    setQueue(items => [...items, { id: crypto.randomUUID(), ticket, name, phone, age: 0, gender: 'Chưa rõ', type: 'Walk-in', appointmentTime: 'Đăng ký tại quầy', waitedMinutes: 0, status: 'checkedin', priority: false, symptoms: 'Tiếp nhận mới', bookingTime: 'Vừa xong' }]);
    setShowWalkin(false);
  }

  function handleNav(id: 'queue' | 'appointments' | 'tv' | 'analytics') {
    if (id === 'tv') {
      setShowTV(true);
    } else {
      setSection(id);
    }
  }

  const navItems = [
    { id: 'queue' as const, label: 'Bảng điều khiển', icon: LayoutDashboard },
    { id: 'appointments' as const, label: 'Lịch hẹn hôm nay', icon: CalendarDays },
    { id: 'tv' as const, label: 'Màn hình sảnh chờ', icon: Monitor },
    { id: 'analytics' as const, label: 'Thống kê', icon: BarChart3 }
  ];

  return <div className="min-h-screen bg-slate-100 text-slate-900">
    <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-slate-950 text-white transition-all duration-300 ${collapsed ? 'w-[76px]' : 'w-[260px]'}`}>
      <div className="flex h-[72px] items-center border-b border-slate-800 px-5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-teal-500"><Stethoscope size={19} /></div>
        {!collapsed && <div className="ml-3"><p className="font-bold tracking-tight">ClinicQueue</p><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-400">Pro Console</p></div>}
        <button onClick={() => setCollapsed(v => !v)} className="ml-auto grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-slate-800" aria-label="Thu gọn menu"><Menu size={18} /></button>
      </div>

      {!collapsed && <div className="p-4"><label className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Phòng làm việc</label><div className="relative mt-2"><select className="h-12 w-full appearance-none rounded-lg border border-slate-700 bg-slate-900 px-3 pr-8 text-xs font-semibold outline-none"><option>{room.name} - {room.doctor}</option></select><ChevronDown className="pointer-events-none absolute right-3 top-4 text-slate-500" size={15} /></div></div>}

      <nav className="mt-1 flex-1 space-y-1 px-3">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = item.id === 'tv' ? showTV : section === item.id;
          return (
            <button key={item.id} title={collapsed ? item.label : undefined} onClick={() => handleNav(item.id)} className="flex h-11 w-full items-center rounded-lg px-3 text-sm font-semibold transition">
              <Icon size={18} />
              <span className={collapsed ? 'hidden' : 'ml-3'}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3">
        <button className={`flex h-11 w-full items-center rounded-lg px-3 text-sm text-slate-400 hover:bg-slate-900 ${collapsed ? 'justify-center' : ''}`}>
          <Settings size={18} />
          <span className={collapsed ? 'hidden' : 'ml-3'}>Cài đặt</span>
        </button>
      </div>
    </aside>

    <main className={`min-h-screen transition-all ${collapsed ? 'ml-[76px]' : 'ml-[260px]'}`}>
      <header className="sticky top-0 z-30 flex h-[72px] items-center border-b border-slate-200 bg-white px-5 lg:px-7">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-teal-600">Bảng điều khiển thời gian thực</p><h1 className="mt-0.5 text-xl font-bold text-slate-900">{section === 'queue' ? 'Hàng đợi hôm nay' : section === 'appointments' ? 'Lịch hẹn hôm nay' : 'Thống kê hoạt động'}</h1></div>
        <div className="ml-auto flex items-center gap-3"><button className="relative grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-500"><Bell size={18} /><span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-red-500"></span></button><div className="flex items-center gap-2 border-l border-slate-200 pl-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">NVA</div><div className="hidden sm:block"><p className="text-xs font-bold">BS. Nguyễn Văn An</p><p className="text-[10px] text-slate-400">Quản lý ca</p></div></div></div>
      </header>

      <div className="p-5 lg:p-7">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Kpi label="Tổng lịch hẹn hôm nay" value="48" detail="+6 so với hôm qua" tone="teal" />
          <Kpi label="Đang chờ khám" value={String(waitingCount)} detail={`${priorityCount} bệnh nhân ưu tiên`} tone="amber" />
          <Kpi label="Thời gian chờ trung bình" value="12" suffix="phút" detail="Giảm 3 phút" tone="blue" />
          <Kpi label="Đã hoàn thành" value={String(31 + completedCount)} detail="Tỷ lệ hoàn tất 82%" tone="emerald" />
        </div>

        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Bệnh nhân đang khám</p><h2 className="mt-1 text-sm font-bold text-slate-800">Điểm hiện tại · {room.name}</h2></div><span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">Đang khám</span></div></div>
            {current ? <div className="grid gap-5 p-5 md:grid-cols-[210px_minmax(0,1fr)]">
              <div className="rounded-xl bg-slate-950 p-5 text-white"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Số thứ tự</p><p className="mt-2 text-5xl font-black tabular-nums tracking-tight text-teal-400">{current.ticket}</p><div className="mt-5 flex items-center gap-2 border-t border-slate-800 pt-4"><Volume2 size={16} className="text-teal-400" /><span className="text-xs text-slate-300">Đã gọi lúc 09:12</span></div></div>
              <div><div className="flex items-start justify-between"><div><h3 className="text-xl font-bold">{current.name}</h3><p className="mt-1 text-sm text-slate-500">{current.age > 0 ? `${current.age} tuổi · ` : ''}{current.gender} · <span className="font-semibold text-slate-700">{current.phone}</span></p></div><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{current.type}</span></div><div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Triệu chứng chính</p><p className="mt-1 text-sm font-semibold">{current.symptoms}</p></div><div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Clock3 size={14} />Đặt lúc <strong className="text-slate-700 tabular-nums">{current.bookingTime}</strong><span>· Chờ <strong className="text-slate-700 tabular-nums">{current.waitedMinutes} phút</strong></span></div></div>
            </div> : <div className="p-8 text-center text-sm text-slate-500">Hiện chưa có bệnh nhân đang khám.</div>}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Thao tác nhanh</p><button onClick={callNext} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-teal-600 text-sm font-bold text-white shadow-sm hover:bg-teal-700"><Volume2 size={18} />Gọi số tiếp theo</button><div className="mt-2 grid grid-cols-2 gap-2"><button className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:border-teal-300"><VolumeX size={15} />Gọi lại loa</button><button className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:border-teal-300"><TestTube2 size={15} />Chuyển xét nghiệm</button></div><button onClick={completeCurrent} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700"><Check size={17} />Hoàn tất khám</button><button onClick={markNoShow} className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-600"><CircleUserRound size={15} />Vắng mặt</button></div>
        </section>

        <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 pt-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex overflow-x-auto"><FilterTab label="Tất cả" active={filter === 'all'} onClick={() => setFilter('all')} count={queue.length} /><FilterTab label="Đang chờ" active={filter === 'waiting'} onClick={() => setFilter('waiting')} count={waitingCount} /><FilterTab label="Ưu tiên" active={filter === 'priority'} onClick={() => setFilter('priority')} count={priorityCount} /><FilterTab label="Đã hẹn trước" active={filter === 'online'} onClick={() => setFilter('online')} /><FilterTab label="Vãng lai" active={filter === 'walkin'} onClick={() => setFilter('walkin')} /></div><button onClick={() => setShowWalkin(true)} className="mb-2 flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white"><Plus size={15} />Tiếp nhận bệnh nhân mới</button></div></div>
          <div className="border-b border-slate-100 p-3"><div className="relative max-w-md"><Search className="absolute left-3 top-2.5 text-slate-400" size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo số TT, tên hoặc số điện thoại" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none focus:border-teal-500" /></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400"><th className="px-4 py-3">Số TT</th><th>Bệnh nhân</th><th>Loại hình</th><th>Giờ hẹn</th><th>Thời gian chờ</th><th>Trạng thái</th><th className="px-4 text-right">Thao tác</th></tr></thead><tbody>{filteredQueue.map(item => <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"><td className="px-4 py-3"><span className={`inline-grid h-9 min-w-[54px] place-items-center rounded-lg border text-sm font-black tabular-nums ${item.priority ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-800'}`}>{item.ticket}</span></td><td><p className="text-sm font-bold">{item.name}</p><p className="mt-0.5 text-[11px] text-slate-400">{item.age > 0 ? `${item.age} tuổi · ` : ''}{item.gender} · {item.phone}</p></td><td><TypeBadge type={item.type} /></td><td className="text-xs font-semibold tabular-nums text-slate-600">{item.appointmentTime}</td><td className="text-xs font-bold tabular-nums text-slate-600">{item.waitedMinutes} phút</td><td><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusStyles[item.status]}`}>{statusLabels[item.status]}</span></td><td className="px-4"><div className="flex justify-end gap-1">{item.status === 'waiting' || item.status === 'checkedin' ? <button onClick={() => checkIn(item.id)} title="Tiếp nhận" className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-500 hover:border-teal-300 hover:text-teal-700"><Check size={15} /></button> : null}<button onClick={() => setPriority(item.id)} title="Ưu tiên" className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-600"><Activity size={15} /></button><button onClick={() => cancelItem(item.id)} title="Hủy" className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-500 hover:border-rose-300 hover:text-rose-600"><Trash2 size={15} /></button><button title="Thêm" className="grid h-8 w-8 place-items-center rounded-md text-slate-400"><MoreHorizontal size={16} /></button></div></td></tr>)}</tbody></table></div>
        </section>
      </div>
    </main>

    {showTV && <LobbyTV room={room} queue={queue} onClose={() => setShowTV(false)} />}
    {showWalkin && <WalkinModal onClose={() => setShowWalkin(false)} onSubmit={addWalkin} />}
  </div>;
}

function Kpi({ label, value, suffix, detail, tone }: { label: string; value: string; suffix?: string; detail: string; tone: 'teal'|'amber'|'blue'|'emerald' }) {
  const colors = { teal: 'bg-teal-50 text-teal-700', amber: 'bg-amber-50 text-amber-700', blue: 'bg-blue-50 text-blue-700', emerald: 'bg-emerald-50 text-emerald-700' };
  return <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between"><p className="text-xs font-semibold text-slate-500">{label}</p><span className={`h-2 w-2 rounded-full ${tone === 'teal' ? 'bg-teal-500' : tone === 'amber' ? 'bg-amber-500' : tone === 'blue' ? 'bg-blue-500' : 'bg-emerald-500'}`}></span></div><div className="mt-2 flex items-end gap-1"><strong className="text-3xl font-black tabular-nums text-slate-900">{value}</strong>{suffix && <span className="mb-1 text-xs font-bold text-slate-500">{suffix}</span>}</div><p className={`mt-2 text-[11px] font-bold ${colors[tone].split(' ').slice(-1)[0]}`}>{detail}</p></article>;
}

function FilterTab({ label, count, active, onClick }: { label:string; count?:number; active:boolean; onClick:()=>void }) { return <button onClick={onClick} className={`mr-1 mb-2 h-9 whitespace-nowrap rounded-md px-3 text-xs font-bold transition ${active ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{label}{count !== undefined && <span className="ml-1.5 tabular-nums opacity-70">({count})</span>}</button>; }
function TypeBadge({ type }: { type:string }) { const cls = type === 'Ưu tiên' ? 'border-red-200 bg-red-50 text-red-700' : type === 'Walk-in' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-slate-50 text-slate-600'; return <span className={`rounded-md border px-2 py-1 text-[11px] font-bold ${cls}`}>{type}</span>; }

function LobbyTV({ room, queue, onClose }: { room:RoomState; queue:QueueItem[]; onClose:()=>void }) {
  const current = queue.find(item => item.status === 'in-consultation');
  const next = queue.filter(item => item.status === 'waiting' || item.status === 'priority').slice(0, 5);
  return <div className="fixed inset-0 z-[60] bg-slate-950 text-white"><header className="flex h-20 items-center border-b border-slate-800 px-8"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-lg bg-teal-500"><Stethoscope /></div><div><p className="text-lg font-bold">Phòng khám Nội 01</p><p className="text-xs text-slate-400">Màn hình sảnh chờ</p></div></div><button onClick={onClose} className="ml-auto grid h-10 w-10 place-items-center rounded-lg border border-slate-700 text-slate-300"><X /></button></header><main className="grid h-[calc(100%-80px)] grid-cols-[1.25fr_.75fr]"><section className="grid place-items-center border-r border-slate-800"><div className="text-center"><p className="text-2xl font-bold uppercase tracking-[0.18em] text-teal-400">Đang mời vào phòng</p><p className="mt-7 animate-pulse text-[120px] font-black tabular-nums leading-none text-white lg:text-[180px]">{current?.ticket ?? room.currentTicket}</p><p className="mt-8 text-3xl font-bold">{room.name}</p><p className="mt-2 text-lg text-slate-400">Tầng 2 · Khu khám Nội</p></div></section><section className="px-10 py-12"><p className="text-xl font-bold uppercase tracking-[0.12em] text-slate-400">Số chuẩn bị</p><div className="mt-8 space-y-3">{next.map((item, index) => <div key={item.id} className="flex items-center justify-between border-b border-slate-800 pb-3"><strong className="text-4xl tabular-nums text-slate-100">{item.ticket}</strong><span className="text-sm text-slate-500">Lượt thứ {index + 1}</span></div>)}</div></section></main></div>;
}

function WalkinModal({ onClose, onSubmit }: { onClose:()=>void; onSubmit:(name:string,phone:string)=>void }) {
  const [name,setName]=useState(''); const [phone,setPhone]=useState('');
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-600">Tiếp nhận trực tiếp</p><h2 className="mt-1 text-lg font-bold">Bệnh nhân mới</h2></div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-500"><X size={17}/></button></div><label className="mt-5 block text-xs font-bold">Họ và tên<input value={name} onChange={e=>setName(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-teal-500" placeholder="Nguyễn Văn Dũng"/></label><label className="mt-4 block text-xs font-bold">Số điện thoại<input value={phone} onChange={e=>setPhone(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-teal-500" placeholder="0902 123 456"/></label><button disabled={!name.trim()} onClick={()=>onSubmit(name,phone)} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-teal-600 text-sm font-bold text-white disabled:bg-slate-200"><UserPlus size={17}/>Cấp số & tiếp nhận</button></div></div>;
}
