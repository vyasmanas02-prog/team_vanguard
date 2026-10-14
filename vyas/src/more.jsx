import { useState } from 'react'
import { useStore, setState, uid, pct, notify, SUBJECTS, visibleNotice, allClasses, classKey, classLabel, inClass } from './store.js'
import { resizeImage, timeAgo, isToday, askAI } from './util.js'
import { Table, Badge } from './pages.jsx'
import { useStudentFilter } from './filters.jsx'

/* ---------- Notices: daily college notifications ---------- */
export function Notices({ user }) {
  const s = useStore()
  const [form, setForm] = useState({ title: '', body: '' })
  const isStaff = user.role !== 'student'
  const person = (id) => s.users.find((u) => u.id === id)?.name
  const [aud, setAud] = useState('') // '' = everyone, otherwise a class key
  const classes = user.role === 'admin' ? allClasses(s) : user.role === 'teacher' ? user.classes || [] : []
  const list = s.notices.filter((n) => visibleNotice(n, user)).sort((a, b) => b.time - a.time)
  const today = list.filter((n) => isToday(n.time))
  const earlier = list.filter((n) => !isToday(n.time))

  const post = () => {
    if (!form.title.trim()) return
    const audience = isStaff ? classes.find((c) => classKey(c) === aud) || null : null
    setState((d) => {
      d.notices.unshift({ id: uid(), title: form.title.trim(), body: form.body.trim(), authorId: user.id, kind: isStaff ? 'official' : 'student', time: Date.now(), audience })
      if (isStaff && !audience) notify(d, 'all', `Notice: ${form.title.trim()}`)
      if (audience) d.users.filter((u) => u.role === 'student' && inClass(u, audience)).forEach((u) => notify(d, u.id, `Notice for ${classLabel(audience)}: ${form.title.trim()}`))
      return d
    })
    setForm({ title: '', body: '' })
    setAud('')
  }
  const del = (id) =>
    setState((d) => {
      d.notices = d.notices.filter((n) => n.id !== id)
      return d
    })
  const Card = ({ n }) => (
    <div className="card">
      <div className="row between">
        <b>{n.title} <span className={'tag ' + n.kind}>{n.kind === 'official' ? 'Official' : 'Student'}</span>{n.audience && <span className="tag complaint">Only {classLabel(n.audience)}</span>}</b>
        {(isStaff || n.authorId === user.id) && <button className="ghost small" onClick={() => del(n.id)}>Delete</button>}
      </div>
      {n.body && <p>{n.body}</p>}
      <p className="muted">{person(n.authorId)} · {timeAgo(n.time)}</p>
    </div>
  )
  return (
    <div>
      <h2>College notices</h2>
      <div className="card">
        <h3>{isStaff ? 'Post an official notice' : 'Share a notice with everyone'}</h3>
        <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea rows="2" placeholder="Details" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        {isStaff && (
          <select value={aud} onChange={(e) => setAud(e.target.value)} style={{ marginBottom: 8 }}>
            <option value="">Send to everyone</option>
            {classes.map((c) => <option key={classKey(c)} value={classKey(c)}>Only {c.college} · {classLabel(c)}</option>)}
          </select>
        )}
        <button onClick={post}>Post</button>
      </div>
      <h3>Today</h3>
      {today.length === 0 && <p className="muted">No notices today.</p>}
      {today.map((n) => <Card key={n.id} n={n} />)}
      <h3>Earlier</h3>
      {earlier.length === 0 && <p className="muted">Nothing earlier.</p>}
      {earlier.map((n) => <Card key={n.id} n={n} />)}
    </div>
  )
}

