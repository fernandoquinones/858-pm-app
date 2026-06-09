import { TEMPLATE_LIBRARY } from './templateLibrary'

// Load the live library from the DB (what 'Save to library' writes to).
// Falls back to the bundled template if the table is empty/unavailable.
export async function loadLibrary(supabase) {
  try {
    const { data, error } = await supabase
      .from('library_tasks').select('workstream,timing,title,owner,applies_to,notes')
      .order('workstream', { ascending: true }).order('created_at', { ascending: true })
    if (error || !data || !data.length) return TEMPLATE_LIBRARY
    const map = {}, out = []
    for (const r of data) {
      if (!map[r.workstream]) { map[r.workstream] = { phase: r.workstream, timing: r.timing || '', tasks: [] }; out.push(map[r.workstream]) }
      map[r.workstream].tasks.push({ title: r.title, owner: r.owner, applies_to: r.applies_to, note: r.notes })
    }
    return out
  } catch (e) {
    return TEMPLATE_LIBRARY
  }
}
