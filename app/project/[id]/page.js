'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase, OWNERS, OWNER_COLOR, STATUS } from '../../../lib/supabaseClient'
import { PEOPLE, isMaster, canEditTask, roleOf } from '../../../lib/roles'
import { useCurrentUser } from '../../../lib/useCurrentUser'

function ownInit(o) { return o && o.includes('+') ? o.split('+').map(x => x[0]).join('') : (o || '?').slice(0, 2) }
function attIcon(a) {
  if (a.kind === 'link') return '🔗'
  const n = (a.name || '').toLowerCase()
  if (n.endsWith('.pdf')) return '📄'
  if (/\.(png|jpe?g|gif|webp|heic)$/.test(n)) return '🖼️'
  if (/\.(docx?|pages)$/.test(n)) return '📝'
  if (/\.(xlsx?|csv|numbers)$/.test(n)) return '📊'
  if (/\.(pptx?|key)$/.test(n)) return '📈'
  return '📎'
}

const ACTIVATIONS = ['All events', 'Luncheon', 'Bird circles', '858 House', 'GRIP']

export default function ProjectBoard() {
  const { id } = useParams()
  const [user, setUser] = useCurrentUser()
  const master = isMaster(user)

  const [project, setProject] = useState(null)
  const [workstreams, setWorkstreams] = useState([])
  const [tasks, setTasks] = useState([])
  const [comments, setComments] = useState([])
  const [attachments, setAttachments] = useState([])
  const [library, setLibrary] = useState(new Set())
  const [chs, setChs] = useState([])
  const [chSel, setChSel] = useState('')
  const [open, setOpen] = useState({})
  const [openThread, setOpenThread] = useState({})
  const [draft, setDraft] = useState({})
  const [link, setLink] = useState({})         // taskId -> {name, url}
  const [adding, setAdding] = useState({})
  const [newWs, setNewWs] = useState('')
  const [showNewWs, setShowNewWs] = useState(false)
  const [extendPrompt, setExtendPrompt] = useState('')
  const [extending, setExtending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    const [p, ws, ts, cm, at, lt] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('workstreams').select('*').eq('project_id', id).order('sort_order'),
      supabase.from('tasks').select('*').eq('project_id', id).order('sort_order'),
      supabase.from('comments').select('*').eq('project_id', id).order('created_at'),
      supabase.from('attachments').select('*').eq('project_id', id).order('created_at'),
      supabase.from('library_tasks').select('workstream,title')
    ])
    if (p.error) setErr(p.error.message)
    setProject(p.data || null)
    setWorkstreams(ws.data || [])
    setTasks(ts.data || [])
    setComments(cm.data || [])
    setAttachments(at.data || [])
    setLibrary(new Set((lt.data || []).map(r => r.workstream + '||' + r.title)))
    setOpen(prev => { const n = { ...prev }; (ws.data || []).forEach((w, i) => { if (!(w.id in n)) n[w.id] = i < 5 }); return n })
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (master) fetch('/api/slack/channels').then(r => r.json()).then(j => setChs(j.channels || [])).catch(() => {}) }, [master])
  useEffect(() => {
    const ch = supabase.channel('proj-' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workstreams' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attachments' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'library_tasks' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id, load])

  async function setStatus(t, status) {
    if (!canEditTask(user, t)) return
    setTasks(ts => ts.map(x => x.id === t.id ? { ...x, status } : x))
    await supabase.from('tasks').update({ status }).eq('id', t.id)
    if (status === 'review') { try { await fetch('/api/slack/notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ taskId: t.id }) }) } catch (e) {} }
  }
  async function setDue(t, due_date) { if (!canEditTask(user, t)) return; setTasks(ts => ts.map(x => x.id === t.id ? { ...x, due_date } : x)); await supabase.from('tasks').update({ due_date: due_date || null }).eq('id', t.id) }
  async function addTask(wsId) {
    if (!master) return
    const a = adding[wsId] || {}; const title = (a.title || '').trim(); if (!title) return
    const { error } = await supabase.from('tasks').insert({ project_id: id, workstream_id: wsId, title, owner: a.owner || 'Christina', applies_to: a.act || 'All events', status: 'todo', sort_order: tasks.length + 1 })
    if (error) { setErr('Add task failed: ' + error.message); return }
    setAdding(s => ({ ...s, [wsId]: { title: '', owner: a.owner || 'Christina', act: a.act || 'All events' } })); load()
  }
  async function addWorkstream() {
    if (!master) return
    const name = newWs.trim(); if (!name) return
    await supabase.from('workstreams').insert({ project_id: id, name, timing: 'custom', sort_order: workstreams.length })
    setNewWs(''); setShowNewWs(false); load()
  }
  async function extendPlan() {
    if (!master || !extendPrompt.trim()) return
    setExtending(true); setErr(null)
    try {
      const r = await fetch('/api/extend', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: id, prompt: extendPrompt }) })
      const j = await r.json()
      if (!r.ok) setErr(j.error || 'Could not add to plan')
      else setExtendPrompt('')
      load()
    } catch (e) { setErr(String(e)) }
    setExtending(false)
  }
  async function addComment(taskId) {
    const body = (draft[taskId] || '').trim(); if (!body) return
    await supabase.from('comments').insert({ project_id: id, task_id: taskId, author: user, body, source: 'app' })
    setDraft(d => ({ ...d, [taskId]: '' })); load()
  }
  async function addLink(taskId) {
    const l = link[taskId] || {}; const url = (l.url || '').trim(); if (!url) return
    await supabase.from('attachments').insert({ project_id: id, task_id: taskId, kind: 'link', name: (l.name || '').trim() || url, url, added_by: user })
    setLink(s => ({ ...s, [taskId]: { name: '', url: '' } })); load()
  }
  async function uploadFile(taskId, file) {
    if (!file) return
    const path = `${id}/${taskId}/${Date.now()}-${file.name}`
    const up = await supabase.storage.from('attachments').upload(path, file)
    if (up.error) { setErr('Upload failed: ' + up.error.message + ' (did you create a public "attachments" Storage bucket?)'); return }
    const { data: pub } = supabase.storage.from('attachments').getPublicUrl(path)
    await supabase.from('attachments').insert({ project_id: id, task_id: taskId, kind: 'file', name: file.name, url: pub.publicUrl, added_by: user })
    load()
  }

  async function setActivation(t, applies_to) {
    if (!canEditTask(user, t)) return
    setTasks(ts => ts.map(x => x.id === t.id ? { ...x, applies_to } : x))
    const { error } = await supabase.from('tasks').update({ applies_to }).eq('id', t.id)
    if (error) setErr('Update failed: ' + error.message)
  }
  async function moveTask(t, workstream_id) {
    if (!canEditTask(user, t)) return
    setTasks(ts => ts.map(x => x.id === t.id ? { ...x, workstream_id } : x))
    const { error } = await supabase.from('tasks').update({ workstream_id }).eq('id', t.id)
    if (error) { setErr('Move failed: ' + error.message) } else { load() }
  }
  function inLibrary(wsName, t) { return library.has(wsName + '||' + t.title) }
  async function saveTaskToLibrary(wsName, t) {
    const { error } = await supabase.from('library_tasks').upsert({ workstream: wsName, title: t.title, owner: t.owner, applies_to: t.applies_to, notes: t.notes }, { onConflict: 'workstream,title' })
    if (error) { setErr('Save to library failed: ' + error.message); return }
    setErr(null); setMsg('\u2605 \u201c' + t.title + '\u201d saved to the library.'); setTimeout(() => setMsg(null), 3000)
    load()
  }
  async function removeFromLibrary(wsName, t) {
    const { error } = await supabase.from('library_tasks').delete().eq('workstream', wsName).eq('title', t.title)
    if (error) { setErr('Remove failed: ' + error.message); return }
    load()
  }
  async function saveWorkstreamToLibrary(w) {
    // de-duplicate by title so the batch never updates the same (workstream,title) row twice
    const seen = new Set()
    const rows = tasks.filter(t => t.workstream_id === w.id)
      .map(t => ({ workstream: w.name, title: t.title, owner: t.owner, applies_to: t.applies_to, notes: t.notes }))
      .filter(r => { const k = (r.title || '').trim().toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true })
    if (!rows.length) { setMsg('No tasks to save in this workstream.'); setTimeout(() => setMsg(null), 3000); return }
    const { error } = await supabase.from('library_tasks').upsert(rows, { onConflict: 'workstream,title' })
    if (error) { setErr('Save workstream failed: ' + error.message); return }
    setErr(null)
    setMsg('\u2605 Saved ' + rows.length + ' task' + (rows.length !== 1 ? 's' : '') + ' from \u201c' + w.name + '\u201d to the library.')
    setTimeout(() => setMsg(null), 4000)
    load()
  }

  async function connectRoom() {
    if (!chSel) return
    const c = chs.find(x => x.id === chSel)
    await fetch('/api/slack/link-channel', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: id, channelId: chSel, channelName: c ? c.name : null }) })
    load()
  }

  if (loading) return <div className="wrap"><div className="loading sans">Loading project…</div></div>

  const byWs = wsId => tasks.filter(t => t.workstream_id === wsId)
  const cmtsFor = tid => comments.filter(c => c.task_id === tid)
  const attsFor = tid => attachments.filter(a => a.task_id === tid)
  const done = tasks.filter(t => t.status === 'done').length

  return (
    <div className="wrap">
      <div className="crumb sans"><Link href="/">← All projects</Link></div>
      <div className="topbar">
        <div>
          <h1>{project ? project.name : 'Project'}</h1>
          <div className="sub sans">{done}/{tasks.length} tasks complete · {workstreams.length} workstreams</div>
        </div>
        <div className="chips sans">
          <div className="chip"><span className="dot"></span> Live · synced</div>
          <Link className="chip" href={`/project/${id}/seating`}>🪑 Seating →</Link>
          <label className="chip" style={{ gap: 6 }}>Acting as
            <select value={user} onChange={e => setUser(e.target.value)} style={{ border: 'none', background: 'transparent', fontFamily: 'inherit', fontWeight: 700, color: 'var(--ink)', cursor: 'pointer' }}>
              {PEOPLE.map(p => <option key={p.name} value={p.name}>{p.name} ({p.role})</option>)}
            </select>
          </label>
        </div>
      </div>

      {err && <div className="banner sans">{err}</div>}
      {msg && <div className="banner sans" style={{ background: '#E1F5EE', borderColor: '#5DCAA5', color: '#0F6E56' }}>{msg}</div>}
      {project && project.slack_channel_id ? (
        <div className="card sans" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="subh" style={{ margin: 0 }}>Slack room</span>
          <a className="chip" href={`https://slack.com/app_redirect?channel=${project.slack_channel_id}`} target="_blank" rel="noreferrer">💬 #{project.slack_channel_name || 'channel'}</a>
          <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>task pings post here</span>
          {master && chs.length > 0 && (
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <select value={chSel} onChange={e => setChSel(e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 7, padding: '5px 8px', fontFamily: 'inherit', fontSize: 12 }}>
                <option value="">Change room…</option>
                {chs.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
              </select>
              <button className="btn tiny" onClick={connectRoom}>Connect</button>
            </span>
          )}
        </div>
      ) : master && (
        <div className="card sans" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="subh" style={{ margin: 0 }}>Connect this event to its Slack room</span>
          {chs.length > 0 ? (
            <>
              <select value={chSel} onChange={e => setChSel(e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 7, padding: '6px 9px', fontFamily: 'inherit', fontSize: 12.5, minWidth: 200 }}>
                <option value="">Choose an existing channel…</option>
                {chs.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
              </select>
              <button className="btn sm" onClick={connectRoom} disabled={!chSel}>Connect room</button>
            </>
          ) : <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>No Slack channels found (configure the Slack app, or add the bot to your rooms).</span>}
        </div>
      )}
      {!master && <div className="banner sans" style={{ background: '#eef0fe', borderColor: '#AFA9EC', color: '#3C3489' }}>
        You have <b>{roleOf(user)}</b> access: view all, comment &amp; attach on any task, edit only your own. Switch &ldquo;Acting as&rdquo; to compare.
      </div>}

      {/* ITERATIVE: add an activation or tasks by telling Claude */}
      {master && (
        <div className="card sans">
          <div className="subh">✨ Add to this plan with Claude</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input value={extendPrompt} onChange={e => setExtendPrompt(e.target.value)}
              placeholder='e.g. "Add a GRIP Meetings activation" or "Add a sponsor coordination workstream"'
              onKeyDown={e => { if (e.key === 'Enter') extendPlan() }}
              style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '9px 12px', fontFamily: 'inherit', fontSize: 13, minWidth: 260 }} />
            <button className="btn" onClick={extendPlan} disabled={extending}>{extending ? 'Adding…' : 'Add'}</button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 7 }}>Claude pulls the right tasks from your library and appends them — or use &ldquo;+ Add task&rdquo; for one-offs.</div>
        </div>
      )}

      {workstreams.map(w => {
        const list = byWs(w.id); const a = adding[w.id] || {}
        return (
          <div className="phase" key={w.id}>
            <div className="ph-head" onClick={() => setOpen(o => ({ ...o, [w.id]: !o[w.id] }))}>
              <span className="timing sans">{w.timing || ''}</span>
              <span className="ttl">{w.name}</span>
              <span className="cnt sans">{list.length} task{list.length !== 1 ? 's' : ''}</span>
              <span className="sans" style={{ fontSize: 11, color: 'var(--faint)' }}>{open[w.id] ? '▾' : '▸'}</span>
            </div>
            {open[w.id] && (
              <div className="ph-body">
                {list.map(t => {
                  const editable = canEditTask(user, t)
                  const cs = cmtsFor(t.id); const ats = attsFor(t.id)
                  const l = link[t.id] || {}
                  return (
                    <div key={t.id}>
                      <div className="trow">
                        <div className="tname">
                          <span className="nt">{t.title}</span>
                          <div className="acts">{(t.applies_to || '').split(' / ').filter(Boolean).map(x => <span className="pill" key={x}>{x}</span>)}</div>
                          <button className="cmtbtn" onClick={() => setOpenThread(o => ({ ...o, [t.id]: !o[t.id] }))}>💬 {cs.length} · 📎 {ats.length}</button>
                        </div>
                        <div className="owner"><span className="av" style={{ width: 20, height: 20, fontSize: 9, background: OWNER_COLOR[t.owner] || '#888' }}>{ownInit(t.owner)}</span>{t.owner}</div>
                        <div className={`due sans ${editable ? '' : 'ro'}`}><input type="date" value={t.due_date || ''} disabled={!editable} onChange={e => setDue(t, e.target.value)} /></div>
                        <div className={editable ? '' : 'ro'}>
                          <select className={`st sans ${t.status}`} value={t.status} disabled={!editable} onChange={e => setStatus(t, e.target.value)}>
                            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </div>
                      </div>
                      {openThread[t.id] && (
                        <div className="thread sans">
                          {editable && (
                            <div className="librow">
                              <span style={{ fontSize: 11, color: 'var(--faint)' }}>Applies to</span>
                              <select value={ACTIVATIONS.includes(t.applies_to) ? t.applies_to : ''} onChange={e => setActivation(t, e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 7, padding: '4px 7px', fontFamily: 'inherit', fontSize: 12 }}>
                                {!ACTIVATIONS.includes(t.applies_to) && <option value="">{t.applies_to || '\u2014'}</option>}
                                {ACTIVATIONS.map(x => <option key={x} value={x}>{x}</option>)}
                              </select>
                              <span style={{ fontSize: 11, color: 'var(--faint)', marginLeft: 6 }}>Workstream</span>
                              <select value={t.workstream_id || ''} onChange={e => moveTask(t, e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 7, padding: '4px 7px', fontFamily: 'inherit', fontSize: 12 }}>
                                {workstreams.map(w2 => <option key={w2.id} value={w2.id}>{w2.name}</option>)}
                              </select>
                            </div>
                          )}
                          {master && (
                            <div className="librow">
                              {inLibrary(w.name, t)
                                ? <><span className="libon">★ In library — default for &ldquo;{w.name}&rdquo;</span><button className="libbtn" onClick={() => removeFromLibrary(w.name, t)}>Make one-off</button></>
                                : <><button className="libbtn" onClick={() => saveTaskToLibrary(w.name, t)}>☆ Save to library forever</button><span style={{ fontSize: 10.5, color: 'var(--faint)' }}>one-off for this event by default</span></>}
                            </div>
                          )}
                          <div className="subh">Attachments &amp; links</div>
                          {ats.length > 0 && (
                            <div className="atts">
                              {ats.map(at => <a key={at.id} className="att" href={at.url} target="_blank" rel="noreferrer"><span className="ic">{attIcon(at)}</span>{at.name}</a>)}
                            </div>
                          )}
                          <div className="attbar">
                            <label className="filelbl">📎 Upload file
                              <input type="file" style={{ display: 'none' }} onChange={e => uploadFile(t.id, e.target.files[0])} />
                            </label>
                            <input type="text" placeholder="Label (e.g. Dossier)" value={l.name || ''} onChange={e => setLink(s => ({ ...s, [t.id]: { ...l, name: e.target.value } }))} />
                            <input type="text" placeholder="Paste a link…" value={l.url || ''} onChange={e => setLink(s => ({ ...s, [t.id]: { ...l, url: e.target.value } }))} onKeyDown={e => { if (e.key === 'Enter') addLink(t.id) }} />
                            <button className="btn sm" onClick={() => addLink(t.id)}>Add link</button>
                          </div>

                          <div className="subh" style={{ marginTop: 12 }}>Comments</div>
                          {cs.length === 0 && <div style={{ color: 'var(--faint)', fontSize: 12, marginBottom: 6 }}>No comments yet.</div>}
                          {cs.map(c => (
                            <div className="cmt" key={c.id}>
                              <span className="ca">{c.author}</span>
                              {c.source === 'slack' && <span className="src">via Slack</span>}
                              <span className="tm">{new Date(c.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                              <div>{c.body}</div>
                            </div>
                          ))}
                          <div className="cmtform">
                            <input placeholder={`Comment as ${user}…`} value={draft[t.id] || ''} onChange={e => setDraft(d => ({ ...d, [t.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addComment(t.id) }} />
                            <button className="btn sm" onClick={() => addComment(t.id)}>Comment</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                {master && (
                  <div className="addrow sans">
                    <input placeholder="New task…" value={a.title || ''} onChange={e => setAdding(s => ({ ...s, [w.id]: { ...a, title: e.target.value } }))} onKeyDown={e => { if (e.key === 'Enter') addTask(w.id) }} />
                    <select value={a.owner || 'Christina'} onChange={e => setAdding(s => ({ ...s, [w.id]: { ...a, owner: e.target.value } }))}>
                      {OWNERS.map(o => <option key={o}>{o}</option>)}
                    </select>
                    <select value={a.act || 'All events'} onChange={e => setAdding(s => ({ ...s, [w.id]: { ...a, act: e.target.value } }))}>
                      {ACTIVATIONS.map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                    <button className="btn sm" onClick={() => addTask(w.id)}>+ Add task</button>
                    {(() => { const allIn = list.length > 0 && list.every(t => inLibrary(w.name, t)); return <button className="btn tiny" onClick={() => saveWorkstreamToLibrary(w)} style={allIn ? { background: '#E1F5EE', color: '#0F6E56', borderColor: '#bfe6c9' } : {}}>{allIn ? '★ Workstream in library' : '★ Save workstream to library'}</button> })()}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {master && (
        <div className="card sans" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {!showNewWs ? (
            <>
              <button className="btn ghost sm" onClick={() => setShowNewWs(true)}>+ Add workstream</button>
              <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>Spin up a new workstream and add tasks on the fly.</span>
            </>
          ) : (
            <>
              <input value={newWs} onChange={e => setNewWs(e.target.value)} placeholder="Workstream name…" onKeyDown={e => { if (e.key === 'Enter') addWorkstream() }}
                style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 11px', fontFamily: 'inherit', fontSize: 13, minWidth: 220 }} />
              <button className="btn sm" onClick={addWorkstream}>Add</button>
              <button className="btn tiny" onClick={() => setShowNewWs(false)}>Cancel</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
