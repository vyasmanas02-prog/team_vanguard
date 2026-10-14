import { useState } from 'react'
import { useStore, setState, uid, notify, SUBJECTS, allClasses, classMatch, classKey, classLabel } from './store.js'
import { Table } from './pages.jsx'

const EMPTY = { college: '', branch: '', batch: '', section: '' }
const FIELDS = [['college', 'College'], ['branch', 'Branch or class'], ['batch', 'Batch, e.g. 2025-29'], ['section', 'Section']]
const filled = (f) => Object.values(f).every((v) => v.trim())
const clean = (f) => ({ college: f.college.trim(), branch: f.branch.trim(), batch: f.batch.trim(), section: f.section.trim() })

// Four boxes that suggest values that already exist, but also accept new ones.
function ClassFields({ value, onChange, listId, classes }) {
  return FIELDS.map(([k, ph]) => (
    <span key={k}>
      <input list={listId + k} placeholder={ph} value={value[k]} onChange={(e) => onChange({ ...value, [k]: e.target.value })} />
      <datalist id={listId + k}>{[...new Set(classes.map((c) => c[k]))].sort().map((o) => <option key={o} value={o} />)}</datalist>
    </span>
  ))
}

/* ---------- Admin only: add students, create classes, assign classes to teachers ---------- */
export function Manage() {
  const s = useStore()
  const classes = allClasses(s)
  const teachers = s.users.filter((u) => u.role === 'teacher')
  const [name, setName] = useState('')
  const [sc, setSc] = useState(EMPTY)
  const [nc, setNc] = useState(EMPTY)
  const [ncTeacher, setNcTeacher] = useState('')
  const [pick, setPick] = useState({})
  const [note, setNote] = useState('')
  const taughtBy = (c) => teachers.filter((t) => (t.classes || []).some((x) => classMatch(x, c)))

  const addStudent = () => {
    if (!name.trim() || !filled(sc)) return
    const c = clean(sc)
    const noTeacher = !teachers.some((t) => (t.classes || []).some((x) => classMatch(x, c)))
    setState((d) => {
      const id = 's' + uid()
      d.users.push({ id, name: name.trim(), role: 'student', ...c })
      d.marks[id] = Object.fromEntries(SUBJECTS.map((x) => [x, 0]))
      d.attendance[id] = Object.fromEntries(SUBJECTS.map((x) => [x, { attended: 0, total: 0 }]))
      // join the branch group automatically, e.g. "CSE Branch"
      const g = d.channels.find((ch) => ch.type === 'branch' && ch.name.toLowerCase().startsWith(c.branch.toLowerCase()))
      if (g) g.members.push(id)
      notify(d, id, 'Welcome to Campus ERP')
      return d
    })
    setNote(`${name.trim()} was added to ${classLabel(c)}.` + (noTeacher ? ' No teacher has this class yet. Assign one below.' : ''))
    setName('')
    setSc(EMPTY)
  }

  const assign = (tid, c) => {
    if (!tid) return
    setState((d) => {
      const t = d.users.find((u) => u.id === tid)
      t.classes = t.classes || []
      if (!t.classes.some((x) => classMatch(x, c))) {
        t.classes.push(clean(c))
        notify(d, tid, `You were assigned to class ${classLabel(c)}`)
      }
      return d
    })
  }
  const unassign = (tid, c) =>
    setState((d) => {
      const t = d.users.find((u) => u.id === tid)
      t.classes = (t.classes || []).filter((x) => !classMatch(x, c))
      return d
    })
  const createClass = () => {
    if (!filled(nc) || !ncTeacher) return
    assign(ncTeacher, nc)
    setNote(`Class ${classLabel(nc)} was created and given to ${teachers.find((t) => t.id === ncTeacher)?.name}.`)
    setNc(EMPTY)
    setNcTeacher('')
  }

  return (
    <div>
      <h2>Manage students, teachers and classes</h2>
      <p className="muted">Admin only. To add a new teacher, use the Teachers tab. Then give that teacher classes here.</p>
      {note && <p className="good">{note}</p>}

      <div className="card">
        <h3>Add a student</h3>
        <div className="row wrap">
          <input placeholder="Student name" value={name} onChange={(e) => setName(e.target.value)} />
          <ClassFields value={sc} onChange={setSc} listId="sc-" classes={classes} />
          <button disabled={!name.trim() || !filled(sc)} onClick={addStudent}>Add student</button>
        </div>
        <p className="muted">The student appears on the login screen and is seen by the teachers of that class.</p>
      </div>

      <div className="card">
        <h3>Create a new class for a teacher</h3>
        <div className="row wrap">
          <ClassFields value={nc} onChange={setNc} listId="nc-" classes={classes} />
          <select value={ncTeacher} onChange={(e) => setNcTeacher(e.target.value)}>
            <option value="">Choose teacher</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button disabled={!filled(nc) || !ncTeacher} onClick={createClass}>Create class</button>
        </div>
      </div>

      <h3>All classes ({classes.length})</h3>
      <Table
        head={['Class', 'College', 'Students', 'Teachers', 'Add teacher']}
        rows={classes.map((c) => {
          const k = classKey(c)
          const have = taughtBy(c)
          return [
            classLabel(c),
            c.college,
            s.users.filter((u) => u.role === 'student' && classMatch(u, c)).length,
            <span className="row wrap">
              {have.length === 0 && <span className="muted">No teacher</span>}
              {have.map((t) => (
                <span key={t.id} className="tag">{t.name} <button className="ghost small" onClick={() => unassign(t.id, c)} aria-label={'Remove ' + t.name}>x</button></span>
              ))}
            </span>,
            <span className="row">
              <select value={pick[k] || ''} onChange={(e) => setPick({ ...pick, [k]: e.target.value })}>
                <option value="">Choose</option>
                {teachers.filter((t) => !have.includes(t)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button className="small" disabled={!pick[k]} onClick={() => { assign(pick[k], c); setPick({ ...pick, [k]: '' }) }}>Add</button>
            </span>,
          ]
        })}
      />
    </div>
  )
}
