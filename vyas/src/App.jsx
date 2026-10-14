import { useState } from 'react'
import { useStore, setState, resetData, SUBJECTS } from './store.js'
import { supabase, supabaseConfigured } from './supabase.js'
import { Events, Marks, Attendance, Assignments } from './pages.jsx'
import { CampusConnect } from './social.jsx'
import { Notices, Staff, Counselling, Documents, People, Assistant, Search, Bell } from './more.jsx'
import { Teachers, Feedback } from './teachers.jsx'
import { Timetable, Leave, Fees, LostFound } from './campus.jsx'
import { Users, Profile, Reports } from './admin.jsx'
import Library from './modules/src/modules/Library.jsx'
import Sports from './modules/src/modules/Sports.jsx'
import AttendanceOD from './modules/src/modules/AttendanceOD.jsx'
import './extra.css'

// [key, label, component, roles that can see it (leave out for everyone)]
const TABS = [
  ['connect', 'Campus Connect', CampusConnect],
  ['notices', 'Notices', Notices],
  ['events', 'Events', Events],
  ['marks', 'Marks', Marks],
  ['attendance', 'Attendance', Attendance],
  ['assignments', 'Assignments', Assignments],
  ['timetable', 'Timetable', Timetable],
  ['leave', 'Leave', Leave],
  ['fees', 'Fees', Fees, ['student', 'admin']],
  ['lostfound', 'Lost & Found', LostFound],
  ['counselling', 'Counselling', Counselling],
  ['documents', 'Documents', Documents],
  ['staff', 'Staff', Staff],
  ['profile', 'Profile', Profile],
  ['people', 'People', People, ['teacher', 'admin']],
  ['users', 'Users', Users, ['admin']],
  ['reports', 'Reports', Reports, ['admin']],
  ['teachers', 'Teachers', Teachers, ['admin']],
  ['feedback', 'Rate Teacher', Feedback, ['student']],
  ['assistant', 'AI Assistant', Assistant],
  ['library', 'Library', Library, ['student', 'teacher', 'admin', 'library_operator']],
  ['sports', 'Sports', Sports, ['student', 'teacher', 'admin', 'sports_coordinator']],
  ['od', 'Event OD', AttendanceOD, ['student', 'teacher', 'admin', 'sports_coordinator']],
]

