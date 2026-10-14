import { useState } from 'react'
import { inClass, useStore } from './store.js'

// College -> Branch or class -> Batch -> Section. Picking one resets the ones after it.
const LEVELS = ['college', 'branch', 'batch', 'section']
const ALL = { college: 'All colleges', branch: 'All branches', batch: 'All batches', section: 'All sections' }
const EMPTY = { college: '', branch: '', batch: '', section: '', q: '' }

// Use inside a staff page: const { students, ui } = useStudentFilter(user)
// Show {ui} above the table and build the table from `students`.
export function useStudentFilter(user) {
  const s = useStore()
  const [f, setF] = useState(EMPTY)
  const allStudents = s.users.filter((u) => u.role === 'student')
  const myClasses = user.role === 'teacher' ? user.classes || [] : []
  const all = user.role === 'teacher'
    ? allStudents.filter((student) => myClasses.some((classInfo) => inClass(student, classInfo)))
    : allStudents

  const options = (k) => {
    const before = LEVELS.slice(0, LEVELS.indexOf(k))
    const pool = all.filter((st) => before.every((j) => !f[j] || st[j] === f[j]))
    return [...new Set(pool.map((st) => st[k]))].filter(Boolean).sort()
  }
  const change = (k, v) => {
    const next = { ...f, [k]: v }
    LEVELS.slice(LEVELS.indexOf(k) + 1).forEach((j) => (next[j] = ''))
    setF(next)
  }
  const q = f.q.trim().toLowerCase()
  const students = all.filter((st) => LEVELS.every((k) => !f[k] || st[k] === f[k]) && (!q || st.name.toLowerCase().includes(q)))
  const active = LEVELS.some((k) => f[k]) || q
  const ui = (
    <div className="card filters">
      {myClasses.length > 0 && (
        <div className="row wrap">
          <span className="muted">My classes:</span>
          {myClasses.map((c, i) => (
            <button key={i} className="ghost small" onClick={() => setF({ ...EMPTY, ...c })}>
              {c.branch} · {c.batch} · Sec {c.section}
            </button>
          ))}
        </div>
      )}
      <div className="row wrap">
        {LEVELS.map((k) => (
          <select key={k} value={f[k]} onChange={(e) => change(k, e.target.value)}>
            <option value="">{ALL[k]}</option>
            {options(k).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        <input placeholder="Search by name" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        {active && <button className="ghost small" onClick={() => setF(EMPTY)}>Clear</button>}
      </div>
      <p className="muted">Showing {students.length} of {all.length} students</p>
    </div>
  )
  return { students, ui }
}
