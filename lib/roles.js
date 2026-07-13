// Who can do what. In the prototype the "current user" is chosen with a
// switcher (stand-in for login). In production this comes from Supabase Auth.

export const PEOPLE = [
  { name: 'Fernando',  role: 'owner' },
  { name: 'Christina', role: 'admin' },
  { name: 'JG',        role: 'user' },   // also runs the seating chart
  { name: 'Nic',       role: 'user' },
  { name: 'Caitlin',   role: 'user' },
  { name: 'Beth',      role: 'user' },
  { name: 'Marty',     role: 'user' },
  { name: 'Nola',      role: 'user' }
]

export function roleOf(name) {
  const p = PEOPLE.find(x => x.name === name)
  return p ? p.role : 'user'
}

// "Full access" = owner or admin (both can edit anything). Kept as isMaster for compatibility.
export function isMaster(name) {
  const r = roleOf(name)
  return r === 'owner' || r === 'admin'
}

// Editing fields (name, owner, due date, activation, workstream) = owner/admin only.
export function canEditTask(name) {
  return isMaster(name)
}

// Changing status / completing: owner/admin, OR a user on a task they own.
export function canSetStatus(name, task) {
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
