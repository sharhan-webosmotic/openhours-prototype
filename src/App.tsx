import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import DashboardDesign from './DashboardDesign'

type Page =
  | 'overview'
  | 'appointments'
  | 'calendar'
  | 'patients'
  | 'staff'
  | 'services'
  | 'calls'
  | 'followups'
  | 'reminders'
  | 'reports'
  | 'notifications'
  | 'settings'
type Status = 'Confirmed' | 'Pending' | 'AI Booking' | 'Cancelled' | 'Reschedule Requested'
type AppointmentDocument = { id: number; name: string; category: 'Prescription' | 'Report'; mimeType: string; dataUrl: string }
type Appointment = {
  id: number
  patientId: number
  doctorId?: number
  doctorName?: string
  serviceId: number
  date: string
  time: string
  status: Status
  source: string
  notes: string
  documents?: AppointmentDocument[]
}
type Patient = { id: number; name: string; phone: string; email: string; dob: string; notes: string; gender?: string; bloodGroup?: string; address?: string; emergencyName?: string; emergencyPhone?: string; emergencyRelationship?: string; allergies?: string; medicalHistory?: string; medications?: string }
type Service = { id: number; name: string; description: string; duration: number; price: number; active: boolean; category?: string; mode?: string; includes?: string; preparation?: string; followUp?: string }
type Followup = { id: number; title: string; patientId: number; due: string; priority: string; status: string }
type Reminder = { id: number; appointmentId: number; scheduled: string; type: string; status: string }
type DayHours = { enabled: boolean; start: string; end: string; breakStart: string; breakEnd: string }
type WorkingHours = { start: string; end: string; breakStart: string; breakEnd: string; days: number[]; weekly: Record<number, DayHours> }
type Doctor = { id: number; name: string; specialty: string; email: string; phone: string; schedule?: WorkingHours }
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const defaultWorking: WorkingHours = { start: '09:00', end: '17:00', breakStart: '12:30', breakEnd: '13:30', days: [1, 2, 3, 4, 5], weekly: Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, { enabled: day >= 1 && day <= 5, start: '09:00', end: '17:00', breakStart: '12:30', breakEnd: '13:30' }])) }
function loadWorking(): WorkingHours {
  const saved = load<Partial<WorkingHours>>('oh-working', defaultWorking)
  const days = saved.days || defaultWorking.days
  const base = { start: saved.start || defaultWorking.start, end: saved.end || defaultWorking.end, breakStart: saved.breakStart || defaultWorking.breakStart, breakEnd: saved.breakEnd || defaultWorking.breakEnd }
  const weekly = Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, saved.weekly?.[day] || { ...base, enabled: days.includes(day) }]))
  return { ...base, days, weekly }
}

const nav: { page: Page; label: string; icon: string }[] = [
  { page: 'overview', label: 'Overview', icon: '/assets/d58e7.svg' },
  { page: 'appointments', label: 'Appointments', icon: '/assets/27833.svg' },
  { page: 'patients', label: 'Patients', icon: '/assets/be24d.svg' },
  { page: 'staff', label: 'Doctors', icon: '/assets/8bbd1.svg' },
  { page: 'services', label: 'Services', icon: '/assets/0cc00.svg' },
  { page: 'calls', label: 'Call History', icon: '/assets/820e1.svg' },
  { page: 'settings', label: 'Clinic Settings', icon: '/assets/5aa53.svg' },
]

const initialPatients: Patient[] = [
  { id: 1, name: 'Laura Miller', phone: '(415) 555-0142', email: 'laura@example.com', dob: '1988-06-14', notes: 'Prefers morning appointments.', gender: 'Female' },
  { id: 2, name: 'Noah Johnson', phone: '(415) 555-0176', email: 'noah@example.com', dob: '1992-10-08', notes: '', gender: 'Male' },
  { id: 3, name: 'Sophia Davis', phone: '(415) 555-0189', email: 'sophia@example.com', dob: '1985-02-21', notes: 'Follow-up requested.', gender: 'Female' },
  { id: 4, name: 'Mason Clark', phone: '(415) 555-0113', email: 'mason@example.com', dob: '1979-12-02', notes: '', gender: 'Male' },
  { id: 5, name: 'Emma Wilson', phone: '(415) 555-0134', email: 'emma@example.com', dob: '1995-04-18', notes: '', gender: 'Female' },
]
const DEMO_TODAY = '2025-05-19'
const initialServices: Service[] = [
  { id: 1, name: 'Cardiology Consultation', description: 'A dedicated visit to discuss symptoms, cardiac history, and next steps with Dr. Sudhir.', duration: 30, price: 1200, active: true, category: 'Consultation', mode: 'In clinic', includes: 'Clinical discussion and care plan', preparation: 'Bring previous reports and a current medication list.', followUp: 'Follow-up visit if recommended by the doctor.' },
  { id: 2, name: 'Cardiology Follow-up', description: 'Review progress, treatment response, and questions after a previous visit.', duration: 30, price: 800, active: true, category: 'Follow-up', mode: 'In clinic', includes: 'Progress review and care plan update', preparation: 'Bring recent test results and note any changes since your last visit.', followUp: 'Next review based on the doctor’s recommendation.' },
  { id: 3, name: 'ECG Review', description: 'A focused appointment to review an ECG with a cardiology specialist.', duration: 45, price: 1450, active: true, category: 'Diagnostics', mode: 'In clinic', includes: 'ECG discussion and specialist interpretation', preparation: 'Bring the ECG trace or report if it was completed elsewhere.', followUp: 'Further evaluation may be advised after review.' },
]
function loadServices(): Service[] {
  const stored = load<Service[]>('oh-services', initialServices)
  return stored.map((service) => {
    const seed = initialServices.find((entry) => entry.id === service.id && entry.name === service.name)
    const isLegacyDemo = seed && service.price === seed.price / 10
    return seed && isLegacyDemo ? { ...seed, ...service, price: seed.price, description: seed.description, category: seed.category, mode: seed.mode, includes: seed.includes, preparation: seed.preparation, followUp: seed.followUp } : service
  })
}
const formatINR = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
const initialAppointments: Appointment[] = [
  { id: 1, patientId: 1, serviceId: 1, date: '2025-05-19', time: '09:00', status: 'Confirmed', source: 'Website', notes: 'New patient consultation.' },
  { id: 2, patientId: 1, serviceId: 1, date: '2025-05-19', time: '10:30', status: 'AI Booking', source: 'AI Receptionist', notes: '' },
  { id: 3, patientId: 2, serviceId: 2, date: '2025-05-19', time: '11:15', status: 'Confirmed', source: 'Clinic', notes: '' },
  { id: 4, patientId: 3, serviceId: 3, date: '2025-05-19', time: '14:00', status: 'Pending', source: 'AI Receptionist', notes: 'Please confirm request.' },
  { id: 5, patientId: 4, serviceId: 1, date: '2025-05-20', time: '09:00', status: 'Confirmed', source: 'Phone', notes: '' },
  { id: 6, patientId: 5, serviceId: 2, date: '2025-05-22', time: '15:30', status: 'Reschedule Requested', source: 'AI Receptionist', notes: '' },
]
const calls = [
  { id: 1, date: '2025-05-19', when: 'May 19, 9:42 AM', caller: 'Laura Miller', type: 'New patient', outcome: 'Booked', duration: '4m 18s', appointmentId: 2, summary: 'Laura asked about availability and booked a cardiology consultation.', reviewed: false, transcript: [{ time: '00:00', speaker: 'AI receptionist', text: 'Thank you for calling ClinicAI Cardiology. How can I help you today?' }, { time: '00:08', speaker: 'Laura Miller', text: 'I would like to book a consultation with Dr. Sudhir. I have not visited the clinic before.' }, { time: '00:21', speaker: 'AI receptionist', text: 'I can help with that. I have an available consultation on Monday at 10:30 AM. Would you like me to reserve it?' }, { time: '00:34', speaker: 'Laura Miller', text: 'Yes, that works for me.' }, { time: '00:40', speaker: 'AI receptionist', text: 'Your request is recorded. The clinic will confirm the appointment shortly.' }] },
  { id: 2, date: '2025-05-19', when: 'May 19, 9:18 AM', caller: 'Robert Patel', type: 'Reschedule', outcome: 'Updated', duration: '2m 46s', appointmentId: 0, summary: 'Caller requested a later appointment. Clinic review is required.', reviewed: false, transcript: [{ time: '00:00', speaker: 'AI receptionist', text: 'ClinicAI Cardiology, how may I assist you?' }, { time: '00:07', speaker: 'Robert Patel', text: 'I need to move my appointment to a later time if possible.' }, { time: '00:19', speaker: 'AI receptionist', text: 'I have captured your request. The clinic team will review available times and get back to you.' }, { time: '00:31', speaker: 'Robert Patel', text: 'Thank you, I appreciate it.' }] },
  { id: 3, date: '2025-05-19', when: 'May 19, 8:54 AM', caller: 'Emma Wilson', type: 'General enquiry', outcome: 'Resolved', duration: '3m 08s', appointmentId: 0, summary: 'Asked about clinic hours and preparation guidance.', reviewed: true, transcript: [{ time: '00:00', speaker: 'AI receptionist', text: 'Thank you for calling ClinicAI Cardiology. What would you like to know?' }, { time: '00:09', speaker: 'Emma Wilson', text: 'Could you tell me when the clinic is open and what I should bring to my visit?' }, { time: '00:22', speaker: 'AI receptionist', text: 'The clinic can share its current hours and recommends bringing any previous reports and a list of your current medicines.' }, { time: '00:38', speaker: 'Emma Wilson', text: 'That answers my question, thank you.' }] },
  { id: 4, date: '2025-05-19', when: 'May 19, 8:21 AM', caller: 'James Brown', type: 'Cancellation', outcome: 'Follow-up', duration: '1m 52s', appointmentId: 0, summary: 'Cancellation request captured for staff review.', reviewed: false, transcript: [{ time: '00:00', speaker: 'AI receptionist', text: 'ClinicAI Cardiology. How can I help?' }, { time: '00:06', speaker: 'James Brown', text: 'I need to cancel my upcoming appointment.' }, { time: '00:15', speaker: 'AI receptionist', text: 'I have recorded your cancellation request. A clinic team member will review it and confirm the change.' }, { time: '00:27', speaker: 'James Brown', text: 'All right. Thank you.' }] },
]
const notices = [
  { id: 1, title: 'Booking request needs review', body: 'Sophia Davis requested May 19 at 2:00 PM.', time: '8 min ago', read: false, page: 'appointments' as Page },
  { id: 2, title: 'AI call follow-up due', body: 'Review Robert Patel’s reschedule request.', time: '32 min ago', read: false, page: 'calls' as Page },
  { id: 3, title: 'Appointment reminder updated', body: 'Review upcoming cardiology appointments.', time: '1 hr ago', read: true, page: 'appointments' as Page },
]

function load<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || '') as T
  } catch {
    return fallback
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Unable to read this file.'))
    reader.onerror = () => reject(new Error('Unable to read this file.'))
    reader.readAsDataURL(file)
  })
}

