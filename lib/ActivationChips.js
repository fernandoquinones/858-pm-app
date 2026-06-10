'use client'
import { useState } from 'react'

// Multi-select activation chips. value = array of activation names.
// collapsible: when true, shows only the selected chips with a "+ add / edit" toggle to reveal all.
export function ActivationChips({ value, options, onChange, includeAllEvents = true, allowAdd = true, collapsible = false }) {
  const [expanded, setExpanded] = useState(false)
  const sel = value || []

  function toggle(opt) {
    let next
    if (opt === 'All events') next = sel.includes('All events') ? [] : ['All events']
    else { const base = sel.filter(x => x !== 'All events'); next = base.includes(opt) ? base.filter(x => x !== opt) : [...base, opt] }
    onChange(next)
  }
  function addNew() {
    if (typeof window === 'undefined') return
    const v = window.prompt('New activation name (e.g. Evening social):')
    if (v && v.trim()) { onChange([...sel.filter(x => x !== 'All events'), v.trim()]); setExpanded(true) }
  }

  const opts = [...new Set([...(includeAllEvents ? ['All events'] : []), ...options, ...sel])]
  const collapsed = collapsible && !expanded
  const show = collapsed ? opts.filter(o => sel.includes(o)) : opts
  const dashed = { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', border: '1px dashed var(--line)', background: '#fff', color: 'var(--accent)' }

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {collapsed && show.length === 0 && <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>none selected</span>}
      {show.map(o => {
        const on = sel.includes(o)
        return (
          <button key={o} type="button" onClick={() => toggle(o)}
            style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
              border: '1px solid ' + (on ? '#D9A800' : 'var(--line)'), background: on ? '#FFF6D6' : '#fff', color: on ? '#15263C' : 'var(--muted)' }}>
            {on ? '✓ ' : ''}{o}
          </button>
        )
      })}
      {collapsed
        ? <button type="button" onClick={() => setExpanded(true)} style={dashed}>+ add / edit</button>
        : (
          <>
            {allowAdd && <button type="button" onClick={addNew} style={dashed}>+ new</button>}
            {collapsible && <button type="button" onClick={() => setExpanded(false)} style={{ ...dashed, borderStyle: 'solid', color: 'var(--muted)' }}>✓ done</button>}
          </>
        )}
    </div>
  )
}
