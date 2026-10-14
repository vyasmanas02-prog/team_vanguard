import { useState } from 'react'
import { SUBJECTS, useStore, setState, uid, notify, audit, inClass, classLabel } from '../../../store.js'
import { Table } from '../../../pages.jsx'

export default function AttendanceOD({ user }) {
  const s = useStore()
  const [eventName, setEventName] = useState('')
  const [classSubject, setClassSubject] = useState(SUBJECTS[0])
  const [date, setDate] = useState('')
  const isApprover = ['sports_coordinator', 'admin', 'teacher'].includes(user.role)
  const ownRequests = s.odRequests.filter((request) => request.studentId === user.id)
  const studentFor = (request) => s.users.find((student) => student.id === request.studentId)
  const visibleRequests = user.role === 'student' ? ownRequests : s.odRequests.filter((request) => {
    if (user.role !== 'teacher') return true
    const student = studentFor(request)
    return student && (user.classes || []).some((classInfo) => inClass(student, classInfo))
  })

  const submitRequest = (event) => {
    event.preventDefault()
    if (!eventName.trim() || !date || !SUBJECTS.includes(classSubject)) return
    const duplicate = s.odRequests.some((request) => request.studentId === user.id && request.date === date && request.classSubject === classSubject && request.status !== 'rejected')
    if (duplicate) return
    setState((d) => {
      const request = { id: uid(), studentId: user.id, studentName: user.name, rollNumber: user.rollNumber || user.id, classInfo: { college: user.college, branch: user.branch, batch: user.batch, section: user.section }, eventName: eventName.trim(), classSubject, date, status: 'pending' }
      d.odRequests.push(request)
      audit(d, user.id, 'submitted', 'od_request', request.id, { eventName: request.eventName, subject: classSubject, date })
      return d
    })
    setEventName('')
    setDate('')
  }

  const decide = (requestId, status) => setState((d) => {
    const request = d.odRequests.find((item) => item.id === requestId)
    if (!request || request.status !== 'pending' || !['approved', 'rejected'].includes(status)) return d
    const student = d.users.find((item) => item.id === request.studentId)
    if (user.role === 'teacher' && (!student || !(user.classes || []).some((classInfo) => inClass(student, classInfo)))) return d
    if (status === 'approved') {
      const duplicate = d.odRequests.some((item) => item.id !== request.id && item.studentId === request.studentId && item.date === request.date && item.classSubject === request.classSubject && item.status === 'approved')
      if (duplicate || !SUBJECTS.includes(request.classSubject) || !d.attendance[request.studentId]) return d
      const attendance = d.attendance[request.studentId][request.classSubject]
      if (!attendance) return d
      attendance.total += 1
      attendance.attended += 1
      notify(d, request.studentId, `OD approved for ${request.eventName}; marked present in ${request.classSubject} on ${request.date}.`)
    }
    request.status = status
    audit(d, user.id, status, 'od_request', request.id, { studentId: request.studentId, subject: request.classSubject, date: request.date })
    return d
  })

  return (
    <div>
      <h2>Event attendance approval</h2>
      {user.role === 'student' && <form className="card" onSubmit={submitRequest}>
        <h3>Request on-duty attendance</h3>
        <div className="row wrap">
          <input placeholder="College event or function" value={eventName} onChange={(event) => setEventName(event.target.value)} required />
          <select value={classSubject} onChange={(event) => setClassSubject(event.target.value)}>{SUBJECTS.map((subject) => <option key={subject}>{subject}</option>)}</select>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          <button>Submit for approval</button>
        </div>
        <p className="muted">An approved request records you as present for the selected subject on this date.</p>
      </form>}

      <h3>{user.role === 'student' ? 'My requests' : 'Requests to review'}</h3>
      <Table head={['Student', 'Class', 'Event', 'Subject', 'Date', 'Status', ...(isApprover ? ['Decision'] : [])]} rows={visibleRequests.map((request) => [request.studentName, request.classInfo ? classLabel(request.classInfo) : 'Class unavailable', request.eventName, request.classSubject, request.date, request.status === 'approved' ? 'Approved · Present' : request.status, ...(isApprover ? [request.status === 'pending' ? <span className="row"><button className="small" onClick={() => decide(request.id, 'approved')}>Approve</button><button className="ghost small" onClick={() => decide(request.id, 'rejected')}>Reject</button></span> : ''] : [])])} />
    </div>
  )
}