/* ---------- Staff contacts ---------- */
export function Staff({ user }) {
  const s = useStore()
  const [form, setForm] = useState({ name: '', role: '', phone: '', email: '' })
  const add = () => {
    if (!form.name.trim()) return
    setState((d) => (d.staff.push({ id: uid(), ...form }), d))
    setForm({ name: '', role: '', phone: '', email: '' })
  }
  const del = (id) => setState((d) => ((d.staff = d.staff.filter((x) => x.id !== id)), d))
  return (
    <div>
      <h2>Staff contacts</h2>
      <Table
        head={['Name', 'Role', 'Phone', 'Email', ...(user.role === 'admin' ? [''] : [])]}
        rows={s.staff.map((f) => [
          f.name, f.role, f.phone, f.email,
          ...(user.role === 'admin' ? [<button className="ghost small" onClick={() => del(f.id)}>Remove</button>] : []),
        ])}
      />
      {user.role === 'admin' && (
        <div className="card">
          <h3>Add a contact</h3>
          <div className="row wrap">
            {['name', 'role', 'phone', 'email'].map((k) => (
              <input key={k} placeholder={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            ))}
            <button onClick={add}>Add</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- Counselling (anonymous option) ---------- */
export function Counselling({ user }) {
  const s = useStore()
  const [form, setForm] = useState({ topic: '', message: '', anonymous: false })
  const [reply, setReply] = useState({})
  const send = () => {
    if (!form.topic.trim() || !form.message.trim()) return
    setState((d) => {
      d.counselling.unshift({ id: uid(), studentId: user.id, anonymous: form.anonymous, topic: form.topic.trim(), message: form.message.trim(), status: 'open', reply: '', time: Date.now() })
      return d
    })
    setForm({ topic: '', message: '', anonymous: false })
  }
  const answer = (id) => {
    const t = (reply[id] || '').trim()
    if (!t) return
    setState((d) => {
      const c = d.counselling.find((x) => x.id === id)
      c.reply = t
      c.status = 'replied'
      notify(d, c.studentId, `A counsellor replied to "${c.topic}"`)
      return d
    })
    setReply({ ...reply, [id]: '' })
  }
  if (user.role === 'student') {
    const mine = s.counselling.filter((c) => c.studentId === user.id)
    return (
      <div>
        <h2>Counselling</h2>
        <div className="card">
          <h3>Ask for support</h3>
          <input placeholder="Topic" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
          <textarea rows="3" placeholder="Write your message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          <label className="row"><input type="checkbox" checked={form.anonymous} onChange={(e) => setForm({ ...form, anonymous: e.target.checked })} /> Send anonymously (counsellors will not see my name)</label>
          <button onClick={send}>Send</button>
        </div>
        <h3>My requests</h3>
        {mine.length === 0 && <p className="muted">No requests yet.</p>}
        {mine.map((c) => (
          <div className="card" key={c.id}>
            <b>{c.topic}</b> <Badge status={c.status} /> {c.anonymous && <span className="tag">Anonymous</span>}
            <p>{c.message}</p>
            {c.reply && <p className="good">Reply: {c.reply}</p>}
          </div>
        ))}
      </div>
    )
  }
  return (
    <div>
      <h2>Counselling requests</h2>
      {s.counselling.length === 0 && <p className="muted">No requests yet.</p>}
      {s.counselling.map((c) => (
        <div className="card" key={c.id}>
          <b>{c.topic}</b> <Badge status={c.status} />
          <p className="muted">From: {c.anonymous ? 'Anonymous student' : s.users.find((u) => u.id === c.studentId)?.name} · {timeAgo(c.time)}</p>
          <p>{c.message}</p>
          {c.reply ? <p className="good">Replied: {c.reply}</p> : (
            <div className="row">
              <input placeholder="Write a reply" value={reply[c.id] || ''} onChange={(e) => setReply({ ...reply, [c.id]: e.target.value })} />
              <button onClick={() => answer(c.id)}>Reply</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ---------- Documents ---------- */
export function Documents({ user }) {
  const s = useStore()
  const [type, setType] = useState('Marksheet')
  const add = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    const dataUrl = f.type.startsWith('image/') ? await resizeImage(f, 900) : null
    setState((d) => {
      d.documents.unshift({ id: uid(), studentId: user.id, type, name: f.name, size: f.size, dataUrl, time: Date.now() })
      return d
    })
    e.target.value = ''
  }
  const del = (id) => setState((d) => ((d.documents = d.documents.filter((x) => x.id !== id)), d))
  const docs = user.role === 'student' ? s.documents.filter((x) => x.studentId === user.id) : s.documents
  return (
    <div>
      <h2>Documents</h2>
      {user.role === 'student' && (
        <div className="card">
          <h3>Upload a document</h3>
          <div className="row wrap">
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {['Marksheet', 'ID card', 'Certificate', 'Fee receipt', 'Other'].map((x) => <option key={x}>{x}</option>)}
            </select>
            <input type="file" onChange={add} />
          </div>
          <p className="muted">Demo note: photos are saved in this browser. For other file types only the name is saved until Supabase Storage is connected.</p>
        </div>
      )}
      {docs.length === 0 && <p className="muted">No documents yet.</p>}
      <div className="grid">
        {docs.map((x) => (
          <div className="card" key={x.id}>
            <b>{x.type}</b>
            {user.role !== 'student' && <p className="muted">{s.users.find((u) => u.id === x.studentId)?.name}</p>}
            {x.dataUrl ? <img className="photo" src={x.dataUrl} alt={x.name} /> : <p className="muted">{x.name}</p>}
            <p className="muted">{Math.round(x.size / 1024)} KB · {timeAgo(x.time)}</p>
            {(user.role === 'student' || user.role === 'admin') && <button className="ghost small" onClick={() => del(x.id)}>Delete</button>}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- People (staff only): which groups each student is in ---------- */
export function People({ user }) {
  const s = useStore()
  const { students, ui } = useStudentFilter(user)
  return (
    <div>
      <h2>Students and their groups</h2>
      {ui}
      {students.length === 0 && <p className="muted">No students match these filters.</p>}
      <Table
        head={['Student', 'College', 'Branch', 'Batch', 'Section', 'Groups and clubs', 'Lowest attendance', 'Avg marks']}
        rows={students.map((st) => {
          const groups = s.channels.filter((c) => c.members.includes(st.id))
          const low = Math.min(...SUBJECTS.map((x) => pct(s.attendance[st.id][x])))
          const avg = Math.round(SUBJECTS.reduce((a, x) => a + s.marks[st.id][x], 0) / SUBJECTS.length)
          return [
            st.name,
            st.college,
            st.branch,
            st.batch,
            st.section,
            <span className="row wrap">{groups.length ? groups.map((g) => <span key={g.id} className="tag">{g.name}</span>) : <span className="muted">none</span>}</span>,
            <b className={low < 75 ? 'bad' : 'good'}>{low}%</b>,
            avg,
          ]
        })}
      />
    </div>
  )
}

/* ---------- AI assistant ---------- */
function buildContext(user, s) {
  const L = []
  const nm = (id) => s.users.find((u) => u.id === id)?.name
  if (user.role === 'student') {
    L.push(`Student: ${user.name}, ${user.college}, branch ${user.branch}, batch ${user.batch}, section ${user.section}`)
    L.push('Marks: ' + SUBJECTS.map((x) => `${x} ${s.marks[user.id][x]}/100`).join(', '))
    L.push('Attendance: ' + SUBJECTS.map((x) => `${x} ${pct(s.attendance[user.id][x])}%`).join(', '))
    L.push('Certificates: ' + (s.certificates.filter((c) => c.studentId === user.id).map((c) => `${s.events.find((e) => e.id === c.eventId)?.title} (${c.status})`).join(', ') || 'none'))
    L.push('Assignments: ' + (s.assignments.map((a) => {
      const sub = s.submissions.find((x) => x.assignmentId === a.id && x.studentId === user.id)
      return `${a.title}, due ${a.due || 'n/a'}, ` + (sub ? (sub.grade !== null && sub.grade !== '' ? `graded ${sub.grade}/10` : 'submitted, not graded') : 'not submitted')
    }).join('; ') || 'none'))
    L.push('Groups: ' + (s.channels.filter((c) => c.members.includes(user.id)).map((c) => c.name).join(', ') || 'none'))
    L.push('Pending fees: ₹' + s.fees.filter((f) => f.studentId === user.id && f.status !== 'paid').reduce((a, f) => a + Number(f.amount), 0))
    L.push('Leave requests: ' + (s.leaves.filter((l) => l.studentId === user.id).map((l) => `${l.from} to ${l.to} ${l.status}`).join('; ') || 'none'))
    L.push('Timetable today: ' + (s.timetable.filter((t) => inClass(t, user) && t.day === ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()]).sort((a, b) => a.time.localeCompare(b.time)).map((t) => `${t.time} ${t.subject}`).join(', ') || 'no classes'))
  } else {
    const students = s.users.filter((u) => u.role === 'student')
    L.push(`Staff user: ${user.name} (${user.role}). ${students.length} students.`)
    L.push('Students below 75% in some subject: ' + (students.filter((st) => SUBJECTS.some((x) => pct(s.attendance[st.id][x]) < 75)).map((st) => st.name).join(', ') || 'none'))
    L.push('Pending certificates: ' + s.certificates.filter((c) => c.status === 'pending').length)
    L.push('Open counselling requests: ' + s.counselling.filter((c) => c.status === 'open').length)
  }
  L.push('Latest notices: ' + (s.notices.filter((n) => visibleNotice(n, user)).slice(0, 4).map((n) => n.title).join('; ') || 'none'))
  L.push('Events: ' + s.events.map((e) => `${e.title} on ${e.date}`).join('; '))
  return L.join('\n')
}

function localAnswer(q, user, s) {
  const t = q.toLowerCase()
  const students = s.users.filter((u) => u.role === 'student')
  if (/attend/.test(t)) {
    if (user.role === 'student') return 'Your attendance: ' + SUBJECTS.map((x) => `${x} ${pct(s.attendance[user.id][x])}%`).join(', ') + '. Keep every subject at 75% or more.'
    const low = students.filter((st) => SUBJECTS.some((x) => pct(s.attendance[st.id][x]) < 75)).map((st) => st.name)
    return low.length ? 'Students below 75% in at least one subject: ' + low.join(', ') + '.' : 'Everyone is above 75%.'
  }
  if (/mark|grade|result|score/.test(t)) {
    if (user.role !== 'student') return 'Open the Marks tab to see and edit marks for every student.'
    return 'Your marks: ' + SUBJECTS.map((x) => `${x} ${s.marks[user.id][x]}`).join(', ') + '.'
  }
  if (/event|certificate|hackathon/.test(t)) return 'Events: ' + s.events.map((e) => `${e.title} (${e.date})`).join(', ') + '. Upload certificates from the Events tab.'
  if (/assign|lab|submit/.test(t)) return 'Assignments: ' + (s.assignments.map((a) => `${a.title} (due ${a.due || 'n/a'})`).join(', ') || 'none') + '.'
  if (/notice|news|today|announce/.test(t)) return 'Latest notices: ' + (s.notices.filter((n) => visibleNotice(n, user)).slice(0, 3).map((n) => n.title).join('; ') || 'none') + '.'
  if (/club|group|channel/.test(t)) return 'Groups: ' + s.channels.map((c) => c.name).join(', ') + '. Join them in Campus Connect.'
  if (/fee|payment|pending amount/.test(t)) {
    if (user.role !== 'student') return 'Open the Fees tab to see and update fees.'
    const due = s.fees.filter((f) => f.studentId === user.id && f.status !== 'paid')
    return due.length ? 'Pending fees: ' + due.map((f) => `${f.title} ₹${f.amount} (due ${f.due || 'n/a'})`).join(', ') + '.' : 'You have no pending fees.'
  }
  if (/leave/.test(t)) return user.role === 'student' ? 'Use the Leave tab to ask for leave. Your teacher will approve or reject it.' : 'Open the Leave tab to approve or reject requests.'
  if (/timetable|schedule|period|class today/.test(t)) return 'Open the Timetable tab to see the weekly timetable.'
  if (/complain|feedback|rating|rate/.test(t)) {
    if (user.role === 'student') return 'Open the Rate Teacher tab to rate a teacher or send a complaint. Only the admin sees it.'
    if (user.role === 'admin') return `Open the Teachers tab. There are ${s.feedback.filter((f) => f.status === 'new').length} new ratings or complaints.`
    return 'Feedback about teachers is private to the admin.'
  }
  return 'I can answer about attendance, marks, events, assignments, notices and clubs. Try "What is my attendance?"'
}

export function Assistant({ user }) {
  const s = useStore()
  const [msgs, setMsgs] = useState([{ role: 'assistant', text: `Hi ${user.name.split(' ')[0]}! Ask me about attendance, marks, events, assignments, notices or clubs.` }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const ask = async () => {
    const q = input.trim()
    if (!q || busy) return
    setInput('')
    setBusy(true)
    const next = [...msgs, { role: 'user', text: q }]
    setMsgs(next)
    const history = next.slice(1, -1).slice(-6).map((m) => ({ role: m.role, content: m.text }))
    const r = await askAI('/api/chat', { question: q, history, context: buildContext(user, s) })
    const answer = r && r.answer ? r.answer : localAnswer(q, user, s)
    setMsgs([...next, { role: 'assistant', text: answer, local: !(r && r.answer) }])
    setBusy(false)
  }
  return (
    <div>
      <h2>AI assistant</h2>
      <p className="muted">It only sees your own data. If the AI key is not set, simple built-in answers are used.</p>
      <div className="chat">
        {msgs.map((m, i) => <div key={i} className={'bubble ' + m.role}>{m.text}{m.local && <span className="muted"> (built-in answer)</span>}</div>)}
        {busy && <div className="bubble assistant muted">Thinking...</div>}
      </div>
      <div className="row">
        <input style={{ flex: 1 }} placeholder="Ask a question" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} />
        <button onClick={ask} disabled={busy}>Ask</button>
      </div>
    </div>
  )
}

/* ---------- Search bar ---------- */
export function Search({ user, go }) {
  const s = useStore()
  const [q, setQ] = useState('')
  const t = q.trim().toLowerCase()
  const has = (x) => (x || '').toLowerCase().includes(t)
  const results = !t ? [] : [
    ...(user.role !== 'student' ? s.users.filter((u) => u.role === 'student' && has(u.name)).map((u) => ['Student', u.name, 'people']) : []),
    ...(user.role === 'admin' ? s.users.filter((u) => u.role === 'teacher' && has(u.name)).map((u) => ['Teacher', u.name, 'teachers']) : []),
    ...s.events.filter((e) => has(e.title)).map((e) => ['Event', e.title, 'events']),
    ...s.assignments.filter((a) => has(a.title)).map((a) => ['Assignment', a.title, 'assignments']),
    ...s.channels.filter((c) => has(c.name)).map((c) => [c.type === 'club' ? 'Club' : 'Group', c.name, 'connect']),
    ...s.notices.filter((n) => visibleNotice(n, user) && has(n.title)).map((n) => ['Notice', n.title, 'notices']),
    ...s.staff.filter((f) => has(f.name) || has(f.role)).map((f) => ['Staff', f.name + ' · ' + f.role, 'staff']),
  ].slice(0, 8)
  return (
    <div className="searchbox">
      <input placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
      {t && (
        <div className="dropdown">
          {results.length === 0 && <p className="muted pad">No results.</p>}
          {results.map((r, i) => (
            <button key={i} className="drop-item" onClick={() => { go(r[2]); setQ('') }}>
              <span className="tag">{r[0]}</span> {r[1]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- Notification bell ---------- */
export function Bell({ user }) {
  const s = useStore()
  const [open, setOpen] = useState(false)
  const [snap, setSnap] = useState(0)
  const today = new Date().toISOString().slice(0, 10)
  const loanAlerts = s.libraryIssues.filter((issue) => issue.studentId === user.id && issue.status === 'issued' && issue.dueDate && issue.dueDate <= new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)).map((issue) => ({
    id: 'loan-reminder-' + issue.id,
    userId: user.id,
    text: issue.dueDate < today ? `${issue.bookTitle} is overdue. It was due ${issue.dueDate}.` : `Return ${issue.bookTitle} by ${issue.dueDate}.`,
    time: Date.parse(issue.dueDate + 'T00:00:00') - 3 * 86400000,
  }))
  const mine = [...s.notifications.filter((n) => n.userId === 'all' || n.userId === user.id), ...loanAlerts].sort((a, b) => b.time - a.time)
  const readAt = s.readAt[user.id] || 0
  const unread = mine.filter((n) => n.time > readAt).length
  const toggle = () => {
    if (!open) {
      setSnap(readAt)
      setState((d) => ((d.readAt[user.id] = Date.now()), d))
    }
    setOpen(!open)
  }
  return (
    <div className="searchbox">
      <button className="ghost bellbtn" onClick={toggle}>Alerts{unread > 0 && <span className="count">{unread}</span>}</button>
      {open && (
        <div className="dropdown right">
          {mine.length === 0 && <p className="muted pad">No notifications.</p>}
          {mine.slice(0, 12).map((n) => (
            <div key={n.id} className={'drop-item static ' + (n.time > snap ? 'fresh' : '')}>
              {n.text}
              <div className="muted">{timeAgo(n.time)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
