// Em shi.mjs
export async function api(endpoint) {
  // Remove a barra inicial do endpoint se houver
  const cleanPath = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
  
  // Chama o proxy interno da Vercel sem depender de corsproxy.io
  const response = await fetch(`/api/shinokai?path=${encodeURIComponent(cleanPath)}`)
  
  if (!response.ok) {
    throw new Error(`Erro na API (${response.status})`)
  }
  
  return await response.json()
}
