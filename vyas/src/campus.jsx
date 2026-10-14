import { useState } from 'react'
import { useStore, setState, uid, notify, classKey, classLabel, inClass, allClasses, teachersOfStudent } from './store.js'
import { resizeImage, timeAgo, downloadCsv } from './util.js'
import { Table, Badge } from './pages.jsx'
import { useStudentFilter } from './filters.jsx'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const todayName = () => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()]
const rupees = (n) => '₹' + Number(n).toLocaleString('en-IN')

/* ---------- Timetable: students see their class, staff edit per class ---------- */
export function Timetable({ user }) {
  const s = useStore()
  const isStaff = user.role !== 'student'
  const classes = user.role === 'admin' ? allClasses(s) : user.role === 'teacher' ? user.classes || [] : []
  const [key, setKey] = useState('')
  const [form, setForm] = useState({ day: 'Mon', time: '', subject: '', teacherId: '' })
  const teachers = s.users.filter((u) => u.role === 'teacher')
  const cls = isStaff ? classes.find((c) => classKey(c) === key) || classes[0] : user
  const slots = cls ? s.timetable.filter((t) => inClass(t, cls)) : []
  const tname = (id) => s.users.find((u) => u.id === id)?.name || ''

  const add = () => {
    if (!cls || !form.time || !form.subject.trim()) return
    setState((d) => {
      d.timetable.push({ id: uid(), college: cls.college, branch: cls.branch, batch: cls.batch, section: cls.section, day: form.day, time: form.time, subject: form.subject.trim(), teacherId: form.teacherId || (user.role === 'teacher' ? user.id : '') })
      d.users.filter((u) => u.role === 'student' && inClass(u, cls)).forEach((st) => notify(d, st.id, `Timetable updated: ${form.subject.trim()} on ${form.day} at ${form.time}`))
      return d
    })
    setForm({ ...form, time: '', subject: '' })
  }
  const del = (id) => setState((d) => { d.timetable = d.timetable.filter((t) => t.id !== id); return d })

  return (
    <div>
      <h2>Timetable</h2>
      {isStaff && (
        <div className="card">
          {classes.length === 0 ? <p className="muted">No classes are assigned to you yet. Ask the admin.</p> : (
            <select value={cls ? classKey(cls) : ''} onChange={(e) => setKey(e.target.value)}>
              {classes.map((c) => <option key={classKey(c)} value={classKey(c)}>{c.college} · {classLabel(c)}</option>)}
            </select>
          )}
        </div>
      )}
      {cls && <p className="muted">Class: {cls.college} · {classLabel(cls)}</p>}
      <div className="grid">
        {DAYS.map((day) => {
          const list = slots.filter((t) => t.day === day).sort((a, b) => a.time.localeCompare(b.time))
          return (
            <div key={day} className={'card' + (day === todayName() ? ' today' : '')}>
              <h3>{day}{day === todayName() && <span className="tag official">Today</span>}</h3>
              {list.length === 0 && <p className="muted">No classes.</p>}
              {list.map((t) => (
                <div key={t.id} className="row between slot">
                  <span><b>{t.time}</b> {t.subject}<br /><span className="muted">{tname(t.teacherId)}</span></span>
                  {isStaff && <button className="ghost small" onClick={() => del(t.id)}>Remove</button>}
                </div>
              ))}
            </div>
          )
        })}
      </div>
      {isStaff && cls && (
        <div className="card">
          <h3>Add a period</h3>
          <div className="row wrap">
            <select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>{DAYS.map((d) => <option key={d}>{d}</option>)}</select>
            <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            <input placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
              <option value="">{user.role === 'teacher' ? 'Me' : 'Choose teacher'}</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button onClick={add}>Add</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- Leave requests ---------- */
export function Leave({ user }) {
  const s = useStore()
  const [form, setForm] = useState({ from: '', to: '', reason: '' })
  const student = (id) => s.users.find((u) => u.id === id)
  const send = () => {
    if (!form.from || !form.to || !form.reason.trim() || form.to < form.from) return
    setState((d) => {
      d.leaves.unshift({ id: uid(), studentId: user.id, from: form.from, to: form.to, reason: form.reason.trim(), status: 'pending', time: Date.now(), decidedBy: '' })
      teachersOfStudent(d, user).forEach((t) => notify(d, t.id, `${user.name} asked for leave (${form.from} to ${form.to})`))
      return d
    })
    setForm({ from: '', to: '', reason: '' })
  }
  const decide = (id, status) =>
    setState((d) => {
      const l = d.leaves.find((x) => x.id === id)
      l.status = status
      l.decidedBy = user.id
      notify(d, l.studentId, `Your leave request (${l.from} to ${l.to}) was ${status}`)
      return d
    })

  if (user.role === 'student') {
    const mine = s.leaves.filter((l) => l.studentId === user.id)
    return (
      <div>
        <h2>Leave requests</h2>
        <div className="card">
          <h3>Ask for leave</h3>
          <div className="row wrap">
            <label className="muted">From <input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></label>
            <label className="muted">To <input type="date" value={form.to} min={form.from} onChange={(e) => setForm({ ...form, to: e.target.value })} /></label>
          </div>
          <textarea rows="2" placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <button onClick={send}>Send request</button>
        </div>
        <h3>My requests</h3>
        {mine.length === 0 && <p className="muted">No requests yet.</p>}
        {mine.map((l) => (
          <div className="card" key={l.id}>
            <b>{l.from} to {l.to}</b> <Badge status={l.status} />
            <p>{l.reason}</p>
            {l.decidedBy && <p className="muted">Decided by {student(l.decidedBy)?.name}</p>}
          </div>
        ))}
      </div>
    )
  }
  const list = s.leaves.filter((l) => {
    const st = student(l.studentId)
    return st && (user.role === 'admin' || (user.classes || []).some((c) => inClass(st, c)))
  })
  return (
    <div>
      <h2>Leave requests</h2>
      <p className="muted">{user.role === 'teacher' ? 'You see requests from students of your classes.' : 'You see requests from all students.'}</p>
      {list.length === 0 && <p className="muted">No requests.</p>}
      {list.map((l) => {
        const st = student(l.studentId)
        return (
          <div className="card" key={l.id}>
            <div className="row between">
              <b>{st.name} <span className="muted">{classLabel(st)}</span></b>
              <Badge status={l.status} />
            </div>
            <p>{l.from} to {l.to}: {l.reason}</p>
            <p className="muted">{timeAgo(l.time)}{l.decidedBy ? ' · decided by ' + student(l.decidedBy)?.name : ''}</p>
            {l.status === 'pending' && (
              <div className="row">
                <button onClick={() => decide(l.id, 'approved')}>Approve</button>
                <button className="ghost" onClick={() => decide(l.id, 'rejected')}>Reject</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ---------- Fees: students see theirs, admin manages ---------- */
export function Fees({ user }) {
  const s = useStore()
  const { students, ui } = useStudentFilter(user)
  const [form, setForm] = useState({ title: '', amount: '', due: '' })
  const sum = (list) => list.reduce((a, f) => a + Number(f.amount), 0)

  if (user.role === 'student') {
    const mine = s.fees.filter((f) => f.studentId === user.id)
    const pending = mine.filter((f) => f.status !== 'paid')
    return (
      <div>
        <h2>My fees</h2>
        <div className="grid">
          <div className="card"><p className="big">{rupees(sum(pending))}</p><p className="muted">pending</p></div>
          <div className="card"><p className="big good">{rupees(sum(mine.filter((f) => f.status === 'paid')))}</p><p className="muted">paid</p></div>
        </div>
        <Table head={['Fee', 'Amount', 'Due', 'Status']} rows={mine.map((f) => [f.title, rupees(f.amount), f.due || 'n/a', <Badge status={f.status} />])} />
        {mine.length === 0 && <p className="muted">No fees yet.</p>}
      </div>
    )
  }
  const ids = new Set(students.map((x) => x.id))
  const rows = s.fees.filter((f) => ids.has(f.studentId))
  const who = (id) => s.users.find((u) => u.id === id)
  const add = () => {
    if (!form.title.trim() || !Number(form.amount) || students.length === 0) return
    setState((d) => {
      students.forEach((st) => {
        d.fees.push({ id: uid(), studentId: st.id, title: form.title.trim(), amount: Number(form.amount), due: form.due, status: 'pending' })
        notify(d, st.id, `New fee added: ${form.title.trim()} (${rupees(form.amount)})`)
      })
      return d
    })
    setForm({ title: '', amount: '', due: '' })
  }
  const toggle = (id) =>
    setState((d) => {
      const f = d.fees.find((x) => x.id === id)
      f.status = f.status === 'paid' ? 'pending' : 'paid'
      if (f.status === 'paid') notify(d, f.studentId, `Payment received for ${f.title}`)
      return d
    })
  const csv = () => downloadCsv('fees.csv', [['Student', 'College', 'Branch', 'Batch', 'Section', 'Fee', 'Amount', 'Due', 'Status'], ...rows.map((f) => { const u = who(f.studentId); return [u.name, u.college, u.branch, u.batch, u.section, f.title, f.amount, f.due, f.status] })])
  return (
    <div>
      <h2>Fees</h2>
      {ui}
      <div className="card">
        <h3>Add a fee for the {students.length} student{students.length === 1 ? '' : 's'} shown above</h3>
        <div className="row wrap">
          <input placeholder="Fee name" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
          <button onClick={add}>Add fee</button>
        </div>
      </div>
      <div className="row between">
        <p className="muted">Pending: {rupees(sum(rows.filter((f) => f.status !== 'paid')))} · Paid: {rupees(sum(rows.filter((f) => f.status === 'paid')))}</p>
        <button className="ghost small" onClick={csv}>Download CSV</button>
      </div>
      <Table
        head={['Student', 'Class', 'Fee', 'Amount', 'Due', 'Status', '']}
        rows={rows.map((f) => [who(f.studentId).name, classLabel(who(f.studentId)), f.title, rupees(f.amount), f.due || 'n/a', <Badge status={f.status} />, <button className="ghost small" onClick={() => toggle(f.id)}>{f.status === 'paid' ? 'Mark pending' : 'Mark paid'}</button>])}
      />
    </div>
  )
}

/* ---------- Lost and found ---------- */
export function LostFound({ user }) {
  const s = useStore()
  const [form, setForm] = useState({ kind: 'lost', title: '', desc: '', photo: null })
  const [show, setShow] = useState('')
  const post = () => {
    if (!form.title.trim()) return
    setState((d) => {
      d.lostfound.unshift({ id: uid(), kind: form.kind, title: form.title.trim(), desc: form.desc.trim(), photo: form.photo, authorId: user.id, status: 'open', time: Date.now() })
      notify(d, 'all', `${form.kind === 'lost' ? 'Lost' : 'Found'}: ${form.title.trim()}`)
      return d
    })
    setForm({ kind: 'lost', title: '', desc: '', photo: null })
  }
  const pick = async (e) => {
    const f = e.target.files[0]
    if (f) setForm({ ...form, photo: await resizeImage(f, 700) })
    e.target.value = ''
  }
  const mark = (id) => setState((d) => { const x = d.lostfound.find((q) => q.id === id); x.status = x.status === 'open' ? 'returned' : 'open'; return d })
  const del = (id) => setState((d) => { d.lostfound = d.lostfound.filter((x) => x.id !== id); return d })
  const list = s.lostfound.filter((x) => !show || x.kind === show)
  return (
    <div>
      <h2>Lost and found</h2>
      <div className="card">
        <h3>Post an item</h3>
        <div className="row wrap">
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="lost">I lost something</option>
            <option value="found">I found something</option>
          </select>
          <input placeholder="Item name" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <textarea rows="2" placeholder="Where and when? How can the owner reach you?" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
        {form.photo && <img className="photo" src={form.photo} alt="preview" />}
        <div className="row wrap">
          <input type="file" accept="image/*" onChange={pick} />
          <button onClick={post}>Post</button>
        </div>
      </div>
      <div className="row wrap">
        {[['', 'All'], ['lost', 'Lost'], ['found', 'Found']].map(([k, l]) => <button key={k} className={show === k ? '' : 'ghost'} onClick={() => setShow(k)}>{l}</button>)}
      </div>
      {list.length === 0 && <p className="muted">Nothing posted.</p>}
      <div className="grid">
        {list.map((x) => (
          <div className="card" key={x.id}>
            <b>{x.title}</b> <span className={'tag ' + (x.kind === 'lost' ? 'complaint' : 'official')}>{x.kind === 'lost' ? 'Lost' : 'Found'}</span> <Badge status={x.status} />
            {x.desc && <p>{x.desc}</p>}
            {x.photo && <img className="photo" src={x.photo} alt={x.title} />}
            <p className="muted">{s.users.find((u) => u.id === x.authorId)?.name || 'Unknown'} · {timeAgo(x.time)}</p>
            {(x.authorId === user.id || user.role !== 'student') && (
              <div className="row">
                <button className="ghost small" onClick={() => mark(x.id)}>{x.status === 'open' ? 'Mark returned' : 'Reopen'}</button>
                <button className="ghost small" onClick={() => del(x.id)}>Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
