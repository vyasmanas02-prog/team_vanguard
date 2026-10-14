import { useState } from 'react'
import { useStore, setState, uid } from './store.js'
import { resizeImage, timeAgo } from './util.js'

const TYPE_LABEL = { club: 'Club', channel: 'Channel', branch: 'Branch' }

export function CampusConnect({ user }) {
  const s = useStore()
  const [active, setActive] = useState(s.channels[0]?.id)
  const [form, setForm] = useState({ name: '', type: 'club', desc: '' })
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState(null)
  const [comment, setComment] = useState({})
  const [showMembers, setShowMembers] = useState(false)
  const [poll, setPoll] = useState(null) // null = no poll, otherwise an array of option texts

  const isStaff = user.role !== 'student'
  const ch = s.channels.find((c) => c.id === active)
  const isMember = ch ? ch.members.includes(user.id) : false
  const person = (id) => s.users.find((u) => u.id === id)
  const mine = s.channels.filter((c) => c.members.includes(user.id))
  const others = s.channels.filter((c) => !c.members.includes(user.id))
  const posts = s.posts.filter((p) => p.channelId === active).sort((a, b) => b.time - a.time)

  const create = () => {
    if (!form.name.trim()) return
    const id = uid()
    setState((d) => {
      d.channels.push({ id, name: form.name.trim(), type: form.type, desc: form.desc.trim(), ownerId: user.id, members: [user.id] })
      return d
    })
    setForm({ name: '', type: 'club', desc: '' })
    setActive(id)
  }
  const toggleJoin = () =>
    setState((d) => {
      const c = d.channels.find((x) => x.id === active)
      c.members = c.members.includes(user.id) ? c.members.filter((m) => m !== user.id) : [...c.members, user.id]
      return d
    })
  const post = () => {
    const opts = (poll || []).map((o) => o.trim()).filter(Boolean)
    if (poll && (!text.trim() || opts.length < 2)) return // a poll needs a question and 2 options
    if (!text.trim() && !photo) return
    setState((d) => {
      d.posts.unshift({ id: uid(), channelId: active, authorId: user.id, text: text.trim(), photo, time: Date.now(), likes: [], comments: [], ...(poll ? { poll: { options: opts.map((t) => ({ id: uid(), text: t, votes: [] })) } } : {}) })
      return d
    })
    setText('')
    setPhoto(null)
    setPoll(null)
  }
  const vote = (pid, oid) =>
    setState((d) => {
      const p = d.posts.find((x) => x.id === pid)
      p.poll.options.forEach((o) => (o.votes = o.votes.filter((v) => v !== user.id)))
      p.poll.options.find((o) => o.id === oid).votes.push(user.id)
      return d
    })
  const pickPhoto = async (e) => {
    const f = e.target.files[0]
    if (f) setPhoto(await resizeImage(f, 700))
    e.target.value = ''
  }
  const like = (pid) =>
    setState((d) => {
      const p = d.posts.find((x) => x.id === pid)
      p.likes = p.likes.includes(user.id) ? p.likes.filter((x) => x !== user.id) : [...p.likes, user.id]
      return d
    })
  const addComment = (pid) => {
    const t = (comment[pid] || '').trim()
    if (!t) return
    setState((d) => {
      d.posts.find((x) => x.id === pid).comments.push({ id: uid(), authorId: user.id, text: t, time: Date.now() })
      return d
    })
    setComment({ ...comment, [pid]: '' })
  }
  const delPost = (pid) =>
    setState((d) => {
      d.posts = d.posts.filter((p) => p.id !== pid)
      return d
    })

  const Item = ({ c }) => (
    <button className={'ch-item ' + (c.id === active ? 'on' : '')} onClick={() => setActive(c.id)}>
      <b>{c.name}</b>
      <span className="muted">{TYPE_LABEL[c.type]} · {c.members.length} members</span>
    </button>
  )

  return (
    <div>
      <h2>Campus Connect</h2>
      <div className="connect">
        <aside className="side">
          <div className="card">
            <h3>Create a club or channel</h3>
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="club">Club</option>
              <option value="channel">Channel</option>
            </select>
            <input placeholder="What is it about?" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
            <button onClick={create}>Create</button>
          </div>
          <h4>My groups</h4>
          {mine.length === 0 && <p className="muted">You have not joined any group.</p>}
          {mine.map((c) => <Item key={c.id} c={c} />)}
          <h4>Discover</h4>
          {others.length === 0 && <p className="muted">You have joined everything.</p>}
          {others.map((c) => <Item key={c.id} c={c} />)}
        </aside>

        <section>
          {!ch ? (
            <p className="muted">Pick a group on the left.</p>
          ) : (
            <>
              <div className="card">
                <div className="row wrap between">
                  <div>
                    <h3>{ch.name} <span className="tag">{TYPE_LABEL[ch.type]}</span></h3>
                    <p className="muted">{ch.desc || 'No description.'} Created by {person(ch.ownerId)?.name}.</p>
                  </div>
                  <div className="row">
                    <button className="ghost" onClick={() => setShowMembers(!showMembers)}>{ch.members.length} members</button>
                    <button className={isMember ? 'ghost' : ''} onClick={toggleJoin}>{isMember ? 'Leave' : 'Join'}</button>
                  </div>
                </div>
                {showMembers && (
                  <div className="row wrap members">
                    {ch.members.map((m) => {
                      const p = person(m)
                      return <span key={m} className="tag">{p?.name}{p?.branch ? ' · ' + p.branch : ''}{p?.role !== 'student' ? ' · ' + p?.role : ''}</span>
                    })}
                  </div>
                )}
              </div>

              {isMember ? (
                <div className="card">
                  <textarea rows="2" placeholder={'Post in ' + ch.name + '...'} value={text} onChange={(e) => setText(e.target.value)} />
                  {photo && <img className="photo" src={photo} alt="preview" />}
                  {poll && (
                    <div>
                      <p className="muted">Poll: write the question above, then the options.</p>
                      {poll.map((o, i) => <input key={i} placeholder={'Option ' + (i + 1)} value={o} onChange={(e) => setPoll(poll.map((x, j) => (j === i ? e.target.value : x)))} style={{ display: 'block', marginBottom: 6 }} />)}
                      {poll.length < 4 && <button className="ghost small" onClick={() => setPoll([...poll, ''])}>Add option</button>}
                    </div>
                  )}
                  <div className="row wrap">
                    <input type="file" accept="image/*" onChange={pickPhoto} />
                    <button className="ghost" onClick={() => setPoll(poll ? null : ['', ''])}>{poll ? 'Remove poll' : 'Add poll'}</button>
                    <button onClick={post}>Post</button>
                  </div>
                </div>
              ) : (
                <p className="muted">Join this group to post.</p>
              )}

              {posts.length === 0 && <p className="muted">No posts yet.</p>}
              {posts.map((p) => (
                <div className="card post" key={p.id}>
                  <div className="row between">
                    <b>{person(p.authorId)?.name} <span className="muted">{timeAgo(p.time)}</span></b>
                    {(p.authorId === user.id || ch.ownerId === user.id || isStaff) && <button className="ghost small" onClick={() => delPost(p.id)}>Delete</button>}
                  </div>
                  {p.text && <p>{p.text}</p>}
                  {p.photo && <img className="photo" src={p.photo} alt="post" />}
                  {p.poll && (() => {
                    const total = p.poll.options.reduce((a, o) => a + o.votes.length, 0)
                    return (
                      <div>
                        {p.poll.options.map((o) => (
                          <button key={o.id} disabled={!isMember} className={'pollopt' + (o.votes.includes(user.id) ? ' mine' : '')} onClick={() => vote(p.id, o.id)}>
                            <div className="bar" style={{ width: (total ? (o.votes.length / total) * 100 : 0) + '%' }} />
                            <span>{o.text}</span><span className="n">{o.votes.length}{total ? ' · ' + Math.round((o.votes.length / total) * 100) + '%' : ''}</span>
                          </button>
                        ))}
                        <p className="muted">{total} vote{total === 1 ? '' : 's'}{isMember ? '. Tap an option to vote or change your vote.' : '. Join the group to vote.'}</p>
                      </div>
                    )
                  })()}
                  <div className="row">
                    <button className={p.likes.includes(user.id) ? 'small' : 'ghost small'} onClick={() => like(p.id)}>Like {p.likes.length}</button>
                    <span className="muted">{p.comments.length} comments</span>
                  </div>
                  {p.comments.map((c) => (
                    <p key={c.id} className="comment"><b>{person(c.authorId)?.name}:</b> {c.text}</p>
                  ))}
                  <div className="row">
                    <input placeholder="Add a comment" value={comment[p.id] || ''} onChange={(e) => setComment({ ...comment, [p.id]: e.target.value })} />
                    <button className="ghost small" onClick={() => addComment(p.id)}>Send</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
