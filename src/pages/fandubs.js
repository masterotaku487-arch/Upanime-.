// Cruza o catálogo (AniList) com os fan-dubs em PT-BR cadastrados no
// worker de estúdios, pra sabermos quais animes têm dublagem disponível.
// Isso funciona como um "gênero Dublado" virtual, já que a API de
// catálogo não tem esse conceito nativamente.

const API = 'https://studio-proxy.masterotaku487.workers.dev'

let cache = null
let pending = null

const normalize = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')

// Busca (uma única vez, com cache em memória) o conjunto de títulos
// que têm pelo menos um fan-dub cadastrado.
export async function getDubbedTitleSet() {
  if (cache) return cache
  if (!pending) {
    pending = fetch(`${API}/api/fanDubs`)
      .then(r => r.json())
      .then(d => {
        const set = new Set()
        ;(d.fanDubs || []).forEach(f => {
          if (f.animeTitulo) set.add(normalize(f.animeTitulo))
        })
        cache = set
        return set
      })
      .catch(() => new Set())
  }
  return pending
}

// Checa se um anime (objeto do AniList/mapMedia) tem dublagem disponível.
export function isDubbed(anime, dubbedSet) {
  if (!dubbedSet || dubbedSet.size === 0) return false
  const candidates = [anime.title, anime.title_english, anime.title_japanese].filter(Boolean)
  return candidates.some(t => dubbedSet.has(normalize(t)))
}
