import { useSyncExternalStore } from 'react'

const KEY = 'campus-erp-v4'
export const SUBJECTS = ['Maths', 'Physics', 'Programming', 'Electronics']
const NAMES = ['Aarav Sharma', 'Diya Patel', 'Rohan Meena', 'Isha Joshi', 'Kabir Singh', 'Ananya Gupta', 'Vivaan Jain', 'Meera Nair', 'Arjun Reddy', 'Sana Khan', 'Neha Kapoor', 'Yash Verma']
// [college, branch or class, batch, section] for each student above, in the same order
const INFO = [
  ['College of Engineering', 'CSE', '2023-27', 'A'],
  ['College of Engineering', 'ECE', '2023-27', 'A'],
  ['College of Engineering', 'CSE', '2023-27', 'B'],
  ['College of Engineering', 'ECE', '2023-27', 'B'],
  ['College of Engineering', 'CSE', '2024-28', 'A'],
  ['College of Engineering', 'ECE', '2024-28', 'A'],
  ['College of Engineering', 'CSE', '2024-28', 'B'],
  ['College of Engineering', 'ECE', '2024-28', 'B'],
  ['College of Science', 'Physics', '2023-26', 'A'],
  ['College of Science', 'Physics', '2023-26', 'B'],
  ['College of Science', 'Chemistry', '2024-27', 'A'],
  ['College of Science', 'Chemistry', '2024-27', 'A'],
]
const ENG = 'College of Engineering'
const SCI = 'College of Science'
const classesOf = (college, branch, pairs) => pairs.map(([batch, section]) => ({ college, branch, batch, section }))
const H = 3600000

// ---- class helpers (college + branch + batch + section = one class) ----
export const CLASS_KEYS = ['college', 'branch', 'batch', 'section']
export const classKey = (c) => CLASS_KEYS.map((k) => c[k]).join('|')
export const classLabel = (c) => `${c.branch} ${c.batch} Sec ${c.section}`
export const inClass = (u, c) => CLASS_KEYS.every((k) => u[k] === c[k])
export const visibleNotice = (n, user) => !n.audience || user.role !== 'student' || inClass(user, n.audience)
export function allClasses(s) {
  const m = new Map()
  s.users.filter((u) => u.role === 'student').forEach((u) => {
    const c = { college: u.college, branch: u.branch, batch: u.batch, section: u.section }
    m.set(classKey(c), c)
  })
  return [...m.values()].sort((a, b) => classKey(a).localeCompare(classKey(b)))
}
export const teachersOfStudent = (s, st) => s.users.filter((u) => u.role === 'teacher' && (u.classes || []).some((c) => inClass(st, c)))
// Removes a user and everything that belongs to them. Call inside setState.
export function removeUser(d, id) {
  d.users = d.users.filter((u) => u.id !== id)
  delete d.marks[id]
  delete d.attendance[id]
  d.channels.forEach((c) => (c.members = c.members.filter((m) => m !== id)))
  ;['certificates', 'submissions', 'counselling', 'documents', 'leaves', 'fees'].forEach((k) => (d[k] = d[k].filter((x) => x.studentId !== id)))
  d.feedback = d.feedback.filter((f) => f.studentId !== id && f.teacherId !== id)
  d.libraryIssues = d.libraryIssues.filter((item) => item.studentId !== id)
  d.libraryReservations = d.libraryReservations.filter((item) => item.studentId !== id)
  d.sportsIssues = d.sportsIssues.filter((item) => item.studentId !== id)
  d.sportsBookings = d.sportsBookings.filter((item) => item.studentId !== id)
  d.sportsPerformance = d.sportsPerformance.filter((item) => item.studentId !== id)
  d.odRequests = d.odRequests.filter((item) => item.studentId !== id)
  d.timetable.forEach((t) => { if (t.teacherId === id) t.teacherId = '' })
  d.notifications = d.notifications.filter((n) => n.userId !== id)
}

export const uid = () => Math.random().toString(36).slice(2, 9)
export const pct = (a) => (a.total ? Math.round((a.attended / a.total) * 100) : 0)
export function grade(p) {
  return p >= 85 ? 'A' : p >= 70 ? 'B' : p >= 55 ? 'C' : p >= 40 ? 'D' : 'F'
}
// userId can be a user id or 'all'. Call inside setState.
export function notify(d, userId, text) {
  d.notifications.unshift({ id: uid(), userId, text, time: Date.now() })
}
export function audit(d, actorId, action, entityType, entityId, details = {}) {
  d.auditEvents ||= []
  d.auditEvents.unshift({ id: uid(), actorId, action, entityType, entityId, details, time: Date.now() })
  d.auditEvents = d.auditEvents.slice(0, 300)
}

