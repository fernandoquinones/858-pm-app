'use client'
// Multi-select activation chips. value = array of activation names.
export function ActivationChips({ value, options, onChange, includeAllEvents = true, allowAdd = true }) {
  const sel = value || []
  function toggle(opt) {
    let next
    if (opt === 'All events') {
      next = sel.includes('All events') ? [] : ['All events']
    } else {
      const base = sel.filter(x => x !== 'All events')
      next = base.includes(opt) ? base.filter(x => x !== opt) : [...base, opt]
    }
    onChange(next)
  }
  function addNew() {
    if (typeof window === 'undefined') return
    const v = window.prompt('New activation name (e.g. Presentation):')
    if (v && v.trim()) onChange([...sel.filter(x => x !== 'All events'), v.trim()])
  }
  // include any selected values (e.g. a just-added custom activation) so they render as chips
  let opts = [...new Set([...(includeAllEvents ? ['All events'] : []), ...options, ...sel])]
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {opts.map(o => {
        const on = sel.includes(o)
        return (
          <button key={o} type="button" onClick={() => toggle(o)}
            style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
              border: '1px solid ' + (on ? '#534AB7' : 'var(--line)'), background: on ? '#EEEDFE' : '#fff', color: on ? '#3C3489' : 'var(--muted)' }}>
            {on ? '✓ ' : ''}{o}
          </button>
        )
      })}
      {allowAdd && (
        <button type="button" onClick={addNew}
          style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
            border: '1px dashed var(--line)', background: '#fff', color: 'var(--accent)' }}>+ new</button>
      )}
    </div>
  )
}
