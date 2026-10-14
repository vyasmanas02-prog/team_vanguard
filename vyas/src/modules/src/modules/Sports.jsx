import { useState } from 'react'
import { useStore, setState, uid, notify, audit } from '../../../store.js'
import { Table } from '../../../pages.jsx'

export default function Sports({ user }) {
  const s = useStore()
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [equipmentId, setEquipmentId] = useState('')
  const [issueStudentId, setIssueStudentId] = useState('')
  const [issueEquipmentId, setIssueEquipmentId] = useState('')
  const [editEquipmentId, setEditEquipmentId] = useState('')
  const [editName, setEditName] = useState('')
  const [editTotal, setEditTotal] = useState('')
  const [performanceStudentId, setPerformanceStudentId] = useState('')
  const [performanceSport, setPerformanceSport] = useState('')
  const [performanceEvent, setPerformanceEvent] = useState('')
  const [performanceAchievement, setPerformanceAchievement] = useState('')
  const [performanceScore, setPerformanceScore] = useState('')
  const [performanceDate, setPerformanceDate] = useState(new Date().toISOString().slice(0, 10))
  const [facilityName, setFacilityName] = useState('')
  const [facilityType, setFacilityType] = useState('Court')
  const [bookingFacilityId, setBookingFacilityId] = useState('')
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().slice(0, 10))
  const [bookingStart, setBookingStart] = useState('16:00')
  const [bookingEnd, setBookingEnd] = useState('17:00')
  const [bookingMessage, setBookingMessage] = useState('')
  const manager = user.role === 'admin' || user.role === 'sports_coordinator'
  const myIssues = s.sportsIssues.filter((issue) => issue.studentId === user.id)
  const students = s.users.filter((student) => student.role === 'student')
  const facilities = s.sportsFacilities || []
  const bookings = s.sportsBookings || []

  const addEquipment = (event) => {
    event.preventDefault()
    const count = Number(quantity)
    if (!name.trim() || !Number.isInteger(count) || count < 1) return
    setState((d) => {
      const item = { id: uid(), name: name.trim(), total: count, available: count }
      d.sportsEquipment.push(item)
      audit(d, user.id, 'created', 'sports_equipment', item.id, { name: item.name, quantity: count })
      return d
    })
    setName('')
    setQuantity('1')
  }

  const requestEquipment = (event) => {
    event.preventDefault()
    if (!equipmentId || myIssues.some((issue) => issue.equipmentId === equipmentId && ['requested', 'issued'].includes(issue.status))) return
    const item = s.sportsEquipment.find((equipment) => equipment.id === equipmentId)
    if (!item || item.available < 1) return
    setState((d) => {
      const issue = { id: uid(), equipmentId, itemName: item.name, studentId: user.id, studentName: user.name, rollNumber: user.rollNumber || user.id, time: new Date().toISOString().slice(0, 10), status: 'requested' }
      d.sportsIssues.push(issue)
      audit(d, user.id, 'requested', 'sports_equipment', equipmentId, { name: item.name })
      return d
    })
    setEquipmentId('')
  }

  const issueToStudent = (event) => {
    event.preventDefault()
    if (!manager || !issueStudentId || !issueEquipmentId) return
    const student = students.find((item) => item.id === issueStudentId)
    const equipment = s.sportsEquipment.find((item) => item.id === issueEquipmentId)
    if (!student || !equipment || equipment.available < 1) return
    setState((d) => {
      const availableEquipment = d.sportsEquipment.find((item) => item.id === issueEquipmentId)
      if (!availableEquipment || availableEquipment.available < 1) return d
      availableEquipment.available -= 1
      const issue = {
        id: uid(),
        equipmentId: availableEquipment.id,
        itemName: availableEquipment.name,
        studentId: student.id,
        studentName: student.name,
        rollNumber: student.rollNumber || student.id,
        time: new Date().toISOString().slice(0, 10),
        status: 'issued',
      }
      d.sportsIssues.push(issue)
      audit(d, user.id, 'issued', 'sports_equipment', availableEquipment.id, { studentId: student.id, name: availableEquipment.name })
      return d
    })
    setIssueStudentId('')
    setIssueEquipmentId('')
  }

  const decideIssue = (issueId, decision) => setState((d) => {
    const issue = d.sportsIssues.find((item) => item.id === issueId)
    const equipment = d.sportsEquipment.find((item) => item.id === issue?.equipmentId)
    if (!issue || issue.status !== 'requested') return d
    if (decision === 'issued' && equipment?.available > 0) {
      issue.status = 'issued'
      equipment.available -= 1
    } else {
      issue.status = 'rejected'
    }
    audit(d, user.id, decision, 'sports_issue', issue.id, { studentId: issue.studentId, equipment: issue.itemName })
    return d
  })

  const returnEquipment = (issueId) => setState((d) => {
    const issue = d.sportsIssues.find((item) => item.id === issueId)
    const equipment = d.sportsEquipment.find((item) => item.id === issue?.equipmentId)
    if (issue?.status === 'issued') {
      issue.status = 'returned'
      if (equipment) equipment.available = Math.min(equipment.total, equipment.available + 1)
      audit(d, user.id, 'returned', 'sports_issue', issue.id, { equipment: issue.itemName })
    }
    return d
  })

  const selectEquipmentToEdit = (id) => {
    const item = s.sportsEquipment.find((equipment) => equipment.id === id)
    setEditEquipmentId(id)
    setEditName(item?.name || '')
    setEditTotal(item ? String(item.total) : '')
  }

  const updateEquipment = (event) => {
    event.preventDefault()
    const total = Number(editTotal)
    if (!editEquipmentId || !editName.trim() || !Number.isInteger(total) || total < 1) return
    setState((d) => {
      const item = d.sportsEquipment.find((equipment) => equipment.id === editEquipmentId)
      const issued = d.sportsIssues.filter((issue) => issue.equipmentId === editEquipmentId && issue.status === 'issued').length
      if (item && total >= issued) {
        Object.assign(item, { name: editName.trim(), total, available: total - issued })
        audit(d, user.id, 'updated', 'sports_equipment', item.id, { name: item.name, quantity: total })
      }
      return d
    })
  }

  const addPerformance = (event) => {
    event.preventDefault()
    const student = students.find((item) => item.id === performanceStudentId)
    if (!student || !performanceSport.trim() || !performanceEvent.trim() || !performanceAchievement.trim() || !performanceDate) return
    setState((d) => {
      const record = { id: uid(), studentId: student.id, sport: performanceSport.trim(), event: performanceEvent.trim(), achievement: performanceAchievement.trim(), score: performanceScore.trim(), date: performanceDate }
      d.sportsPerformance.push(record)
      audit(d, user.id, 'recorded', 'sports_performance', record.id, { studentId: student.id, sport: record.sport, event: record.event })
      return d
    })
    setPerformanceStudentId('')
    setPerformanceSport('')
    setPerformanceEvent('')
    setPerformanceAchievement('')
    setPerformanceScore('')
  }

  const addFacility = (event) => {
    event.preventDefault()
    if (!manager || !facilityName.trim()) return
    setState((d) => {
      const facility = { id: uid(), name: facilityName.trim(), type: facilityType }
      d.sportsFacilities.push(facility)
      audit(d, user.id, 'created', 'sports_facility', facility.id, { name: facility.name })
      return d
    })
    setFacilityName('')
  }

  const submitBooking = (event) => {
    event.preventDefault()
    if (!bookingFacilityId || !bookingDate || !bookingStart || !bookingEnd || bookingStart >= bookingEnd) {
      setBookingMessage('Choose a facility and a valid start/end time.')
      return
    }
    const conflict = bookings.some((booking) => booking.facilityId === bookingFacilityId && booking.date === bookingDate && ['pending', 'approved'].includes(booking.status) && booking.startsAt < bookingEnd && booking.endsAt > bookingStart)
    if (conflict) {
      setBookingMessage('That time overlaps an existing request or booking. Choose another slot.')
      return
    }
    const facility = facilities.find((item) => item.id === bookingFacilityId)
    setState((d) => {
      const booking = { id: uid(), facilityId: facility.id, facilityName: facility.name, studentId: user.id, studentName: user.name, date: bookingDate, startsAt: bookingStart, endsAt: bookingEnd, status: 'pending' }
      d.sportsBookings.push(booking)
      audit(d, user.id, 'requested', 'sports_booking', booking.id, { facility: facility.name, date: bookingDate, startsAt: bookingStart, endsAt: bookingEnd })
      notify(d, d.users.find((account) => account.role === 'sports_coordinator')?.id || 'sp1', `${user.name} requested ${facility.name} on ${bookingDate}.`)
      return d
    })
    setBookingMessage('Booking request sent to the sports coordinator.')
  }

  const decideBooking = (bookingId, status) => setState((d) => {
    const booking = d.sportsBookings.find((item) => item.id === bookingId)
    if (!booking || booking.status !== 'pending') return d
    const conflict = status === 'approved' && d.sportsBookings.some((item) => item.id !== booking.id && item.facilityId === booking.facilityId && item.date === booking.date && item.status === 'approved' && item.startsAt < booking.endsAt && item.endsAt > booking.startsAt)
    booking.status = conflict ? 'rejected' : status
    audit(d, user.id, booking.status, 'sports_booking', booking.id, { studentId: booking.studentId, facility: booking.facilityName, date: booking.date })
    notify(d, booking.studentId, conflict ? `Your ${booking.facilityName} booking conflicts with an approved booking and was declined.` : `Your ${booking.facilityName} booking was ${status}.`)
    return d
  })

  return (
    <div>
      <h2>Sports equipment</h2>
      <h3>Equipment availability</h3>
      <Table head={['Equipment', 'Total', 'Available']} rows={s.sportsEquipment.map((item) => [item.name, item.total, item.available])} />

      {user.role === 'student' && <form className="card" onSubmit={requestEquipment}>
        <h3>Request equipment</h3>
        <div className="row wrap">
          <select value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)} required>
            <option value="">Select available equipment</option>
            {s.sportsEquipment.filter((item) => item.available > 0 && !myIssues.some((issue) => issue.equipmentId === item.id && ['requested', 'issued'].includes(issue.status))).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.available} available)</option>)}
          </select>
          <button disabled={!equipmentId}>Send request</button>
        </div>
      </form>}

      {user.role === 'student' && <>
        <form className="card" onSubmit={submitBooking}>
          <h3>Book a sports facility</h3>
          <div className="row wrap">
            <select value={bookingFacilityId} onChange={(event) => setBookingFacilityId(event.target.value)} required>
              <option value="">Select a court or field</option>
              {facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name} · {facility.type}</option>)}
            </select>
            <input aria-label="Booking date" type="date" min={new Date().toISOString().slice(0, 10)} value={bookingDate} onChange={(event) => setBookingDate(event.target.value)} required />
            <label className="row">From <input aria-label="Start time" type="time" value={bookingStart} onChange={(event) => setBookingStart(event.target.value)} required /></label>
            <label className="row">To <input aria-label="End time" type="time" value={bookingEnd} onChange={(event) => setBookingEnd(event.target.value)} required /></label>
            <button>Request booking</button>
          </div>
          {bookingMessage && <p className="muted" role="status">{bookingMessage}</p>}
        </form>
        <h3>Facility schedule</h3>
        <Table head={['Facility', 'Date', 'Start', 'End', 'Status']} rows={bookings.filter((booking) => ['pending', 'approved'].includes(booking.status)).map((booking) => [booking.facilityName, booking.date, booking.startsAt, booking.endsAt, booking.status])} />
        <h3>My facility bookings</h3>
        <Table head={['Facility', 'Date', 'Time', 'Status']} rows={bookings.filter((booking) => booking.studentId === user.id).map((booking) => [booking.facilityName, booking.date, `${booking.startsAt}–${booking.endsAt}`, booking.status])} />
      </>}

      {manager && <>
        <form className="card" onSubmit={addFacility}>
          <h3>Add a facility</h3>
          <div className="row wrap">
            <input placeholder="Court or field name" value={facilityName} onChange={(event) => setFacilityName(event.target.value)} required />
            <select value={facilityType} onChange={(event) => setFacilityType(event.target.value)}><option>Court</option><option>Field</option><option>Track</option><option>Other</option></select>
            <button>Add facility</button>
          </div>
        </form>
        <h3>Facility booking requests</h3>
        <Table head={['Facility', 'Student', 'Date', 'Start', 'End', 'Status', 'Actions']} rows={bookings.map((booking) => [booking.facilityName, booking.studentName, booking.date, booking.startsAt, booking.endsAt, booking.status, booking.status === 'pending' ? <span className="row"><button className="small" onClick={() => decideBooking(booking.id, 'approved')}>Approve</button><button className="ghost small" onClick={() => decideBooking(booking.id, 'rejected')}>Decline</button></span> : ''])} />
        <form className="card" onSubmit={addEquipment}>
          <h3>Add equipment</h3>
          <div className="row wrap">
            <input placeholder="Equipment name" value={name} onChange={(event) => setName(event.target.value)} required />
            <input aria-label="Quantity" type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
            <button>Add to inventory</button>
          </div>
        </form>
        <form className="card" onSubmit={issueToStudent}>
          <h3>Issue equipment to a student</h3>
          <div className="row wrap">
            <select value={issueStudentId} onChange={(event) => setIssueStudentId(event.target.value)} required>
              <option value="">Select student</option>
              {students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.branch} {student.batch} Sec {student.section}</option>)}
            </select>
            <select value={issueEquipmentId} onChange={(event) => setIssueEquipmentId(event.target.value)} required>
              <option value="">Select available equipment</option>
              {s.sportsEquipment.filter((item) => item.available > 0).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.available} available)</option>)}
            </select>
            <button disabled={!issueStudentId || !issueEquipmentId}>Record issue</button>
          </div>
        </form>
        <form className="card" onSubmit={updateEquipment}>
          <h3>Update equipment details or quantity</h3>
          <div className="row wrap">
            <select value={editEquipmentId} onChange={(event) => selectEquipmentToEdit(event.target.value)} required>
              <option value="">Select equipment</option>
              {s.sportsEquipment.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <input placeholder="Equipment name" value={editName} onChange={(event) => setEditName(event.target.value)} required />
            <input aria-label="Total quantity" type="number" min="1" value={editTotal} onChange={(event) => setEditTotal(event.target.value)} required />
            <button disabled={!editEquipmentId}>Save equipment details</button>
          </div>
        </form>
        <form className="card" onSubmit={addPerformance}>
          <h3>Record student performance</h3>
          <div className="row wrap">
            <select value={performanceStudentId} onChange={(event) => setPerformanceStudentId(event.target.value)} required>
              <option value="">Select student</option>
              {students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.branch} {student.batch} Sec {student.section}</option>)}
            </select>
            <input placeholder="Sport" value={performanceSport} onChange={(event) => setPerformanceSport(event.target.value)} required />
            <input placeholder="Event or competition" value={performanceEvent} onChange={(event) => setPerformanceEvent(event.target.value)} required />
            <input placeholder="Achievement or result" value={performanceAchievement} onChange={(event) => setPerformanceAchievement(event.target.value)} required />
            <input placeholder="Score (optional)" value={performanceScore} onChange={(event) => setPerformanceScore(event.target.value)} />
            <input aria-label="Performance date" type="date" value={performanceDate} onChange={(event) => setPerformanceDate(event.target.value)} required />
            <button>Add performance</button>
          </div>
        </form>
        <h3>Equipment issue and return log</h3>
        <Table head={['Equipment', 'Student', 'Roll number', 'Department', 'Branch', 'Year', 'Section', 'Date', 'Status', 'Actions']} rows={s.sportsIssues.map((issue) => {
          const student = students.find((item) => item.id === issue.studentId)
          return [issue.itemName, issue.studentName, issue.rollNumber, student?.dept || student?.branch || '', student?.branch || '', student?.batch || '', student?.section || '', issue.time, issue.status, <span className="row">
          {issue.status === 'requested' && <><button className="small" onClick={() => decideIssue(issue.id, 'issued')}>Issue</button><button className="ghost small" onClick={() => decideIssue(issue.id, 'rejected')}>Decline</button></>}
          {issue.status === 'issued' && <button className="ghost small" onClick={() => returnEquipment(issue.id)}>Mark returned</button>}
        </span>]
        })} />
      </>}

      {user.role === 'student' && <>
        <h3>My equipment requests</h3>
        <Table head={['Equipment', 'Date', 'Status']} rows={myIssues.map((issue) => [issue.itemName, issue.time, issue.status])} />
        <h3>My sports performance</h3>
        <Table head={['Sport', 'Event', 'Achievement', 'Score', 'Date']} rows={s.sportsPerformance.filter((record) => record.studentId === user.id).map((record) => [record.sport, record.event, record.achievement, record.score || '', record.date])} />
      </>}

      {manager && <>
        <h3>Student performance records</h3>
        <Table head={['Student', 'Roll number', 'Department', 'Branch', 'Year', 'Class', 'Section', 'Sport', 'Event', 'Achievement', 'Score', 'Date']} rows={s.sportsPerformance.map((record) => {
          const student = students.find((item) => item.id === record.studentId)
          return [student?.name || 'Student removed', student?.rollNumber || student?.id || '', student?.dept || student?.branch || '', student?.branch || '', student?.batch || '', student ? `${student.branch} ${student.batch}` : '', student?.section || '', record.sport, record.event, record.achievement, record.score || '', record.date]
        })} />
      </>}
    </div>
  )
}
