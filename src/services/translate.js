// Tradução via Google Translate (sem API key)
import { useState, useEffect } from 'react'

const cache = new Map()

export async function translateToET(text) {
  if (!text) return ''
  if (/[ãõáéíóúâêîôûçàèì]/i.test(text)) return text  // já em PT
  
  const key = text.slice(0, 80)
  if (cache.has(key)) return cache.get(key)

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURIComponent(text)}`
    const r = await fetch(url)
    if (!r.ok) throw new Error()
    const data = await r.json()
    const result = data[0]?.map(c => c[0]).join('') || text
    cache.set(key, result)
    return result
  } catch {
    return text
  }
}

export function useTranslatedSynopsis(synopsis) {
  const [text, setText] = useState(synopsis || '')
  
  useEffect(() => {
    if (!synopsis) return
    setText(synopsis) // mostra inglês enquanto traduz
    translateToET(synopsis).then(setText)
  }, [synopsis])
  
  return text
}
