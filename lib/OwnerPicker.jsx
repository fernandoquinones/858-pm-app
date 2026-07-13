'use client'
import { useState, useRef, useEffect } from 'react'

// Multi-select owner picker (UI only). Stores/emits the combo as a "A + B" string,
// so the database owner field stays a plain text column — no schema change.
export function OwnerPicker({ value = '', onChange, owners = [], full = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const sel = (value || '').split('+').map(s => s.trim()).filter(Boolean)
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  const toggle = name => onChange((sel.includes(name) ? sel.filter(x => x !== name) : [...sel, name]).join(' + '))
  return (
    <div ref={ref} style={{ position: 'relative', display: full ? 'block' : 'inline-block', width: full ? '100%' : undefined }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ width: full ? '100%' : undefined, textAlign: 'left', border: '1px solid var(--line)', background: '#fff', borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', color: sel.length ? 'var(--ink)' : 'var(--faint)', maxWidth: full ? undefined : 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {sel.length ? sel.join(' + ') : 'Choose owner(s)'} <span style={{ color: 'var(--faint)' }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', zIndex: 30, top: '100%', left: 0, marginTop: 4, background: '#fff', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 8px 24px rgba(20,35,60,.14)', padding: 6, minWidth: 180, maxHeight: 280, overflowY: 'auto' }}>
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
