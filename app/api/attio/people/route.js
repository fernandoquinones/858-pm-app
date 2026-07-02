// Contacts for the Headshots page.
// If ATTIO_API_KEY is set, pulls real People from Attio; otherwise returns a sample set
// so the page is fully usable now. Field mapping below is best-effort and may need a
// small tweak once we see the real Attio schema.

const SAMPLE = [
  { id: 'aaron-weedy', name: 'Aaron Weedy', company: 'Ledo Pizza', metro: 'Baltimore', title: 'VP Operations', email: 'aaron@ledopizza.com' },
  { id: 'aj-francavilla', name: 'AJ Francavilla', company: 'Sodexo', metro: 'New York', title: 'Director', email: 'aj@sodexo.com' },
  { id: 'angell-tsang', name: 'Angell Tsang', company: 'Tso Chinese', metro: 'Austin', title: 'Founder', email: 'angell@tsochinese.com' },
  { id: 'ann-hufford', name: 'Ann Hufford', company: 'Technomic', metro: 'Chicago', title: 'Principal', email: 'ann@technomic.com' },
  { id: 'anne-chaio', name: 'Anne Chaio', company: 'Friedmans Hospitality', metro: 'New York', title: 'Partner', email: 'anne@friedmans.com' },
  { id: 'bradley-parker', name: 'Bradley Parker', company: 'Parker Hospitality', metro: 'Chicago', title: 'CEO', email: 'bradley@parkerhospitality.com' },
  { id: 'brendon-gilbert', name: 'Brendon Gilbert', company: "Hattie B's", metro: 'Nashville', title: 'COO', email: 'brendon@hattieb.com' },
  { id: 'brian-anderson', name: 'Brian Anderson', company: 'Upward Projects', metro: 'Phoenix', title: 'Founder', email: 'brian@upwardprojects.com' },
  { id: 'achilles-papakonstantinou', name: 'Achilles Papakonstantinou', company: 'Nostimo Brands', metro: '', title: 'Founder', email: 'achilles@nostimo.com' },
  { id: 'april-brady', name: 'April Brady', company: 'Technomic', metro: 'Chicago', title: '', email: 'april@technomic.com' },
  { id: 'ben-neon', name: '', company: 'Neon Deer Data Labs Inc.', metro: '', title: '', email: 'ben@neondeerdata.com' },
  { id: 'melissa-neon', name: '', company: 'Neon Deer Data Labs Inc.', metro: '', title: '', email: 'melissa@neondeerdata.com' },
  { id: 'jason-wolf', name: 'Jason Wolf', company: 'Neon Deer Data Labs Inc.', metro: '', title: '', email: 'jason@neondeerdata.com' },
  { id: 'jordan-wells', name: 'Jordan Wells', company: 'Unknown Co.', metro: 'Denver', title: 'GM', email: 'jordan@unknown.co' },
]

function first(v) { return Array.isArray(v) ? v[0] : v }

// Best-effort mapping of an Attio person record → our row shape.
function mapAttio(rec) {
  const v = rec.values || {}
  const nameV = first(v.name) || {}
  const name = nameV.full_name || [nameV.first_name, nameV.last_name].filter(Boolean).join(' ') || ''
  const email = (first(v.email_addresses) || {}).email_address || (first(v.email_addresses) || {}).value || ''
  const title = (first(v.job_title) || {}).value || (first(v.title) || {}).value || ''
  const companyRec = first(v.company) || {}
  const company = companyRec.value || (companyRec.target_record && companyRec.target_record.name) || ''
  const metro = (first(v.metro) || {}).value || (first(v.city) || {}).value || (first(v.location) || {}).locality || ''
  const id = (rec.id && (rec.id.record_id || rec.id)) || email || name
  return { id, name, company, metro, title, email }
}

export async function GET() {
  const key = process.env.ATTIO_API_KEY
  if (!key) return Response.json({ source: 'sample', people: SAMPLE })
  try {
    const people = []
    let offset = 0
    const limit = 500
    for (let i = 0; i < 40; i++) { // hard cap ~20k
      const r = await fetch('https://api.attio.com/v2/objects/people/records/query', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ limit, offset })
      })
      if (!r.ok) return Response.json({ source: 'attio-error', error: await r.text(), people: SAMPLE }, { status: 200 })
      const j = await r.json()
      const batch = (j.data || []).map(mapAttio)
      people.push(...batch)
      if (batch.length < limit) break
      offset += limit
    }
    return Response.json({ source: 'attio', people })
  } catch (e) {
    return Response.json({ source: 'attio-exception', error: String(e), people: SAMPLE }, { status: 200 })
  }
}