export default function App() {
  const s = useStore()
  const [uid, setUid] = useState(null)
  const [tab, setTab] = useState('connect')
  const [tabHistory, setTabHistory] = useState(['connect'])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [loginRole, setLoginRole] = useState('student')
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [signupOpen, setSignupOpen] = useState(false)
  const [signupMessage, setSignupMessage] = useState('')
  const [signup, setSignup] = useState({ fullName: '', loginId: '', email: '', password: '', phone: '', college: '', department: '', branch: '', year: '', className: '', section: '' })
  const user = s.users.find((u) => u.id === uid)

  const goToTab = (nextTab) => {
    if (nextTab === tab) return
    const nextHistory = tabHistory.slice(0, historyIndex + 1)
    nextHistory.push(nextTab)
    setTabHistory(nextHistory)
    setHistoryIndex(nextHistory.length - 1)
    setTab(nextTab)
  }

  const moveHistory = (direction) => {
    const nextIndex = historyIndex + direction
    if (nextIndex < 0 || nextIndex >= tabHistory.length) return
    setHistoryIndex(nextIndex)
    setTab(tabHistory[nextIndex])
  }

  const login = async (event) => {
    event.preventDefault()
    if (supabaseConfigured) {
      setLoginBusy(true)
      setLoginError('')
      try {
        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'login', loginId, role: loginRole, password }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Sign-in failed.')
        const { error } = await supabase.auth.setSession(result.session)
        if (error) throw error
        const profile = result.profile
        const account = {
          id: profile.login_id,
          name: profile.full_name,
          role: profile.role,
          email: profile.email || '',
          phone: profile.phone || '',
          college: profile.college || '',
          dept: profile.department || '',
          designation: profile.designation || '',
          subjects: profile.subjects || [],
          branch: profile.branch || '',
          batch: profile.year || '',
          section: profile.section || '',
          rollNumber: profile.login_id,
          classes: profile.classes || [],
        }
        setState((d) => {
          const existing = d.users.find((u) => u.id === account.id)
          if (existing) Object.assign(existing, account)
          else d.users.push(account)
          if (account.role === 'student') {
            d.marks[account.id] ||= Object.fromEntries(SUBJECTS.map((subject) => [subject, 0]))
            d.attendance[account.id] ||= Object.fromEntries(SUBJECTS.map((subject) => [subject, { attended: 0, total: 0 }]))
          }
          return d
        })
        setLoginId('')
        setPassword('')
        const startTab = account.role === 'library_operator' ? 'library' : account.role === 'sports_coordinator' ? 'sports' : 'connect'
        setTab(startTab)
        setTabHistory([startTab])
        setHistoryIndex(0)
        setUid(account.id)
      } catch (error) {
        setLoginError(error.message || 'Sign-in failed.')
      } finally {
        setLoginBusy(false)
      }
      return
    }
    const account = s.users.find((u) => u.role === loginRole && u.id.toLowerCase() === loginId.trim().toLowerCase())
    if (!account) {
      setLoginError(`No ${loginRole.replace('_', ' ')} account matches that ID.`)
      return
    }
    setLoginError('')
    setLoginId('')
    const startTab = loginRole === 'library_operator' ? 'library' : loginRole === 'sports_coordinator' ? 'sports' : 'connect'
    setTab(startTab)
    setTabHistory([startTab])
    setHistoryIndex(0)
    setUid(account.id)
  }

  const logout = async () => {
    if (supabaseConfigured) await supabase.auth.signOut()
    setUid(null)
    setTabHistory(['connect'])
    setHistoryIndex(0)
  }

  const registerStudent = async (event) => {
    event.preventDefault()
    setLoginBusy(true)
    setLoginError('')
    setSignupMessage('')
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'signup_student', profile: signup }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Registration failed.')
      setSignupMessage(result.message)
      setLoginRole('student')
      setLoginId(signup.loginId)
      setPassword('')
      setSignup({ fullName: '', loginId: '', email: '', password: '', phone: '', college: '', department: '', branch: '', year: '', className: '', section: '' })
      setSignupOpen(false)
    } catch (error) {
      setLoginError(error.message || 'Registration failed.')
    } finally {
      setLoginBusy(false)
    }
  }

  if (!user) {
    return (
      <div className="login">
        <h1>Campus ERP</h1>
        <p className="muted">{supabaseConfigured ? 'Sign in with your assigned role, ID, and password.' : 'Sign in with a demo role and ID.'}</p>
        {signupMessage && <p className="good" role="status">{signupMessage}</p>}
        <form className="card" onSubmit={login}>
          <div className="row wrap">
            <select aria-label="Account type" value={loginRole} onChange={(event) => { setLoginRole(event.target.value); setLoginError('') }}>
              {['student', 'teacher', 'library_operator', 'sports_coordinator', 'admin'].filter((role) => s.users.some((u) => u.role === role)).map((role) => (
                <option key={role} value={role}>{role.replace('_', ' ')}</option>
              ))}
            </select>
            <input aria-label="Account ID" placeholder="Enter your ID" value={loginId} onChange={(event) => { setLoginId(event.target.value); setLoginError('') }} required />
            {supabaseConfigured && <input aria-label="Password" type="password" placeholder="Password" value={password} onChange={(event) => { setPassword(event.target.value); setLoginError('') }} required />}
            <button type="submit" disabled={loginBusy}>{loginBusy ? 'Signing in…' : 'Log in'}</button>
          </div>
          {loginError && <p className="warn" role="alert">{loginError}</p>}
        </form>
        {!supabaseConfigured && <>
          <p className="muted">Demo IDs: students s1–s12, teachers t1–t2, admin a1, library l1, sports sp1.</p>
          <button className="ghost" onClick={resetData}>Reset sample data</button>
        </>}
        {supabaseConfigured && loginRole === 'student' && <button className="ghost" type="button" onClick={() => { setSignupOpen(!signupOpen); setLoginError('') }}>{signupOpen ? 'Back to sign in' : 'Create student account'}</button>}
        {supabaseConfigured && signupOpen && <form className="card" onSubmit={registerStudent}>
          <h3>Student registration</h3>
          <div className="row wrap">
            {[
              ['fullName', 'Full name'], ['loginId', 'Student ID'], ['email', 'Email'], ['password', 'Password (10+ characters)'],
              ['phone', 'Phone'], ['college', 'College'], ['department', 'Department'], ['branch', 'Branch'],
              ['year', 'Year or batch'], ['className', 'Class'], ['section', 'Section'],
            ].map(([key, label]) => <input
              key={key}
              aria-label={label}
              placeholder={label}
              type={key === 'password' ? 'password' : key === 'email' ? 'email' : 'text'}
              minLength={key === 'password' ? 10 : undefined}
              value={signup[key]}
              onChange={(event) => setSignup({ ...signup, [key]: event.target.value })}
              required={['fullName', 'loginId', 'email', 'password', 'college', 'branch', 'year', 'section'].includes(key)}
            />)}
            <button disabled={loginBusy}>{loginBusy ? 'Creating account…' : 'Create account'}</button>
          </div>
        </form>}
      </div>
    )
  }

  const roleTabs = user.role === 'library_operator'
    ? ['library', 'profile']
    : user.role === 'sports_coordinator'
      ? ['sports', 'od', 'profile']
      : null
  const tabs = TABS.filter((t) => roleTabs ? roleTabs.includes(t[0]) : !t[3] || t[3].includes(user.role))
  const defaultTab = user.role === 'library_operator' ? 'library' : user.role === 'sports_coordinator' ? 'sports' : tabs[0]?.[0]
  const current = tabs.find((t) => t[0] === tab) || tabs.find((t) => t[0] === defaultTab) || tabs[0]
  const Page = current[2]
  return (
    <div className="app">
      <header>
        <b>Campus ERP</b>
        <Search user={user} go={goToTab} />
        <button className="ghost" aria-label="Back" title="Back" onClick={() => moveHistory(-1)} disabled={historyIndex === 0}>Back</button>
        <button className="ghost" aria-label="Forward" title="Forward" onClick={() => moveHistory(1)} disabled={historyIndex >= tabHistory.length - 1}>Forward</button>
        <Bell user={user} />
        <span className="muted">{user.name} · {user.role}{user.role === 'student' ? ` · ${user.branch} ${user.batch} Sec ${user.section}` : ''}</span>
        <button className="ghost" onClick={logout}>Log out</button>
      </header>
      <nav>
        {tabs.map(([k, label]) => (
          <button key={k} className={k === current[0] ? 'active' : 'ghost'} onClick={() => goToTab(k)}>{label}</button>
        ))}
      </nav>
      <main><Page user={user} /></main>
    </div>
  )
}