function rnd(seed) {
  let s = seed
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280)
}

function seed() {
  const r = rnd(7)
  const t = Date.now()
  const users = [
    { id: 'a1', name: 'Admin Office', role: 'admin' },
    { id: 'l1', name: 'Library Operator', role: 'library_operator' },
    { id: 'sp1', name: 'Sports Coordinator', role: 'sports_coordinator' },
    {
      id: 't1', name: 'Prof. Verma', role: 'teacher', dept: 'CSE', designation: 'HOD and Professor',
      phone: '+91 90000 00002', email: 'verma@college.edu', subjects: ['Programming', 'Maths'],
      classes: classesOf(ENG, 'CSE', [['2023-27', 'A'], ['2023-27', 'B'], ['2024-28', 'A'], ['2024-28', 'B']]),
    },
    {
      id: 't2', name: 'Prof. Iyer', role: 'teacher', dept: 'ECE', designation: 'HOD and Associate Professor',
      phone: '+91 90000 00003', email: 'iyer@college.edu', subjects: ['Electronics', 'Physics'],
      classes: [
        ...classesOf(ENG, 'ECE', [['2023-27', 'A'], ['2023-27', 'B'], ['2024-28', 'A'], ['2024-28', 'B']]),
        ...classesOf(SCI, 'Physics', [['2023-26', 'A'], ['2023-26', 'B']]),
      ],
    },
    ...NAMES.map((n, i) => ({ id: 's' + (i + 1), name: n, role: 'student', college: INFO[i][0], branch: INFO[i][1], batch: INFO[i][2], section: INFO[i][3] })),
  ]
  const students = users.filter((u) => u.role === 'student')
  const marks = {}
  const attendance = {}
  students.forEach((s) => {
    marks[s.id] = {}
    attendance[s.id] = {}
    SUBJECTS.forEach((sub) => {
      marks[s.id][sub] = Math.round(45 + r() * 50)
      attendance[s.id][sub] = { attended: Math.round(24 + r() * 16), total: 40 }
    })
  })
  const cse = students.filter((s) => s.branch === 'CSE').map((s) => s.id)
  const ece = students.filter((s) => s.branch === 'ECE').map((s) => s.id)
  const d = {
    users,
    staff: [
      { id: 'f1', name: 'Dr. R. K. Mehta', role: 'Principal', phone: '+91 90000 00001', email: 'principal@college.edu' },
      { id: 'f2', name: 'Prof. Verma', role: 'HOD, CSE', phone: '+91 90000 00002', email: 'verma@college.edu' },
      { id: 'f3', name: 'Prof. Iyer', role: 'HOD, ECE', phone: '+91 90000 00003', email: 'iyer@college.edu' },
      { id: 'f4', name: 'Exam Cell', role: 'Office', phone: '+91 90000 00004', email: 'exams@college.edu' },
      { id: 'f5', name: 'Library', role: 'Office', phone: '+91 90000 00005', email: 'library@college.edu' },
    ],
    events: [
      { id: 'e1', title: 'Hackathon 2026', date: '2026-10-20' },
      { id: 'e2', title: 'Inter-college Quiz', date: '2026-10-25' },
      { id: 'e3', title: 'Robotics Workshop', date: '2026-11-02' },
      { id: 'e4', title: 'Cultural Fest', date: '2026-11-10' },
    ],
    certificates: [
      { id: 'c1', eventId: 'e1', studentId: 's1', file: 'hackathon-cert.pdf', dataUrl: null, status: 'verified' },
      { id: 'c2', eventId: 'e1', studentId: 's2', file: 'hack.png', dataUrl: null, status: 'pending' },
    ],
    marks,
    attendance,
    libraryBooks: [
      { id: 'b1', title: 'Introduction to Algorithms', author: 'Thomas H. Cormen', total: 8, available: 7 },
      { id: 'b2', title: 'Clean Code', author: 'Robert C. Martin', total: 5, available: 5 },
      { id: 'b3', title: 'Physics: Principles with Applications', author: 'Douglas C. Giancoli', total: 6, available: 6 },
    ],
    libraryIssues: [
      { id: 'bi1', bookId: 'b1', bookTitle: 'Introduction to Algorithms', studentId: 's1', studentName: 'Aarav Sharma', rollNumber: 's1', date: '2026-10-12', issuedDate: '2026-10-12', dueDate: '2026-10-26', status: 'issued' },
      { id: 'bi2', bookId: 'b2', bookTitle: 'Clean Code', studentId: 's2', studentName: 'Diya Patel', rollNumber: 's2', date: '2026-10-13', status: 'requested' },
    ],
    libraryReservations: [],
    libraryLayout: { rows: 2, columns: 5 },
    librarySeats: Array.from({ length: 10 }, (_, i) => ({
      id: 'seat' + (i + 1),
      seatNumber: `R${Math.floor(i / 5) + 1}-S${(i % 5) + 1}`,
      row: Math.floor(i / 5),
      column: i % 5,
      active: true,
      isOccupied: i === 1 || i === 5,
    })),
    sportsEquipment: [
      { id: 'se1', name: 'Football', total: 12, available: 11 },
      { id: 'se2', name: 'Basketball', total: 8, available: 8 },
      { id: 'se3', name: 'Badminton Racket', total: 10, available: 7 },
    ],
    sportsFacilities: [
      { id: 'sf1', name: 'Basketball Court', type: 'Court' },
      { id: 'sf2', name: 'Main Football Ground', type: 'Field' },
      { id: 'sf3', name: 'Badminton Court 1', type: 'Court' },
    ],
    sportsBookings: [],
    sportsIssues: [
      { id: 'si1', equipmentId: 'se1', itemName: 'Football', studentId: 's3', studentName: 'Rohan Meena', rollNumber: 's3', time: '2026-10-13', status: 'issued' },
    ],
    sportsPerformance: [
      { id: 'perf1', studentId: 's1', sport: 'Athletics', event: 'College Sports Day', achievement: '100 m: 2nd place', score: '12.8 sec', date: '2026-10-10' },
    ],
    auditEvents: [],
    odRequests: [],
    assignments: [{ id: 'as1', title: 'Lab 1: Arrays in C', due: '2026-10-30', desc: 'Upload your lab file.' }],
    submissions: [],
    channels: [
      { id: 'ch1', name: 'Coding Club', type: 'club', desc: 'Weekly coding sessions and contests.', ownerId: 's1', members: ['s1', 's2', 's3', 't1'] },
      { id: 'ch2', name: 'CSE Branch', type: 'branch', desc: 'Updates for CSE students.', ownerId: 't1', members: [...cse, 't1'] },
      { id: 'ch3', name: 'ECE Branch', type: 'branch', desc: 'Updates for ECE students.', ownerId: 't2', members: [...ece, 't2'] },
      { id: 'ch4', name: 'Photography Club', type: 'club', desc: 'Share your best campus shots.', ownerId: 's4', members: ['s4', 's5', 's6'] },
      { id: 'ch5', name: 'Placement Updates', type: 'channel', desc: 'Company visits and tips.', ownerId: 't1', members: ['t1', 's1', 's2', 's3'] },
    ],
    posts: [
      { id: 'p1', channelId: 'ch1', authorId: 's1', text: 'Contest this Saturday at 4 PM in Lab 2. Bring your laptop!', photo: null, time: t - 2 * H, likes: ['s2'], comments: [{ id: 'k1', authorId: 's2', text: 'I will be there.', time: t - H }] },
      { id: 'p2', channelId: 'ch5', authorId: 't1', text: 'A company visit is planned next week. Update your resume.', photo: null, time: t - 5 * H, likes: [], comments: [] },
      { id: 'p3', channelId: 'ch2', authorId: 't1', text: 'Unit test 2 syllabus is on the notice board.', photo: null, time: t - 26 * H, likes: ['s1', 's3'], comments: [] },
      { id: 'p4', channelId: 'ch1', authorId: 's2', text: 'Which language for the next contest?', photo: null, time: t - 3 * H, likes: [], comments: [], poll: { options: [{ id: 'o1', text: 'C++', votes: ['s1', 's2'] }, { id: 'o2', text: 'Python', votes: ['s3'] }, { id: 'o3', text: 'Java', votes: [] }] } },
    ],
    notices: [
      { id: 'n4', title: 'CSE 2023-27 Sec A: lab file check on Friday', body: 'Bring your Lab 1 file.', authorId: 't1', kind: 'official', time: t - H, audience: classesOf(ENG, 'CSE', [['2023-27', 'A']])[0] },
      { id: 'n1', title: 'Mid-sem exam timetable released', body: 'Check the exam cell board. Exams start on 3 November.', authorId: 'a1', kind: 'official', time: t - 3 * H },
      { id: 'n2', title: 'Library open till 8 PM this week', body: 'Extended hours for exam preparation.', authorId: 'a1', kind: 'official', time: t - 6 * H },
      { id: 'n3', title: 'Hackathon registration closes Friday', body: 'Register with your team of 4.', authorId: 't1', kind: 'official', time: t - 50 * H },
    ],
    notifications: [],
    readAt: {},
    counselling: [],
    documents: [],
    leaves: [{ id: 'lv1', studentId: 's3', from: '2026-10-20', to: '2026-10-21', reason: 'Family function', status: 'pending', time: t - 4 * H, decidedBy: '' }],
    fees: students.flatMap((st) => [
      { id: uid(), studentId: st.id, title: 'Tuition fee', amount: 50000, due: '2026-11-15', status: r() > 0.5 ? 'paid' : 'pending' },
      { id: uid(), studentId: st.id, title: 'Exam fee', amount: 2000, due: '2026-10-31', status: 'pending' },
    ]),
    timetable: allClasses({ users }).flatMap((c) =>
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].flatMap((day, di) =>
        ['09:00', '10:00', '11:30'].map((time, si) => ({
          id: uid(), ...c, day, time, subject: SUBJECTS[(di + si + (c.branch === 'CSE' ? 0 : 2)) % 4], teacherId: c.branch === 'CSE' ? 't1' : 't2',
        }))
      )
    ),
    lostfound: [
      { id: 'lf1', kind: 'lost', title: 'Blue water bottle', desc: 'Left in Lab 2 on Monday.', photo: null, authorId: 's5', status: 'open', time: t - 10 * H },
      { id: 'lf2', kind: 'found', title: 'Casio calculator', desc: 'Found near the library. Collect it from the office.', photo: null, authorId: 'a1', status: 'open', time: t - 3 * H },
    ],
    // Ratings and complaints about teachers. Only the admin screen reads this.
    feedback: [
      { id: 'fb1', teacherId: 't1', studentId: 's1', kind: 'rating', stars: 5, message: 'Explains arrays and pointers very clearly.', anonymous: false, status: 'new', time: t - 20 * H },
      { id: 'fb2', teacherId: 't1', studentId: 's3', kind: 'rating', stars: 4, message: '', anonymous: true, status: 'new', time: t - 30 * H },
      { id: 'fb3', teacherId: 't2', studentId: 's4', kind: 'complaint', stars: 0, message: 'Lab sessions often start 20 minutes late.', anonymous: true, status: 'new', time: t - 8 * H },
    ],
  }
  notify(d, 'all', 'Notice: Mid-sem exam timetable released')
  students.forEach((s) =>
    SUBJECTS.forEach((sub) => {
      if (pct(attendance[s.id][sub]) < 75) notify(d, s.id, `Attendance below 75% in ${sub}`)
    })
  )
  return d
}

