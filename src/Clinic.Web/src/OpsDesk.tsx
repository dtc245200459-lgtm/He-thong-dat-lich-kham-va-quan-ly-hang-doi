import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Check, Volume2, FlaskConical, UserX, Monitor, Plus, Search, ArrowUp, X, Phone } from 'lucide-react';

export type DeskStatus = 'waiting' | 'priority' | 'consulting' | 'completed' | 'no-show';
export type DeskCategory = 'Đặt hẹn' | 'Trực tiếp' | 'Ưu tiên';

export interface QueueItem {
  id: string;
  ticket: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  category: DeskCategory;
  appointmentTime: string;
  waitedMinutes: number;
  status: DeskStatus;
  symptoms: string;
}

export interface RoomState {
  id: string;
  name: string;
  doctor: string;
}

const initialQueue: QueueItem[] = [
  { id:'1', ticket:'A-038', name:'Nguyễn Thị Mai', age:34, gender:'Nam', phone:'0901 234 567', category:'Đặt hẹn', appointmentTime:'08:30', waitedMinutes:28, status:'consulting', symptoms:'Đau họng, sốt nhẹ 2 ngày' },
  { id:'2', ticket:'A-039', name:'Trần Văn Long', age:51, gender:'Nam', phone:'0912 667 120', category:'Đặt hẹn', appointmentTime:'08:45', waitedMinutes:18, status:'waiting', symptoms:'Tăng huyết áp, chóng mặt' },
  { id:'3', ticket:'A-040', name:'Phạm Thu Hà', age:29, gender:'Nữ', phone:'0938 420 111', category:'Ưu tiên', appointmentTime:'09:00', waitedMinutes:15, status:'priority', symptoms:'Khó thở nhẹ, đau ngực' },
  { id:'4', ticket:'A-041', name:'Lê Minh Quân', age:42, gender:'Nam', phone:'0977 301 228', category:'Trực tiếp', appointmentTime:'09:10', waitedMinutes:11, status:'waiting', symptoms:'Đau lưng khi ngồi lâu' },
  { id:'5', ticket:'A-042', name:'Vũ Hồng Anh', age:25, gender:'Nữ', phone:'0908 554 932', category:'Đặt hẹn', appointmentTime:'09:20', waitedMinutes:8, status:'waiting', symptoms:'Mệt mỏi, mất ngủ' },
  { id:'6', ticket:'A-043', name:'Đỗ Gia Bảo', age:67, gender:'Nam', phone:'0981 882 006', category:'Trực tiếp', appointmentTime:'09:30', waitedMinutes:6, status:'waiting', symptoms:'Đau khớp gối' }
];

const statusClass: Record<DeskStatus,string> = {
  waiting:'bg-amber-50 text-amber-800 border-amber-200', priority:'bg-rose-50 text-rose-800 border-rose-200', consulting:'bg-emerald-50 text-emerald-800 border-emerald-200', completed:'bg-gray-50 text-gray-600 border-gray-200', 'no-show':'bg-gray-50 text-gray-500 border-gray-200'
};
const statusLabel: Record<DeskStatus,string> = { waiting:'Chờ khám', priority:'Ưu tiên', consulting:'Đang khám', completed:'Đã xong', 'no-show':'Vắng mặt' };