function Button({ children, onClick, kind = 'primary', type = 'button', disabled = false, className = '' }: { children: ReactNode; onClick?: () => void; kind?: 'primary' | 'secondary' | 'ghost' | 'danger'; type?: 'button' | 'submit'; disabled?: boolean; className?: string }) {
  return <button className={`btn ${kind} ${className}`} onClick={onClick} type={type} disabled={disabled}>{children}</button>
}
function Field({ label, children, hint, className = '' }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return <label className={`field ${className}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}
function PatientAvatar({ patient, large = false }: { patient: Pick<Patient, 'name' | 'gender'>; large?: boolean }) {
  const genderClass = patient.gender === 'Female' ? 'female' : patient.gender === 'Male' ? 'male' : 'neutral'
  const symbol = patient.gender === 'Female' ? '♀' : patient.gender === 'Male' ? '♂' : patient.name.split(' ').map((part) => part[0]).join('').slice(0, 2)
  return <span className={`patient-avatar ${genderClass} ${large ? 'large' : ''}`} aria-label={`${patient.gender || 'Patient'} patient`} title={patient.gender || 'Patient'}>{symbol}</span>
}
function Badge({ status, selectedFontSize = false }: { status: string; selectedFontSize?: boolean }) {
  return <span className={`badge ${status.toLowerCase().replace(/ /g, '-')} ${selectedFontSize ? 'selected-font-size' : ''}`}>{status}</span>
}
function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}
function Empty({ title = 'No records found', body = 'Try adjusting your search or filters.' }: { title?: string; body?: string }) {
  return <div className="empty"><div className="empty-icon">◇</div><strong>{title}</strong><p>{body}</p></div>
}

export default function App() {
  const [auth, setAuth] = useState(() => sessionStorage.getItem('clinicai-auth') === 'yes')
  const [authScreen, setAuthScreen] = useState<'login' | 'forgot' | 'reset'>('login')
  const [page, setPage] = useState<Page>('overview')
  const [appointmentCalendarDate, setAppointmentCalendarDate] = useState('2025-05-19')
  const [appointmentCalendarView, setAppointmentCalendarView] = useState<'Month' | 'Week' | 'Day' | 'List'>('List')
  const [patients, setPatients] = useState(() => load('oh-patients', initialPatients))
  const [services, setServices] = useState<Service[]>(loadServices)
  const [appointments, setAppointments] = useState(() => load('oh-appointments', initialAppointments))
  const [followups, setFollowups] = useState<Followup[]>(() => load('oh-followups', [
    { id: 1, title: 'Confirm requested time change', patientId: 5, due: '2025-05-19', priority: 'High', status: 'Overdue' },
    { id: 2, title: 'Check in after consultation', patientId: 2, due: '2025-05-21', priority: 'Medium', status: 'Pending' },
  ]))
  const [reminders, setReminders] = useState<Reminder[]>(() => load('oh-reminders', [
    { id: 1, appointmentId: 3, scheduled: 'May 18, 11:15 AM', type: 'SMS', status: 'Sent (simulated)' },
    { id: 2, appointmentId: 4, scheduled: 'May 18, 2:00 PM', type: 'Email', status: 'Scheduled' },
    { id: 3, appointmentId: 5, scheduled: 'May 19, 9:00 AM', type: 'SMS', status: 'Failed' },
  ]))
  const [working, setWorking] = useState<WorkingHours>(loadWorking)
  const [doctors, setDoctors] = useState<Doctor[]>(() => load<Doctor[]>('oh-doctors', [{ id: 1, name: 'Dr. Sudhir', specialty: 'Cardiology Specialist', email: 'doctor@clinicai.example', phone: '(415) 555-0100' }]).map((doctor) => ({ ...doctor, schedule: doctor.schedule || (doctor.id === 1 ? working : defaultWorking) })))
  const [booking, setBooking] = useState<{ open: boolean; edit?: Appointment; initialPatient?: number; initialDate?: string }>({ open: false })
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [toast, setToast] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [periodOpen, setPeriodOpen] = useState(false)
  const [period, setPeriod] = useState('Last 7 days')
  const [periodPosition, setPeriodPosition] = useState({ top: 80, left: 12 })
  const [searchOpen, setSearchOpen] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const [readNotices, setReadNotices] = useState<number[]>([])

  useEffect(() => localStorage.setItem('oh-patients', JSON.stringify(patients)), [patients])
  useEffect(() => localStorage.setItem('oh-services', JSON.stringify(services)), [services])
  useEffect(() => localStorage.setItem('oh-appointments', JSON.stringify(appointments)), [appointments])
  useEffect(() => localStorage.setItem('oh-followups', JSON.stringify(followups)), [followups])
  useEffect(() => localStorage.setItem('oh-reminders', JSON.stringify(reminders)), [reminders])
  useEffect(() => localStorage.setItem('oh-working', JSON.stringify(working)), [working])
  useEffect(() => localStorage.setItem('oh-doctors', JSON.stringify(doctors)), [doctors])
  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(id)
  }, [toast])

  const go = (next: Page) => {
    setPage(next)
    setNotifyOpen(false)
    setProfileOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const person = (id: number) => patients.find((item) => item.id === id)!
  const service = (id: number) => services.find((item) => item.id === id)!
  const saveAppointment = (value: Appointment) => {
    setAppointments((current) => current.some((item) => item.id === value.id) ? current.map((item) => item.id === value.id ? value : item) : [...current, value])
    setReminders((current) => {
      const existing = current.find((item) => item.appointmentId === value.id)
      if (value.status === 'Cancelled') return current.map((item) => item.appointmentId === value.id ? { ...item, status: 'Cancelled' } : item)
      if (existing) return current.map((item) => item.appointmentId === value.id ? { ...item, scheduled: `${value.date}, ${value.time}`, status: 'Scheduled' } : item)
      return [...current, { id: Date.now(), appointmentId: value.id, scheduled: `${value.date}, ${value.time}`, type: 'SMS', status: 'Scheduled' }]
    })
    setSelectedAppointment(value)
    setToast(value.id > 100 ? 'Appointment created and synchronized.' : 'Appointment updated across ClinicAI.')
  }

  if (!auth) return <Auth screen={authScreen} setScreen={setAuthScreen} onSuccess={() => { sessionStorage.setItem('clinicai-auth', 'yes'); setAuth(true) }} />

  const openDashboardAppointment = (target: HTMLElement) => {
    const row = target.closest<HTMLElement>('[data-appointment-id]')
    if (!row) return false
    const item = appointments.find((appointment) => appointment.id === Number(row.dataset.appointmentId))
    if (item) setSelectedAppointment(item)
    return true
  }

  const openAppointmentCalendar = (date: string, view: 'Month' | 'Week' | 'Day' | 'List') => {
    setAppointmentCalendarDate(date)
    setAppointmentCalendarView(view)
    go('appointments')
  }

  const dashboardClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement
    if (openDashboardAppointment(target)) return
    const calendarCard = target.closest('[data-node-id="1:663"]')
    const periodTrigger = target.closest('[data-node-id="1:182"]') as HTMLElement | null
    if (periodTrigger) {
      const bounds = periodTrigger.getBoundingClientRect()
      const menuWidth = Math.min(264, window.innerWidth - 24)
      const menuHeight = 354
      const left = Math.max(12, Math.min(bounds.left, window.innerWidth - menuWidth - 12))
      const below = bounds.bottom + 8
      const top = below + menuHeight <= window.innerHeight - 12 ? below : Math.max(12, bounds.top - menuHeight - 8)
      setPeriodPosition({ top, left })
      setPeriodOpen(true)
      return
    }
    if (target.closest('[data-node-id="1:109"]')) { setBooking({ open: true }); return }
    if (target.closest('[data-node-id="1:114"]')) { setNotifyOpen(true); return }
    if (target.closest('[data-node-id="1:119"]')) { setToast('Clinic support is available through the clinic settings.'); return }
    if (target.closest('[data-node-id="1:409"]')) { go('calls'); return }
    if (target.closest('[data-node-id="1:520"]')) { openAppointmentCalendar('2025-05-19', 'List'); return }
    if (calendarCard && target.closest('[data-node-id="1:671"]')) { openAppointmentCalendar('2025-05-19', 'Month'); return }
    if (calendarCard && target.closest('[data-node-id="1:673"]')) { setBooking({ open: true, initialDate: '2025-05-19' }); return }
    if (calendarCard && target.closest('[data-node-id="1:690"]')) { openAppointmentCalendar('2025-04-19', 'Month'); return }
    if (calendarCard && target.closest('[data-node-id="1:696"]')) { openAppointmentCalendar('2025-06-19', 'Month'); return }
    const dashboardMonthGrid = calendarCard?.querySelector('[data-node-id="1:713"]')
    const dashboardDayCell = dashboardMonthGrid && target.closest('[data-name="Button"]')
    if (dashboardMonthGrid && dashboardDayCell && dashboardMonthGrid.contains(dashboardDayCell)) {
      const cells = Array.from(dashboardMonthGrid.querySelectorAll('[data-name="Button"]'))
      const dayIndex = cells.indexOf(dashboardDayCell)
      if (dayIndex >= 0) {
        const date = new Date(2025, 4, dayIndex - 3, 12)
        const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        openAppointmentCalendar(value, 'Day')
        return
      }
    }
    if (target.closest('[data-node-id="1:124"]')) { setProfileOpen(true); return }
    const text = target.closest('button, a')?.textContent?.trim() || target.closest('div, p')?.textContent?.trim() || ''
    const destinations: [string, Page][] = [
      ['Appointments', 'appointments'], ['Patients', 'patients'], ['Doctors', 'staff'], ['Doctors & Staff', 'staff'], ['Services', 'services'],
      ['Call History', 'calls'],
      ['Clinic Settings', 'settings'], ['View Full Schedule', 'appointments'], ['Recent AI Calls', 'calls'], ['Upcoming Appointments', 'appointments'],
    ]
    if (text === 'New Appointment' || text === 'Book') setBooking({ open: true, initialDate: '2025-05-19' })
    else if (text.includes('Dr. Sudhir') || text === 'DS') setProfileOpen(true)
    else if (text.includes('Laura Miller') && text.length < 80) setSelectedAppointment(appointments.find((item) => item.patientId === 1) || null)
    else {
      const found = destinations.find(([label]) => text === label || text.startsWith(label))
      if (found) go(found[1])
    }
  }

  const pageContent = (() => {
    switch (page) {
      case 'appointments': return <Calendar appointments={appointments} patients={patients} services={services} working={working} initialView={appointmentCalendarView} initialDate={appointmentCalendarDate} onNew={(date) => setBooking({ open: true, initialDate: date })} onOpen={setSelectedAppointment} />
      case 'calendar': return <Calendar appointments={appointments} patients={patients} services={services} working={working} onNew={(date) => setBooking({ open: true, initialDate: date })} onOpen={setSelectedAppointment} />
      case 'patients': return <Patients
        patients={patients}
        appointments={appointments}
        services={services}
        followups={followups}
        setFollowups={setFollowups}
        toast={setToast}
        onSave={(item) => { setPatients((current) => current.some((p) => p.id === item.id) ? current.map((p) => p.id === item.id ? item : p) : [...current, item]); setToast('Patient saved and added to booking options.') }}
        onBook={(id) => setBooking({ open: true, initialPatient: id })}
        onOpenAppointment={setSelectedAppointment}
        onUploadDocument={async (appointmentId, category, file) => {
          const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png']
          if (!allowedTypes.includes(file.type)) { setToast('Choose a PDF, JPG, or PNG file.'); return }
          if (file.size > 2 * 1024 * 1024) { setToast('Files must be 2 MB or smaller.'); return }
          try {
            const document: AppointmentDocument = { id: Date.now(), name: file.name, category, mimeType: file.type, dataUrl: await readFileAsDataUrl(file) }
            setAppointments((current) => current.map((item) => item.id === appointmentId ? { ...item, documents: [...(item.documents || []), document] } : item))
            setToast(`${category} added to the appointment timeline.`)
          } catch {
            setToast('This file could not be added. Try another file.')
          }
        }}
      />
      case 'staff': return <Staff working={working} setWorking={(value) => { setWorking(value); setToast('Dr. Sudhir’s availability was updated.') }} services={services} doctors={doctors} setDoctors={setDoctors} />
      case 'services': return <Services services={services} setServices={setServices} toast={setToast} />
      case 'calls': return <Calls onAppointment={(id) => { const item = appointments.find((a) => a.id === id); if (item) setSelectedAppointment(item) }} onFollowup={(caller) => { const p = patients.find((item) => item.name === caller) || patients[0]; setFollowups((current) => [...current, { id: Date.now(), title: `Follow up on AI call with ${caller}`, patientId: p.id, due: '2025-05-20', priority: 'Medium', status: 'Pending' }]); setToast('Follow-up task created.') }} />
      case 'followups': return <Followups items={followups} setItems={setFollowups} patients={patients} toast={setToast} />
      case 'reminders': return <Reminders items={reminders} setItems={setReminders} appointments={appointments} patients={patients} toast={setToast} />
      case 'reports': return <Reports appointments={appointments} services={services} period={period} setPeriod={setPeriod} />
      case 'notifications': return <Notifications read={readNotices} setRead={setReadNotices} go={go} />
      case 'settings': return <Settings working={working} doctors={doctors} go={go} toast={setToast} />
      default: return null
    }
  })()

  return (
    <>
      {page === 'overview' ? (
        <Shell page={page} go={go} onNew={() => setBooking({ open: true })} globalSearch={globalSearch} setGlobalSearch={setGlobalSearch} setSearchOpen={setSearchOpen} setNotifyOpen={setNotifyOpen} setProfileOpen={setProfileOpen} hidePageHeading>
          <div className="dashboard-embedded" onClickCapture={dashboardClick} onKeyDownCapture={(event) => {
            if ((event.key === 'Enter' || event.key === ' ') && openDashboardAppointment(event.target as HTMLElement)) event.preventDefault()
          }}>
            <DashboardDesign period={period} periodOpen={periodOpen} appointments={appointments} />
          </div>
        </Shell>
      ) : (
        <Shell page={page} go={go} onNew={() => setBooking({ open: true })} globalSearch={globalSearch} setGlobalSearch={setGlobalSearch} setSearchOpen={setSearchOpen} setNotifyOpen={setNotifyOpen} setProfileOpen={setProfileOpen}>
          {pageContent}
        </Shell>
      )}
      {booking.open && <AppointmentForm edit={booking.edit} initialPatient={booking.initialPatient} initialDate={booking.initialDate} patients={patients} services={services} doctors={doctors} appointments={appointments} working={working} onClose={() => setBooking({ open: false })} onSave={(value) => { saveAppointment(value); setBooking({ open: false }) }} onAddPatient={(item) => setPatients((current) => [...current, item])} />}
      {selectedAppointment && <AppointmentDetails item={selectedAppointment} patient={person(selectedAppointment.patientId)} service={service(selectedAppointment.serviceId)} doctorName={doctors.find((doctor) => doctor.id === (selectedAppointment.doctorId || 1))?.name || 'Dr. Sudhir'} onClose={() => setSelectedAppointment(null)} onEdit={() => { setBooking({ open: true, edit: selectedAppointment }); setSelectedAppointment(null) }} onStatus={(status) => { const changed = { ...selectedAppointment, status }; saveAppointment(changed); setSelectedAppointment(changed) }} />}
      {notifyOpen && <Popover title="Notifications" onClose={() => setNotifyOpen(false)}><NotificationList compact read={readNotices} setRead={setReadNotices} go={go} /></Popover>}
      {profileOpen && <Popover title="Dr. Sudhir" onClose={() => setProfileOpen(false)}><div className="profile-card"><div className="avatar large">DS</div><strong>Dr. Sudhir</strong><span>Cardiology Specialist</span><Button kind="secondary" onClick={() => go('staff')}>View profile</Button><Button kind="danger" onClick={() => setLogoutOpen(true)}>Logout</Button></div></Popover>}
      {searchOpen && <SearchPanel query={globalSearch} patients={patients} appointments={appointments} go={go} close={() => setSearchOpen(false)} />}
      {periodOpen && <div className="period-menu-scrim" onClick={() => setPeriodOpen(false)} onKeyDown={(event) => { if (event.key === 'Escape') setPeriodOpen(false) }}><div className="period-menu" role="listbox" aria-label="Reporting period" style={periodPosition} onClick={(event) => event.stopPropagation()}><div className="period-menu-heading"><strong>Reporting period</strong><button type="button" aria-label="Close reporting period menu" onClick={() => setPeriodOpen(false)}>×</button></div>{['Today', 'Last 7 days', 'Last 30 days', 'This month', 'Last month', 'Custom date range'].map((item) => <button type="button" role="option" aria-selected={period === item} className={`menu-row ${period === item ? 'selected' : ''}`} key={item} onClick={() => { setPeriod(item); setPeriodOpen(false); setToast(`Dashboard metrics updated for ${item}.`) }}>{item}</button>)}</div></div>}
      {logoutOpen && <Confirm title="Log out of ClinicAI?" body="You’ll return to the demo login screen. Your local demo records will remain available." action="Log out" onCancel={() => setLogoutOpen(false)} onConfirm={() => { sessionStorage.removeItem('clinicai-auth'); setAuth(false); setLogoutOpen(false); setPage('overview') }} />}
      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </>
  )
}

function Auth({ screen, setScreen, onSuccess }: { screen: 'login' | 'forgot' | 'reset'; setScreen: (value: 'login' | 'forgot' | 'reset') => void; onSuccess: () => void }) {
  const [email, setEmail] = useState('demo@clinicai.example')
  const [password, setPassword] = useState('ClinicAI123!')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!email.includes('@')) return setError('Enter a valid email address.')
    if (screen === 'forgot') { setSent(true); return }
    if (password.length < 8) return setError('Password must contain at least 8 characters.')
    if (screen === 'reset' && password !== confirm) return setError('Passwords do not match.')
    if (screen === 'reset') { setSent(true); window.setTimeout(() => setScreen('login'), 1200); return }
    onSuccess()
  }
  return <main className="auth-page">
    <section className="auth-brand">
      <div className="brand-mark"><img src="/clinicai-logo.svg" alt="" /></div>
      <div className="auth-brand-copy"><span>ClinicAI</span><h1>One calm place for every clinic day.</h1><p>Appointments, patients and AI receptionist activity stay organized for Dr. Sudhir.</p></div>
      <div className="demo-pill">Interactive client demo · No real credentials or messages</div>
    </section>
    <section className="auth-panel">
      <form className="auth-form" onSubmit={submit}>
        <button type="button" className="mobile-logo" onClick={() => setScreen('login')}><img className="mini-mark-image" src="/clinicai-logo.svg" alt="" /> ClinicAI</button>
        <div className="eyebrow">{screen === 'login' ? 'WELCOME BACK' : 'ACCOUNT RECOVERY'}</div>
        <h2>{screen === 'login' ? 'Sign in to ClinicAI' : screen === 'forgot' ? 'Reset your password' : 'Choose a new password'}</h2>
        <p>{screen === 'login' ? 'Use the prefilled demo account or open Demo Access.' : screen === 'forgot' ? 'We’ll simulate sending a secure reset link.' : 'Enter a new demo password below.'}</p>
        {sent && <div className="success-box">{screen === 'forgot' ? 'Simulated reset link sent. No email was actually delivered.' : 'Password reset successfully. Returning to login…'}</div>}
        {screen !== 'reset' && <Field label="Email address"><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@clinic.com" /></Field>}
        {screen !== 'forgot' && <Field label="Password"><div className="password-wrap"><input value={password} onChange={(e) => setPassword(e.target.value)} type={show ? 'text' : 'password'} /><button type="button" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button></div></Field>}
        {screen === 'reset' && <Field label="Confirm password"><input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" /></Field>}
        {error && <div className="error-box">{error}</div>}
        {screen === 'login' && <div className="form-between"><label className="check"><input type="checkbox" defaultChecked /> Remember me</label><button type="button" className="link" onClick={() => setScreen('forgot')}>Forgot password?</button></div>}
        <Button type="submit">{screen === 'login' ? 'Sign In' : screen === 'forgot' ? 'Send Reset Link' : 'Reset Password'}</Button>
        {screen === 'login' ? <Button kind="secondary" onClick={onSuccess}>Demo Access</Button> : <button type="button" className="back-link" onClick={() => setScreen('login')}>← Back to Login</button>}
        {screen === 'forgot' && sent && <Button kind="secondary" onClick={() => setScreen('reset')}>Open simulated reset screen</Button>}
      </form>
    </section>
  </main>
}

function Shell({ page, go, onNew, children, globalSearch, setGlobalSearch, setSearchOpen, setNotifyOpen, setProfileOpen, hidePageHeading = false }: { page: Page; go: (page: Page) => void; onNew: () => void; children: ReactNode; globalSearch: string; setGlobalSearch: (v: string) => void; setSearchOpen: (v: boolean) => void; setNotifyOpen: (v: boolean) => void; setProfileOpen: (v: boolean) => void; hidePageHeading?: boolean }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const label = page === 'calendar' ? 'Calendar & Bookings' : nav.find((item) => item.page === page)?.label || 'ClinicAI'
  const navigate = (next: Page) => { go(next); setMobileNavOpen(false) }
  return <div className={`app-shell ${mobileNavOpen ? 'mobile-nav-open' : ''}`}>
    {mobileNavOpen && <button className="sidebar-scrim" aria-label="Close navigation menu" onClick={() => setMobileNavOpen(false)} />}
    <aside className="sidebar" id="primary-navigation">
      <button className="logo" onClick={() => go('overview')}><span className="logo-mark"><img src="/clinicai-logo.svg" alt="" /></span><span>ClinicAI</span></button>
      <nav>{nav.map((item) => <button key={item.page} className={page === item.page ? 'active' : ''} onClick={() => navigate(item.page)}><img src={item.icon} alt="" /><span>{item.label}</span></button>)}</nav>
    </aside>
    <div className="main">
      <header className="topbar">
        <button className="mobile-menu-toggle" type="button" aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileNavOpen} aria-controls="primary-navigation" onClick={() => setMobileNavOpen((open) => !open)}><span /><span /><span /></button>
        <button className="mobile-brand" type="button" onClick={() => navigate('overview')}><img src="/clinicai-logo.svg" alt="" />ClinicAI</button>
        <div className="global-search"><img src="/assets/e1136.svg" alt="" /><input aria-label="Global search" placeholder="Search patients, appointments or calls…" value={globalSearch} onChange={(e) => { setGlobalSearch(e.target.value); setSearchOpen(true) }} onFocus={() => setSearchOpen(true)} /><kbd>⌘K</kbd></div>
        <div className="today"><span>Today</span><strong>Monday, 19 May 2025</strong></div>
        <Button onClick={onNew}>＋ New Appointment</Button>
        <button className="profile-trigger" onClick={() => setProfileOpen(true)}><span className="avatar">DS</span><span><strong>Dr. Sudhir</strong><small>Cardiology Specialist</small></span><b>⌄</b></button>
      </header>
      <main className={`page ${hidePageHeading ? 'overview-page' : ''}`}>
        {!hidePageHeading && <div className="page-heading"><div><button className="breadcrumb" onClick={() => go('overview')}>Overview</button><span> / {label}</span><h1>{label}</h1></div>{page === 'calendar' && <Button onClick={onNew}>＋ New Appointment</Button>}</div>}
        {children}
      </main>
    </div>
  </div>
}

function Appointments({ appointments, patients, services, onNew, onOpen }: { appointments: Appointment[]; patients: Patient[]; services: Service[]; onNew: () => void; onOpen: (a: Appointment) => void }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')
  const [date, setDate] = useState('')
  const filtered = appointments.filter((item) => (!query || patients.find((p) => p.id === item.patientId)?.name.toLowerCase().includes(query.toLowerCase())) && (status === 'All' || item.status === status) && (!date || item.date === date))
  return <>
    <div className="toolbar"><div className="search-control">⌕<input placeholder="Search patient or contact" value={query} onChange={(e) => setQuery(e.target.value)} /></div><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /><select value={status} onChange={(e) => setStatus(e.target.value)}><option>All</option>{['Confirmed', 'Pending', 'AI Booking', 'Cancelled', 'Reschedule Requested'].map((x) => <option key={x}>{x}</option>)}</select><Button onClick={onNew}>＋ New Appointment</Button></div>
    <Card>{filtered.length ? <div className="table-wrap"><table><thead><tr><th>Date & time</th><th>Patient</th><th>Doctor</th><th>Service</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.date}</strong><small>{item.time}</small></td><td>{patients.find((p) => p.id === item.patientId)?.name}</td><td>{item.doctorName || 'Dr. Sudhir'}</td><td>{services.find((s) => s.id === item.serviceId)?.name}</td><td><Badge status={item.status} /></td><td><Button kind="ghost" onClick={() => onOpen(item)}>View details</Button></td></tr>)}</tbody></table></div> : <Empty />}</Card>
    <div className="pagination"><span>Showing {filtered.length} of {appointments.length} appointments</span><div><button disabled>‹</button><button className="active">1</button><button disabled>›</button></div></div>
  </>
}

function availableSlots(date: string, serviceId: number, services: Service[], appointments: Appointment[], working: WorkingHours, doctorId = 1, editingId?: number) {
  if (!date || !serviceId) return []
  const day = new Date(`${date}T12:00:00`).getDay()
  const hours = working.weekly?.[day] || { enabled: working.days.includes(day), start: working.start, end: working.end, breakStart: working.breakStart, breakEnd: working.breakEnd }
  if (!hours.enabled) return []
  const duration = services.find((item) => item.id === serviceId)?.duration || 30
  const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
  const fmt = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
  const slots: string[] = []
  for (let start = toMinutes(hours.start); start + duration <= toMinutes(hours.end); start += 15) {
    const end = start + duration
    const inBreak = start < toMinutes(hours.breakEnd) && end > toMinutes(hours.breakStart)
    const conflict = appointments.some((item) => {
      if (item.id === editingId || item.date !== date || item.status === 'Cancelled' || (item.doctorId || 1) !== doctorId) return false
      const otherDuration = services.find((s) => s.id === item.serviceId)?.duration || 30
      const otherStart = toMinutes(item.time)
      return start < otherStart + otherDuration && end > otherStart
    })
    if (!inBreak && !conflict) slots.push(fmt(start))
  }
  return slots
}

function AppointmentForm({ edit, initialPatient, initialDate, patients, services, doctors, appointments, working, onClose, onSave, onAddPatient }: { edit?: Appointment; initialPatient?: number; initialDate?: string; patients: Patient[]; services: Service[]; doctors: Doctor[]; appointments: Appointment[]; working: WorkingHours; onClose: () => void; onSave: (a: Appointment) => void; onAddPatient: (p: Patient) => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [patientId, setPatientId] = useState(edit?.patientId || initialPatient || 0)
  const [doctorId, setDoctorId] = useState(edit?.doctorId || 1)
  const [serviceId, setServiceId] = useState(edit?.serviceId || services.find((item) => item.active)?.id || 0)
  const [date, setDate] = useState(edit?.date || initialDate || '2025-05-21')
  const [time, setTime] = useState(edit?.time || '')
  const [notes, setNotes] = useState(edit?.notes || '')
  const [error, setError] = useState('')
  const [addPatient, setAddPatient] = useState(false)
  const selectedDoctor = doctors.find((doctor) => doctor.id === doctorId) || doctors[0]
  const doctorWorking = selectedDoctor?.schedule || working
  const slots = availableSlots(date, serviceId, services, appointments, doctorWorking, doctorId, edit?.id)
  const next = () => {
    if (!patientId) return setError('Select a patient to continue.')
    if (!selectedDoctor) return setError('Add a doctor before booking.')
    if (!serviceId) return setError('Select a cardiology service.')
    if (!date || !time) return setError('Choose an available date and time.')
    if (!slots.includes(time)) return setError('That time is outside the selected doctor’s availability or has just been booked. Choose another slot.')
    setError(''); setStep(2)
  }
  const save = () => onSave({ id: edit?.id || Date.now(), patientId, doctorId, doctorName: selectedDoctor?.name, serviceId, date, time, notes, status: edit?.status || 'Confirmed', source: edit?.source || 'Clinic demo', documents: edit?.documents || [] })
  return <div className="modal-backdrop booking-modal-backdrop"><div className="modal booking-modal">
    <div className="modal-head"><div><span className="eyebrow">{edit ? 'EDIT APPOINTMENT' : 'NEW APPOINTMENT'}</span><h2>{edit ? 'Update appointment' : `Book with ${selectedDoctor?.name || 'a doctor'}`}</h2></div><button className="close" onClick={onClose}>×</button></div>
    <div className="modal-body">
      {step === 1 && <div className="booking-fields">
        <div className="booking-field-group"><Field label="Select patient"><select value={patientId} onChange={(e) => setPatientId(Number(e.target.value))}><option value={0}>Choose a patient</option>{patients.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.phone}</option>)}</select></Field><button className="add-inline" onClick={() => setAddPatient((value) => !value)}>＋ Add a new patient</button>{addPatient && <QuickPatient onSave={(item) => { onAddPatient(item); setPatientId(item.id); setAddPatient(false) }} />}</div>
        <Field label="Doctor"><select value={doctorId} onChange={(event) => { const id = Number(event.target.value); setDoctorId(id); setTime('') }}>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name} · {doctor.specialty}</option>)}</select></Field>
        <Field label="Select service"><select value={serviceId} onChange={(e) => { setServiceId(Number(e.target.value)); setTime('') }}>{services.filter((item) => item.active).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Appointment date"><input type="date" value={date} onChange={(e) => { setDate(e.target.value); setTime('') }} /></Field>
        <Field label="Available time slots" hint={`Calculated from ${selectedDoctor?.name || 'the selected doctor'}’s hours for this weekday, break times, service duration, and existing bookings.`}><div className="slot-grid">{slots.length ? slots.map((item) => <button type="button" className={time === item ? 'selected' : ''} key={item} onClick={() => setTime(item)}>{item}</button>) : <span className="no-slots">No available slots for this doctor on this date.</span>}</div></Field>
        <Field label="Notes (optional)"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add helpful appointment notes" /></Field>
      </div>}
      {step === 2 && <div className="review-card"><div className="review-icon">✓</div><h3>Review booking details</h3><dl><div><dt>Patient</dt><dd>{patients.find((p) => p.id === patientId)?.name}</dd></div><div><dt>Service</dt><dd>{services.find((s) => s.id === serviceId)?.name}</dd></div><div><dt>Date & time</dt><dd>{date} at {time}</dd></div><div><dt>Assigned doctor</dt><dd>{selectedDoctor?.name}</dd></div><div><dt>Duration</dt><dd>{services.find((s) => s.id === serviceId)?.duration} minutes</dd></div><div><dt>Notes</dt><dd>{notes || 'No notes added.'}</dd></div></dl></div>}
      {error && <div className="error-box">{error}</div>}
    </div>
    <div className="modal-actions"><Button kind="secondary" onClick={step === 1 ? onClose : () => { setError(''); setStep(1) }}>{step === 1 ? 'Cancel' : 'Back'}</Button>{step === 1 ? <Button onClick={next}>Continue</Button> : <Button onClick={save}>Confirm appointment</Button>}</div>
  </div></div>
}

function QuickPatient({ onSave }: { onSave: (item: Patient) => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  return <div className="quick-add"><Field label="Full name"><input value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field><Button disabled={!name || !phone} onClick={() => onSave({ id: Date.now(), name, phone, email: '', dob: '', notes: '', gender: 'Prefer not to say' })}>Save patient</Button></div>
}

function AppointmentDetails({ item, patient, service, doctorName, onClose, onEdit, onStatus }: { item: Appointment; patient: Patient; service: Service; doctorName: string; onClose: () => void; onEdit: () => void; onStatus: (s: Status) => void }) {
  const [cancel, setCancel] = useState(false)
  const appointmentDate = new Date(`${item.date}T12:00:00`)
  const month = Number.isNaN(appointmentDate.getTime()) ? '' : appointmentDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  return <div className="drawer-backdrop" onClick={onClose}><aside className="drawer appointment-drawer" onClick={(e) => e.stopPropagation()}>
    <div className="modal-head"><div><span className="eyebrow">APPOINTMENT DETAILS</span><h2>{patient.name}</h2></div><button className="close" onClick={onClose}>×</button></div>
    <div className="appointment-hero"><div className="date-tile"><strong>{item.date.slice(-2)}</strong><span>{month}</span></div><div><h3>{service.name}</h3><p>{item.date} · {item.time}</p><Badge status={item.status} /></div></div>
    <dl className="details-list"><div><dt>Patient contact</dt><dd>{patient.phone}<br />{patient.email || 'Email not provided'}</dd></div><div><dt>Assigned doctor</dt><dd>{doctorName}</dd></div><div><dt>Duration</dt><dd>{service.duration} minutes</dd></div><div><dt>Booking source</dt><dd>{item.source}</dd></div><div><dt>Notes</dt><dd>{item.notes || 'No notes added.'}</dd></div></dl>
    <div className="drawer-actions">{item.status === 'Pending' && <Button onClick={() => onStatus('Confirmed')}>Confirm request</Button>}<Button kind="secondary" onClick={onEdit}>Edit or reschedule</Button>{item.status !== 'Cancelled' && <Button kind="danger" onClick={() => setCancel(true)}>Cancel appointment</Button>}</div>
    {cancel && <div className="inline-confirm"><strong>Cancel this appointment?</strong><p>The record will remain in history and its reminder will be cancelled.</p><div><Button kind="secondary" onClick={() => setCancel(false)}>Keep appointment</Button><Button kind="danger" onClick={() => { onStatus('Cancelled'); setCancel(false) }}>Confirm cancellation</Button></div></div>}
  </aside></div>
}

function Calendar({ appointments, patients, services, working, onNew, onOpen, initialView = 'Month', initialDate = '2025-05-19' }: { appointments: Appointment[]; patients: Patient[]; services: Service[]; working: { start: string; end: string; breakStart: string; breakEnd: string; days: number[] }; onNew: (date: string) => void; onOpen: (a: Appointment) => void; initialView?: 'Month' | 'Week' | 'Day' | 'List'; initialDate?: string }) {
  const demoToday = '2025-05-19'
  const [view, setView] = useState<'Month' | 'Week' | 'Day' | 'List'>(initialView)
  const [selected, setSelected] = useState(initialDate)
  const toDate = (value: string) => new Date(`${value}T12:00:00`)
  const formatDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  const shiftDate = (amount: number, unit: 'day' | 'week' | 'month') => {
    const next = toDate(selected)
    if (unit === 'month') next.setDate(1)
    if (unit === 'month') next.setMonth(next.getMonth() + amount)
    else next.setDate(next.getDate() + amount * (unit === 'week' ? 7 : 1))
    setSelected(formatDate(next))
  }
  const selectedDate = toDate(selected)
  const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12)
  const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const monthCells = Array.from({ length: 42 }, (_, index) => formatDate(new Date(monthStart.getFullYear(), monthStart.getMonth(), index - monthStart.getDay() + 1, 12)))
  const weekStart = new Date(selectedDate)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart)
    day.setDate(day.getDate() + index)
    return formatDate(day)
  })
  const appointmentsOn = (date: string) => appointments.filter((item) => item.date === date)
  const move = (amount: number) => shiftDate(amount, view === 'Month' || view === 'List' ? 'month' : view === 'Week' ? 'week' : 'day')
  const timeSlots = Array.from({ length: 9 }, (_, i) => `${String(i + 9).padStart(2, '0')}:00`)

  return <>
    <Card className="calendar-toolbar">
      <div className="calendar-controls">
        <Button kind="secondary" className="calendar-arrow" aria-label="Previous" onClick={() => move(-1)}>‹</Button>
        <Button kind="secondary" onClick={() => setSelected(demoToday)}>Today</Button>
        <Button kind="secondary" className="calendar-arrow" aria-label="Next" onClick={() => move(1)}>›</Button>
        <strong>{view === 'Week' ? `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6, 12).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : monthLabel}</strong>
      </div>
      <div className="segmented">{(['Month', 'Week', 'Day', 'List'] as const).map((item) => <button className={view === item ? 'active' : ''} onClick={() => setView(item)} key={item}>{item}</button>)}</div>
    </Card>
    {view === 'Month' ? <div className="calendar-layout">
      <Card className="full-calendar"><div className="weekdays">{['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => <span key={day}>{day}</span>)}</div><div className="month-grid">{monthCells.map((date) => <button key={date} className={`${selected === date ? 'selected' : ''} ${date.slice(0, 7) === selected.slice(0, 7) ? '' : 'outside-month'}`} onClick={() => setSelected(date)}><span>{Number(date.slice(-2))}</span>{appointmentsOn(date).map((item) => <i className={item.status.toLowerCase().replace(/ /g, '-')} key={item.id} />)}</button>)}</div></Card>
      <Card className="agenda"><div className="card-title"><div><span className="eyebrow">SELECTED DAY</span><h2>{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2></div><Button onClick={() => onNew(selected)}>＋ Book</Button></div>{appointmentsOn(selected).length ? appointmentsOn(selected).map((item) => <button className="agenda-item" onClick={() => onOpen(item)} key={item.id}><span>{item.time}</span><div><strong>{patients.find((patient) => patient.id === item.patientId)?.name}</strong><small>{services.find((service) => service.id === item.serviceId)?.name}</small></div><Badge status={item.status} /></button>) : <Empty title="No appointments" body="This day is clear and ready for bookings." />}</Card>
    </div> : view === 'List' ? <Appointments appointments={appointments.filter((item) => item.date.startsWith(selected.slice(0, 7)))} patients={patients} services={services} onNew={() => onNew(selected)} onOpen={onOpen} />
      : view === 'Week' ? <div className="week-calendar">{weekDays.map((date) => <Card className="week-day" key={date}><button className={`week-day-heading ${date === selected ? 'active' : ''}`} onClick={() => { setSelected(date); setView('Day') }}><span>{toDate(date).toLocaleDateString('en-US', { weekday: 'short' })}</span><strong>{Number(date.slice(-2))}</strong></button>{appointmentsOn(date).length ? appointmentsOn(date).map((item) => <button className={`week-event ${item.status.toLowerCase().replace(/ /g, '-')}`} key={item.id} onClick={() => onOpen(item)}><strong>{item.time}</strong><span>{patients.find((patient) => patient.id === item.patientId)?.name}</span><small>{services.find((service) => service.id === item.serviceId)?.name}</small></button>) : <button className="week-empty" onClick={() => onNew(date)}>＋ Add</button>}</Card>)}</div>
        : <Card className="time-calendar"><div className="time-head"><div><strong>{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong><span>Dr. Sudhir · {working.start}–{working.end}</span></div><Button onClick={() => onNew(selected)}>＋ New Appointment</Button></div>{timeSlots.map((time) => <div className="time-row" key={time}><span>{time}</span><div>{appointmentsOn(selected).filter((item) => item.time.startsWith(time.slice(0, 2))).map((item) => <button onClick={() => onOpen(item)} key={item.id}><strong>{item.time} · {patients.find((patient) => patient.id === item.patientId)?.name}</strong><small>{services.find((service) => service.id === item.serviceId)?.name}</small></button>)}</div></div>)}</Card>}
  </>
}

function Patients({ patients, appointments, services, followups, setFollowups, toast, onSave, onBook, onUploadDocument, onOpenAppointment }: { patients: Patient[]; appointments: Appointment[]; services: Service[]; followups: Followup[]; setFollowups: (items: Followup[]) => void; toast: (message: string) => void; onSave: (p: Patient) => void; onBook: (id: number) => void; onUploadDocument: (appointmentId: number, category: 'Prescription' | 'Report', file: File) => void; onOpenAppointment: (item: Appointment) => void }) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Patient | null>(null)
  const [selected, setSelected] = useState<Patient | null>(null)
  const list = patients.filter((item) => `${item.name} ${item.phone} ${item.email}`.toLowerCase().includes(query.toLowerCase()))
  const sortedVisits = (patientId: number) => appointments.filter((visit) => visit.patientId === patientId && visit.status !== 'Cancelled').sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
  if (selected) return <PatientProfile patient={selected} appointments={appointments} services={services} followups={followups} setFollowups={setFollowups} toast={toast} onBack={() => setSelected(null)} onBook={() => onBook(selected.id)} onUploadDocument={onUploadDocument} onOpenAppointment={onOpenAppointment} />
  return <>
    <div className="patient-list-summary"><div><span className="eyebrow">PATIENT DIRECTORY</span><h2>{patients.length} registered patients</h2><p>Review contact details and each patient’s next cardiology visit.</p></div><div className="patient-summary-stat"><strong>{appointments.filter((visit) => visit.date >= DEMO_TODAY && visit.status !== 'Cancelled').length}</strong><span>upcoming visits</span></div></div>
    <div className="toolbar patient-toolbar"><div className="search-control">⌕<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or contact" /></div><Button onClick={() => setEditing({ id: Date.now(), name: '', phone: '', email: '', dob: '', notes: '', gender: 'Prefer not to say' })}>＋ Add Patient</Button></div>
    <Card className="patient-table-card">{list.length ? <div className="table-wrap"><table><thead><tr><th>Patient</th><th>Contact details</th><th>Last visit</th><th>Next appointment</th><th>Profile</th></tr></thead><tbody>{list.map((item) => {
      const visits = sortedVisits(item.id)
      const next = visits.find((visit) => visit.date >= DEMO_TODAY)
      const last = visits.filter((visit) => visit.date < DEMO_TODAY).at(-1)
      const service = next && services.find((entry) => entry.id === next.serviceId)
      return <tr key={item.id}>
        <td><button className="person-cell" onClick={() => setSelected(item)}><PatientAvatar patient={item} /><span><strong>{item.name}</strong><small>{item.gender || 'Gender not specified'}{item.dob ? ` · DOB ${item.dob}` : ''}</small></span></button></td>
        <td><span className="patient-contact-phone">{item.phone}</span><small>{item.email || 'No email provided'}</small></td>
        <td><span className="last-visit-date">{last ? new Date(`${last.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No previous visits'}</span>{last && <small>{last.time} · {services.find((entry) => entry.id === last.serviceId)?.name || 'Cardiology visit'}</small>}</td>
        <td>{next ? <button className="next-visit-link" onClick={() => onOpenAppointment(next)}><span className="next-visit-date">{new Date(`${next.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}<Badge status={next.status} /></span><span className="next-visit-detail">{next.time} · {service?.name || 'Cardiology visit'}</span></button> : <button className="book-next-link" onClick={() => onBook(item.id)}>＋ Schedule next visit</button>}</td>
        <td><Button kind="ghost" onClick={() => setSelected(item)}>View profile →</Button></td>
      </tr>
    })}</tbody></table></div> : <Empty />}</Card>
    {editing && <PatientEditor value={editing} onClose={() => setEditing(null)} onSave={(value) => { onSave(value); setEditing(null) }} />}
  </>
}
function PatientEditor({ value, onClose, onSave }: { value: Patient; onClose: () => void; onSave: (p: Patient) => void }) {
  const [data, setData] = useState(value)
  const update = (key: keyof Patient, value: string) => setData((current) => ({ ...current, [key]: value }))
  return <div className="modal-backdrop"><form className="modal patient-form-modal" onSubmit={(e) => { e.preventDefault(); if (data.name.trim() && data.phone.trim()) onSave(data) }}><div className="modal-head"><div><span className="eyebrow">PATIENT RECORD</span><h2>{value.name ? 'Edit patient' : 'Add patient'}</h2></div><button className="close" type="button" onClick={onClose}>×</button></div><div className="modal-body patient-form-body">
    <section className="patient-form-section"><div className="patient-form-section-title"><div><h3>Personal details</h3><p>Contact and identification information</p></div><PatientAvatar patient={data} large /></div><div className="patient-form-grid">
      <Field label="Full name"><input required autoFocus value={data.name} onChange={(e) => update('name', e.target.value)} placeholder="Patient’s full name" /></Field>
      <Field label="Gender"><select value={data.gender || 'Prefer not to say'} onChange={(e) => update('gender', e.target.value)}><option>Female</option><option>Male</option><option>Other</option><option>Prefer not to say</option></select></Field>
      <Field label="Phone number"><input required type="tel" value={data.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+1 (415) 555-0100" /></Field>
      <Field label="Email address"><input type="email" value={data.email} onChange={(e) => update('email', e.target.value)} placeholder="name@example.com" /></Field>
      <Field label="Date of birth"><input type="date" value={data.dob} onChange={(e) => update('dob', e.target.value)} /></Field>
      <Field label="Blood group (optional)"><select value={data.bloodGroup || ''} onChange={(e) => update('bloodGroup', e.target.value)}><option value="">Not recorded</option>{['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'].map((group) => <option key={group}>{group}</option>)}</select></Field>
      <Field label="Address" className="patient-form-full"><input value={data.address || ''} onChange={(e) => update('address', e.target.value)} placeholder="Street, city, postal code" /></Field>
    </div></section>
    <section className="patient-form-section"><div className="patient-form-section-title"><div><h3>Emergency contact</h3><p>Someone the clinic can contact if needed</p></div></div><div className="patient-form-grid">
      <Field label="Contact name"><input value={data.emergencyName || ''} onChange={(e) => update('emergencyName', e.target.value)} placeholder="Full name" /></Field>
      <Field label="Relationship"><input value={data.emergencyRelationship || ''} onChange={(e) => update('emergencyRelationship', e.target.value)} placeholder="e.g. Spouse, child" /></Field>
      <Field label="Contact phone" className="patient-form-full"><input type="tel" value={data.emergencyPhone || ''} onChange={(e) => update('emergencyPhone', e.target.value)} placeholder="Emergency contact number" /></Field>
    </div></section>
    <section className="patient-form-section"><div className="patient-form-section-title"><div><h3>Cardiology & medical history</h3><p>Record information that can help Dr. Sudhir prepare for the visit</p></div></div><div className="patient-form-grid">
      <Field label="Known allergies" className="patient-form-full"><textarea value={data.allergies || ''} onChange={(e) => update('allergies', e.target.value)} placeholder="List allergies or enter ‘None known’" /></Field>
      <Field label="Cardiac or other medical history" className="patient-form-full"><textarea value={data.medicalHistory || ''} onChange={(e) => update('medicalHistory', e.target.value)} placeholder="Relevant diagnoses, procedures, or health history" /></Field>
      <Field label="Current medications" className="patient-form-full"><textarea value={data.medications || ''} onChange={(e) => update('medications', e.target.value)} placeholder="Medication name and dose, if known" /></Field>
      <Field label="Additional notes" className="patient-form-full"><textarea value={data.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Preferences or other helpful details" /></Field>
    </div></section>
  </div><div className="modal-actions"><Button kind="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Save patient</Button></div></form></div>
}
function PatientProfile({ patient, appointments, services, followups, setFollowups, toast, onBack, onBook, onUploadDocument, onOpenAppointment }: { patient: Patient; appointments: Appointment[]; services: Service[]; followups: Followup[]; setFollowups: (items: Followup[]) => void; toast: (message: string) => void; onBack: () => void; onBook: () => void; onUploadDocument: (appointmentId: number, category: 'Prescription' | 'Report', file: File) => void; onOpenAppointment: (item: Appointment) => void }) {
  const history = appointments.filter((item) => item.patientId === patient.id).sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
  const patientFollowups = followups.filter((item) => item.patientId === patient.id)
  const [editingFollowup, setEditingFollowup] = useState<Followup | null>(null)
  const [documentCategory, setDocumentCategory] = useState<'Prescription' | 'Report'>('Prescription')
  const [selectedDocument, setSelectedDocument] = useState<AppointmentDocument | null>(null)
  const nextAppointment = history.find((item) => item.date >= '2025-05-19' && item.status !== 'Cancelled')
  const timeline = [
    ...history.map((appointment) => ({ kind: 'appointment' as const, date: appointment.date, time: appointment.time, appointment })),
    ...patientFollowups.map((followup) => ({ kind: 'followup' as const, date: followup.due, time: '23:59', followup })),
  ].sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))
  const displayDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  const saveFollowup = (item: Followup) => {
    setFollowups(followups.some((current) => current.id === item.id) ? followups.map((current) => current.id === item.id ? item : current) : [...followups, item])
    setEditingFollowup(null)
    toast('Patient follow-up saved.')
  }
  const toggleFollowup = (item: Followup) => {
    const status = item.status === 'Completed' ? 'Pending' : 'Completed'
    setFollowups(followups.map((current) => current.id === item.id ? { ...current, status } : current))
    toast(status === 'Completed' ? 'Follow-up completed.' : 'Follow-up reopened.')
  }
  return <>
    <button className="back-link" onClick={onBack}>← Back to patients</button>
    <div className="profile-layout">
      <Card className="patient-summary"><PatientAvatar patient={patient} large /><h2>{patient.name}</h2><span>Patient #{patient.id} · {patient.gender || 'Gender not specified'}{patient.bloodGroup ? ` · ${patient.bloodGroup}` : ''}</span><Button onClick={onBook}>＋ Create appointment</Button><hr /><dl><div><dt>Phone</dt><dd>{patient.phone}</dd></div><div><dt>Email</dt><dd>{patient.email || 'Not provided'}</dd></div><div><dt>Date of birth</dt><dd>{patient.dob || 'Not provided'}</dd></div>{patient.address && <div><dt>Address</dt><dd>{patient.address}</dd></div>}{patient.emergencyName && <div><dt>Emergency contact</dt><dd>{patient.emergencyName}{patient.emergencyRelationship ? ` · ${patient.emergencyRelationship}` : ''}<br />{patient.emergencyPhone || 'Phone not provided'}</dd></div>}{patient.allergies && <div><dt>Allergies</dt><dd>{patient.allergies}</dd></div>}{patient.medicalHistory && <div><dt>Medical history</dt><dd>{patient.medicalHistory}</dd></div>}{patient.medications && <div><dt>Medications</dt><dd>{patient.medications}</dd></div>}</dl></Card>
      <Card className="next-appointment-card">
        <div className="next-appointment-copy"><span className="eyebrow">NEXT APPOINTMENT</span>{nextAppointment ? <><h2>{services.find((service) => service.id === nextAppointment.serviceId)?.name || 'Cardiology appointment'}</h2><p>{displayDate(nextAppointment.date)} at {nextAppointment.time} · Dr. Sudhir</p></> : <><h2>No upcoming appointment</h2><p>Book the next visit with Dr. Sudhir’s cardiology clinic.</p></>}</div>
        {nextAppointment ? <div className="next-appointment-actions"><Badge status={nextAppointment.status} /><Button kind="secondary" onClick={() => onOpenAppointment(nextAppointment)}>View details</Button></div> : <Button onClick={onBook}>＋ Create appointment</Button>}
      </Card>
      <Card className="patient-timeline">
        <div className="card-title timeline-heading"><div><h2>Patient timeline</h2><p>Appointments, cardiology documents, and follow-up tasks</p></div><Button onClick={() => setEditingFollowup({ id: Date.now(), title: '', patientId: patient.id, due: '2025-05-21', priority: 'Medium', status: 'Pending' })}>＋ Add follow-up</Button></div>
        {timeline.length ? <div className="timeline-list">{timeline.map((entry) => entry.kind === 'appointment' ? <article className="timeline-entry appointment-entry" key={`appointment-${entry.appointment.id}`}>
          <div className="timeline-marker appointment-marker">♥</div>
          <div className="timeline-entry-content">
            <div className="timeline-entry-top"><span>{displayDate(entry.appointment.date)} · {entry.appointment.time}</span><Badge status={entry.appointment.status} /></div>
            <h3>{services.find((service) => service.id === entry.appointment.serviceId)?.name || 'Cardiology appointment'}</h3>
            <p>{entry.appointment.doctorName || 'Dr. Sudhir'} · Cardiology Specialist · {entry.appointment.source}</p>
            {entry.appointment.notes && <p className="timeline-note">{entry.appointment.notes}</p>}
            <div className="timeline-documents">
              {entry.appointment.documents?.length ? entry.appointment.documents.map((document) => <button type="button" className="timeline-document" onClick={() => setSelectedDocument(document)} key={document.id}><span>{document.category}</span><strong>{document.name}</strong><small>View file ↗</small></button>) : <span className="no-documents">No prescriptions or reports attached.</span>}
            </div>
            <div className="timeline-entry-actions"><Button kind="ghost" onClick={() => onOpenAppointment(entry.appointment)}>View appointment</Button><select aria-label="Document type" value={documentCategory} onChange={(event) => setDocumentCategory(event.target.value as 'Prescription' | 'Report')}><option>Prescription</option><option>Report</option></select><label className="timeline-upload"><span aria-hidden="true">↑</span> Upload document<input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) onUploadDocument(entry.appointment.id, documentCategory, file); event.currentTarget.value = '' }} /></label></div>
          </div>
        </article> : <article className="timeline-entry followup-entry" key={`followup-${entry.followup.id}`}>
          <div className="timeline-marker followup-marker">✓</div>
          <div className="timeline-entry-content">
            <div className="timeline-entry-top"><span>{displayDate(entry.followup.due)}</span><Badge status={entry.followup.status} /></div>
            <h3>{entry.followup.title}</h3>
            <p>Patient follow-up · {entry.followup.priority} priority</p>
            <div className="timeline-entry-actions"><button className={`task-check ${entry.followup.status === 'Completed' ? 'done' : ''}`} onClick={() => toggleFollowup(entry.followup)} aria-label={entry.followup.status === 'Completed' ? 'Reopen follow-up' : 'Complete follow-up'}>{entry.followup.status === 'Completed' ? '✓' : ''}</button><span>{entry.followup.status === 'Completed' ? 'Completed' : 'Mark complete'}</span><Button kind="ghost" onClick={() => setEditingFollowup(entry.followup)}>Edit</Button></div>
          </div>
        </article>)}</div> : <Empty title="No timeline activity" body="Appointments and follow-up tasks will appear here." />}
      </Card>
      <Card className="notes-card"><h2>Notes</h2><p>{patient.notes || 'No patient notes have been added.'}</p></Card>
    </div>
    {editingFollowup && <PatientFollowupEditor item={editingFollowup} patientName={patient.name} onClose={() => setEditingFollowup(null)} onSave={saveFollowup} />}
    {selectedDocument && <div className="document-viewer-backdrop" onClick={() => setSelectedDocument(null)}><section className="document-viewer" role="dialog" aria-modal="true" aria-label={`View ${selectedDocument.category.toLowerCase()}`} onClick={(event) => event.stopPropagation()}><header className="document-viewer-header"><div><span className="eyebrow">{selectedDocument.category.toUpperCase()}</span><h2>{selectedDocument.name}</h2></div><button className="close" aria-label="Close document viewer" onClick={() => setSelectedDocument(null)}>×</button></header><div className="document-viewer-content">{selectedDocument.mimeType === 'application/pdf' ? <iframe title={selectedDocument.name} src={selectedDocument.dataUrl} /> : <img src={selectedDocument.dataUrl} alt={selectedDocument.name} />}</div><footer className="document-viewer-footer"><a className="btn secondary" href={selectedDocument.dataUrl} download={selectedDocument.name}>Download file</a><Button onClick={() => setSelectedDocument(null)}>Done</Button></footer></section></div>}
  </>
}

