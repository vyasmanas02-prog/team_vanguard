import { useState } from 'react'
import { useStore, setState, uid, notify } from './store.js'
import { timeAgo } from './util.js'
import { Badge } from './pages.jsx'

const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n)

/* ---------- Admin only: teacher details + private student feedback ---------- */
export function Teachers() {
  const s = useStore()
  const teachers = s.users.filter((u) => u.role === 'teacher')
  const [who, setWho] = useState('')
  const [kind, setKind] = useState('')
  const [form, setForm] = useState({ name: '', dept: '', designation: '', phone: '', email: '', subjects: '' })
  const nameOf = (id) => s.users.find((u) => u.id === id)?.name || 'Unknown'

  const rating = (id) => {
    const r = s.feedback.filter((f) => f.teacherId === id && f.kind === 'rating')
    return r.length ? { avg: (r.reduce((a, f) => a + f.stars, 0) / r.length).toFixed(1), n: r.length } : null
  }
  const complaints = (id) => s.feedback.filter((f) => f.teacherId === id && f.kind === 'complaint').length

  const add = () => {
    if (!form.name.trim()) return
    setState((d) => {
      d.users.push({
        id: 't' + uid(), name: form.name.trim(), role: 'teacher', dept: form.dept.trim(), designation: form.designation.trim(),
        phone: form.phone.trim(), email: form.email.trim(),
        subjects: form.subjects.split(',').map((x) => x.trim()).filter(Boolean), classes: [],
      })
      return d
    })
    setForm({ name: '', dept: '', designation: '', phone: '', email: '', subjects: '' })
  }
  const toggle = (id) =>
    setState((d) => {
      const f = d.feedback.find((x) => x.id === id)
      f.status = f.status === 'resolved' ? 'new' : 'resolved'
      return d
    })
  const list = s.feedback.filter((f) => (!who || f.teacherId === who) && (!kind || f.kind === kind))

  return (
    <div>
      <h2>Teachers</h2>
      <div className="grid">
        {teachers.map((t) => {
          const r = rating(t.id)
          const c = complaints(t.id)
          return (
            <div className="card" key={t.id}>
              <h3>{t.name}</h3>
              <p className="muted">{t.designation || 'Teacher'} · {t.dept || 'No department'}</p>
              <p>{t.phone || 'No phone'}<br />{t.email || 'No email'}</p>
              <div>{(t.subjects || []).map((x) => <span key={x} className="tag">{x}</span>)}</div>
              <h4>Classes taught</h4>
              <div>
                {(t.classes || []).length === 0 && <span className="muted">None assigned</span>}
                {(t.classes || []).map((c2, i) => <span key={i} className="tag">{c2.branch} {c2.batch} Sec {c2.section}</span>)}
              </div>
              <h4>Student feedback</h4>
              <p>
                {r ? <b>{'★'} {r.avg} <span className="muted">from {r.n} rating{r.n > 1 ? 's' : ''}</span></b> : <span className="muted">No ratings yet</span>}
                {' · '}
                <b className={c ? 'bad' : ''}>{c} complaint{c === 1 ? '' : 's'}</b>
              </p>
              <button className="ghost small" onClick={() => setWho(t.id)}>View feedback</button>
            </div>
          )
        })}
      </div>

      <div className="card">
        <h3>Add a teacher</h3>
        <div className="row wrap">
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Department" value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })} />
          <input placeholder="Designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Subjects, separated by commas" value={form.subjects} onChange={(e) => setForm({ ...form, subjects: e.target.value })} />
          <button onClick={add}>Add teacher</button>
        </div>
      </div>

      <h3>Ratings and complaints</h3>
      <p className="muted">Only the admin can see this section. Teachers cannot.</p>
      <div className="row wrap">
        <select value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">All teachers</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Ratings and complaints</option>
          <option value="rating">Ratings only</option>
          <option value="complaint">Complaints only</option>
        </select>
      </div>
      {list.length === 0 && <p className="muted">Nothing here yet.</p>}
      {list.map((f) => (
        <div className="card" key={f.id}>
          <div className="row between">
            <b>{nameOf(f.teacherId)} <span className={'tag ' + (f.kind === 'complaint' ? 'complaint' : 'official')}>{f.kind === 'complaint' ? 'Complaint' : 'Rating'}</span></b>
            <Badge status={f.status} />
          </div>
          {f.kind === 'rating' && <p className="stars">{stars(f.stars)}</p>}
          {f.message && <p>{f.message}</p>}
          <div className="row between">
            <span className="muted">From: {f.anonymous ? 'Anonymous student' : nameOf(f.studentId)} · {timeAgo(f.time)}</span>
            <button className="ghost small" onClick={() => toggle(f.id)}>{f.status === 'resolved' ? 'Reopen' : 'Mark resolved'}</button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------- Student: rate a teacher or send a complaint (admin reads it) ---------- */
export function Feedback({ user }) {
  const s = useStore()
  const teachers = s.users.filter((u) => u.role === 'teacher')
  const empty = { teacherId: '', kind: 'rating', stars: 0, message: '', anonymous: false }
  const [form, setForm] = useState(empty)
  const [note, setNote] = useState('')
  const ok = form.teacherId && (form.kind === 'rating' ? form.stars > 0 : form.message.trim())
  const mine = s.feedback.filter((f) => f.studentId === user.id)

  const send = () => {
    if (!ok) return
    setState((d) => {
      d.feedback.unshift({
        id: uid(), teacherId: form.teacherId, studentId: user.id, kind: form.kind,
        stars: form.kind === 'rating' ? form.stars : 0, message: form.message.trim(),
        anonymous: form.anonymous, status: 'new', time: Date.now(),
      })
      notify(d, 'a1', `New teacher ${form.kind} received`)
      return d
    })
    setForm(empty)
    setNote('Sent. Only the admin can see this. Your teacher cannot.')
  }

  return (
    <div>
      <h2>Rate a teacher</h2>
      <p className="muted">Your rating or complaint goes to the admin only. Teachers never see it.</p>
      <div className="card">
        <div className="row wrap">
          <select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
            <option value="">Choose teacher</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}{t.dept ? ' (' + t.dept + ')' : ''}</option>)}
          </select>
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="rating">Give a rating</option>
            <option value="complaint">Make a complaint</option>
          </select>
        </div>
        {form.kind === 'rating' && (
          <p className="stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className={'starbtn ' + (n <= form.stars ? 'on' : '')} onClick={() => setForm({ ...form, stars: n })} aria-label={n + ' stars'}>★</button>
            ))}
          </p>
        )}
        <textarea rows="3" placeholder={form.kind === 'rating' ? 'Comment (optional)' : 'Describe the problem'} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        <label className="row"><input type="checkbox" checked={form.anonymous} onChange={(e) => setForm({ ...form, anonymous: e.target.checked })} /> Send anonymously (the admin will not see my name)</label>
        <button disabled={!ok} onClick={send}>Send to admin</button>
        {note && <p className="good">{note}</p>}
      </div>
      <h3>What I sent</h3>
      {mine.length === 0 && <p className="muted">Nothing sent yet.</p>}
      {mine.map((f) => (
        <div className="card" key={f.id}>
          <b>{s.users.find((u) => u.id === f.teacherId)?.name}</b> <span className="tag">{f.kind === 'complaint' ? 'Complaint' : 'Rating'}</span> {f.anonymous && <span className="tag">Anonymous</span>} <Badge status={f.status} />
          {f.kind === 'rating' && <p className="stars">{stars(f.stars)}</p>}
          {f.message && <p>{f.message}</p>}
          <p className="muted">{timeAgo(f.time)}</p>
        </div>
      ))}
    </div>
  )
}