export default function OpsDesk() {
  const [queue, setQueue] = useState(initialQueue);
  const [filter, setFilter] = useState<'all'|'waiting'|'priority'|'done'>('all');
  const [search, setSearch] = useState('');
  const [tv, setTv] = useState(false);
  const [walkin, setWalkin] = useState(false);
  const [room, setRoom] = useState('204');

  const current = queue.find(item => item.status === 'consulting');
  const upNext = useMemo(() => queue.find(item => item.status === 'priority') ?? queue.find(item => item.status === 'waiting'), [queue]);
  const waiting = queue.filter(item => item.status === 'waiting' || item.status === 'priority').length;
  const priority = queue.filter(item => item.status === 'priority').length;
  const completed = queue.filter(item => item.status === 'completed').length;

  const filtered = useMemo(() => queue.filter(item => {
    const filterMatch = filter === 'all' || (filter === 'waiting' && item.status === 'waiting') || (filter === 'priority' && item.status === 'priority') || (filter === 'done' && item.status === 'completed');
    const term = search.trim().toLowerCase();
    const searchMatch = !term || item.ticket.toLowerCase().includes(term) || item.name.toLowerCase().includes(term) || item.phone.includes(term);
    return filterMatch && searchMatch;
  }), [queue, filter, search]);

  function advanceQueue() {
    setQueue(items => {
      const next = items.map(item => item.status === 'consulting' ? { ...item, status:'completed' as DeskStatus } : item);
      const priorityIndex = next.findIndex(item => item.status === 'priority');
      const waitingIndex = next.findIndex(item => item.status === 'waiting');
      const index = priorityIndex >= 0 ? priorityIndex : waitingIndex;
      if (index >= 0) next[index] = { ...next[index], status:'consulting' };
      return next;
    });
  }

  function callIntoRoom(id:string) {
    setQueue(items => {
      const next = items.map(item => item.status === 'consulting' ? { ...item, status:'waiting' as DeskStatus } : item);
      return next.map(item => item.id === id ? { ...item, status:'consulting' as DeskStatus } : item);
    });
  }

  function setPriority(id:string) { setQueue(items => items.map(item => item.id === id ? { ...item, status:'priority', category:'Ưu tiên' } : item)); }
  function cancel(id:string) { setQueue(items => items.map(item => item.id === id ? { ...item, status:'no-show' } : item)); }
  function markNoShow() { if (current) setQueue(items => items.map(item => item.id === current.id ? { ...item, status:'no-show' } : item)); }

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === 'Enter') advanceQueue();
      if (event.key.toLowerCase() === 'r') return;
      if (event.key === ' ') { event.preventDefault(); markNoShow(); }
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  });

  return <div className="min-h-screen bg-[#F8F9FA] text-[#111827]">
    <header className="sticky top-0 z-30 h-14 border-b border-[#E5E7EB] bg-white">
      <div className="flex h-full items-center px-4">
        <div className="relative flex h-full min-w-[260px] items-center border-r border-[#E5E7EB] pr-4">
          <select value={room} onChange={event => setRoom(event.target.value)} className="h-8 w-full appearance-none bg-transparent pr-7 text-xs font-semibold outline-none"><option value="204">Phòng 204 • Nội Tổng Quát — BS. Trần Minh Quân</option><option value="205">Phòng 205 • Tim Mạch — BS. Lê Hoàng Nam</option></select><ChevronDown className="pointer-events-none absolute right-5 top-3.5 text-gray-400" size={14} />
        </div>
        <div className="hidden h-full items-center divide-x divide-[#E5E7EB] lg:flex"><Metric label="Chờ khám" value={waiting} /><Metric label="Ưu tiên" value={priority} urgent /><Metric label="TB chờ" value={11} suffix="p" /><Metric label="Đã khám" value={28 + completed} /></div>
        <div className="ml-auto flex items-center gap-2"><button onClick={() => setTv(true)} className="flex h-8 items-center gap-2 border border-[#E5E7EB] px-3 text-xs font-semibold hover:bg-[#F8F9FA]"><Monitor size={14} />Màn hình sảnh chờ <span className="text-gray-400">TV</span></button><button onClick={() => setWalkin(true)} className="flex h-8 items-center gap-2 bg-[#064E3B] px-3 text-xs font-semibold text-white"><Plus size={14} />Tiếp nhận nhanh</button></div>
      </div>
    </header>

    <main className="grid h-[calc(100vh-56px)] grid-cols-[340px_minmax(0,1fr)]">
      <aside className="border-r border-[#E5E7EB] bg-white p-4">
        <div className="border-b border-[#E5E7EB] pb-3"><div className="flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Đang khám</p><span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>Trong phòng</span></div></div>
        {current ? <>
          <div className="py-5"><p className="font-mono text-5xl font-bold tracking-tight tabular-nums">{current.ticket}</p><h2 className="mt-4 text-lg font-semibold">{current.name}</h2><p className="mt-1 text-sm text-gray-500 tabular-nums">{current.age} tuổi • {current.gender}</p><button className="mt-3 flex items-center gap-2 text-sm text-gray-600"><Phone size={14} />{current.phone}</button></div>
          <div className="border-y border-[#E5E7EB] py-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Ghi chú lâm sàng</p><p className="mt-2 text-sm leading-6">{current.symptoms}</p></div>
          <div className="mt-4 space-y-2"><button onClick={advanceQueue} className="flex h-11 w-full items-center justify-between bg-[#111827] px-3 text-sm font-semibold text-white"><span>Hoàn tất & Gọi số tiếp theo</span><kbd className="border border-gray-600 px-1.5 py-0.5 font-mono text-[10px] text-gray-300">Enter</kbd></button><button className="flex h-9 w-full items-center justify-between border border-[#E5E7EB] px-3 text-xs font-semibold hover:bg-[#F8F9FA]"><span className="flex items-center gap-2"><Volume2 size={14}/>Gọi lại loa</span><kbd className="font-mono text-[10px] text-gray-400">R</kbd></button><button className="flex h-9 w-full items-center justify-between border border-[#E5E7EB] px-3 text-xs font-semibold hover:bg-[#F8F9FA]"><span className="flex items-center gap-2"><FlaskConical size={14}/>Chuyển cận lâm sàng</span></button><button onClick={markNoShow} className="flex h-9 w-full items-center justify-between px-3 text-xs font-semibold text-gray-500 hover:bg-rose-50 hover:text-rose-700"><span className="flex items-center gap-2"><UserX size={14}/>Đánh dấu vắng mặt</span><kbd className="font-mono text-[10px] text-gray-400">Space</kbd></button></div>
        </> : <div className="py-10 text-sm text-gray-500">Chưa có bệnh nhân trong phòng.</div>}

        {upNext && <div className="mt-5 border-t border-[#E5E7EB] pt-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Tiếp theo trong hàng đợi</p><div className="mt-2 flex items-center justify-between border border-[#E5E7EB] p-3"><div><p className="font-mono text-sm font-bold tabular-nums">{upNext.ticket}</p><p className="mt-1 text-xs text-gray-500">{upNext.name}</p></div><ArrowUp size={14} className="rotate-90 text-gray-400" /></div></div>}
      </aside>

      <section className="min-w-0 bg-white">
        <div className="flex h-12 items-end border-b border-[#E5E7EB] px-4"><FilterTab active={filter==='all'} label="Tất cả" count={waiting + 28 + completed} onClick={() => setFilter('all')} /><FilterTab active={filter==='waiting'} label="Đang chờ" count={waiting} onClick={() => setFilter('waiting')} /><FilterTab active={filter==='priority'} label="Ưu tiên" count={priority} onClick={() => setFilter('priority')} /><FilterTab active={filter==='done'} label="Đã xong" count={28+completed} onClick={() => setFilter('done')} /><div className="ml-auto pb-2"><div className="relative"><Search className="absolute left-2.5 top-2 text-gray-400" size={13}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm theo số TT, tên, SĐT..." className="h-8 w-[280px] rounded-md border border-[#E5E7EB] pl-8 pr-3 text-xs outline-none focus:border-[#064E3B]" /></div></div></div>

        <div className="overflow-x-auto"><table className="w-full min-w-[820px] table-fixed"><thead><tr className="h-10 border-b border-[#E5E7EB] bg-[#F8F9FA] text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500"><th className="w-24 px-4">Số TT</th><th className="w-[220px]">Bệnh nhân</th><th className="w-[150px]">Phân loại</th><th className="w-24">Giờ hẹn</th><th className="w-24">Đã chờ</th><th className="w-28">Trạng thái</th><th className="pr-4 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-[#E5E7EB]">{filtered.map(item => <tr key={item.id} className="group h-12 text-xs hover:bg-[#F8F9FA]"><td className="px-4"><span className="font-mono text-sm font-bold tabular-nums">{item.ticket}</span></td><td><p className="font-semibold">{item.name}</p><p className="mt-0.5 text-[11px] text-gray-400">{item.age} tuổi • {item.gender} • {item.phone}</p></td><td><CategoryBadge category={item.category}/></td><td className="font-mono tabular-nums text-gray-600">{item.appointmentTime}</td><td className={`font-mono tabular-nums ${item.waitedMinutes > 20 ? 'font-semibold text-amber-700' : 'text-gray-500'}`}>{item.waitedMinutes}p</td><td><span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass[item.status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-70"></span>{statusLabel[item.status]}</span></td><td className="pr-4"><div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100"><button onClick={() => callIntoRoom(item.id)} title="Gọi vào khám" className="grid h-7 w-7 place-items-center border border-[#E5E7EB] hover:border-[#064E3B] hover:text-[#064E3B]"><Volume2 size={12}/></button><button onClick={() => setPriority(item.id)} title="Đẩy ưu tiên" className="grid h-7 w-7 place-items-center border border-[#E5E7EB] hover:border-rose-300 hover:text-rose-700"><ArrowUp size={12}/></button><button onClick={() => cancel(item.id)} title="Hủy" className="grid h-7 w-7 place-items-center border border-[#E5E7EB] hover:border-gray-400"><X size={12}/></button></div></td></tr>)}</tbody></table></div>
      </section>
    </main>

    {walkin && <WalkinModal onClose={() => setWalkin(false)} onAdd={(name,phone) => { setQueue(items => [...items,{id:crypto.randomUUID(),ticket:`A-${String(44+items.length).padStart(3,'0')}`,name,phone,age:0,gender:'Chưa rõ',category:'Trực tiếp',appointmentTime:'Trực tiếp',waitedMinutes:0,status:'waiting',symptoms:'Bệnh nhân đăng ký tại quầy'}]); setWalkin(false); }} />}
    {tv && <TVDisplay room={room} current={current} nextQueue={queue.filter(item => item.status==='waiting'||item.status==='priority').slice(0,5)} onClose={() => setTv(false)} />}
  </div>;
}

function Metric({label,value,suffix='',urgent=false}:{label:string,value:number,suffix?:string,urgent?:boolean}) { return <div className={`flex h-full items-center px-4 text-xs ${urgent?'text-rose-700':'text-gray-600'}`}><span>{label}: </span><strong className="ml-1 font-mono tabular-nums text-gray-900">{value}{suffix}</strong></div>; }
function FilterTab({label,count,active,onClick}:{label:string,count:number,active:boolean,onClick:()=>void}) { return <button onClick={onClick} className={`h-12 min-w-[92px] border-b-2 px-3 text-xs font-semibold ${active?'border-[#111827] text-[#111827]':'border-transparent text-gray-500'}`}>{label} <span className="ml-1 font-mono tabular-nums text-gray-400">{count}</span></button>; }
function CategoryBadge({category}:{category:DeskCategory}) { const style=category==='Ưu tiên'?'border-rose-200 bg-rose-50 text-rose-800':category==='Trực tiếp'?'border-gray-200 bg-gray-50 text-gray-600':'border-gray-200 bg-white text-gray-600'; return <span className={`rounded border px-2 py-1 text-[10px] font-semibold ${style}`}>{category}</span>; }

function WalkinModal({onClose,onAdd}:{onClose:()=>void,onAdd:(name:string,phone:string)=>void}) {
  const [name,setName]=useState(''); const [phone,setPhone]=useState('');
  return <div className="fixed inset-0 z-50 grid place-items-center bg-gray-950/30"><div className="w-full max-w-sm border border-gray-200 bg-white p-5"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Tiếp nhận trực tiếp</h2><button onClick={onClose} className="text-gray-400"><X size={16}/></button></div><label className="mt-5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">Họ và tên<input value={name} onChange={event=>setName(event.target.value)} className="mt-2 h-9 w-full rounded-md border border-gray-200 px-3 text-sm normal-case tracking-normal outline-none" placeholder="Nguyễn Văn Dũng"/></label><label className="mt-4 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">Số điện thoại<input value={phone} onChange={event=>setPhone(event.target.value)} className="mt-2 h-9 w-full rounded-md border border-gray-200 px-3 text-sm normal-case tracking-normal outline-none" placeholder="0902 123 456"/></label><button disabled={!name.trim()} onClick={()=>onAdd(name,phone)} className="mt-5 h-9 w-full bg-[#111827] text-xs font-semibold text-white disabled:bg-gray-200">Cấp số & tiếp nhận</button></div></div>;
}

function TVDisplay({room,current,nextQueue,onClose}:{room:string,current?:QueueItem,nextQueue:QueueItem[],onClose:()=>void}) {
  return <div className="fixed inset-0 z-[60] grid grid-cols-[58%_42%] bg-[#09090B] text-white"><section className="grid place-items-center border-r border-white/10"><div className="text-center"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">Đang mời vào phòng</p><p className="mt-6 font-mono text-[120px] font-bold tracking-tight tabular-nums">{current?.ticket ?? 'A-038'}</p><p className="mt-3 font-mono text-3xl tabular-nums">→ P.{room}</p></div></section><section className="bg-[#FAFAFA] px-10 py-12 text-[#111827]"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Danh sách chuẩn bị</p><button onClick={onClose} className="grid h-8 w-8 place-items-center border border-gray-200"><X size={15}/></button></div><div className="mt-8 divide-y divide-gray-200">{nextQueue.map(item => <div key={item.id} className="flex h-16 items-center justify-between"><span className="font-mono text-3xl font-bold tabular-nums">{item.ticket}</span><span className="text-xs text-gray-400 tabular-nums">~{item.waitedMinutes}p chờ</span></div>)}</div></section></div>;
}