let state
try {
  state = JSON.parse(localStorage.getItem(KEY)) || seed()
} catch {
  state = seed()
}
const moduleDefaults = ['libraryBooks', 'libraryIssues', 'libraryReservations', 'librarySeats', 'libraryLayout', 'sportsEquipment', 'sportsFacilities', 'sportsBookings', 'sportsIssues', 'sportsPerformance', 'auditEvents', 'odRequests'].some((key) => state[key] === undefined) ? seed() : null
state.libraryBooks ||= moduleDefaults.libraryBooks
state.libraryIssues ||= moduleDefaults.libraryIssues
state.libraryReservations ||= moduleDefaults.libraryReservations
state.librarySeats ||= moduleDefaults.librarySeats
state.libraryLayout ||= moduleDefaults.libraryLayout || { rows: Math.ceil(state.librarySeats.length / 5), columns: 5 }
state.librarySeats = state.librarySeats.map((seat, index) => ({
  ...seat,
  row: seat.row ?? Math.floor(index / state.libraryLayout.columns),
  column: seat.column ?? index % state.libraryLayout.columns,
  seatNumber: seat.seatNumber || `R${Math.floor(index / state.libraryLayout.columns) + 1}-S${(index % state.libraryLayout.columns) + 1}`,
  active: seat.active ?? true,
}))
state.sportsEquipment ||= moduleDefaults.sportsEquipment
state.sportsFacilities ||= moduleDefaults.sportsFacilities
state.sportsBookings ||= moduleDefaults.sportsBookings
state.sportsIssues ||= moduleDefaults.sportsIssues
state.sportsPerformance ||= moduleDefaults.sportsPerformance
state.auditEvents ||= moduleDefaults.auditEvents
state.odRequests ||= moduleDefaults.odRequests
if (!state.users.some((u) => u.role === 'library_operator')) state.users.push({ id: 'l1', name: 'Library Operator', role: 'library_operator' })
if (!state.users.some((u) => u.role === 'sports_coordinator')) state.users.push({ id: 'sp1', name: 'Sports Coordinator', role: 'sports_coordinator' })
const listeners = new Set()

export function setState(fn) {
  state = fn(structuredClone(state))
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // storage full (many photos): the app keeps working in memory
  }
  listeners.forEach((l) => l())
}
export function resetData() {
  setState(() => seed())
}
export function useStore() {
  return useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => state
  )
}
