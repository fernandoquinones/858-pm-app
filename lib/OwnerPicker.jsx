'use client'
import { useState, useRef, useEffect } from 'react'

// Multi-select owner picker. Emits the combo as an "A + B" string (owner stays plain text).
// The dropdown is position:fixed (anchored to the button's on-screen rect) so it is never
// clipped by a scrolling/overflow-hidden container — e.g. the last task in a workstream.
export function OwnerPicker({ value = '', onChange, owners = [], full = false }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 200 })
  const ref = useRef(null)
  const sel = (value || '').split('+').map(s => s.trim()).filter(Boolean)

  function place() {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    const width = Math.max(r.width, 200)
    let left = r.left
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8
    setPos({ top: r.bottom + 4, left: Math.max(8, left), width })
  }

  useEffect(() => {
    if (!open) return
    place()
    const close = e => { if (ref.current && !ref.current.contains(e.target) && !(e.target.closest && e.target.closest('[data-ownerpop]'))) setOpen(false) }
    const reposition = () => place()
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('scroll', reposition, true); window.removeEventListener('resize', reposition) }
  }, [open])

  const toggle = name => onChange((sel.includes(name) ? sel.filter(x => x !== name) : [...sel, name]).join(' + '))

  return (
    <div ref={ref} style={{ position: 'relative', display: full ? 'block' : 'inline-block', width: full ? '100%' : undefined }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ width: full ? '100%' : undefined, textAlign: 'left', border: '1px solid var(--line)', background: '#fff', borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', color: sel.length ? 'var(--ink)' : 'var(--faint)', maxWidth: full ? undefined : 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {sel.length ? sel.join(' + ') : 'Choose owner(s)'} <span style={{ color: 'var(--faint)' }}>▾</span>
      </button>
      {open && (
        <div data-ownerpop style={{ position: 'fixed', zIndex: 1000, top: pos.top, left: pos.left, width: pos.width, background: '#fff', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 8px 24px rgba(20,35,60,.14)', padding: 6, maxHeight: 280, overflowY: 'auto' }}>
          {owners.map(o => (
            <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 7, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={sel.includes(o)} onChange={() => toggle(o)} /> {o}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
