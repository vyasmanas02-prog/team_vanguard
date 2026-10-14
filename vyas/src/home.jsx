import { useStore, pct, SUBJECTS, studentsFor, classMatch, classLabel } from './store.js'
import { timeAgo } from './util.js'
import { Table, Badge } from './pages.jsx'

const lowSubjects = (s, id) => SUBJECTS.filter((x) => pct(s.attendance[id][x]) < 75)

function Stat({ label, value, tab, go, bad }) {
  return (
    <div className="card stat" onClick={() => go(tab)}>
      <span className="muted">{label}</span>
      <p className={'big ' + (bad && value > 0 ? 'bad' : '')}>{value}</p>
    </div>
  )
}

/* ---------- Home: each role sees its own dashboard ---------- */
export function Home({ user, go }) {
  const s = useStore()
  const nm = (id) => s.users.find((u) => u.id === id)?.name
  const ev = (id) => s.events.find((e) => e.id === id)?.title
  const notices = [...s.notices].sort((a, b) => b.time - a.time).slice(0, 3)
  const NoticeList = () => (
    <>
      <h3>Latest notices</h3>
      {notices.map((n) => (
        <div className="card" key={n.id}><b>{n.title}</b><p className="muted">{nm(n.authorId)} · {timeAgo(n.time)}</p></div>
      ))}
    </>
  )

  if (user.role === 'student') {
    const low = lowSubjects(s, user.id)
    const certs = s.certificates.filter((c) => c.studentId === user.id)
    const todo = s.assignments.filter((a) => !s.submissions.some((x) => x.assignmentId === a.id && x.studentId === user.id))
    const graded = s.submissions.filter((x) => x.studentId === user.id && x.grade !== null && x.grade !== '')
    return (
      <div>
        <h2>Hello, {user.name.split(' ')[0]}</h2>
        <p className="muted">{user.college} · {user.branch} · {user.batch} · Section {user.section}</p>
        {low.length > 0 && <div className="warn">Attendance below 75% in {low.join(', ')}.</div>}
        <div className="grid">
          <Stat label="Assignments to submit" value={todo.length} tab="assignments" go={go} />
          <Stat label="Certificates waiting for a teacher" value={certs.filter((c) => c.status === 'pending').length} tab="events" go={go} />
          <Stat label="Certificates verified" value={certs.filter((c) => c.status === 'verified').length} tab="events" go={go} />
          <Stat label="Graded assignments" value={graded.length} tab="assignments" go={go} />
        </div>
        <NoticeList />
      </div>
    )
  }

  const mine = studentsFor(s, user)
  const ids = mine.map((x) => x.id)
  const pending = s.certificates.filter((c) => c.status === 'pending' && ids.includes(c.studentId))
  const ungraded = s.submissions.filter((x) => ids.includes(x.studentId) && (x.grade === null || x.grade === ''))
  const lowStudents = mine.filter((st) => lowSubjects(s, st.id).length)
  const isAdmin = user.role === 'admin'

  return (
    <div>
      <h2>{isAdmin ? 'Admin dashboard' : `Hello, ${user.name}`}</h2>
      <p className="muted">{isAdmin ? 'You can see everything in the college.' : 'You see only the students in your own classes.'}</p>
      {!isAdmin && (
        <div className="card">
          <h3>My classes</h3>
          {(user.classes || []).length === 0 && <p className="muted">No classes assigned yet. Ask the admin to assign classes.</p>}
          {(user.classes || []).map((c, i) => (
            <span key={i} className="tag">{classLabel(c)} · {s.users.filter((u) => u.role === 'student' && classMatch(u, c)).length} students</span>
          ))}
        </div>
      )}
      <div className="grid">
        <Stat label={isAdmin ? 'Students' : 'My students'} value={mine.length} tab={isAdmin ? 'manage' : 'people'} go={go} />
        <Stat label="Certificates to verify" value={pending.length} tab="events" go={go} bad />
        <Stat label="Submissions to grade" value={ungraded.length} tab="assignments" go={go} bad />
        <Stat label="Students below 75% attendance" value={lowStudents.length} tab="attendance" go={go} bad />
        {isAdmin && <Stat label="Teachers" value={s.users.filter((u) => u.role === 'teacher').length} tab="teachers" go={go} />}
        {isAdmin && <Stat label="Open counselling requests" value={s.counselling.filter((c) => c.status === 'open').length} tab="counselling" go={go} bad />}
        {isAdmin && <Stat label="New ratings and complaints" value={s.feedback.filter((f) => f.status === 'new').length} tab="teachers" go={go} bad />}
      </div>
      <h3>Pending verifications</h3>
      {pending.length === 0 ? <p className="muted">Nothing to verify.</p> : (
        <Table head={['Student', 'Event', 'File', 'Status']} rows={pending.map((c) => [nm(c.studentId), ev(c.eventId), c.file, <Badge status={c.status} />])} />
      )}
      {lowStudents.length > 0 && (
        <>
          <h3>Low attendance</h3>
          <Table head={['Student', 'Class', 'Subjects below 75%']} rows={lowStudents.map((st) => [st.name, classLabel(st), lowSubjects(s, st.id).join(', ')])} />
        </>
      )}
      <NoticeList />
    </div>
  )
}

/* ---------- Students and teachers can look at teachers and the admin office (read only) ---------- */
export function Directory({ user }) {
  const s = useStore()
  const teachers = s.users.filter((u) => u.role === 'teacher')
  return (
    <div>
      <h2>Teachers and Admin office</h2>
      <p className="muted">Read only. Contact details and who teaches which class. Private things like marks or teacher ratings are not shown here.</p>
      <h3>Admin office and staff</h3>
      <Table head={['Name', 'Role', 'Phone', 'Email']} rows={s.staff.map((f) => [f.name, f.role, f.phone, f.email])} />
      <p className="muted">The Admin office posts official notices. Read them in the Notices tab.</p>
      <h3>Teachers</h3>
      <div className="grid">
        {teachers.map((t) => {
          const mine = user.role === 'student' && (t.classes || []).some((c) => classMatch(user, c))
          return (
            <div className="card" key={t.id}>
              <h3>{t.name} {mine && <span className="tag official">Teaches your class</span>}</h3>
              <p className="muted">{t.designation || 'Teacher'} · {t.dept || 'No department'}</p>
              <p>{t.phone || 'No phone'}<br />{t.email || 'No email'}</p>
              <div>{(t.subjects || []).map((x) => <span key={x} className="tag">{x}</span>)}</div>
              <h4>Classes taught</h4>
              <div>
                {(t.classes || []).length === 0 && <span className="muted">None assigned</span>}
                {(t.classes || []).map((c, i) => <span key={i} className="tag">{classLabel(c)}</span>)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
