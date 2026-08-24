// Catálogo de fan-dubs (PT-BR) — vem direto da nossa própria API de
// estúdios, que já traz o gênero de cada dublagem (campo `genero`).
// Sem precisar cruzar com o AniList por título: usamos o dado real.

const API = 'https://studio-proxy.masterotaku487.workers.dev'

let cache = null
let pending = null

const normalize = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim()

// Busca (uma única vez, com cache em memória) a lista completa de fan-dubs.
export async function getAllFanDubs() {
  if (cache) return cache
  if (!pending) {
    pending = fetch(`${API}/api/fanDubs`)
      .then(r => r.json())
      .then(d => {
        cache = d.fanDubs || []
        return cache
      })
      .catch(() => [])
  }
  return pending
}

// Filtra a lista de fan-dubs por gênero (campo `genero` de cada item).
export async function getFanDubsByGenre(genreLabel) {
  const all = await getAllFanDubs()
  const target = normalize(genreLabel)
  return all.filter(d => normalize(d.genero) === target)
}
