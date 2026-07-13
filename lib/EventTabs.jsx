'use client'
import Link from 'next/link'

// Tab bar shown at the top of every event: the three hubs.
export function EventTabs({ id, active }) {
  const tabs = [
    { key: 'event', label: '📋 Event Hub', href: `/project/${id}/plan` },
    { key: 'client', label: '🤝 Client Hub', href: `/project/${id}/client` },
    { key: 'internal', label: '🗂 Internal Hub', href: `/project/${id}/internal` },
  ]
  return (
    <div style={{ display: 'flex', gap: 8, margin: '4px 0 18px', flexWrap: 'wrap' }}>
      {tabs.map(t => {
        const on = active === t.key
        return (
          <Link key={t.key} href={t.href} style={{ textDecoration: 'none', fontSize: 14, fontWeight: 600, padding: '9px 18px', borderRadius: 10, border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'), background: on ? 'var(--accent)' : '#fff', color: on ? '#fff' : 'var(--muted)' }}>{t.label}</Link>
        )
      })}
    </div>
  )
}
