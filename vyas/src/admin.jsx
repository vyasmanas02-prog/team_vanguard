import { useState } from 'react'
import { useStore, setState, uid, pct, SUBJECTS, allClasses, classKey, classLabel, inClass, removeUser, audit } from './store.js'
import { resizeImage } from './util.js'
import { Table } from './pages.jsx'
import { useStudentFilter } from './filters.jsx'
import { supabase, supabaseConfigured } from './supabase.js'

/* ---------- Avatar: photo or initials ---------- */
export function Avatar({ u, size = 56 }) {
  const style = { width: size, height: size, fontSize: size / 2.5 }
  if (u.photo) return <img className="avatar" style={style} src={u.photo} alt={u.name} />
  return <span className="avatar" style={style}>{u.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
}

/* ---------- Admin: add, edit and remove students and teachers ---------- */
export function Users({ user }) {
  const s = useStore()
  const { students, ui } = useStudentFilter({ role: 'admin' })
  const teachers = s.users.filter((u) => u.role === 'teacher')
  const otherAccounts = s.users.filter((u) => !['student', 'teacher'].includes(u.role))
  const classOptions = allClasses(s)
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState({ name: '', rollNumber: '', college: '', dept: '', branch: '', batch: '', section: '', email: '', phone: '' })
  const [accountForm, setAccountForm] = useState({ name: '', role: 'teacher', dept: '', designation: '', phone: '', email: '', password: '', subjects: '', classKeys: [] })
  const [accountError, setAccountError] = useState('')
  const all = s.users.filter((u) => u.role === 'student')
  const pool = (k) => [...new Set(all.map((u) => u[k]))].filter(Boolean)

  const startEdit = (u) => setEdit({ ...u, subjects: (u.subjects || []).join(', '), classes: [...(u.classes || [])] })
  const save = () => {
    if (!edit.name.trim()) return
    setState((d) => {
      const u = d.users.find((x) => x.id === edit.id)
      const { subjects, ...changes } = edit
      Object.assign(u, changes, { name: edit.name.trim() })
      if (u.role === 'teacher') u.subjects = subjects.split(',').map((x) => x.trim()).filter(Boolean)
      audit(d, user.id, 'updated', u.role, u.id, { name: u.name })
      return d
    })
    setEdit(null)
  }
  const toggleEditClass = (classInfo) => {
    const key = classKey(classInfo)
    const classes = edit.classes || []
    setEdit({ ...edit, classes: classes.some((c) => classKey(c) === key) ? classes.filter((c) => classKey(c) !== key) : [...classes, classInfo] })
  }
  const remove = (u) => {
    if (!window.confirm(`Remove ${u.name}? Their marks, attendance, fees and requests will be deleted too.`)) return
    setState((d) => { audit(d, user.id, 'removed', u.role, u.id, { name: u.name }); removeUser(d, u.id); return d })
    if (edit?.id === u.id) setEdit(null)
  }
  const addStudent = () => {
    if (!form.name.trim() || !form.college.trim() || !form.branch.trim() || !form.batch.trim() || !form.section.trim()) return
    setState((d) => {
      const id = 's' + uid()
      d.users.push({ id, name: form.name.trim(), role: 'student', rollNumber: form.rollNumber.trim(), college: form.college.trim(), dept: form.dept.trim(), branch: form.branch.trim(), batch: form.batch.trim(), section: form.section.trim(), email: form.email.trim(), phone: form.phone.trim() })
      audit(d, user.id, 'created', 'student', id, { name: form.name.trim() })
      d.marks[id] = {}
      d.attendance[id] = {}
      SUBJECTS.forEach((x) => { d.marks[id][x] = 0; d.attendance[id][x] = { attended: 0, total: 0 } })
      const g = d.channels.find((c) => c.type === 'branch' && c.name === form.branch.trim() + ' Branch')
      if (g) g.members.push(id)
      return d
    })
    setForm({ name: '', rollNumber: '', college: '', dept: '', branch: '', batch: '', section: '', email: '', phone: '' })
  }
  const addAccount = async (event) => {
    event.preventDefault()
    if (!accountForm.name.trim() || (accountForm.role === 'teacher' && accountForm.classKeys.length === 0)) return
    const prefix = { teacher: 't', library_operator: 'l', sports_coordinator: 'sp', admin: 'a' }[accountForm.role]
    const id = prefix + uid()
    let loginId = id
    if (supabaseConfigured) {
      setAccountError('')
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${sessionData.session?.access_token || ''}` },
          body: JSON.stringify({
            action: 'create_account',
            account: {
              loginId: id,
              fullName: accountForm.name.trim(),
              role: accountForm.role,
              email: accountForm.email.trim(),
              password: accountForm.password,
              phone: accountForm.phone.trim(),
              department: accountForm.dept.trim(),
              designation: accountForm.designation.trim(),
              subjects: accountForm.subjects.split(',').map((subject) => subject.trim()).filter(Boolean),
              classes: classOptions.filter((classInfo) => accountForm.classKeys.includes(classKey(classInfo))).map((classInfo) => ({ ...classInfo, year: classInfo.batch })),
            },
          }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Account creation failed.')
        loginId = result.profile.login_id
      } catch (error) {
        setAccountError(error.message || 'Account creation failed.')
        return
      }
    }
    const account = {
      id: loginId,
      name: accountForm.name.trim(),
      role: accountForm.role,
      dept: accountForm.dept.trim(),
      designation: accountForm.designation.trim(),
      phone: accountForm.phone.trim(),
      email: accountForm.email.trim(),
    }
    if (account.role === 'teacher') {
      account.subjects = accountForm.subjects.split(',').map((subject) => subject.trim()).filter(Boolean)
      account.classes = classOptions.filter((classInfo) => accountForm.classKeys.includes(classKey(classInfo)))
    }
    setState((d) => { d.users.push(account); audit(d, user.id, 'created', account.role, loginId, { name: account.name }); return d })
    setAccountForm({ name: '', role: accountForm.role, dept: '', designation: '', phone: '', email: '', password: '', subjects: '', classKeys: [] })
  }
  const field = (k, ph, list) => <input placeholder={ph} list={list} value={edit[k] || ''} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} />

  return (
    <div>
      <h2>Manage users</h2>
      {['college', 'branch', 'batch', 'section'].map((k) => <datalist key={k} id={'dl-' + k}>{pool(k).map((v) => <option key={v} value={v} />)}</datalist>)}

      {edit && (
        <div className="card">
          <h3>Edit {edit.role}</h3>
          <p className="muted">Login ID: {edit.id}</p>
          <div className="row wrap">
            {field('name', 'Name')}
            {edit.role === 'student' ? (
              <>{field('rollNumber', 'Student ID')}{field('college', 'College', 'dl-college')}{field('dept', 'Department')}{field('branch', 'Branch or class', 'dl-branch')}{field('batch', 'Year or batch', 'dl-batch')}{field('section', 'Section', 'dl-section')}{field('email', 'Email')}{field('phone', 'Phone')}</>
            ) : (
              <>{field('dept', 'Department')}{field('designation', 'Designation')}{field('phone', 'Phone')}{field('email', 'Email')}{edit.role === 'teacher' && field('subjects', 'Subjects, separated by commas')}</>
            )}
            <button onClick={save}>Save</button>
            <button className="ghost" onClick={() => setEdit(null)}>Cancel</button>
          </div>
          {edit.role === 'teacher' && <div className="card">
            <h4>Assigned classes</h4>
            <div className="row wrap">
              {classOptions.map((classInfo) => <label className="row" key={classKey(classInfo)}>
                <input type="checkbox" checked={(edit.classes || []).some((c) => classKey(c) === classKey(classInfo))} onChange={() => toggleEditClass(classInfo)} />
                {classInfo.branch} · {classInfo.batch} · Sec {classInfo.section}
              </label>)}
            </div>
          </div>}
        </div>
      )}

      <div className="card">
        <h3>Add a student</h3>
        <div className="row wrap">
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Student ID" value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} />
          {[['college', 'College'], ['dept', 'Department'], ['branch', 'Branch or class'], ['batch', 'Year or batch, e.g. 2025-29'], ['section', 'Section'], ['email', 'Email'], ['phone', 'Phone']].map(([k, ph]) => (
            <input key={k} placeholder={ph} list={'dl-' + k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          ))}
          <button onClick={addStudent}>Add student</button>
        </div>
      </div>

      <form className="card" onSubmit={addAccount}>
        <h3>Add an account</h3>
        <div className="row wrap">
          <input placeholder="Name" value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} required />
          <select value={accountForm.role} onChange={(e) => setAccountForm({ ...accountForm, role: e.target.value })}>
            <option value="teacher">Teacher</option>
            <option value="library_operator">Library operator</option>
            <option value="sports_coordinator">Sports coordinator</option>
            <option value="admin">Admin</option>
          </select>
          <input placeholder="Department" value={accountForm.dept} onChange={(e) => setAccountForm({ ...accountForm, dept: e.target.value })} />
          <input placeholder="Designation" value={accountForm.designation} onChange={(e) => setAccountForm({ ...accountForm, designation: e.target.value })} />
          <input placeholder="Phone" value={accountForm.phone} onChange={(e) => setAccountForm({ ...accountForm, phone: e.target.value })} />
          <input placeholder="Email" value={accountForm.email} onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })} />
          {supabaseConfigured && <input aria-label="New account password" placeholder="Initial password (10+ characters)" type="password" minLength={10} value={accountForm.password} onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })} required />}
          {accountForm.role === 'teacher' && <input placeholder="Subjects, separated by commas" value={accountForm.subjects} onChange={(e) => setAccountForm({ ...accountForm, subjects: e.target.value })} />}
          <button>Add account</button>
        </div>
        {accountForm.role === 'teacher' && <div className="row wrap">
          {classOptions.map((classInfo) => <label className="row" key={classKey(classInfo)}>
            <input type="checkbox" checked={accountForm.classKeys.includes(classKey(classInfo))} onChange={() => setAccountForm({ ...accountForm, classKeys: accountForm.classKeys.includes(classKey(classInfo)) ? accountForm.classKeys.filter((key) => key !== classKey(classInfo)) : [...accountForm.classKeys, classKey(classInfo)] })} />
            {classInfo.branch} · {classInfo.batch} · Sec {classInfo.section}
          </label>)}
        </div>}
        {accountForm.role === 'teacher' && accountForm.classKeys.length === 0 && <p className="muted">Select at least one class for this teacher.</p>}
        {accountError && <p className="warn" role="alert">{accountError}</p>}
      </form>

      <h3>Students</h3>
      {ui}
      <Table
        head={['Login ID', 'Student ID', 'Name', 'College', 'Department', 'Branch', 'Year', 'Section', '']}
        rows={students.map((u) => [u.id, u.rollNumber || '', u.name, u.college, u.dept || '', u.branch, u.batch, u.section, <span className="row"><button className="ghost small" onClick={() => startEdit(u)}>Edit</button><button className="ghost small" onClick={() => remove(u)}>Remove</button></span>])}
      />

      <h3>Teachers</h3>
      <Table
        head={['Login ID', 'Name', 'Department', 'Designation', 'Subjects', 'Classes', '']}
        rows={teachers.map((u) => [u.id, u.name, u.dept, u.designation, (u.subjects || []).join(', '), (u.classes || []).length, <span className="row"><button className="ghost small" onClick={() => startEdit(u)}>Edit</button><button className="ghost small" onClick={() => remove(u)}>Remove</button></span>])}
      />

      <h3>Other accounts</h3>
      <Table
        head={['Login ID', 'Role', 'Name', 'Department', 'Designation', '']}
        rows={otherAccounts.map((u) => [u.id, u.role.replace('_', ' '), u.name, u.dept || '', u.designation || '', <span className="row"><button className="ghost small" onClick={() => startEdit(u)}>Edit</button><button className="ghost small" onClick={() => remove(u)}>Remove</button></span>])}
      />
    </div>
  )
}

export function Reports() {
  const s = useStore()
  const today = new Date().toISOString().slice(0, 10)
  const students = s.users.filter((user) => user.role === 'student')
  const overdueLoans = s.libraryIssues.filter((issue) => issue.status === 'issued' && issue.dueDate && issue.dueDate < today)
  const metrics = [
    ['Students', students.length],
    ['Teachers', s.users.filter((user) => user.role === 'teacher').length],
    ['Active library loans', s.libraryIssues.filter((issue) => issue.status === 'issued').length],
    ['Overdue books', overdueLoans.length],
    ['Book waitlist', s.libraryReservations.filter((reservation) => ['waiting', 'available'].includes(reservation.status)).length],
    ['Sports equipment issued', s.sportsIssues.filter((issue) => issue.status === 'issued').length],
    ['Pending sports bookings', s.sportsBookings.filter((booking) => booking.status === 'pending').length],
    ['Pending OD requests', s.odRequests.filter((request) => request.status === 'pending').length],
    ['Students below 75% attendance', students.filter((student) => SUBJECTS.some((subject) => s.attendance[student.id]?.[subject] && pct(s.attendance[student.id][subject]) < 75)).length],
  ]
  const actorName = (id) => s.users.find((user) => user.id === id)?.name || 'System'

  return (
    <div>
      <h2>Campus reports</h2>
      <div className="grid">
        {metrics.map(([label, value]) => <div className="card" key={label}><span className="muted">{label}</span><p className="big">{value}</p></div>)}
      </div>
      <h3>Overdue library loans</h3>
      <Table head={['Book', 'Student', 'Student ID', 'Due date']} rows={overdueLoans.map((issue) => [issue.bookTitle, issue.studentName, issue.rollNumber, issue.dueDate])} />
      <h3>Recent activity</h3>
      <Table head={['When', 'User', 'Action', 'Record', 'Details']} rows={s.auditEvents.slice(0, 25).map((entry) => [new Date(entry.time).toLocaleString(), actorName(entry.actorId), entry.action, `${entry.entityType} · ${entry.entityId}`, JSON.stringify(entry.details)])} />
    </div>
  )
}

/* ---------- Profile: my details + directory of classmates and teachers ---------- */
export function Profile({ user }) {
  const s = useStore()
  const me = s.users.find((u) => u.id === user.id)
  const [draft, setDraft] = useState({ phone: me.phone || '', email: me.email || '', bio: me.bio || '', shareContact: !!me.shareContact, photo: me.photo || null })
  const [saved, setSaved] = useState(false)
  const [q, setQ] = useState('')
  const isStudent = user.role === 'student'

  const pickPhoto = async (e) => {
    const f = e.target.files[0]
    if (f) setDraft({ ...draft, photo: await resizeImage(f, 300) })
    e.target.value = ''
  }
  const save = () => {
    setState((d) => { Object.assign(d.users.find((u) => u.id === user.id), draft); return d })
    setSaved(true)
  }
  const people = s.users.filter((u) => u.id !== user.id && u.role !== 'admin' && (!isStudent || u.role === 'teacher' || inClass(u, user)) && (!q.trim() || u.name.toLowerCase().includes(q.trim().toLowerCase())))
  const canSeeContact = (u) => !isStudent || u.role === 'teacher' || u.shareContact

  return (
    <div>
      <h2>My profile</h2>
      <div className="card">
        <div className="row wrap">
          <Avatar u={{ ...me, photo: draft.photo }} size={72} />
          <div>
            <b>{me.name}</b>
            <p className="muted">{me.role === 'student' ? `${me.college} · ${me.dept || me.branch} · ${classLabel(me)}${me.rollNumber ? ` · ID ${me.rollNumber}` : ''}` : me.role === 'teacher' ? `${me.designation || 'Teacher'} · ${me.dept || ''}` : 'Admin'}</p>
          </div>
        </div>
        <div className="row wrap">
          <input type="file" accept="image/*" onChange={pickPhoto} />
          <input placeholder="Phone" value={draft.phone} onChange={(e) => { setSaved(false); setDraft({ ...draft, phone: e.target.value }) }} />
          <input placeholder="Email" value={draft.email} onChange={(e) => { setSaved(false); setDraft({ ...draft, email: e.target.value }) }} />
        </div>
        <textarea rows="2" placeholder="A short line about you" value={draft.bio} onChange={(e) => { setSaved(false); setDraft({ ...draft, bio: e.target.value }) }} />
        {isStudent && <label className="row"><input type="checkbox" checked={draft.shareContact} onChange={(e) => { setSaved(false); setDraft({ ...draft, shareContact: e.target.checked }) }} /> Show my phone and email to classmates (teachers can always see them)</label>}
        <button onClick={save}>Save profile</button>
        {saved && <span className="good"> Saved.</span>}
      </div>

      <h3>{isStudent ? 'My classmates and teachers' : 'Students and teachers'}</h3>
      <input placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
      {people.length === 0 && <p className="muted">No one found.</p>}
      <div className="grid">
        {people.map((u) => (
          <div className="card" key={u.id}>
            <div className="row">
              <Avatar u={u} />
              <div>
                <b>{u.name}</b>
                <p className="muted">{u.role === 'student' ? `${u.college} · ${classLabel(u)}` : `${u.designation || 'Teacher'} · ${u.dept || ''}`}</p>
              </div>
            </div>
            {u.bio && <p>{u.bio}</p>}
            {u.role === 'teacher' && <div>{(u.subjects || []).map((x) => <span key={x} className="tag">{x}</span>)}</div>}
            {canSeeContact(u) ? <p className="muted">{u.phone || 'No phone'} · {u.email || 'No email'}</p> : <p className="muted">Contact details are private.</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
