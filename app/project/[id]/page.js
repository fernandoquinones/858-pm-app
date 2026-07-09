'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase, OWNERS, OWNER_COLOR, STATUS, BASE_ACTIVATIONS, parseActs, joinActs } from '../../../lib/supabaseClient'
import { TaskTimeline } from '../../../lib/TaskTimeline'
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
  const [titleDraft, setTitleDraft] = useState({})
  const [cmtEdit, setCmtEdit] = useState({})
  const [link, setLink] = useState({})
  const [na, setNa] = useState({ title: '', wsId: '', owner: 'Christina', acts: [], toLib: false, due: '' })
  const [newWs, setNewWs] = useState('')
  const [showNewWs, setShowNewWs] = useState(false)
  const [extendPrompt, setExtendPrompt] = useState('')
  const [extending, setExtending] = useState(false)
  const [reportPrompt, setReportPrompt] = useState('')
  const [reportBusy, setReportBusy] = useState(false)
  const [reportHtml, setReportHtml] = useState('')
  const [fOwners, setFOwners] = useState([])
  const [fStatuses, setFStatuses] = useState([])
  const [fActs, setFActs] = useState([])
  const [dueFilter, setDueFilter] = useState('')
  const [sortBy, setSortBy] = useState('flat')
  const [evLink, setEvLink] = useState({ name: '', url: '' })
  const [headerPanel, setHeaderPanel] = useState(null)
  const [slackOpen, setSlackOpen] = useState(false)
  const [chId, setChId] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [msg, setMsg] = useState(null)
  const [sel, setSel] = useState(new Set())

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
    const { error } = await supabase.from('tasks').insert({ project_id: id, workstream_id: wsId, title, owner: na.owner, applies_to, due_date: na.due || null, status: 'todo', sort_order: tasks.length + 1 })
    if (error) { setErr('Add task failed: ' + error.message); return }
    if (na.toLib) {
      const { error: e2 } = await supabase.from('library_tasks').upsert({ workstream: wsName, title, owner: na.owner, applies_to, notes: '' }, { onConflict: 'workstream,title' })
      if (e2) { setErr('Task added, but library save failed: ' + e2.message); load(); return }
    }
    setErr(null)
    setMsg('Added “' + title + '” to “' + wsName + '”' + (na.toLib ? ' ★ and saved to the library.' : '.'))
    setTimeout(() => setMsg(null), 3500)
    setNa(n => ({ ...n, title: '', acts: [], toLib: false, due: '' }))   // reset title, activations, library toggle, due each add
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
  function exportCsv() {
    const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'
    const wsById = {}; workstreams.forEach(w => { wsById[w.id] = w })
    const ordered = [...tasks].sort((a, b) => {
      const wa = (wsById[a.workstream_id] || {}).sort_order ?? 999, wb = (wsById[b.workstream_id] || {}).sort_order ?? 999
      if (wa !== wb) return wa - wb
      return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    })
    const rows = [['Workstream', 'Timing', 'Task', 'Owner', 'Status', 'Due date', 'Activation', 'Phase']]
    ordered.forEach(t => {
      const w = wsById[t.workstream_id] || {}
      rows.push([w.name || '', w.timing || '', t.title, t.owner, STATUS[t.status] || t.status, t.due_date || '', parseActs(t.applies_to).join(' / '), phaseOf(t)])
    })
    const csv = rows.map(r => r.map(esc).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = ((project && project.name) || 'tasks').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '') + '-tasks.csv'
    a.click(); URL.revokeObjectURL(a.href)
  }
  async function addEventLink() {
    const url = (evLink.url || '').trim(); if (!url) return
    await supabase.from('attachments').insert({ project_id: id, task_id: null, kind: 'link', name: (evLink.name || '').trim() || url, url, added_by: user })
    setEvLink({ name: '', url: '' }); load()
  }
  async function removeEventLink(aId) { await supabase.from('attachments').delete().eq('id', aId); load() }
  async function addComment(taskId) {
    const body = (draft[taskId] || '').trim(); if (!body) return
    await supabase.from('comments').insert({ project_id: id, task_id: taskId, author: user, body, source: 'app' })
    // mirror into the Slack thread(s) for this task (no-op if Slack isn't configured / no message yet)
    try { await fetch('/api/slack/comment-notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ taskId, author: user, body }) }) } catch (e) {}
    setDraft(d => ({ ...d, [taskId]: '' })); load()
  }
  async function renameTask(t) {
    const v = (titleDraft[t.id] !== undefined ? titleDraft[t.id] : t.title).trim()
    if (!v || v === t.title) { setTitleDraft(s => { const n = { ...s }; delete n[t.id]; return n }); return }
    const { error } = await supabase.from('tasks').update({ title: v }).eq('id', t.id)
    if (error) { setErr('Rename failed: ' + error.message); return }
    setTitleDraft(s => { const n = { ...s }; delete n[t.id]; return n }); setMsg('Task renamed.'); setTimeout(() => setMsg(null), 2500); load()
  }
  async function deleteComment(c) {
    if (!(c.author === user || master)) return
    if (typeof window !== 'undefined' && !window.confirm('Delete this comment?')) return
    const { error } = await supabase.from('comments').delete().eq('id', c.id)
    if (error) { setErr('Delete comment failed: ' + error.message); return }
    load()
  }
  async function saveCommentEdit(c) {
    const v = (cmtEdit[c.id] || '').trim(); if (!v) return
    const { error } = await supabase.from('comments').update({ body: v }).eq('id', c.id)
    if (error) { setErr('Edit failed: ' + error.message); return }
    setCmtEdit(s => { const n = { ...s }; delete n[c.id]; return n }); load()
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
  const [undo, setUndo] = useState(null)
  const toggleSel = tid => setSel(s => { const n = new Set(s); n.has(tid) ? n.delete(tid) : n.add(tid); return n })
  async function deleteTask(t) {
    if (user !== 'Christina') return
    if (typeof window !== 'undefined' && !window.confirm('Delete “' + t.title + '”? You can undo right after.')) return
    const { error } = await supabase.from('tasks').delete().eq('id', t.id)
    if (error) { setErr('Delete failed: ' + error.message); return }
    setErr(null); setUndo({ kind: 'tasks', tasks: [t], label: '“' + t.title + '”' })
    load()
  }
  async function deleteSelected() {
    if (user !== 'Christina' || !sel.size) return
    if (typeof window !== 'undefined' && !window.confirm('Delete ' + sel.size + ' task(s)? You can undo right after.')) return
    const rows = tasks.filter(t => sel.has(t.id))
    const { error } = await supabase.from('tasks').delete().in('id', rows.map(t => t.id))
    if (error) { setErr('Bulk delete failed: ' + error.message); return }
    setSel(new Set()); setErr(null); setUndo({ kind: 'tasks', tasks: rows, label: rows.length + ' tasks' })
    load()
  }
  async function deleteWorkstream(w) {
    if (user !== 'Christina' || w.id === '__all__') return
    const wsTasks = tasks.filter(t => t.workstream_id === w.id)
    const q = wsTasks.length ? ('Remove the “' + w.name + '” workstream and its ' + wsTasks.length + ' task(s)? You can undo right after.') : ('Remove the empty “' + w.name + '” workstream? You can undo right after.')
    if (typeof window !== 'undefined' && !window.confirm(q)) return
    if (wsTasks.length) { const { error: te } = await supabase.from('tasks').delete().in('id', wsTasks.map(t => t.id)); if (te) { setErr('Delete failed: ' + te.message); return } }
    const { error } = await supabase.from('workstreams').delete().eq('id', w.id)
    if (error) { setErr('Delete failed: ' + error.message); return }
    setErr(null); setUndo({ kind: 'workstream', ws: w, tasks: wsTasks, label: '“' + w.name + '” workstream' })
    load()
  }
  async function restoreUndo() {
    if (!undo) return
    if (undo.kind === 'tasks') {
      const { error } = await supabase.from('tasks').insert(undo.tasks)
      if (error) { setErr('Undo failed: ' + error.message); return }
    } else if (undo.kind === 'workstream') {
      const { error: we } = await supabase.from('workstreams').insert(undo.ws)
      if (we) { setErr('Undo failed: ' + we.message); return }
      if (undo.tasks.length) { const { error: te } = await supabase.from('tasks').insert(undo.tasks); if (te) { setErr('Undo failed: ' + te.message); return } }
    }
    setUndo(null); setErr(null); load()
  }
  async function setEventActivations(acts) {
    const prev = parseActs(project.activations)
    const added = acts.filter(a => !prev.includes(a) && a !== 'All events')
    setProject(p => ({ ...p, activations: acts.join(' / ') }))
    const { error } = await supabase.from('projects').update({ activations: acts.join(' / ') }).eq('id', id)
    if (error) { setErr('Update activations failed: ' + error.message); return }
    for (const a of added) {
      if (typeof window !== 'undefined' && !window.confirm('Add the “' + a + '” tasks from the library to this plan?')) continue
      try {
        const r = await fetch('/api/add-activation', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: id, activation: a }) })
        const j = await r.json()
        if (j.error) { setErr('Add “' + a + '” failed: ' + j.error); continue }
        setMsg('Added ' + j.added + ' “' + a + '” task(s).'); setTimeout(() => setMsg(null), 4000)
      } catch (e) { setErr(String(e)) }
    }
    if (added.length) load()
  }
  const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''
  async function setEventDate(v) {
    setProject(p => ({ ...p, event_date: v || null }))
    const { error } = await supabase.from('projects').update({ event_date: v || null }).eq('id', id)
    if (error) setErr('Update date failed: ' + error.message)
  }
  function setLocalField(k, v) { setProject(p => ({ ...p, [k]: v })) }
  async function saveField(k) {
    const { error } = await supabase.from('projects').update({ [k]: (project && project[k]) || null }).eq('id', id)
    if (error) setErr('Update failed: ' + error.message)
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

  const phaseOf = t => {
    if (!t.due_date || !project || !project.event_date) return ''
    const end = project.event_end_date || project.event_date
    if (t.due_date < project.event_date) return 'Pre-event'
    if (t.due_date > end) return 'Post-event'
    return 'Intra-event'
  }
  async function setEventEnd(v) {
    setProject(p => ({ ...p, event_end_date: v || null }))
    const { error } = await supabase.from('projects').update({ event_end_date: v || null }).eq('id', id)
    if (error) setErr('Update end date failed: ' + error.message)
  }
  const _todayStr = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') })()
  const isOverdue = t => t.status !== 'done' && t.due_date && t.due_date < _todayStr
  const byWs = wsId => {
    let list = wsId === '__all__' ? [...tasks] : tasks.filter(t => t.workstream_id === wsId)
    if (fOwners.length) list = list.filter(t => { const os = (t.owner || '').split('+').map(x => x.trim()); return fOwners.some(o => os.includes(o)) })
    if (fStatuses.length) list = list.filter(t => fStatuses.includes(t.status))
    if (fActs.length) list = list.filter(t => { const a = parseActs(t.applies_to); return fActs.some(x => a.includes(x)) })
    if (dueFilter === 'overdue') list = list.filter(isOverdue)
    else if (dueFilter === 'upcoming') list = list.filter(t => !isOverdue(t))
    if (sortBy === 'due' || wsId === '__all__') list = [...list].sort((a, b) => (a.due_date || '9999-12-31').localeCompare(b.due_date || '9999-12-31'))
    return list
  }
  const filtering = !!(fOwners.length || fStatuses.length || fActs.length || dueFilter)
  const toggleF = (arr, set, v) => set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])
  const ownersInUse = [...new Set(tasks.flatMap(t => (t.owner || '').split('+').map(x => x.trim())).filter(Boolean))]
  const fchip = on => ({ fontSize: 13, padding: '5px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'), background: on ? 'var(--accent-soft)' : 'transparent', color: on ? 'var(--accent)' : 'var(--muted)', fontWeight: on ? 700 : 500 })
  const flabel = { fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)', width: 82, flex: 'none' }
  const evActs = parseActs(project ? project.activations : '').filter(a => a !== 'All events')
  const groups = (!master || sortBy === 'flat') ? [{ id: '__all__', name: 'All tasks \u00b7 by due date', timing: '' }] : workstreams
  const cmtsFor = tid => comments.filter(c => c.task_id === tid)
  const attsFor = tid => attachments.filter(a => a.task_id === tid)
  const eventLinks = attachments.filter(a => !a.task_id)
  const done = tasks.filter(t => t.status === 'done').length
  const openCount = tasks.length - done
  const _tMid = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })()
  const overdue = tasks.filter(t => t.status !== 'done' && t.due_date && new Date(t.due_date + 'T00:00:00') < _tMid).length

  return (
    <div className="wrap">
      <div className="crumb sans" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><img src="/logo.svg" alt="858" style={{ height: 18 }} /><Link href="/">← All events</Link></div>
      <div className="topbar" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', margin: '0 0 6px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>Date</span>
                {master
                  ? <input type="date" value={project.event_date || ''} onChange={e => setEventDate(e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 999, padding: '3px 10px', fontFamily: 'inherit', fontSize: 11.5, background: 'transparent', color: 'var(--muted)' }} />
                  : <span style={{ fontSize: 12, color: 'var(--ink)' }}>{project.event_date ? fmtDate(project.event_date) : '—'}</span>}
              </span>
              {(master || project.event_end_date) && (<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>End</span>
                {master
                  ? <input type="date" value={project.event_end_date || ''} onChange={e => setEventEnd(e.target.value)} title="End date (for multi-day events)" style={{ border: '1px solid var(--line)', borderRadius: 999, padding: '3px 10px', fontFamily: 'inherit', fontSize: 11.5, background: 'transparent', color: 'var(--muted)' }} />
                  : <span style={{ fontSize: 12, color: 'var(--ink)' }}>{project.event_end_date ? fmtDate(project.event_end_date) : '—'}</span>}
              </span>)}
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>City</span>
                {master
                  ? <input value={project.city || ''} onChange={e => setLocalField('city', e.target.value)} onBlur={() => saveField('city')} placeholder="City" style={{ width: 120, border: '1px solid var(--line)', borderRadius: 999, padding: '3px 10px', fontFamily: 'inherit', fontSize: 11.5, background: 'transparent', color: 'var(--muted)' }} />
                  : <span style={{ fontSize: 12, color: 'var(--ink)' }}>{project.city || '—'}</span>}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>State</span>
                {master
                  ? <input value={project.state || ''} onChange={e => setLocalField('state', e.target.value)} onBlur={() => saveField('state')} placeholder="State" style={{ width: 70, border: '1px solid var(--line)', borderRadius: 999, padding: '3px 10px', fontFamily: 'inherit', fontSize: 11.5, background: 'transparent', color: 'var(--muted)' }} />
                  : <span style={{ fontSize: 12, color: 'var(--ink)' }}>{project.state || '—'}</span>}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 160px', minWidth: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>Venue</span>
                {master
                  ? <input value={project.venue || ''} onChange={e => setLocalField('venue', e.target.value)} onBlur={() => saveField('venue')} placeholder="TBD" style={{ flex: 1, minWidth: 0, border: '1px solid var(--line)', borderRadius: 999, padding: '3px 10px', fontFamily: 'inherit', fontSize: 11.5, background: 'transparent', color: 'var(--muted)' }} />
                  : <span style={{ fontSize: 12, color: 'var(--ink)' }}>{project.venue || 'TBD'}</span>}
              </span>
            </div>
          )}
          {project && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', margin: '0 0 6px' }}>
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
                      <select value={chSel} onChange={e => setChSel(e.target.value)} style={{ flex: '1 1 0', minWidth: 0, border: '1px solid var(--line)', borderRadius: 999, padding: '4px 10px', fontFamily: 'inherit', fontSize: 11.5, background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}>
                        <option value="">Choose a channel…</option>
                        {chs.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                      </select>
                      <button type="button" onClick={connectRoom} disabled={!chSel} style={{ border: '1px solid var(--line)', borderRadius: 999, padding: '4px 11px', fontFamily: 'inherit', fontSize: 11.5, background: 'transparent', color: 'var(--accent)', cursor: 'pointer' }}>Connect</button>
                      <span style={{ fontSize: 11, color: 'var(--faint)' }}>or</span>
                    </>
                  )}
                  <input value={chId} onChange={e => setChId(e.target.value)} placeholder="paste channel ID (C…)" style={{ flex: '1 1 0', minWidth: 0, border: '1px solid var(--line)', borderRadius: 999, padding: '4px 10px', fontFamily: 'inherit', fontSize: 11.5, background: 'transparent', color: 'var(--muted)' }} />
                  <button type="button" onClick={connectById} disabled={!chId.trim()} style={{ border: '1px solid var(--line)', borderRadius: 999, padding: '4px 11px', fontFamily: 'inherit', fontSize: 11.5, background: 'transparent', color: 'var(--accent)', cursor: 'pointer' }}>Connect ID</button>
                  {project.slack_channel_id && <button type="button" onClick={() => setSlackOpen(false)} style={{ fontSize: 11, color: 'var(--faint)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>cancel</button>}
                </>
              )}
              {!master && !project.slack_channel_id && <span style={{ fontSize: 11, color: 'var(--faint)' }}>no room linked</span>}
            </div>
          )}
          <div className="sub sans">{done}/{tasks.length} tasks complete · {workstreams.length} workstreams</div>
        </div>
        <div className="chips sans" style={{ position: 'relative', display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0 }}>
          <div className="chip"><span className="dot"></span> Live · synced</div>
          <Link className="chip" href={`/project/${id}/seating`}>🪑 Seating →</Link>
          <button type="button" className="chip" onClick={() => setHeaderPanel(p => p === 'reports' ? null : 'reports')} style={{ cursor: 'pointer', fontFamily: 'inherit', borderColor: headerPanel === 'reports' ? 'var(--accent)' : undefined, color: headerPanel === 'reports' ? 'var(--accent)' : undefined, fontWeight: headerPanel === 'reports' ? 700 : undefined }}>📊 Reports</button>
          <button type="button" className="chip" onClick={() => setHeaderPanel(p => p === 'links' ? null : 'links')} style={{ cursor: 'pointer', fontFamily: 'inherit', borderColor: headerPanel === 'links' ? 'var(--accent)' : undefined, color: headerPanel === 'links' ? 'var(--accent)' : undefined, fontWeight: headerPanel === 'links' ? 700 : undefined }}>🔗 Links</button>
          <button type="button" className="chip" onClick={exportCsv} style={{ cursor: 'pointer', fontFamily: 'inherit' }}>⬇ Export CSV</button>
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

      {headerPanel === 'reports' && (<>
        <div className="card sans"><TaskTimeline tasks={tasks} eventDate={project ? project.event_date : ''} eventEndDate={project ? project.event_end_date : ''} eventName={project ? project.name : ''} /></div>
        <div className="card sans">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="subh" style={{ margin: 0 }}>📊 Status dashboard <span style={{ color: 'var(--faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· live</span></div>
            <button onClick={() => setHeaderPanel(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--faint)', fontSize: 18, lineHeight: 1, fontFamily: 'inherit' }}>×</button>
          </div>
        {(() => {
          const counts = {}; Object.keys(STATUS).forEach(k => counts[k] = 0)
          tasks.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1 })
          const total = tasks.length || 1
          const colors = { todo: '#8A94A3', prog: '#3A7BD5', ongoing: '#5B45A8', review: '#B25A00', done: '#0F6E56' }
          return <div style={{ display: 'grid', gap: 9, margin: '8px 0 4px' }}>
            {Object.entries(STATUS).map(([k, v]) => <div key={k}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}><span>{v}</span><span style={{ fontWeight: 700 }}>{counts[k] || 0}</span></div>
              <div style={{ height: 7, background: '#EEF0F4', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: ((counts[k] || 0) / total * 100) + '%', height: '100%', background: colors[k] }} /></div>
            </div>)}
          </div>
        })()}
        </div>
        <div className="card sans">
        <div className="subh">🗓 This week&rsquo;s tasks <span style={{ color: 'var(--faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· live</span></div>
        {(() => {
          const d = new Date(); d.setDate(d.getDate() + 6)
          const end = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
          const week = tasks.filter(t => t.status !== 'done' && t.due_date && t.due_date >= _todayStr && t.due_date <= end).sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
          if (!week.length) return <div style={{ fontSize: 12.5, color: 'var(--faint)', margin: '6px 0' }}>Nothing due in the next 7 days.</div>
          return <div style={{ margin: '6px 0 2px' }}>{week.map(t => <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: '1px solid #eef0f4', fontSize: 13 }}>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
            <span style={{ color: 'var(--muted)', flex: 'none', fontSize: 12 }}>{t.owner} · {t.due_date}</span>
          </div>)}</div>
        })()}
        </div>
        <div className="card sans">
        <div className="subh">✨ Build a custom view with Claude</div>
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
      </>)}
      {headerPanel === 'links' && (
        <div className="card sans" style={{ width: 480, maxWidth: '100%', marginLeft: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={() => setHeaderPanel(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--faint)', fontSize: 18, lineHeight: 1, fontFamily: 'inherit' }}>×</button></div>
      <div className="sans">
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
        </div>
      )}

      {master && headerPanel !== 'reports' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'stretch' }}>
          <div className="card sans" style={{ margin: 0 }}>
            <div className="subh">✨ Add to this plan with Claude</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input value={extendPrompt} onChange={e => setExtendPrompt(e.target.value)} placeholder='e.g. "Add a GRIP Meetings activation"' onKeyDown={e => { if (e.key === 'Enter') extendPlan() }} style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '9px 12px', fontFamily: 'inherit', fontSize: 13, minWidth: 260 }} />
            <button className="btn ghost" onClick={extendPlan} disabled={extending}>{extending ? 'Adding…' : 'Add'}</button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 7 }}>Pulls matching tasks from your library (needs the Anthropic key). Or add one manually below.</div>
        </div>
          <div className="card sans" style={{ margin: 0 }}>
            <div className="subh">+ Add a task</div>
          <input placeholder="Task title…" value={na.title} onChange={e => setNa(n => ({ ...n, title: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addTaskGlobal() }} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--line)', borderRadius: 8, padding: '9px 11px', fontFamily: 'inherit', fontSize: 13, marginBottom: 10 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12, alignItems: 'start' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 4 }}>Owner</div>
              <select value={na.owner} onChange={e => setNa(n => ({ ...n, owner: e.target.value }))} style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 9px', fontFamily: 'inherit', fontSize: 12.5 }}>
                {OWNERS.map(o => <option key={o}>{o}</option>)}
              </select>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)', margin: '10px 0 4px' }}>Due date</div>
              <input type="date" value={na.due || ''} onChange={e => setNa(n => ({ ...n, due: e.target.value }))} style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 8, padding: '7px 9px', fontFamily: 'inherit', fontSize: 12.5 }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 4 }}>Workstream</div>
              <select value={na.wsId || (workstreams[0] && workstreams[0].id) || ''} onChange={e => setNa(n => ({ ...n, wsId: e.target.value }))} style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 9px', fontFamily: 'inherit', fontSize: 12.5 }}>
                {workstreams.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 4 }}>Activation</div>
              <ActivationChips value={na.acts} options={actOpts} onChange={acts => setNa(n => ({ ...n, acts }))} collapsible={true} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, fontWeight: 600, color: na.toLib ? '#0F6E56' : 'var(--muted)' }}>
              <input type="checkbox" checked={na.toLib} onChange={e => setNa(n => ({ ...n, toLib: e.target.checked }))} /> ★ Save to library
            </label>
            <button className="btn" onClick={addTaskGlobal}>Add task</button>
          </div>
        </div>
        </div>
      )}

      <div style={{ margin: '10px 0 10px' }}>
        <div className="sans" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <span style={flabel}>Owners</span>
          {ownersInUse.map(o => <button key={o} style={fchip(fOwners.includes(o))} onClick={() => toggleF(fOwners, setFOwners, o)}>{o}</button>)}
        </div>
        <div className="sans" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <span style={flabel}>Status</span>
          {Object.entries(STATUS).map(([k, v]) => <button key={k} style={fchip(fStatuses.includes(k))} onClick={() => toggleF(fStatuses, setFStatuses, k)}>{v}</button>)}
        </div>
        {evActs.length > 0 && <div className="sans" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <span style={flabel}>Activation</span>
          {evActs.map(a => <button key={a} style={fchip(fActs.includes(a))} onClick={() => toggleF(fActs, setFActs, a)}>{a}</button>)}
        </div>}
        <div className="sans" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={flabel}>View</span>
          <button style={fchip(dueFilter === 'overdue')} onClick={() => setDueFilter(dueFilter === 'overdue' ? '' : 'overdue')}>⚠ Overdue</button>
          <button style={fchip(dueFilter === 'upcoming')} onClick={() => setDueFilter(dueFilter === 'upcoming' ? '' : 'upcoming')}>On track</button>
          {master && <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 999, padding: '6px 12px', fontFamily: 'inherit', fontSize: 13, background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}>
            <option value="">Grouped by workstream</option>
            <option value="due">Due date (within group)</option>
            <option value="flat">All tasks by due date</option>
          </select>}
          {(filtering || sortBy !== 'flat') && <button className="btn ghost sm" onClick={() => { setFOwners([]); setFStatuses([]); setFActs([]); setDueFilter(''); setSortBy('flat') }}>Clear</button>}
        </div>
      </div>

      <div className="tiles sans">
        <div className="tile"><div className="tnum">{tasks.length}</div><div className="tlab">Total tasks</div></div>
        <div className="tile good"><div className="tnum">{done}</div><div className="tlab">Done</div></div>
        <div className="tile accent"><div className="tnum">{openCount}</div><div className="tlab">Open</div></div>
        <div className="tile warn"><div className="tnum">{overdue}</div><div className="tlab">Overdue</div></div>
      </div>

      {undo && (
        <div className="card sans" style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#FFF8E6', borderColor: '#F0D8A8', marginBottom: 10 }}>
          <span>Deleted {undo.label}.</span>
          <button className="btn sm" onClick={restoreUndo}>↩ Undo</button>
          <button className="btn ghost sm" onClick={() => setUndo(null)}>Dismiss</button>
        </div>
      )}

      {user === 'Christina' && sel.size > 0 && (
        <div className="card sans" style={{ display: 'flex', alignItems: 'center', gap: 12, borderColor: '#f0c4c0', background: '#fdf3f2', marginBottom: 10 }}>
          <b style={{ color: '#b42318' }}>{sel.size} selected</b>
          <button className="btn sm" style={{ background: '#b42318', borderColor: '#b42318' }} onClick={deleteSelected}>🗑 Delete selected</button>
          <button className="btn ghost sm" onClick={() => setSel(new Set())}>Clear</button>
        </div>
      )}

      {groups.map(w => {
        const list = byWs(w.id)
        if (filtering && !list.length) return null
        const isOpen = w.id === '__all__' ? open[w.id] !== false : !!open[w.id]
        return (
          <div className="phase" key={w.id}>
            <div className="ph-head" onClick={() => setOpen(o => ({ ...o, [w.id]: !o[w.id] }))}>
              <span className="timing sans">{w.timing || ''}</span>
              <span className="ttl">{w.name}</span>
              <span className="cnt sans">{list.length} task{list.length !== 1 ? 's' : ''}</span>
              {user === 'Christina' && w.id !== '__all__' && <button onClick={e => { e.stopPropagation(); deleteWorkstream(w) }} title="Remove workstream" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', fontSize: 14, padding: '0 6px' }}>🗑</button>}
              <span className="sans" style={{ fontSize: 11, color: 'var(--faint)' }}>{isOpen ? '▾' : '▸'}</span>
            </div>
            {isOpen && (
              <div className="ph-body">
                {list.map(t => {
                  const editable = canEditTask(user, t)
                  const cs = cmtsFor(t.id); const ats = attsFor(t.id)
                  const l = link[t.id] || {}
                  return (
                    <div key={t.id}>
                      <div className={t.status === 'done' ? 'trow donerow' : 'trow'}>
                        <div className="tname">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {user === 'Christina' && <input type="checkbox" checked={sel.has(t.id)} onChange={() => toggleSel(t.id)} style={{ cursor: 'pointer' }} />}
                            {editable && titleDraft[t.id] !== undefined
                              ? <input autoFocus className="nt" value={titleDraft[t.id]} onChange={e => setTitleDraft(s => ({ ...s, [t.id]: e.target.value }))} onBlur={() => renameTask(t)} onKeyDown={e => { if (e.key === 'Enter') renameTask(t); if (e.key === 'Escape') setTitleDraft(s => { const n = { ...s }; delete n[t.id]; return n }) }} style={{ border: '1px solid var(--accent)', borderRadius: 6, padding: '2px 7px', fontFamily: 'inherit', minWidth: 260 }} />
                              : <span className="nt" onClick={() => { if (editable) setTitleDraft(s => ({ ...s, [t.id]: t.title })) }} style={{ cursor: editable ? 'text' : 'default' }} title={editable ? 'Click to rename' : undefined}>{t.title}</span>}
                            {parseActs(t.applies_to).filter(a => a !== 'All events').map(x => <span className="apill" key={x}>{x}</span>)}
                          </div>
                          <button className="cmtbtn" onClick={() => setOpenThread(o => ({ ...o, [t.id]: o[t.id] === 'edit' ? null : 'edit' }))}>{openThread[t.id] === 'edit' ? '▾ Hide' : '✎ Edit'}</button>
                          <button className="cmtbtn" style={{ marginLeft: 12 }} onClick={() => setOpenThread(o => ({ ...o, [t.id]: o[t.id] === 'comments' ? null : 'comments' }))}>💬 Comment{cs.length ? ' (' + cs.length + ')' : ''}</button>
                          <button className="cmtbtn" style={{ marginLeft: 12 }} onClick={() => setOpenThread(o => ({ ...o, [t.id]: o[t.id] === 'attach' ? null : 'attach' }))}>📎 Add attachment{ats.length ? ' (' + ats.length + ')' : ''}</button>
                          {user === 'Christina' && <button className="cmtbtn" onClick={() => deleteTask(t)} style={{ color: 'var(--red)', marginLeft: 12 }}>🗑 Delete</button>}
                        </div>
                        <div className="owner"><span className="av" style={{ width: 20, height: 20, fontSize: 9, background: OWNER_COLOR[t.owner] || '#888' }}>{ownInit(t.owner)}</span>{editable
                          ? <select value={OWNERS.includes(t.owner) ? t.owner : '__combo__'} onChange={e => { if (e.target.value !== '__combo__') setOwner(t, e.target.value) }} style={{ border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 14, color: 'var(--muted)', fontWeight: 500, cursor: 'pointer', maxWidth: 130 }}>
                              {!OWNERS.includes(t.owner) && t.owner && <option value="__combo__">{t.owner}</option>}
                              {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          : <span>{t.owner}</span>}</div>
                        <div className={`due sans ${editable ? '' : 'ro'}`}><input type="date" value={t.due_date || ''} disabled={!editable} onChange={e => setDue(t, e.target.value)} /></div>
                        <div className={editable ? '' : 'ro'}>
                          <select className={`st sans ${t.status}`} value={t.status} disabled={!editable} onChange={e => setStatus(t, e.target.value)}>
                            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </div>
                      </div>
                      {openThread[t.id] && (
                        <div className="thread sans">
                          {openThread[t.id] === 'edit' && (<>
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
                          </>)}
                          {openThread[t.id] === 'attach' && (<>
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
                          </>)}
                          {openThread[t.id] === 'comments' && (<>
                          <div className="subh" style={{ marginTop: 12 }}>Comments</div>
                          {cs.length === 0 && <div style={{ color: 'var(--faint)', fontSize: 12, marginBottom: 6 }}>No comments yet.</div>}
                          {cs.map(c => {
                            const canMod = c.author === user || master
                            const editing = cmtEdit[c.id] !== undefined
                            return (
                            <div className="cmt" key={c.id}>
                              <span className="ca">{c.author}</span>
                              {c.source === 'slack' && <span className="src">via Slack</span>}
                              <span className="tm">{new Date(c.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                              {canMod && !editing && <span style={{ marginLeft: 8 }}><button className="cmtbtn" style={{ fontSize: 11 }} onClick={() => setCmtEdit(s => ({ ...s, [c.id]: c.body }))}>edit</button><button className="cmtbtn" style={{ fontSize: 11, color: 'var(--red)', marginLeft: 8 }} onClick={() => deleteComment(c)}>delete</button></span>}
                              {editing
                                ? <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                    <input value={cmtEdit[c.id]} onChange={e => setCmtEdit(s => ({ ...s, [c.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') saveCommentEdit(c) }} style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 7, padding: '6px 9px', fontFamily: 'inherit', fontSize: 12 }} />
                                    <button className="btn sm" onClick={() => saveCommentEdit(c)}>Save</button>
                                    <button className="btn ghost sm" onClick={() => setCmtEdit(s => { const n = { ...s }; delete n[c.id]; return n })}>Cancel</button>
                                  </div>
                                : <div>{c.body}</div>}
                            </div>
                            )
                          })}
                          <div className="cmtform">
                            <input placeholder={`Comment as ${user}…`} value={draft[t.id] || ''} onChange={e => setDraft(d => ({ ...d, [t.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addComment(t.id) }} />
                            <button className="btn sm" onClick={() => addComment(t.id)}>Comment</button>
                          </div>
                          </>)}
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