function PatientFollowupEditor({ item, patientName, onClose, onSave }: { item: Followup; patientName: string; onClose: () => void; onSave: (item: Followup) => void }) {
  const [data, setData] = useState(item)
  return <div className="modal-backdrop"><form className="modal small-modal" onSubmit={(event) => { event.preventDefault(); if (data.title) onSave(data) }}><div className="modal-head"><div><span className="eyebrow">PATIENT FOLLOW-UP</span><h2>{item.title ? 'Edit follow-up' : 'Create follow-up'}</h2></div><button className="close" type="button" onClick={onClose}>×</button></div><div className="modal-body form-grid"><Field label="Patient"><input value={patientName} disabled /></Field><Field label="Task title"><input required value={data.title} onChange={(event) => setData({ ...data, title: event.target.value })} /></Field><div className="form-grid two"><Field label="Due date"><input type="date" value={data.due} onChange={(event) => setData({ ...data, due: event.target.value })} /></Field><Field label="Priority"><select value={data.priority} onChange={(event) => setData({ ...data, priority: event.target.value })}><option>Low</option><option>Medium</option><option>High</option></select></Field></div></div><div className="modal-actions"><Button kind="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Save follow-up</Button></div></form></div>
}

function Staff({ working, setWorking, services, doctors, setDoctors }: { working: WorkingHours; setWorking: (v: WorkingHours) => void; services: Service[]; doctors: Doctor[]; setDoctors: (v: Doctor[]) => void }) {
  const [draft, setDraft] = useState(working)
  const [selectedDay, setSelectedDay] = useState(1)
  const [selectedDoctorId, setSelectedDoctorId] = useState(doctors[0]?.id || 1)
  const [editor, setEditor] = useState(false)
  const selectedDoctor = doctors.find((doctor) => doctor.id === selectedDoctorId) || doctors[0]
  const day = draft.weekly[selectedDay]
  const enabledSchedules = Object.values(draft.weekly).filter((item) => item.enabled)
  const scheduleValid = enabledSchedules.length > 0 && enabledSchedules.every((item) => item.start < item.end && item.breakStart <= item.breakEnd && item.breakStart >= item.start && item.breakEnd <= item.end)
  const changeDay = (key: keyof DayHours, value: string | boolean) => setDraft((current) => {
    const updatedDay = { ...current.weekly[selectedDay], [key]: value }
    const weekly = { ...current.weekly, [selectedDay]: updatedDay }
    return { ...current, weekly, days: WEEKDAYS.map((_, index) => weekly[index].enabled ? index : -1).filter((index) => index >= 0) }
  })
  const saveSchedule = () => {
    if (!scheduleValid) return
    const baseline = draft.weekly[draft.days[0] ?? 1]
    const savedSchedule = { ...draft, start: baseline.start, end: baseline.end, breakStart: baseline.breakStart, breakEnd: baseline.breakEnd }
    if (selectedDoctor?.id === 1) setWorking(savedSchedule)
    setDoctors(doctors.map((doctor) => doctor.id === selectedDoctor?.id ? { ...doctor, schedule: savedSchedule } : doctor))
  }
  return <div className="staff-page">
    <div className="staff-page-heading"><p>Manage doctor profiles and set booking availability for each day.</p><Button onClick={() => setEditor(true)}>＋ Add doctor</Button></div>
    <Card className="team-card"><div className="card-title"><div><h2>Doctors <span className="team-count">{doctors.length}</span></h2><p>Provider profiles and specialties</p></div></div><div className="team-list">{doctors.map((doctor) => <article className="team-member" key={doctor.id}><span className="team-avatar doctor-avatar">{doctor.name.replace(/^Dr\.?\s*/i, '').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><div className="team-member-copy"><strong>{doctor.name}</strong><span>{doctor.specialty}</span><small>{doctor.email} · {doctor.phone}</small></div><Badge status="Active" /></article>)}</div></Card>
    <Card className="weekly-hours-card"><div className="card-title"><div><span className="eyebrow">WEEKLY SCHEDULE</span><h2>Working hours & availability</h2><p>Set different clinic and break times for every weekday. Booking slots use the selected doctor’s schedule; days off and break periods cannot be booked.</p></div><label className="schedule-doctor">Schedule for <select value={selectedDoctorId} onChange={(event) => { const id = Number(event.target.value); const doctor = doctors.find((item) => item.id === id); setSelectedDoctorId(id); setDraft(doctor?.schedule || (id === 1 ? working : defaultWorking)) }} aria-label="Select doctor schedule">{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select></label></div>
      <div className="weekly-schedule-layout"><div className="weekday-list">{WEEKDAYS.map((name, index) => { const hours = draft.weekly[index]; return <button type="button" key={name} className={`weekday-option ${selectedDay === index ? 'selected' : ''}`} onClick={() => setSelectedDay(index)}><span className="weekday-dot" /><span className="weekday-option-copy"><strong>{name}</strong><small>{hours.enabled ? `${hours.start}–${hours.end}` : 'Day off'}</small></span><span className={`day-switch ${hours.enabled ? 'on' : ''}`} onClick={(event) => { event.stopPropagation(); changeDay('enabled', !hours.enabled) }} role="switch" aria-checked={hours.enabled} aria-label={`${name} availability`} /></button> })}</div>
        <div className="day-hours-panel"><div className="day-hours-heading"><div><h3>{WEEKDAYS[selectedDay]} availability</h3><p>{day.enabled ? 'Patients can book during these hours.' : 'Enable this day to accept appointments.'}</p></div><label className="availability-toggle"><input type="checkbox" checked={day.enabled} onChange={(event) => changeDay('enabled', event.target.checked)} /><span>{day.enabled ? 'Available' : 'Day off'}</span></label></div>{day.enabled ? <><div className="hours-group"><span className="hours-group-label">Clinic hours</span><div className="form-grid two"><Field label="Starts"><input type="time" value={day.start} onChange={(e) => changeDay('start', e.target.value)} /></Field><Field label="Ends"><input type="time" value={day.end} onChange={(e) => changeDay('end', e.target.value)} /></Field></div></div><div className="hours-group break-group"><span className="hours-group-label">Break time <small>Optional</small></span><div className="form-grid two"><Field label="Break starts"><input type="time" value={day.breakStart} onChange={(e) => changeDay('breakStart', e.target.value)} /></Field><Field label="Break ends"><input type="time" value={day.breakEnd} onChange={(e) => changeDay('breakEnd', e.target.value)} /></Field></div></div></> : <div className="day-off-notice">This doctor is not available on {WEEKDAYS[selectedDay]}. No appointment slots will be offered.</div>}
          <div className="schedule-actions">{!scheduleValid && <span className="schedule-validation">Select an available day and make sure each day’s hours and break times fit within the clinic hours.</span>}<Button kind="secondary" onClick={() => setDraft(selectedDoctor?.schedule || (selectedDoctor?.id === 1 ? working : defaultWorking))}>Discard changes</Button><Button disabled={!scheduleValid} onClick={saveSchedule}>Save weekly schedule</Button></div>
        </div></div>
      <div className="schedule-footnote">Active services: {services.filter((service) => service.active).map((service) => service.name).join(', ') || 'No active services'}</div>
    </Card>
    {editor && <TeamMemberEditor onClose={() => setEditor(false)} onSave={(member) => { const doctor = { ...member, schedule: working }; setDoctors([...doctors, doctor]); setSelectedDoctorId(doctor.id); setDraft(working); setEditor(false) }} />}
  </div>
}

function TeamMemberEditor({ onClose, onSave }: { onClose: () => void; onSave: (member: Doctor) => void }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  return <div className="modal-backdrop"><form className="modal small-modal" onSubmit={(event) => { event.preventDefault(); onSave({ id: Date.now(), name: name.toLowerCase().startsWith('dr.') ? name : `Dr. ${name}`, specialty: role, email, phone }) }}><div className="modal-head"><div><span className="eyebrow">CLINIC TEAM</span><h2>Add doctor</h2></div><button type="button" className="close" onClick={onClose}>×</button></div><div className="modal-body form-grid"><Field label="Full name"><input required autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Dr. Asha Rao" /></Field><Field label="Specialty"><input required value={role} onChange={(event) => setRole(event.target.value)} placeholder="e.g. Cardiologist" /></Field><Field label="Email"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@clinic.com" /></Field><Field label="Phone"><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone number" /></Field></div><div className="modal-actions"><Button kind="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Add doctor</Button></div></form></div>
}

function Services({ services, setServices, toast }: { services: Service[]; setServices: (v: Service[]) => void; toast: (v: string) => void }) {
  const [edit, setEdit] = useState<Service | null>(null)
  const active = services.filter((service) => service.active)
  const avgDuration = active.length ? Math.round(active.reduce((total, service) => total + service.duration, 0) / active.length) : 0
  const feeRange = active.length ? `${formatINR(Math.min(...active.map((service) => service.price)))} – ${formatINR(Math.max(...active.map((service) => service.price)))}` : '—'
  return <>
    <div className="services-heading"><div><span className="eyebrow">CARE CATALOGUE</span><p>Manage the cardiology appointments patients can book with Dr. Sudhir.</p></div><Button onClick={() => setEdit({ id: Date.now(), name: '', description: '', duration: 30, price: 0, active: true, category: 'Consultation', mode: 'In clinic', includes: '', preparation: '', followUp: '' })}>＋ Add service</Button></div>
    <div className="service-overview-stats"><div><span className="service-stat-icon">✚</span><span><small>Active services</small><strong>{active.length}<em> of {services.length}</em></strong></span></div><div><span className="service-stat-icon duration-icon">◷</span><span><small>Average appointment</small><strong>{avgDuration} <em>minutes</em></strong></span></div><div><span className="service-stat-icon fee-icon">₹</span><span><small>Current fee range</small><strong>{feeRange}</strong></span></div></div>
    <div className="service-catalogue-heading"><div><h3>Cardiology care</h3><p>Service information shown to patients during booking.</p></div><span>{active.length} bookable {active.length === 1 ? 'service' : 'services'}</span></div>
    <div className="service-grid">{services.map((item) => <Card key={item.id} className={`service-card ${item.active ? '' : 'inactive-service'}`}><div className="service-card-top"><div className={`service-icon service-icon-${(item.category || 'consultation').toLowerCase().replace(/[^a-z]/g, '-')}`}>{item.category === 'Diagnostics' ? '⌁' : item.category === 'Follow-up' ? '↻' : '♡'}</div><Badge status={item.active ? 'Active' : 'Inactive'} /></div><span className="service-category">{item.category || 'Cardiology service'}</span><h2>{item.name}</h2><p className="service-description">{item.description || 'No description added yet.'}</p>
      <div className="service-facts"><div><small>Appointment length</small><strong>{item.duration} minutes</strong></div><div><small>Fee</small><strong className="service-fee">{formatINR(item.price)}</strong></div><div><small>Visit type</small><strong>{item.mode || 'In clinic'}</strong></div></div>
      <div className="service-extra"><div><span>Included</span><p>{item.includes || 'Details to be confirmed by the clinic.'}</p></div><div><span>Before the visit</span><p>{item.preparation || 'No preparation instructions added.'}</p></div><div><span>Follow-up</span><p>{item.followUp || 'As advised by the doctor.'}</p></div></div>
      <div className="service-card-actions"><Button kind="secondary" onClick={() => setEdit(item)}>Edit service</Button><Button kind="ghost" onClick={() => { setServices(services.map((service) => service.id === item.id ? { ...service, active: !service.active } : service)); toast(`${item.name} ${item.active ? 'removed from' : 'added to'} booking options.`) }}>{item.active ? 'Deactivate' : 'Activate'}</Button></div>
    </Card>)}</div>
    {!services.length && <Card><Empty title="No services yet" body="Add your first cardiology service to make it available for appointments." /></Card>}
    <div className="service-pricing-note"><strong>Pricing note</strong><span>Fees are sample INR amounts for this demo. Confirm the clinic’s final tariff before sharing with patients.</span></div>
    {edit && <ServiceEditor item={edit} onClose={() => setEdit(null)} onSave={(value) => { setServices(services.some((service) => service.id === value.id) ? services.map((service) => service.id === value.id ? value : service) : [...services, value]); setEdit(null); toast('Service saved and booking options updated.') }} />}
  </>
}
function ServiceEditor({ item, onClose, onSave }: { item: Service; onClose: () => void; onSave: (v: Service) => void }) {
  const [data, setData] = useState(item)
  const update = (key: keyof Service, value: string | number) => setData((current) => ({ ...current, [key]: value }))
  return <div className="modal-backdrop"><form className="modal service-editor-modal" onSubmit={(e) => { e.preventDefault(); onSave(data) }}><div className="modal-head"><div><span className="eyebrow">SERVICE SETUP</span><h2>{item.name ? 'Edit service' : 'Add service'}</h2></div><button type="button" className="close" onClick={onClose}>×</button></div><div className="modal-body service-editor-body">
    <div className="service-editor-section"><div className="service-editor-section-heading"><h3>Service details</h3><p>Name and information patients will see when booking.</p></div><div className="patient-form-grid"><Field label="Service name"><input required value={data.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Cardiology consultation" /></Field><Field label="Category"><select value={data.category || 'Consultation'} onChange={(e) => update('category', e.target.value)}><option>Consultation</option><option>Follow-up</option><option>Diagnostics</option><option>Other</option></select></Field><Field label="Description" className="patient-form-full"><textarea required value={data.description} onChange={(e) => update('description', e.target.value)} placeholder="What is this appointment for?" /></Field></div></div>
    <div className="service-editor-section"><div className="service-editor-section-heading"><h3>Booking & fee</h3><p>Set the appointment length, visit format, and fee in Indian rupees.</p></div><div className="patient-form-grid"><Field label="Duration (minutes)"><input type="number" min="15" step="15" value={data.duration} onChange={(e) => update('duration', Number(e.target.value))} /></Field><Field label="Fee (INR)"><div className="rupee-input"><span>₹</span><input type="number" min="0" step="50" value={data.price} onChange={(e) => update('price', Number(e.target.value))} /></div></Field><Field label="Visit type"><select value={data.mode || 'In clinic'} onChange={(e) => update('mode', e.target.value)}><option>In clinic</option><option>Video consultation</option><option>In clinic or video</option></select></Field></div></div>
    <div className="service-editor-section"><div className="service-editor-section-heading"><h3>Patient guidance</h3><p>Share practical expectations before and after the appointment.</p></div><div className="patient-form-grid"><Field label="What’s included" className="patient-form-full"><textarea value={data.includes || ''} onChange={(e) => update('includes', e.target.value)} placeholder="What the patient can expect during this service" /></Field><Field label="Preparation instructions" className="patient-form-full"><textarea value={data.preparation || ''} onChange={(e) => update('preparation', e.target.value)} placeholder="What should the patient bring or prepare?" /></Field><Field label="Follow-up guidance" className="patient-form-full"><textarea value={data.followUp || ''} onChange={(e) => update('followUp', e.target.value)} placeholder="What happens after this appointment?" /></Field></div></div>
  </div><div className="modal-actions"><Button kind="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Save service</Button></div></form></div>
}

function formatAudioTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}
function callAudioText(call: (typeof calls)[number]) {
  return call.transcript.map((line) => `${line.speaker}: ${line.text}`).join('. ')
}
function callAudioLength(call: (typeof calls)[number]) {
  return Math.max(8, Math.round(call.transcript.reduce((sum, line) => sum + line.text.trim().split(/\s+/).length, 0) / 2.6))
}
function CallPlayer({ call, playing, paused, progress, compact = false, onToggle }: { call: (typeof calls)[number]; playing: boolean; paused: boolean; progress: number; compact?: boolean; onToggle: () => void }) {
  const duration = callAudioLength(call)
  const current = progress >= 100 ? duration : Math.min(duration, Math.round(duration * progress / 100))
  return <div className={`call-player ${compact ? 'compact' : ''}`}>
    <button className={`call-player-control ${playing && !paused ? 'is-playing' : ''}`} onClick={onToggle} aria-label={`${playing ? paused ? 'Resume' : 'Pause' : 'Play'} audio for ${call.caller}`} title={playing ? paused ? 'Resume audio' : 'Pause audio' : 'Play audio'}>{playing && !paused ? 'Ⅱ' : '▶'}</button>
    <div className="call-player-content"><div className="call-player-meta">{!compact && <strong>Call audio</strong>}<span>{formatAudioTime(current)} <i>/</i> {formatAudioTime(duration)}</span></div><div className="call-player-progress" aria-label={`Audio progress ${Math.round(progress)} percent`}><i style={{ width: `${Math.max(progress ? 2 : 0, progress)}%` }} /></div>{!compact && <small>Spoken from the sample transcript</small>}</div>
  </div>
}

function Calls({ onAppointment, onFollowup }: { onAppointment: (id: number) => void; onFollowup: (caller: string) => void }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<(typeof calls)[number] | null>(null)
  const [reviewed, setReviewed] = useState<number[]>(calls.filter((c) => c.reviewed).map((c) => c.id))
  const [type, setType] = useState('All call types')
  const [outcome, setOutcome] = useState('All outcomes')
  const [date, setDate] = useState('')
  const [playingId, setPlayingId] = useState<number | null>(null)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [completedId, setCompletedId] = useState<number | null>(null)
  const playbackTimer = useRef<number | null>(null)
  const clearPlaybackTimer = () => { if (playbackTimer.current !== null) window.clearInterval(playbackTimer.current); playbackTimer.current = null }
  const playCall = (call: (typeof calls)[number]) => {
    if (playingId === call.id) {
      if (paused) {
        window.speechSynthesis?.resume()
        setPaused(false)
        const duration = callAudioLength(call)
        playbackTimer.current = window.setInterval(() => setProgress((value) => Math.min(96, value + 100 / (duration * 10))), 100)
      } else {
        window.speechSynthesis?.pause()
        clearPlaybackTimer()
        setPaused(true)
      }
      return
    }
    clearPlaybackTimer()
    window.speechSynthesis?.cancel()
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return
    const text = callAudioText(call)
    const duration = callAudioLength(call)
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.96
    utterance.onboundary = (event) => setProgress(Math.max(1, Math.min(98, Math.round((event.charIndex / text.length) * 100))))
    utterance.onend = () => { clearPlaybackTimer(); setProgress(100); setCompletedId(call.id); setPlayingId(null); setPaused(false) }
    utterance.onerror = () => { clearPlaybackTimer(); setPlayingId(null); setPaused(false) }
    setProgress(0)
    setCompletedId(null)
    setPlayingId(call.id)
    setPaused(false)
    playbackTimer.current = window.setInterval(() => setProgress((value) => Math.min(96, value + 100 / (duration * 10))), 100)
    window.speechSynthesis.speak(utterance)
  }
  useEffect(() => () => { clearPlaybackTimer(); window.speechSynthesis?.cancel() }, [])
  const filtered = calls.filter((call) => `${call.caller} ${call.type} ${call.outcome} ${call.summary}`.toLowerCase().includes(query.toLowerCase()) && (type === 'All call types' || call.type === type) && (outcome === 'All outcomes' || call.outcome === outcome) && (!date || call.date === date))
  const needsReview = calls.filter((call) => !reviewed.includes(call.id)).length
  const bookedOrUpdated = calls.filter((call) => ['Booked', 'Updated'].includes(call.outcome)).length
  return <>
    <div className="demo-notice">Sample call records and transcripts are provided for this prototype. Audio playback is spoken from the sample transcript.</div>
    <div className="call-overview"><div><span className="call-overview-icon">◉</span><span><small>Total calls</small><strong>{calls.length}</strong><em>Sample call records</em></span></div><div><span className="call-overview-icon review-call-icon">!</span><span><small>Needs review</small><strong>{needsReview}</strong><em>Call records to check</em></span></div><div><span className="call-overview-icon booked-call-icon">✓</span><span><small>Booked or updated</small><strong>{bookedOrUpdated}</strong><em>Requests handled by AI</em></span></div><div><span className="call-overview-icon duration-call-icon">◷</span><span><small>Average call length</small><strong>3m 01s</strong><em>Across sample calls</em></span></div></div>
    <div className="toolbar call-toolbar"><div className="search-control">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search caller, call type, or summary" /></div><input aria-label="Filter calls by date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /><select aria-label="Filter calls by type" value={type} onChange={(event) => setType(event.target.value)}><option>All call types</option>{[...new Set(calls.map((call) => call.type))].map((callType) => <option key={callType}>{callType}</option>)}</select><select aria-label="Filter calls by outcome" value={outcome} onChange={(event) => setOutcome(event.target.value)}><option>All outcomes</option>{[...new Set(calls.map((call) => call.outcome))].map((callOutcome) => <option key={callOutcome}>{callOutcome}</option>)}</select></div>
    <Card className="call-table-card"><div className="call-table-heading"><div><h2>Recent calls</h2><p>Review outcomes, listen to the audio, or open a call transcript.</p></div><span>{filtered.length} of {calls.length} calls</span></div>{filtered.length ? <div className="table-wrap"><table><thead><tr><th>Time & date</th><th>Caller</th><th>Call type</th><th>Outcome</th><th>Duration</th><th>Review</th><th>Call audio & details</th></tr></thead><tbody>{filtered.map((call) => <tr key={call.id}><td><strong>{call.when.split(', ')[0]}</strong><small>{call.when.split(', ')[1]}</small></td><td><strong>{call.caller}</strong><small>Inbound · AI receptionist</small></td><td>{call.type}</td><td><Badge status={call.outcome} /></td><td>{call.duration}</td><td><span className={`call-review-label ${reviewed.includes(call.id) ? 'done' : ''}`}><i />{reviewed.includes(call.id) ? 'Reviewed' : 'Needs review'}</span></td><td><div className="call-row-actions"><CallPlayer compact call={call} playing={playingId === call.id} paused={paused} progress={playingId === call.id ? progress : completedId === call.id ? 100 : 0} onToggle={() => playCall(call)} /><Button kind="ghost" onClick={() => setSelected(call)}>Details</Button></div></td></tr>)}</tbody></table></div> : <Empty title="No calls match these filters" body="Try changing the date, call type, outcome, or search terms." />}</Card>
    {selected && <div className="drawer-backdrop" onClick={() => setSelected(null)}><aside className="drawer call-drawer" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">CALL RECORD · {selected.when.toUpperCase()}</span><h2>{selected.caller}</h2></div><button className="close" onClick={() => setSelected(null)}>×</button></div><div className="call-summary"><div className="call-summary-top"><Badge status={selected.outcome} /><span className={`call-review-label ${reviewed.includes(selected.id) ? 'done' : ''}`}><i />{reviewed.includes(selected.id) ? 'Reviewed' : 'Needs review'}</span></div><h3>Call summary</h3><p>{selected.summary}</p><small>Summary from the sample call record.</small></div><section className="call-audio-section" aria-label="Call audio player"><div className="call-audio-heading"><strong>Call audio</strong><span>Sample transcript narration</span></div><CallPlayer call={selected} playing={playingId === selected.id} paused={paused} progress={playingId === selected.id ? progress : completedId === selected.id ? 100 : 0} onToggle={() => playCall(selected)} /><p className="call-audio-note">Audio is spoken from the sample transcript.</p></section><div className="call-transcript"><div className="call-transcript-heading"><div><h3>Transcript</h3><p>Sample conversation · timestamps shown</p></div><span>{selected.transcript.length} turns</span></div><div className="transcript-lines">{selected.transcript.map((line, index) => <article className={`transcript-line ${line.speaker === 'AI receptionist' ? 'ai-line' : ''}`} key={`${selected.id}-${index}`}><time>{line.time}</time><div><strong>{line.speaker}</strong><p>{line.text}</p></div></article>)}</div></div><dl className="details-list"><div><dt>Call type</dt><dd>{selected.type}</dd></div><div><dt>Outcome</dt><dd>{selected.outcome}</dd></div><div><dt>Required action</dt><dd>{selected.outcome === 'Follow-up' ? 'Clinic follow-up' : selected.outcome === 'Booked' ? 'Appointment request recorded' : 'Review details'}</dd></div></dl><div className="drawer-actions">{selected.appointmentId > 0 && <Button onClick={() => onAppointment(selected.appointmentId)}>View related appointment</Button>}<Button kind="secondary" onClick={() => { onFollowup(selected.caller); setSelected(null) }}>Create follow-up</Button>{!reviewed.includes(selected.id) && <Button kind="ghost" onClick={() => setReviewed((current) => [...new Set([...current, selected.id])])}>Mark as reviewed</Button>}</div></aside></div>}
  </>
}

function Followups({ items, setItems, patients, toast }: { items: Followup[]; setItems: (v: Followup[]) => void; patients: Patient[]; toast: (v: string) => void }) {
  const [status, setStatus] = useState('All')
  const [create, setCreate] = useState(false)
  const list = items.filter((item) => status === 'All' || item.status === status)
  return <><div className="toolbar"><select value={status} onChange={(e) => setStatus(e.target.value)}><option>All</option><option>Pending</option><option>Completed</option><option>Overdue</option><option>Cancelled</option></select><input type="date" /><Button onClick={() => setCreate(true)}>＋ Create Follow-up</Button></div><Card>{list.length ? <div className="task-list">{list.map((item) => <div className="task" key={item.id}><button className={`task-check ${item.status === 'Completed' ? 'done' : ''}`} onClick={() => { setItems(items.map((x) => x.id === item.id ? { ...x, status: x.status === 'Completed' ? 'Pending' : 'Completed' } : x)); toast(item.status === 'Completed' ? 'Follow-up reopened.' : 'Follow-up completed.') }}>{item.status === 'Completed' ? '✓' : ''}</button><div><strong>{item.title}</strong><span>{patients.find((p) => p.id === item.patientId)?.name} · Due {item.due}</span></div><Badge status={item.priority} /><Badge status={item.status} /><Button kind="ghost" onClick={() => setItems(items.map((x) => x.id === item.id ? { ...x, due: '2025-05-22' } : x))}>Edit</Button></div>)}</div> : <Empty title="No follow-ups" />}</Card>{create && <QuickFollowup patients={patients} onClose={() => setCreate(false)} onSave={(item) => { setItems([...items, item]); setCreate(false); toast('Follow-up created.') }} />}</>
}
function QuickFollowup({ patients, onClose, onSave }: { patients: Patient[]; onClose: () => void; onSave: (x: Followup) => void }) {
  const [title, setTitle] = useState('')
  const [patientId, setPatientId] = useState(patients[0].id)
  const [due, setDue] = useState('2025-05-21')
  return <div className="modal-backdrop"><div className="modal small-modal"><div className="modal-head"><h2>Create follow-up</h2><button className="close" onClick={onClose}>×</button></div><div className="modal-body form-grid"><Field label="Task title"><input value={title} onChange={(e) => setTitle(e.target.value)} /></Field><Field label="Patient"><select value={patientId} onChange={(e) => setPatientId(Number(e.target.value))}>{patients.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></Field><Field label="Due date"><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field></div><div className="modal-actions"><Button kind="secondary" onClick={onClose}>Cancel</Button><Button disabled={!title} onClick={() => onSave({ id: Date.now(), title, patientId, due, priority: 'Medium', status: 'Pending' })}>Create task</Button></div></div></div>
}

function Reminders({ items, setItems, appointments, patients, toast }: { items: Reminder[]; setItems: (v: Reminder[]) => void; appointments: Appointment[]; patients: Patient[]; toast: (v: string) => void }) {
  return <><div className="demo-notice">Reminder delivery is simulated. No SMS, email, or phone message is sent.</div><Card><div className="table-wrap"><table><thead><tr><th>Related appointment</th><th>Patient</th><th>Scheduled time</th><th>Type</th><th>Delivery status</th><th>Actions</th></tr></thead><tbody>{items.map((item) => { const a = appointments.find((x) => x.id === item.appointmentId); return <tr key={item.id}><td>{a ? `${a.date} · ${a.time}` : 'Historical appointment'}</td><td>{a ? patients.find((p) => p.id === a.patientId)?.name : '—'}</td><td>{item.scheduled}</td><td>{item.type}</td><td><Badge status={item.status} selectedFontSize={[1, 2, 3].includes(item.id)} /></td><td>{item.status === 'Failed' ? <Button kind="secondary" onClick={() => { setItems(items.map((x) => x.id === item.id ? { ...x, status: 'Sent (simulated)' } : x)); toast('Reminder retry marked sent in demo mode.') }}>Retry</Button> : <Button kind="ghost" onClick={() => { setItems(items.map((x) => x.id === item.id ? { ...x, status: 'Cancelled' } : x)); toast('Reminder cancelled.') }}>Cancel</Button>}</td></tr>})}</tbody></table></div></Card></>
}

function Reports({ appointments, services, period, setPeriod }: { appointments: Appointment[]; services: Service[]; period: string; setPeriod: (v: string) => void }) {
  const active = appointments.filter((a) => a.status !== 'Cancelled')
  const confirmed = active.filter((a) => a.status === 'Confirmed' || a.status === 'AI Booking').length
  const estimated = active.reduce((sum, a) => sum + (services.find((s) => s.id === a.serviceId)?.price || 0), 0)
  return <><div className="toolbar"><div><strong>Performance overview</strong><span className="toolbar-note">Metrics use shared fictional demo data.</span></div><select value={period} onChange={(e) => setPeriod(e.target.value)}>{['Today', 'Last 7 days', 'Last 30 days', 'This month', 'Last month', 'Custom date range'].map((x) => <option key={x}>{x}</option>)}</select><Button kind="secondary">Export demo summary</Button></div><div className="metric-grid"><Metric label="Call volume" value={String(calls.length)} change="+12.4%" /><Metric label="AI bookings" value={String(active.filter((a) => a.source === 'AI Receptionist').length)} change="+18.2%" /><Metric label="Confirmed appointments" value={String(confirmed)} change={`${Math.round((confirmed / Math.max(1, active.length)) * 100)}% outcome`} /><Metric label="Estimated revenue impact" value={formatINR(estimated)} change="Not collected revenue" /></div><div className="report-grid"><Card><div className="card-title"><div><h2>Appointment activity</h2><p>Bookings by day · {period}</p></div></div><div className="big-bars">{[42, 70, 54, 88, 75, 50, 36].map((h, i) => <div key={i}><i style={{ height: `${h}%` }} /><span>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</span></div>)}</div></Card><Card><div className="card-title"><div><h2>Booking outcomes</h2><p>Reconciled with appointment records</p></div></div><div className="outcome-summary"><div className="donut"><strong>{active.length}</strong><span>active</span></div><ul><li><i className="blue" /> Confirmed <b>{confirmed}</b></li><li><i className="orange" /> Pending <b>{active.filter((a) => a.status === 'Pending').length}</b></li><li><i className="red" /> Cancelled <b>{appointments.filter((a) => a.status === 'Cancelled').length}</b></li></ul></div></Card><Card><div className="card-title"><div><h2>Follow-up performance</h2><p>Period-based demo tasks</p></div></div><div className="progress-list"><span>Completed on time <b>75%</b></span><progress value="75" max="100" /><span>Patient response rate <b>68%</b></span><progress value="68" max="100" /></div></Card></div></>
}
function Metric({ label, value, change }: { label: string; value: string; change: string }) {
  return <Card className="metric"><span>{label}</span><strong>{value}</strong><small>{change}</small></Card>
}

function Notifications({ read, setRead, go }: { read: number[]; setRead: (v: number[]) => void; go: (p: Page) => void }) {
  return <><div className="toolbar"><div><strong>{notices.filter((n) => !n.read && !read.includes(n.id)).length} unread notifications</strong><span className="toolbar-note">All activity shown is fictional.</span></div><Button kind="secondary" onClick={() => setRead(notices.map((n) => n.id))}>Mark all as read</Button></div><Card><NotificationList read={read} setRead={setRead} go={go} /></Card></>
}
function NotificationList({ read, setRead, go, compact = false }: { read: number[]; setRead: (v: number[]) => void; go: (p: Page) => void; compact?: boolean }) {
  return <div className={`notification-list ${compact ? 'compact' : ''}`}>{notices.map((item) => { const isRead = item.read || read.includes(item.id); return <button className={isRead ? 'read' : ''} key={item.id} onClick={() => { setRead([...read, item.id]); go(item.page) }}><i /><div><strong>{item.title}</strong><span>{item.body}</span><small>{item.time}</small></div><b>›</b></button>})}</div>
}

function Settings({ working, doctors, go, toast }: { working: WorkingHours; doctors: Doctor[]; go: (page: Page) => void; toast: (v: string) => void }) {
  const [tab, setTab] = useState<'Clinic profile' | 'Doctor availability' | 'Booking preferences' | 'AI receptionist'>('Clinic profile')
  const [clinic, setClinic] = useState(() => load('oh-clinic-profile', { name: 'Dr. Sudhir Cardiology Clinic', phone: '(415) 555-0100', email: 'hello@clinicai.example', address: '1200 Market Street, San Francisco, CA' }))
  const [preferences, setPreferences] = useState(() => load('oh-booking-preferences', { confirmation: 'Manual review for AI requests', cancellation: '24 hours' }))
  const [online, setOnline] = useState(() => load('oh-ai-online', true))
  const [selectedDoctorId, setSelectedDoctorId] = useState(doctors[0]?.id || 1)
  const selectedDoctor = doctors.find((doctor) => doctor.id === selectedDoctorId) || doctors[0]
  const schedule = selectedDoctor?.schedule || working
  const timeLabel = (value: string) => { const [hour, minute] = value.split(':').map(Number); return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}` }
  const save = () => {
    localStorage.setItem('oh-clinic-profile', JSON.stringify(clinic))
    localStorage.setItem('oh-booking-preferences', JSON.stringify(preferences))
    localStorage.setItem('oh-ai-online', JSON.stringify(online))
    toast('Clinic settings saved.')
  }
  const tabs = ['Clinic profile', 'Doctor availability', 'Booking preferences', 'AI receptionist'] as const
  return <div className="settings-page">
    <div className="settings-intro"><p>Manage clinic information, booking rules, and receptionist preferences.</p></div>
    <div className="settings-tabs" role="tablist" aria-label="Clinic settings sections">{tabs.map((item) => <button type="button" role="tab" aria-selected={tab === item} className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)}><span>{item === 'Clinic profile' ? '⌂' : item === 'Doctor availability' ? '◷' : item === 'Booking preferences' ? '▤' : '✦'}</span>{item}</button>)}</div>
    <div className="settings-content" role="tabpanel">
      {tab === 'Clinic profile' && <Card><div className="settings-panel-heading"><span className="settings-panel-icon">⌂</span><div><h2>Clinic profile</h2><p>Contact information used across the clinic workspace.</p></div></div><div className="form-grid two"><Field label="Clinic name"><input value={clinic.name} onChange={(event) => setClinic({ ...clinic, name: event.target.value })} /></Field><Field label="Clinic phone"><input type="tel" value={clinic.phone} onChange={(event) => setClinic({ ...clinic, phone: event.target.value })} /></Field><Field label="Contact email"><input type="email" value={clinic.email} onChange={(event) => setClinic({ ...clinic, email: event.target.value })} /></Field><Field label="Clinic address"><input value={clinic.address} onChange={(event) => setClinic({ ...clinic, address: event.target.value })} /></Field></div></Card>}
      {tab === 'Doctor availability' && <Card><div className="settings-panel-heading"><span className="settings-panel-icon availability-settings-icon">◷</span><div><h2>Doctor availability</h2><p>Booking times follow each doctor’s hours for the selected weekday. Breaks and days off are unavailable.</p></div></div><div className="availability-settings-toolbar"><Field label="Doctor"><select value={selectedDoctor?.id || 1} onChange={(event) => setSelectedDoctorId(Number(event.target.value))}>{doctors.map((doctor) => <option value={doctor.id} key={doctor.id}>{doctor.name} · {doctor.specialty}</option>)}</select></Field><Button onClick={() => go('staff')}>Edit weekly schedule →</Button></div><div className="settings-week-list">{WEEKDAYS.map((day, index) => { const hours = schedule.weekly[index]; return <div className={`settings-week-row ${hours.enabled ? 'open' : 'closed'}`} key={day}><span className="settings-week-dot" /><strong>{day}</strong><span>{hours.enabled ? `${timeLabel(hours.start)} – ${timeLabel(hours.end)}` : 'Day off'}</span><small>{hours.enabled ? hours.breakStart === hours.breakEnd ? 'No break' : `Break ${timeLabel(hours.breakStart)} – ${timeLabel(hours.breakEnd)}` : 'No appointment slots'}</small></div> })}</div><div className="info-box settings-availability-note">These saved hours are used to calculate appointment slots. To change hours or breaks, edit the weekly schedule for this doctor.</div></Card>}
      {tab === 'Booking preferences' && <Card><div className="settings-panel-heading"><span className="settings-panel-icon booking-settings-icon">▤</span><div><h2>Booking preferences</h2><p>Choose how incoming booking requests and cancellations are handled in the demo.</p></div></div><div className="form-grid two"><Field label="Booking confirmation"><select value={preferences.confirmation} onChange={(event) => setPreferences({ ...preferences, confirmation: event.target.value })}><option>Manual review for AI requests</option><option>Auto-confirm available requests</option></select><small>AI requests can be reviewed from the Appointments page.</small></Field><Field label="Cancellation notice"><select value={preferences.cancellation} onChange={(event) => setPreferences({ ...preferences, cancellation: event.target.value })}><option>24 hours</option><option>48 hours</option><option>72 hours</option></select><small>Displayed as the clinic’s preferred notice period.</small></Field></div></Card>}
      {tab === 'AI receptionist' && <Card><div className="settings-panel-heading settings-ai-heading"><span className="settings-panel-icon ai-settings-icon">✦</span><div><h2>AI receptionist</h2><p>Demo controls only. No live phone system is connected.</p></div><button type="button" aria-pressed={online} aria-label="Toggle AI receptionist demo status" className={`toggle ${online ? 'on' : ''}`} onClick={() => setOnline(!online)}><i /></button></div><div className="ai-settings-status"><span className={`ai-status-dot ${online ? 'on' : ''}`} /><div><strong>Demo status: {online ? 'Online' : 'Offline'}</strong><p>{online ? 'The sample receptionist is shown as available. Call forwarding remains simulated.' : 'The sample receptionist is shown as offline.'}</p></div></div><div className="info-box">Call examples, playback, and transcripts in this prototype are fictional.</div></Card>}
    </div>
    <div className="sticky-save"><span>Changes are saved on this device.</span><Button onClick={save}>Save settings</Button></div>
  </div>
}

function Popover({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="popover"><div className="popover-head"><strong>{title}</strong><button onClick={onClose}>×</button></div>{children}</div>
}
function Confirm({ title, body, action, onCancel, onConfirm }: { title: string; body: string; action: string; onCancel: () => void; onConfirm: () => void }) {
  return <div className="modal-backdrop"><div className="modal confirm-modal"><div className="confirm-icon">!</div><h2>{title}</h2><p>{body}</p><div className="modal-actions"><Button kind="secondary" onClick={onCancel}>Cancel</Button><Button kind="danger" onClick={onConfirm}>{action}</Button></div></div></div>
}
function SearchPanel({ query, patients, appointments, go, close }: { query: string; patients: Patient[]; appointments: Appointment[]; go: (p: Page) => void; close: () => void }) {
  const p = patients.filter((x) => x.name.toLowerCase().includes(query.toLowerCase())).slice(0, 3)
  return <div className="search-panel"><div className="popover-head"><strong>Search ClinicAI</strong><button onClick={close}>×</button></div>{!query ? <Empty title="Start typing to search" body="Find demo patients, appointments, and AI calls." /> : <><span className="result-label">PATIENTS</span>{p.map((x) => <button className="search-result" key={x.id} onClick={() => { go('patients'); close() }}><span className="avatar">{x.name[0]}</span><div><strong>{x.name}</strong><small>{x.phone}</small></div><b>›</b></button>)}<span className="result-label">RECORDS</span><button className="search-result" onClick={() => { go('appointments'); close() }}><span className="result-icon">▣</span><div><strong>{appointments.length} appointments</strong><small>Open appointment list</small></div><b>›</b></button><button className="search-result" onClick={() => { go('calls'); close() }}><span className="result-icon">◌</span><div><strong>{calls.length} AI calls</strong><small>Open call history</small></div><b>›</b></button></>}</div>
}
