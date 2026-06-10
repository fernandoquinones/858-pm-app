// Who can do what. In the prototype the "current user" is chosen with a
// switcher (stand-in for login). In production this comes from Supabase Auth.

export const PEOPLE = [
  { name: 'Christina', role: 'master' },
  { name: 'Fernando',      role: 'master' },
  { name: 'JG',        role: 'member' },   // also runs the seating chart
  { name: 'Nic',       role: 'member' },
  { name: 'Chris',     role: 'member' },
  { name: 'Marty',     role: 'member' }
]

export function roleOf(name) {
  const p = PEOPLE.find(x => x.name === name)
  return p ? p.role : 'member'
}

export function isMaster(name) {
  return roleOf(name) === 'master'
}

// Members can edit a task only if they are (part of) its owner. Masters can edit anything.
export function canEditTask(name, task) {
  if (isMaster(name)) return true
  if (!task || !task.owner) return false
  return task.owner.split('+').map(s => s.trim()).includes(name)
}

// Seating chart: masters can edit, and JG can build/edit it for assigned-seating
// events (luncheons, bird circles). Everyone else views it read-only.
export function canEditSeating(name) {
  return isMaster(name) || name === 'JG'
}

// Everyone signed in can comment on any task.
export function canComment() { return true }
