// Resolve a public-folder path against Vite's base URL so the app works
// both at "/" (dev) and under a subpath such as GitHub Pages "/biofuel-radar/".
export const asset = (p: string) => import.meta.env.BASE_URL + p.replace(/^\//, '')

// Fetch a JSON file from /public and rebase every "src" image path inside it.
export const loadJson = <T,>(p: string): Promise<T> =>
  fetch(asset(p)).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${p}`)
    return r.text()
  }).then((t) => JSON.parse(t, (k, v) => (k === 'src' && typeof v === 'string' && v.startsWith('/') ? asset(v) : v)))
