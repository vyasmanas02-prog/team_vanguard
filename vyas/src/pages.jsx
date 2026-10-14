import { useState } from 'react'
import { useStore, setState, uid, pct, grade, notify, SUBJECTS } from './store.js'
import { resizeImage, askAI, downloadCsv } from './util.js'
import { useStudentFilter } from './filters.jsx'

/* ---------- small helpers ---------- */
export function Table({ head, rows }) {
  return (
    <div className="scroll">
      <table>
        <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}
export function Badge({ status }) {
  return <span className={'badge ' + status}>{status}</span>
}

/* ---------- Events (with AI certificate reader) ---------- */
export function Events({ user }) {
  const s = useStore()
  const [sel, setSel] = useState('')
  const [file, setFile] = useState(null)
  const [aiMsg, setAiMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const count = (id) => s.certificates.filter((c) => c.eventId === id && c.status === 'verified').length
  const name = (id) => s.users.find((u) => u.id === id)?.name
  const eventTitle = (id) => s.events.find((e) => e.id === id)?.title

  const pick = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    setBusy(true)
    setAiMsg('Reading certificate...')
    const dataUrl = f.type.startsWith('image/') ? await resizeImage(f, 1000) : null
    setFile({ name: f.name, dataUrl })
    let match = null
    if (dataUrl) {
      const r = await askAI('/api/certificate', { image: dataUrl, events: s.events.map((x) => x.title) })
      if (r && r.matchedEvent) {
        match = s.events.find((x) => x.title === r.matchedEvent)
        if (match) setAiMsg('AI read: ' + (r.eventName || r.matchedEvent) + (r.studentName ? ' for ' + r.studentName : ''))
      }
    }
    if (!match) {
      const low = f.name.toLowerCase()
      match = s.events.find((x) => x.title.toLowerCase().split(' ').some((w) => w.length > 3 && low.includes(w)))
      setAiMsg(match ? 'Matched from the file name (the AI reader is not connected).' : 'Could not detect the event. Please choose it.')
    }
    if (match) setSel(match.id)
    setBusy(false)
  }

  const upload = () => {
    if (!sel || !file) return
    setState((d) => {
      d.certificates.push({ id: uid(), eventId: sel, studentId: user.id, file: file.name, dataUrl: file.dataUrl, status: 'pending' })
      return d
    })
    setFile(null)
    setSel('')
    setAiMsg('Uploaded. Waiting for a teacher to verify.')
  }
  const verify = (id, status) =>
    setState((d) => {
      const c = d.certificates.find((x) => x.id === id)
      c.status = status
      notify(d, c.studentId, `Your certificate for ${eventTitle(c.eventId)} was ${status}`)
      return d
    })
  const mine = s.certificates.filter((c) => c.studentId === user.id)

  return (
    <div>
      <h2>Event tracker</h2>
      {user.role === 'student' && (
        <div className="card">
          <h3>Upload a certificate</h3>
          <div className="row wrap">
            <input type="file" accept="image/*,application/pdf" onChange={pick} />
            <select value={sel} onChange={(e) => setSel(e.target.value)}>
              <option value="">Choose event</option>
              {s.events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
            <button disabled={busy || !sel || !file} onClick={upload}>Upload</button>
          </div>
          {aiMsg && <p className="muted">{aiMsg}</p>}
        </div>
      )}
      <div className="grid">
        {s.events.map((e) => (
          <div className="card" key={e.id}>
            <h3>{e.title}</h3>
            <p className="muted">{e.date}</p>
            <p className="big">{count(e.id)} <span className="muted">verified participants</span></p>
          </div>
        ))}
      </div>
      {user.role === 'student' && (
        <>
          <h3>My certificates</h3>
          <Table head={['Event', 'File', 'Status']} rows={mine.map((c) => [eventTitle(c.eventId), c.file, <Badge status={c.status} />])} />
        </>
      )}
      {user.role !== 'student' && (
        <>
          <h3>Certificates to review</h3>
          <Table
            head={['Student', 'Event', 'File', 'Status', '']}
            rows={s.certificates.map((c) => [
              name(c.studentId),
              eventTitle(c.eventId),
              c.dataUrl ? <img className="thumb" src={c.dataUrl} alt={c.file} /> : c.file,
              <Badge status={c.status} />,
              c.status === 'pending' ? (
                <span className="row">
                  <button onClick={() => verify(c.id, 'verified')}>Verify</button>
                  <button className="ghost" onClick={() => verify(c.id, 'rejected')}>Reject</button>
                </span>
              ) : '',
            ])}
          />
        </>
      )}
    </div>
  )
}

/* ---------- Marks ---------- */
export function Marks({ user }) {
  const s = useStore()
  const { students, ui } = useStudentFilter(user)
  const setMark = (sid, sub, v) =>
    setState((d) => {
      d.marks[sid][sub] = Math.max(0, Math.min(100, Number(v) || 0))
      return d
    })
  if (user.role === 'student') {
    const m = s.marks[user.id]
    const total = SUBJECTS.reduce((a, x) => a + m[x], 0)
    const p = Math.round(total / SUBJECTS.length)
    return (
      <div>
        <h2>My report card</h2>
        <Table head={['Subject', 'Marks /100', 'Grade']} rows={SUBJECTS.map((x) => [x, m[x], grade(m[x])])} />
        <div className="card"><p className="big">{p}% <span className="muted">overall, grade {grade(p)}</span></p></div>
      </div>
    )
  }
  return (
    <div>
      <h2>Marks entry</h2>
      {ui}
      <button className="ghost small" onClick={() => downloadCsv('marks.csv', [['Student', 'College', 'Branch', 'Batch', 'Section', ...SUBJECTS, 'Average'], ...students.map((st) => [st.name, st.college, st.branch, st.batch, st.section, ...SUBJECTS.map((x) => s.marks[st.id][x]), Math.round(SUBJECTS.reduce((a, x) => a + s.marks[st.id][x], 0) / SUBJECTS.length)])])}>Download CSV</button>
      {students.length === 0 && <p className="muted">No students match these filters.</p>}
      <Table
        head={['Student', ...SUBJECTS, 'Avg']}
        rows={students.map((st) => [
          st.name,
          ...SUBJECTS.map((x) => <input className="num" type="number" value={s.marks[st.id][x]} onChange={(e) => setMark(st.id, x, e.target.value)} />),
          Math.round(SUBJECTS.reduce((a, x) => a + s.marks[st.id][x], 0) / SUBJECTS.length),
        ])}
      />
    </div>
  )
}

/* ---------- Attendance ---------- */
export function Attendance({ user }) {
  const s = useStore()
  const { students, ui } = useStudentFilter(user)
  const mark = (sid, sub, present) =>
    setState((d) => {
      const a = d.attendance[sid][sub]
      const before = pct(a)
      a.total += 1
      if (present) a.attended += 1
      if (before >= 75 && pct(a) < 75) notify(d, sid, `Attendance dropped below 75% in ${sub}`)
      return d
    })
  if (user.role === 'student') {
    const att = s.attendance[user.id]
    const low = SUBJECTS.filter((x) => pct(att[x]) < 75)
    return (
      <div>
        <h2>My attendance</h2>
        {low.length > 0 && <div className="warn">Warning: below 75% in {low.join(', ')}. You may be barred from exams.</div>}
        <Table
          head={['Subject', 'Attended', 'Total', '%']}
          rows={SUBJECTS.map((x) => [x, att[x].attended, att[x].total, <b className={pct(att[x]) < 75 ? 'bad' : 'good'}>{pct(att[x])}%</b>])}
        />
      </div>
    )
  }
  return (
    <div>
      <h2>Mark attendance</h2>
      <p className="muted">Pick a class below, then press P or A to record one more class for a student.</p>
      {ui}
      <button className="ghost small" onClick={() => downloadCsv('attendance.csv', [['Student', 'College', 'Branch', 'Batch', 'Section', ...SUBJECTS.map((x) => x + ' %')], ...students.map((st) => [st.name, st.college, st.branch, st.batch, st.section, ...SUBJECTS.map((x) => pct(s.attendance[st.id][x]))])])}>Download CSV</button>
      {students.length === 0 && <p className="muted">No students match these filters.</p>}
      <Table
        head={['Student', ...SUBJECTS]}
        rows={students.map((st) => [
          st.name,
          ...SUBJECTS.map((x) => {
            const a = s.attendance[st.id][x]
            return (
              <span className="row">
                <b className={pct(a) < 75 ? 'bad' : 'good'}>{pct(a)}%</b>
                <button onClick={() => mark(st.id, x, true)}>P</button>
                <button className="ghost" onClick={() => mark(st.id, x, false)}>A</button>
              </span>
            )
          }),
        ])}
      />
    </div>
  )
}

/* ---------- Assignments ---------- */
export function Assignments({ user }) {
  const s = useStore()
  const [form, setForm] = useState({ title: '', due: '', desc: '' })
  const [file, setFile] = useState({})
  const name = (id) => s.users.find((u) => u.id === id)?.name
  const post = () => {
    if (!form.title) return
    setState((d) => {
      d.assignments.push({ id: uid(), ...form })
      notify(d, 'all', `New assignment: ${form.title}`)
      return d
    })
    setForm({ title: '', due: '', desc: '' })
  }
  const submit = (aid) => {
    if (!file[aid]) return
    setState((d) => (d.submissions.push({ id: uid(), assignmentId: aid, studentId: user.id, file: file[aid], grade: null, feedback: '' }), d))
    setFile({ ...file, [aid]: '' })
  }
  const setGrade = (id, key, v) =>
    setState((d) => {
      const x = d.submissions.find((q) => q.id === id)
      const wasEmpty = x.grade === null || x.grade === ''
      x[key] = v
      if (key === 'grade' && wasEmpty && v !== '') {
        const a = d.assignments.find((q) => q.id === x.assignmentId)
        notify(d, x.studentId, `Your submission for ${a?.title} was graded`)
      }
      return d
    })
  return (
    <div>
      <h2>Assignments and lab files</h2>
      {user.role !== 'student' && (
        <div className="card">
          <h3>Post an assignment</h3>
          <div className="row wrap">
            <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
            <input placeholder="Description" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
            <button onClick={post}>Post</button>
          </div>
        </div>
      )}
      <div className="grid">
        {s.assignments.map((a) => {
          const mine = s.submissions.find((x) => x.assignmentId === a.id && x.studentId === user.id)
          return (
            <div className="card" key={a.id}>
              <h3>{a.title}</h3>
              <p className="muted">Due {a.due || 'n/a'} · {a.desc}</p>
              {user.role === 'student' &&
                (mine ? (
                  <p>Submitted: {mine.file}. {mine.grade !== null && mine.grade !== '' ? <b className="good">Grade: {mine.grade}/10. {mine.feedback}</b> : <span className="muted">Awaiting grade.</span>}</p>
                ) : (
                  <div className="row">
                    <input placeholder="Lab file name" value={file[a.id] || ''} onChange={(e) => setFile({ ...file, [a.id]: e.target.value })} />
                    <button onClick={() => submit(a.id)}>Submit</button>
                  </div>
                ))}
            </div>
          )
        })}
      </div>
      {user.role !== 'student' && (
        <>
          <h3>Submissions to grade</h3>
          <Table
            head={['Student', 'Assignment', 'File', 'Grade /10', 'Feedback']}
            rows={s.submissions.map((x) => [
              name(x.studentId),
              s.assignments.find((a) => a.id === x.assignmentId)?.title,
              x.file,
              <input className="num" type="number" min="0" max="10" value={x.grade ?? ''} onChange={(e) => setGrade(x.id, 'grade', e.target.value)} />,
              <input value={x.feedback} onChange={(e) => setGrade(x.id, 'feedback', e.target.value)} />,
            ])}
          />
          {s.submissions.length === 0 && <p className="muted">No submissions yet. Log in as a student to submit one.</p>}
        </>
      )}
    </div>
  )
}
