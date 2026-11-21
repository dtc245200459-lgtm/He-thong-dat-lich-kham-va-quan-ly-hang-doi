const api = '/api';
const state = { doctors: [], selectedDoctor: null, slots: [], queue: null, appointment: null };

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

async function request(path, options = {}) {
  const response = await fetch(`${api}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  if (!response.ok) {
    let message = `Lỗi ${response.status}`;
    try { const body = await response.json(); message = body.detail || body.title || message; } catch {}
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function initials(name) { return name.split(' ').slice(-2).map(part => part[0]).join('').toUpperCase(); }
function localDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function formatTime(value) { return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
function formatDate(value) { return new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)); }

function showToast(message, error = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.className = 'toast', 3200);
}

function switchView(view) {
  $$('.view').forEach(section => section.classList.remove('active'));
  $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view));
  $(`#${view}-view`).classList.add('active');
  const titles = { dashboard: 'Tổng quan', booking: 'Đặt lịch khám', appointments: 'Lịch hẹn', queue: 'Quầy phục vụ' };
  $('#page-title').textContent = titles[view];
  $('.sidebar').classList.remove('open');
}

async function loadDoctors() {
  state.doctors = await request('/doctors');
  $('#metric-doctors').textContent = state.doctors.length;

  $('#doctor-grid').innerHTML = state.doctors.map(doctor => `
    <article class="doctor-card${state.selectedDoctor?.id === doctor.id ? ' selected' : ''}" data-doctor-id="${doctor.id}">
      <div class="avatar">${initials(doctor.name)}</div>
      <div><h3>${escapeHtml(doctor.name)}</h3><p>${escapeHtml(doctor.specialty)}</p></div>
      <div class="room">${escapeHtml(doctor.roomName)}</div>
    </article>`).join('');

  const options = state.doctors.map(doctor => `<option value="${doctor.id}">${escapeHtml(doctor.name)} - ${escapeHtml(doctor.roomName)}</option>`).join('');
  $('#booking-doctor').insertAdjacentHTML('beforeend', options);
  $('#staff-doctor').innerHTML = options;

  $$('.doctor-card').forEach(card => card.addEventListener('click', () => selectDoctor(card.dataset.doctorId)));
  if (!state.selectedDoctor && state.doctors.length) selectDoctor(state.doctors[0].id);
}

async function selectDoctor(id) {
  state.selectedDoctor = state.doctors.find(doctor => doctor.id === id) || null;
  $$('.doctor-card').forEach(card => card.classList.toggle('selected', card.dataset.doctorId === id));
  $('#booking-doctor').value = id;
  $('#staff-doctor').value = id;
  updateBookingSummary();
  await Promise.all([loadSlots(id), loadQueue(id)]);
}

async function loadSlots(id) {
  state.slots = await request(`/doctors/${id}/slots`);
  const select = $('#booking-slot');
  select.disabled = false;
  select.innerHTML = '<option value="">Chọn khung giờ</option>' + state.slots.map(slot => {
    const start = formatTime(slot.startTime);
    const date = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(new Date(slot.startTime));
    return `<option value="${slot.id}" ${slot.availableCount < 1 ? 'disabled' : ''}>${date} - ${start} (${slot.availableCount}/${slot.capacity} còn trống)</option>`;
  }).join('');
}

async function loadQueue(id) {
  if (!id) return;
  const date = $('#staff-date').value || localDate();
  try {
    state.queue = await request(`/queues/${id}?serviceDate=${date}`);
    renderQueue(state.queue);
  } catch (error) {
    $('#queue-preview').innerHTML = `<div class="empty-state"><strong>Chưa có dữ liệu hàng đợi</strong><span>${escapeHtml(error.message)}</span></div>`;
  }
}

function renderQueue(queue) {
  $('#sync-time').textContent = `Cập nhật ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  $('#metric-issued').textContent = queue.lastIssuedNumber;
  $('#metric-current').textContent = queue.currentServingNumber || '--';
  $('#metric-current-detail').textContent = queue.roomName;
  $('#metric-waiting').textContent = queue.entries.filter(entry => !entry.isCancelled && entry.status !== 'Completed').length;

  $('#queue-preview').innerHTML = queue.entries.length ? queue.entries.slice(0, 6).map(entry => `
    <div class="queue-preview-item">
      <span class="queue-number">${String(entry.number).padStart(2, '0')}</span>
      <div><strong>${escapeHtml(entry.patientName)}</strong><small>${escapeHtml(entry.status)}</small></div>
      <span class="status-chip ${String(entry.status).toLowerCase()}">${escapeHtml(entry.status)}</span>
    </div>`).join('') : '<div class="empty-state"><strong>Chưa có lượt khám</strong><span>Hàng đợi sẽ cập nhật sau khi có lịch hẹn.</span></div>';

  $('#serving-banner').innerHTML = `<span>Đang phục vụ</span><strong>${queue.currentServingNumber || '--'}</strong><small>${escapeHtml(queue.doctorName)} - ${escapeHtml(queue.roomName)}</small>`;
  $('#queue-table-body').innerHTML = queue.entries.length ? queue.entries.map(entry => `
    <tr>
      <td><strong>${String(entry.number).padStart(2, '0')}</strong></td>
      <td>${escapeHtml(entry.patientName)}</td>
      <td><span class="status-chip ${String(entry.status).toLowerCase()}">${escapeHtml(entry.status)}</span></td>
      <td>${entry.isCancelled ? 'Đã hủy' : `<button class="table-action cancel-action" data-id="${entry.appointmentId}">Hủy lịch</button>`}</td>
    </tr>`).join('') : '<tr><td colspan="4" class="empty-state">Chưa có bệnh nhân trong hàng đợi</td></tr>';

  $$('.cancel-action').forEach(button => button.addEventListener('click', () => cancelAppointment(button.dataset.id)));
}

async function cancelAppointment(id) {
  if (!confirm('Hủy lịch hẹn này?')) return;
  try { await request(`/appointments/${id}`, { method: 'DELETE' }); showToast('Đã hủy lịch hẹn'); await loadQueue($('#staff-doctor').value); }
  catch (error) { showToast(error.message, true); }
}

function updateBookingSummary() {
  const doctor = state.doctors.find(item => item.id === $('#booking-doctor').value);
  $('#summary-doctor').textContent = doctor ? doctor.name : 'Chưa chọn';
  $('#summary-room').textContent = doctor ? doctor.roomName : '--';
  const slot = state.slots.find(item => item.id === $('#booking-slot').value);
  $('#summary-slot').textContent = slot ? `${formatTime(slot.startTime)} - ${formatDate(slot.startTime)}` : 'Chưa chọn';
}

async function submitBooking(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = { patientName: form.get('patientName'), patientPhone: form.get('patientPhone'), doctorId: form.get('doctorId'), timeSlotId: form.get('timeSlotId') };
  const submit = event.currentTarget.querySelector('[type="submit"]');
  submit.disabled = true;
  submit.textContent = 'Đang xử lý...';
  try {
    const appointment = await request('/appointments', { method: 'POST', body: JSON.stringify(payload) });
    state.appointment = appointment;
    showToast('Đặt lịch thành công');
    event.currentTarget.reset();
    $('#summary-doctor').textContent = 'Chưa chọn'; $('#summary-slot').textContent = 'Chưa chọn'; $('#summary-room').textContent = '--';
    renderAppointment(appointment);
    switchView('appointments');
  } catch (error) { showToast(error.message, true); }
  finally { submit.disabled = false; submit.textContent = 'Xác nhận đặt lịch'; }
}

function renderAppointment(appointment) {
  state.appointment = appointment;
  $('#appointment-id').value = appointment.id;
  $('#appointment-result').innerHTML = `
    <article class="appointment-card">
      <div class="appointment-card-head"><div><p class="eyebrow">Mã lịch hẹn</p><strong>${escapeHtml(appointment.queueNumber ? `Số ${appointment.queueNumber}` : 'Đang xử lý')}</strong></div><span class="status-chip confirmed">${escapeHtml(appointment.status)}</span></div>
      <div class="appointment-details">
        <div><span>Bệnh nhân</span><strong>${escapeHtml(appointment.patientName)}</strong></div>
        <div><span>Bác sĩ</span><strong>${escapeHtml(appointment.doctorName)}</strong></div>
        <div><span>Phòng khám</span><strong>${escapeHtml(appointment.roomName)}</strong></div>
        <div><span>Ngày khám</span><strong>${escapeHtml(formatDate(appointment.startTime))}</strong></div>
        <div><span>Giờ khám</span><strong>${formatTime(appointment.startTime)} - ${formatTime(appointment.endTime)}</strong></div>
        <div><span>Mã tra cứu</span><strong>${escapeHtml(appointment.id)}</strong></div>
      </div>
    </article>`;
}

async function lookupAppointment(event) {
  event.preventDefault();
  const id = $('#appointment-id').value.trim();
  if (!id) return;
  try { renderAppointment(await request(`/appointments/${id}`)); }
  catch (error) { showToast(error.message, true); }
}

async function serveNext() {
  const doctorId = $('#staff-doctor').value;
  const date = $('#staff-date').value;
  if (!doctorId) return;
  try { state.queue = await request(`/queues/${doctorId}/next?serviceDate=${date}`, { method: 'POST' }); renderQueue(state.queue); showToast('Đã chuyển sang lượt tiếp theo'); }
  catch (error) { showToast(error.message, true); }
}

async function initialize() {
  $('#today-label').textContent = formatDate(new Date());
  $('#staff-date').value = localDate();
  $$('.nav-item, [data-view]').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));
  $('#menu-button').addEventListener('click', () => $('.sidebar').classList.toggle('open'));
  $('#booking-doctor').addEventListener('change', async event => { await selectDoctor(event.target.value); updateBookingSummary(); });
  $('#booking-slot').addEventListener('change', updateBookingSummary);
  $('#booking-form').addEventListener('submit', submitBooking);
  $('#lookup-form').addEventListener('submit', lookupAppointment);
  $('#staff-doctor').addEventListener('change', event => loadQueue(event.target.value));
  $('#staff-date').addEventListener('change', event => loadQueue($('#staff-doctor').value));
  $('#serve-next').addEventListener('click', serveNext);

  try {
    await loadDoctors();
  } catch (error) {
    showToast(`Không tải được dữ liệu: ${error.message}`, true);
    $('#doctor-grid').innerHTML = '<div class="empty-state"><strong>Không thể kết nối API</strong><span>Kiểm tra Appointment API và Docker Compose.</span></div>';
  }

  setInterval(() => { if (state.selectedDoctor) loadQueue(state.selectedDoctor.id).catch(() => {}); }, 8000);
}

initialize();
