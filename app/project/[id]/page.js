'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase, OWNERS, OWNER_COLOR, STATUS, BASE_ACTIVATIONS, parseActs, joinActs } from '../../../lib/supabaseClient'
import { PEOPLE, isMaster, canEditTask, roleOf } from '../../../lib/roles'
import { useCurrentUser } from '../../../lib/useCurrentUser'
import { ActivationChips } from '../../../lib/ActivationChips'

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
  const [actOpts, setActOpts] = useState(BASE_ACTIVATIONS)
  const [chs, setChs] = useState([])
  const [chSel, setChSel] = useState('')
  const [open, setOpen] = useState({})
  const [openThread, setOpenThread] = useState({})
  const [draft, setDraft] = useState({})
  const [link, setLink] = useState({})
  const [na, setNa] = useState({ title: '', wsId: '', owner: 'Christina', acts: [], toLib: false })
  const [newWs, setNewWs] = useState('')
  const [showNewWs, setShowNewWs] = useState(false)
  const [extendPrompt, setExtendPrompt] = useState('')
  const [extending, setExtending] = useState(false)
  const [reportPrompt, setReportPrompt] = useState('')
  const [reportBusy, setReportBusy] = useState(false)
  const [reportHtml, setReportHtml] = useState('')
  const [filterOwner, setFilterOwner] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterAct, setFilterAct] = useState('')
  const [sortBy, setSortBy] = useState('')
  const [evLink, setEvLink] = useState({ name: '', url: '' })
  const [headerPanel, setHeaderPanel] = useState(null)
  const [slackOpen, setSlackOpen] = useState(false)
  const [chId, setChId] = useState('')
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
      supabase.from('library_tasks').select('workstream,title,applies_to')
    ])
    if (p.error) setErr(p.error.message)
    setProject(p.data || null)
    setWorkstreams(ws.data || [])
    setTasks(ts.data || [])
    setComments(cm.data || [])
    setAttachments(at.data || [])
    setLibrary(new Set((lt.data || []).map(r => r.workstream + '||' + r.title)))
    const found = new Set(BASE_ACTIVATIONS)
    ;(lt.data || []).forEach(r => parseActs(r.applies_to).forEach(a => { if (a !== 'All events') found.add(a) }))
    ;(ts.data || []).forEach(r => parseActs(r.applies_to).forEach(a => { if (a !== 'All events') found.add(a) }))
    setActOpts([...found])
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
    if (status === 'done') { try { await fetch('/api/slack/complete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ taskId: t.id, by: user }) }) } catch (e) {} }
  }
  async function setDue(t, due_date) { if (!canEditTask(user, t)) return; setTasks(ts => ts.map(x => x.id === t.id ? { ...x, due_date } : x)); await supabase.from('tasks').update({ due_date: due_date || null }).eq('id', t.id) }
  async function setActivation(t, acts) {
    if (!canEditTask(user, t)) return
    const applies_to = acts.length ? joinActs(acts) : 'All events'
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
  async function setOwner(t, owner) {
    if (!canEditTask(user, t)) return
    setTasks(ts => ts.map(x => x.id === t.id ? { ...x, owner } : x))
    const { error } = await supabase.from('tasks').update({ owner }).eq('id', t.id)   // event only; library untouched
    if (error) setErr('Update failed: ' + error.message)
  }
  async function addTaskGlobal() {
    if (!master) return
    const title = (na.title || '').trim(); if (!title) return
    const wsId = na.wsId || (workstreams[0] && workstreams[0].id)
    if (!wsId) { setErr('Create a workstream first.'); return }
    const wsName = (workstreams.find(w => w.id === wsId) || {}).name
    const applies_to = na.acts.length ? joinActs(na.acts) : 'All events'
    const { error } = await supabase.from('tasks').insert({ project_id: id, workstream_id: wsId, title, owner: na.owner, applies_to, status: 'todo', sort_order: tasks.length + 1 })
    if (error) { setErr('Add task failed: ' + error.message); return }
    if (na.toLib) {
      const { error: e2 } = await supabase.from('library_tasks').upsert({ workstream: wsName, title, owner: na.owner, applies_to, notes: '' }, { onConflict: 'workstream,title' })
      if (e2) { setErr('Task added, but library save failed: ' + e2.message); load(); return }
    }
    setErr(null)
    setMsg('Added “' + title + '” to “' + wsName + '”' + (na.toLib ? ' ★ and saved to the library.' : '.'))
    setTimeout(() => setMsg(null), 3500)
    setNa(n => ({ ...n, title: '', acts: [], toLib: false }))   // reset title, activations, library toggle each add
    load()
  }
  async function addWorkstream() {
    if (!master) return
    const name = newWs.trim(); if (!name) return
    const { data: w, error } = await supabase.from('workstreams').insert({ project_id: id, name, timing: 'custom', sort_order: workstreams.length }).select().single()
    if (error) { setErr('Add workstream failed: ' + error.message); return }
    setErr(null); setMsg('Added workstream “' + name + '” (at the bottom).'); setTimeout(() => setMsg(null), 3500)
    if (w) setOpen(o => ({ ...o, [w.id]: true }))
    setNewWs(''); setShowNewWs(false); load()
  }
  async function extendPlan() {
    if (!master || !extendPrompt.trim()) return
    setExtending(true); setErr(null)
    try {
      const r = await fetch('/api/extend', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: id, prompt: extendPrompt }) })
      const j = await r.json()
      if (!r.ok) setErr(j.error || 'Could not add to plan'); else setExtendPrompt('')
      load()
    } catch (e) { setErr(String(e)) }
    setExtending(false)
  }

  async function generateReport(p) {
    const text = (typeof p === 'string' ? p : reportPrompt).trim()
    if (!text) return
    setReportBusy(true); setErr(null); setReportHtml('')
    try {
      const r = await fetch('/api/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: id, prompt: text }) })
      const j = await r.json()
      if (!r.ok) setErr(j.error || 'Could not build the view'); else setReportHtml(j.html || '')
    } catch (e) { setErr(String(e)) }
    setReportBusy(false)
  }
  function downloadReport() {
    const blob = new Blob([reportHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = ((project && project.name) || 'report') + '.html'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }
  function openReport() { const w = window.open(); if (w) { w.document.write(reportHtml); w.document.close() } }
  async function addEventLink() {
    const url = (evLink.url || '').trim(); if (!url) return
    await supabase.from('attachments').insert({ project_id: id, task_id: null, kind: 'link', name: (evLink.name || '').trim() || url, url, added_by: user })
    setEvLink({ name: '', url: '' }); load()
  }
  async function removeEventLink(aId) { await supabase.from('attachments').delete().eq('id', aId); load() }
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
  function inLibrary(wsName, t) { return library.has(wsName + '||' + t.title) }
  async function saveTaskToLibrary(wsName, t) {
    const { error } = await supabase.from('library_tasks').upsert({ workstream: wsName, title: t.title, owner: t.owner, applies_to: t.applies_to, notes: t.notes }, { onConflict: 'workstream,title' })
    if (error) { setErr('Save to library failed: ' + error.message); return }
    setErr(null); setMsg('★ “' + t.title + '” saved to the library.'); setTimeout(() => setMsg(null), 3000)
    load()
  }
  async function removeFromLibrary(wsName, t) {
    const { error } = await supabase.from('library_tasks').delete().eq('workstream', wsName).eq('title', t.title)
    if (error) { setErr('Remove failed: ' + error.message); return }
    setErr(null); setMsg('Removed “' + t.title + '” from the library (still on this event).'); setTimeout(() => setMsg(null), 3000)
    load()
  }
  async function deleteTask(t) {
    if (!canEditTask(user, t)) return
    if (typeof window !== 'undefined' && !window.confirm('Delete “' + t.title + '” from this plan? This cannot be undone.')) return
    const { error } = await supabase.from('tasks').delete().eq('id', t.id)
    if (error) { setErr('Delete failed: ' + error.message); return }
    setErr(null); setMsg('Deleted “' + t.title + '” from the plan.'); setTimeout(() => setMsg(null), 3000)
    load()
  }
  async function setEventActivations(acts) {
    setProject(p => ({ ...p, activations: acts.join(' / ') }))
    const { error } = await supabase.from('projects').update({ activations: acts.join(' / ') }).eq('id', id)
    if (error) setErr('Update activations failed: ' + error.message)
  }
  async function connectRoom() {
    if (!chSel) return
    const c = chs.find(x => x.id === chSel)
    const r = await fetch('/api/slack/link-channel', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: id, channelId: chSel, channelName: c ? c.name : null }) })
    const j = await r.json(); if (!r.ok) { setErr(j.error || 'Connect failed'); return }
    setSlackOpen(false); setChSel(''); load()
  }
  async function connectById() {
    const cid = chId.trim(); if (!cid) return
    const r = await fetch('/api/slack/link-channel', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: id, channelId: cid, channelName: null }) })
    const j = await r.json(); if (!r.ok) { setErr(j.error || 'Connect failed'); return }
    setSlackOpen(false); setChId(''); load()
  }

  if (loading) return <div className="wrap"><div className="loading sans">Loading project…</div></div>

  const byWs = wsId => {
    let list = tasks.filter(t => t.workstream_id === wsId)
    if (filterOwner) list = list.filter(t => (t.owner || '').includes(filterOwner))
    if (filterStatus) list = list.filter(t => t.status === filterStatus)
    if (filterAct) list = list.filter(t => parseActs(t.applies_to).includes(filterAct))
    if (sortBy === 'due') list = [...list].sort((a, b) => (a.due_date || '9999-12-31').localeCompare(b.due_date || '9999-12-31'))
    return list
  }
  const filtering = !!(filterOwner || filterStatus || filterAct)
  const cmtsFor = tid => comments.filter(c => c.task_id === tid)
  const attsFor = tid => attachments.filter(a => a.task_id === tid)
  const eventLinks = attachments.filter(a => !a.task_id)
  const done = tasks.filter(t => t.status === 'done').length

  return (
    <div className="wrap">
      <div className="crumb sans" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><img src="/logo.svg" alt="858" style={{ height: 18 }} /><Link href="/">← All events</Link></div>
      <div className="topbar">
        <div>
          <h1>{project ? project.name : 'Project'}</h1>
          {project && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '7px 0 5px' }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>Activations</span>
              {master
                ? <ActivationChips value={parseActs(project.activations)} options={actOpts} onChange={setEventActivations} includeAllEvents={false} collapsible={true} />
                : (parseActs(project.activations).length ? parseActs(project.activations).map(a => <span className="pill" key={a}>{a}</span>) : <span style={{ fontSize: 11, color: 'var(--faint)' }}>none</span>)}
            </div>
          )}
          {project && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '0 0 6px' }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>Slack</span>
              {project.slack_channel_id && !slackOpen && (
                <>
                  <a className="pill" href={`https://slack.com/app_redirect?channel=${project.slack_channel_id}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>💬 #{project.slack_channel_name || 'channel'}</a>
                  {master && <button type="button" onClick={() => setSlackOpen(true)} style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', border: '1px dashed var(--line)', background: '#fff', color: 'var(--accent)' }}>change</button>}
                </>
              )}
              {master && (slackOpen || !project.slack_channel_id) && (
                <>
                  {chs.length > 0 && (
                    <>
                      <select value={chSel} onChange={e => setChSel(e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 7, padding: '4px 8px', fontFamily: 'inherit', fontSize: 12 }}>
                        <option value="">Choose a channel…</option>
                        {chs.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                      </select>
                      <button type="button" className="btn tiny" onClick={connectRoom} disabled={!chSel}>Connect</button>
                      <span style={{ fontSize: 11, color: 'var(--faint)' }}>or</span>
                    </>
                  )}
                  <input value={chId} onChange={e => setChId(e.target.value)} placeholder="paste channel ID (C…)" style={{ border: '1px solid var(--line)', borderRadius: 7, padding: '4px 8px', fontFamily: 'inherit', fontSize: 12, width: 160 }} />
                  <button type="button" className="btn tiny" onClick={connectById} disabled={!chId.trim()}>Connect ID</button>
                  {project.slack_channel_id && <button type="button" onClick={() => setSlackOpen(false)} style={{ fontSize: 11, color: 'var(--faint)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>cancel</button>}
                </>
              )}
              {!master && !project.slack_channel_id && <span style={{ fontSize: 11, color: 'var(--faint)' }}>no room linked</span>}
            </div>
          )}
          <div className="sub sans">{done}/{tasks.length} tasks complete · {workstreams.length} workstreams</div>
        </div>
        <div className="chips sans">
          <div className="chip"><span className="dot"></span> Live · synced</div>
          <Link className="chip" href={`/project/${id}/seating`}>🪑 Seating →</Link>
          <button type="button" className="chip" onClick={() => setHeaderPanel(p => p === 'reports' ? null : 'reports')} style={{ cursor: 'pointer', fontFamily: 'inherit', borderColor: headerPanel === 'reports' ? 'var(--accent)' : undefined, color: headerPanel === 'reports' ? 'var(--accent)' : undefined, fontWeight: headerPanel === 'reports' ? 700 : undefined }}>📊 Reports</button>
          <button type="button" className="chip" onClick={() => setHeaderPanel(p => p === 'links' ? null : 'links')} style={{ cursor: 'pointer', fontFamily: 'inherit', borderColor: headerPanel === 'links' ? 'var(--accent)' : undefined, color: headerPanel === 'links' ? 'var(--accent)' : undefined, fontWeight: headerPanel === 'links' ? 700 : undefined }}>🔗 Links</button>
          <label className="chip" style={{ gap: 6 }}>Acting as
            <select value={user} onChange={e => setUser(e.target.value)} style={{ border: 'none', background: 'transparent', fontFamily: 'inherit', fontWeight: 700, color: 'var(--ink)', cursor: 'pointer' }}>
              {PEOPLE.map(p => <option key={p.name} value={p.name}>{p.name} ({p.role})</option>)}
            </select>
          </label>
        </div>
      </div>

      {err && <div className="banner sans">{err}</div>}
      {msg && <div className="banner sans" style={{ background: '#E1F5EE', borderColor: '#5DCAA5', color: '#0F6E56' }}>{msg}</div>}

      {!master && <div className="banner sans" style={{ background: '#E7F0FA', borderColor: '#9DC2E5', color: '#15263C' }}>
        You have <b>{roleOf(user)}</b> access: view all, comment &amp; attach on any task, edit only your own. Switch &ldquo;Acting as&rdquo; to compare.
      </div>}

      {headerPanel === 'reports' && (
      <div className="card sans">
        <div className="subh">📊 Reports &amp; views with Claude</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input value={reportPrompt} onChange={e => setReportPrompt(e.target.value)} placeholder={'e.g. "status dashboard", "calendar of due dates", "what is overdue"'} onKeyDown={e => { if (e.key === 'Enter') generateReport() }} style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '9px 12px', fontFamily: 'inherit', fontSize: 13, minWidth: 260 }} />
          <button className="btn ghost" onClick={() => generateReport()} disabled={reportBusy}>{reportBusy ? 'Building…' : 'Build view'}</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {['Status dashboard', 'Calendar of due dates', 'Timeline by workstream', 'What is overdue', 'This week\'s tasks', 'Workload by owner'].map(q =>
            <button key={q} className="btn ghost sm" onClick={() => { setReportPrompt(q); generateReport(q) }} style={{ fontSize: 11.5 }}>{q}</button>)}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 7 }}>Builds a visual from this event&rsquo;s live data (uses the Anthropic key). Read-only &mdash; it never changes the plan.</div>
        {reportHtml && <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button className="btn ghost sm" onClick={openReport}>Open in new tab</button>
            <button className="btn ghost sm" onClick={downloadReport}>Download .html</button>
          </div>
          <iframe title="report" sandbox="allow-same-origin" srcDoc={reportHtml} style={{ width: '100%', height: 560, border: '1px solid var(--line)', borderRadius: 8, background: '#fff' }} />
        </div>}
      </div>
      )}

      {headerPanel === 'links' && (
      <div className="card sans">
        <div className="subh">🔗 Helpful links</div>
        {eventLinks.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {eventLinks.map(a => <div key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <a href={a.url} target="_blank" rel="noreferrer" style={{ color: '#2E5AAC' }}>{a.name || a.url}</a>
            <button className="btn ghost sm" onClick={() => removeEventLink(a.id)} style={{ fontSize: 11 }}>remove</button>
          </div>)}
        </div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="Label (e.g. Brand guidelines)" value={evLink.name} onChange={e => setEvLink(s => ({ ...s, name: e.target.value }))} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontFamily: 'inherit', fontSize: 13, minWidth: 180 }} />
          <input placeholder="Paste a URL…" value={evLink.url} onChange={e => setEvLink(s => ({ ...s, url: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addEventLink() }} style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontFamily: 'inherit', fontSize: 13, minWidth: 200 }} />
          <button className="btn ghost" onClick={addEventLink}>Add link</button>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 7 }}>Event-level resources (Informa links, brand guidelines, decks). Visible to everyone on this plan.</div>
      </div>
      )}

      {master && (
        <div className="card sans">
          <div className="subh">✨ Add to this plan with Claude</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input value={extendPrompt} onChange={e => setExtendPrompt(e.target.value)} placeholder='e.g. "Add a GRIP Meetings activation"' onKeyDown={e => { if (e.key === 'Enter') extendPlan() }} style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '9px 12px', fontFamily: 'inherit', fontSize: 13, minWidth: 260 }} />
            <button className="btn ghost" onClick={extendPlan} disabled={extending}>{extending ? 'Adding…' : 'Add'}</button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 7 }}>Pulls matching tasks from your library (needs the Anthropic key). Or add one manually below.</div>
        </div>
      )}

      {/* ADD A TASK — workstream, owner, multi-select activations, and library toggle, all at once */}
      {master && (
        <div className="card sans">
          <div className="subh">+ Add a task</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <input placeholder="Task title…" value={na.title} onChange={e => setNa(n => ({ ...n, title: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addTaskGlobal() }} style={{ flex: 1, minWidth: 220, border: '1px solid var(--line)', borderRadius: 8, padding: '9px 11px', fontFamily: 'inherit', fontSize: 13 }} />
            <select value={na.wsId || (workstreams[0] && workstreams[0].id) || ''} onChange={e => setNa(n => ({ ...n, wsId: e.target.value }))} title="Workstream" style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 9px', fontFamily: 'inherit', fontSize: 12.5 }}>
              {workstreams.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select value={na.owner} onChange={e => setNa(n => ({ ...n, owner: e.target.value }))} title="Owner" style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 9px', fontFamily: 'inherit', fontSize: 12.5 }}>
              {OWNERS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 6 }}>Applies to (pick one or more, or leave blank for All events):</div>
          <ActivationChips value={na.acts} options={actOpts} onChange={acts => setNa(n => ({ ...n, acts }))} />
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, fontWeight: 600, color: na.toLib ? '#0F6E56' : 'var(--muted)' }}>
              <input type="checkbox" checked={na.toLib} onChange={e => setNa(n => ({ ...n, toLib: e.target.checked }))} /> ★ Save to library
            </label>
            <button className="btn" onClick={addTaskGlobal}>Add task</button>
            <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>Tick &ldquo;Save to library&rdquo; to make it reusable for future events; leave it for a one-off.</span>
          </div>
        </div>
      )}

      <div className="card sans" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Filter</span>
        <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '7px 9px', fontFamily: 'inherit', fontSize: 12.5 }}>
          <option value="">All owners</option>
          {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '7px 9px', fontFamily: 'inherit', fontSize: 12.5 }}>
          <option value="">Any status</option>
          <option value="todo">To do</option>
          <option value="review">Needs review</option>
          <option value="done">Done</option>
        </select>
        <select value={filterAct} onChange={e => setFilterAct(e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '7px 9px', fontFamily: 'inherit', fontSize: 12.5 }}>
          <option value="">Any activation</option>
          {actOpts.filter(a => a !== 'All events').map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '7px 9px', fontFamily: 'inherit', fontSize: 12.5 }}>
          <option value="">Default order</option>
          <option value="due">Sort by due date</option>
        </select>
        {(filtering || sortBy) && <button className="btn ghost sm" onClick={() => { setFilterOwner(''); setFilterStatus(''); setFilterAct(''); setSortBy('') }}>Clear</button>}
      </div>

      {workstreams.map(w => {
        const list = byWs(w.id)
        if (filtering && !list.length) return null
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
                          <div className="acts">{parseActs(t.applies_to).map(x => <span className="pill" key={x}>{x}</span>)}</div>
                          <button className="cmtbtn" onClick={() => setOpenThread(o => ({ ...o, [t.id]: !o[t.id] }))}>{openThread[t.id] ? '▾ Hide' : '✎ Edit'}</button>
                          <button className="cmtbtn" onClick={() => setOpenThread(o => ({ ...o, [t.id]: !o[t.id] }))} style={{ marginLeft: 12 }}>💬 Comment{cs.length ? ' (' + cs.length + ')' : ''}</button>
                          <button className="cmtbtn" onClick={() => setOpenThread(o => ({ ...o, [t.id]: !o[t.id] }))} style={{ marginLeft: 12 }}>📎 Add attachment{ats.length ? ' (' + ats.length + ')' : ''}</button>
                          {canEditTask(user, t) && <button className="cmtbtn" onClick={() => deleteTask(t)} style={{ color: 'var(--red)', marginLeft: 12 }}>🗑 Delete</button>}
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
                            <div className="librow" style={{ flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, color: 'var(--faint)' }}>Applies to</span>
                              <ActivationChips value={parseActs(t.applies_to)} options={actOpts} onChange={acts => setActivation(t, acts)} />
                            </div>
                          )}
                          {editable && (
                            <div className="librow">
                              <span style={{ fontSize: 11, color: 'var(--faint)' }}>Owner</span>
                              <select value={OWNERS.includes(t.owner) ? t.owner : ''} onChange={e => setOwner(t, e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 7, padding: '4px 7px', fontFamily: 'inherit', fontSize: 12 }}>
                                {!OWNERS.includes(t.owner) && t.owner && <option value={t.owner}>{t.owner}</option>}
                                {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                              <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>this event only — not the library</span>
                            </div>
                          )}
                          {editable && (
                            <div className="librow">
                              <span style={{ fontSize: 11, color: 'var(--faint)' }}>Workstream</span>
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
                            <label className="filelbl">📎 Upload file<input type="file" style={{ display: 'none' }} onChange={e => uploadFile(t.id, e.target.files[0])} /></label>
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
              <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>Spin up a new workstream, then add tasks to it above.</span>
            </>
          ) : (
            <>
              <input value={newWs} onChange={e => setNewWs(e.target.value)} placeholder="Workstream name…" onKeyDown={e => { if (e.key === 'Enter') addWorkstream() }} style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 11px', fontFamily: 'inherit', fontSize: 13, minWidth: 220 }} />
              <button className="btn sm" onClick={addWorkstream}>Add</button>
              <button className="btn tiny" onClick={() => setShowNewWs(false)}>Cancel</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
