export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  roomName: string;
  isActive: boolean;
}

export interface DoctorSlot {
  id: string;
  doctorId: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  availableCount: number;
}

export interface AppointmentRequest {
  patientName: string;
  patientPhone: string;
  doctorId: string;
  timeSlotId: string;
}

export interface AppointmentResponse {
  id: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  roomName: string;
  startTime: string;
  endTime: string;
  serviceDate: string;
  queueNumber: number | null;
  status: string;
}

export type QueueStatus = 'waiting' | 'priority' | 'in-consultation' | 'completed' | 'no-show' | 'checkedin';

export interface QueueItem {
  id: string;
  ticket: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  type: 'Đã hẹn trước' | 'Walk-in' | 'Ưu tiên';
  appointmentTime: string;
  waitedMinutes: number;
  status: QueueStatus;
  priority: boolean;
  symptoms: string;
  bookingTime: string;
}

export interface RoomState {
  id: string;
  name: string;
  doctor: string;
  currentTicket: string;
}

export interface QueueTicketResponse {
  ticketCode: string;
  queueNumber: number;
  roomName: string;
  estimatedWaitMinutes: number;
  currentServingNumber: number;
  appointment: AppointmentResponse;
}
