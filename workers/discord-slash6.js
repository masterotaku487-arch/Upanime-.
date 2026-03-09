// Worker: discord-slash6
// Responde INSTANTANEAMENTE ao Discord (tipo 5 deferred)
// Processa o comando em background e edita a mensagem depois

const SITE_URL  = 'https://upanime-nine.vercel.app'
const JIKAN     = 'https://api.jikan.moe/v4'
const CLIENT_ID = '1480333869361270885'
const COR = {vermelho:0xE53935,ouro:0xFFB300,azul:0x1E88E5,verde:0x43A047,roxo:0x8E24AA,rosa:0xE91E8C}
const GENEROS_PT = {'Action':'Ação','Adventure':'Aventura','Comedy':'Comédia','Drama':'Drama','Fantasy':'Fantasia','Horror':'Terror','Mystery':'Mistério','Romance':'Romance','Sci-Fi':'Sci-Fi','Slice of Life':'Slice of Life','Sports':'Esportes','Supernatural':'Sobrenatural','Thriller':'Suspense','Mecha':'Mecha','Isekai':'Isekai','Shounen':'Shounen','Shoujo':'Shoujo','Seinen':'Seinen','Historical':'Histórico','School':'Vida Escolar','Magic':'Magia','Samurai':'Samurai','Martial Arts':'Artes Marciais'}
const traduzir = (g=[]) => g.slice(0,3).map(x=>GENEROS_PT[x.name]||x.name).join(', ')||'—'
const nota  = (s) => s ? `⭐ ${s.toFixed(1)}/10` : '—'
const imgHD = (a) => a?.images?.webp?.large_image_url || a?.images?.jpg?.large_image_url || ''
const imgSM = (a) => a?.images?.webp?.small_image_url || a?.images?.jpg?.image_url || ''
const jikan = (path) => fetch(`${JIKAN}${path}`).then(r=>r.json())

function hexToBytes(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map(b=>parseInt(b,16)))
}

// ── Verificação rápida ─────────────────────────────────────────────────────
async function verifyDiscord(request, publicKey, bodyText) {
  const sig = request.headers.get('x-signature-ed25519')
  const ts  = request.headers.get('x-signature-timestamp')
  if (!sig || !ts || !publicKey) return false
  try {
    const key = await crypto.subtle.importKey(
      'raw', hexToBytes(publicKey), {name:'Ed25519'}, false, ['verify']
    )
    return await crypto.subtle.verify(
      'Ed25519', key, hexToBytes(sig), new TextEncoder().encode(ts + bodyText)
    )
  } catch { return false }
}

// ── Resposta imediata: "Bot está digitando..." ─────────────────────────────
const DEFERRED = new Response(
  JSON.stringify({type:5}),
  {headers:{'Content-Type':'application/json'}}
)

// ── Edita a mensagem após processar ───────────────────────────────────────
async function editReply(token, embed, content='', env) {
  await fetch(`https://discord.com/api/v10/webhooks/${CLIENT_ID}/${token}/messages/@original`, {
    method:  'PATCH',
    headers: {'Content-Type':'application/json', 'Authorization':`Bot ${env.BOT_TOKEN}`},
    body:    JSON.stringify({content, embeds:[embed]}),
  })
}

async function editErr(token, msg, env) {
  await editReply(token, {title:'❌ Erro',description:msg,color:COR.vermelho}, '', env)
}

// ── Registrar comandos ────────────────────────────────────────────────────
async function registerCommands(env) {
  const s3 = {type:3,required:false}
  const r3 = {type:3,required:true}
  const cmds = [
    {name:'ajuda',        description:'📋 Lista todos os comandos'},
    {name:'site',         description:'🌐 Link do Up Anime+'},
    {name:'top10',        description:'🏆 Top 10 animes populares'},
    {name:'ranking',      description:'🥇 Ranking geral'},
    {name:'temporada',    description:'🌸 Animes da temporada'},
    {name:'popular',      description:'🔥 Em exibição agora'},
    {name:'dia',          description:'🎬 Anime do dia'},
    {name:'aleatorio',    description:'🎲 Anime aleatório'},
    {name:'recomendacao', description:'💡 Recomendação aleatória'},
    {name:'novidades',    description:'🔔 Novos episódios'},
    {name:'agenda',       description:'📅 Lançamentos de hoje'},
    {name:'noticias',     description:'📰 Últimas notícias otaku'},
    {name:'generos',      description:'🎭 Animes por gênero', options:[{...s3,name:'genero',description:'Nome do gênero (ex: Ação)'}]},
    {name:'estudio',      description:'🎬 Animes de um estúdio', options:[{...r3,name:'nome',description:'Ex: MAPPA'}]},
    {name:'personagem',   description:'👤 Busca um personagem', options:[{...r3,name:'nome',description:'Nome do personagem'}]},
    {name:'anime',        description:'🔍 Info de um anime', options:[{...r3,name:'nome',description:'Nome do anime'}]},
    {name:'assistir',     description:'▶ Link para assistir', options:[{...r3,name:'nome',description:'Nome do anime'}]},
    {name:'poster',       description:'🖼️ Poster HD', options:[
      {...s3,name:'plataforma',description:'Plataforma',choices:[{name:'📱 TikTok',value:'tiktok'},{name:'🤖 Reddit',value:'reddit'},{name:'𝕏 Twitter/X',value:'x'}]},
      {...s3,name:'anime',description:'Nome do anime (opcional)'},
    ]},
  ]
  const r = await fetch(`https://discord.com/api/v10/applications/${CLIENT_ID}/commands`,{
    method:'PUT',headers:{'Content-Type':'application/json','Authorization':`Bot ${env.BOT_TOKEN}`},body:JSON.stringify(cmds)
  })
  return r.ok ? `✅ ${cmds.length} comandos registrados!` : `❌ ${await r.text()}`
}

// ═══════════════════════════════════════════════════════════════════════════
//  COMANDOS — rodam em background, editam a mensagem depois
// ═══════════════════════════════════════════════════════════════════════════
async function processCommand(cmd, opts, token, env) {
  try {
    switch(cmd) {

      case 'ajuda': {
        await editReply(token, {title:'🎌 Up Anime+ Bot — Comandos',color:COR.azul,description:[
          '`/ajuda` `/site` `/top10` `/ranking`',
          '`/temporada` `/popular` `/dia`',
          '`/aleatorio` `/recomendacao` `/novidades`',
          '`/agenda` `/noticias`',
          '`/generos [gênero]` — Ex: /generos Ação',
          '`/estudio [nome]` — Ex: /estudio MAPPA',
          '`/personagem [nome]` — Ex: /personagem Naruto',
          '`/anime [nome]` `/assistir [nome]`',
          '`/poster [plataforma] [anime]`',
        ].join('\n'),footer:{text:'Up Anime+ • Bot Oficial'}}, '', env)
        break
      }

      case 'site': {
        await editReply(token, {title:'🌐 Up Anime+ — Assista Grátis!',color:COR.vermelho,
          description:`✅ Legendado e Dublado\n✅ Lançamentos da temporada\n✅ Sem cadastro\n\n**[▶ Acessar agora](${SITE_URL})**`},
          `🎌 **Assista animes grátis!** → ${SITE_URL}`, env)
        break
      }

      case 'top10':
      case 'ranking': {
        const d = await jikan('/top/anime?limit=10&filter=bypopularity')
        const desc = (d.data||[]).map((a,i)=>`**${i+1}.** [${a.title_english||a.title}](${SITE_URL}/anime/${a.mal_id}) ${a.score?`⭐${a.score.toFixed(1)}`:''}`).join('\n')
        await editReply(token, {title:'🏆 Top 10 Animes Mais Populares',description:desc+`\n\n[▶ Ver todos](${SITE_URL}/category/bypopularity)`,color:COR.ouro,thumbnail:{url:imgHD(d.data?.[0])},footer:{text:'Up Anime+'},timestamp:new Date().toISOString()}, '', env)
        break
      }

      case 'temporada': {
        const d = await jikan('/seasons/now?limit=9')
        const list = (d.data||[]).slice(0,6)
        await editReply(token, {title:'🌸 Temporada Atual',color:COR.roxo,thumbnail:{url:imgHD(list[0])},
          description:`Os melhores animes em exibição!\n[▶ Ver todos](${SITE_URL}/category/airing)`,
          fields:list.map(a=>({name:(a.title_english||a.title).slice(0,50),value:`${traduzir(a.genres)}\n${nota(a.score)}\n[▶](${SITE_URL}/anime/${a.mal_id})`,inline:true})),
          footer:{text:'Up Anime+'},timestamp:new Date().toISOString()}, '', env)
        break
      }

      case 'popular': {
        const d = await jikan('/top/anime?filter=airing&limit=6')
        const list = (d.data||[]).slice(0,5)
        await editReply(token, {title:'🔴 Em Exibição Agora',color:COR.vermelho,thumbnail:{url:imgHD(list[0])},
          fields:list.map(a=>({name:(a.title_english||a.title).slice(0,50),value:`${nota(a.score)}\n[▶](${SITE_URL}/watch/${a.mal_id}?ep=1)`,inline:true})),
          footer:{text:'Up Anime+'},timestamp:new Date().toISOString()}, '', env)
        break
      }

      case 'dia': {
        const seed = Math.floor(Date.now()/86400000)%25
        const d = await jikan('/top/anime?limit=25&filter=bypopularity')
        const a = (d.data||[])[seed]
        if (!a) { await editErr(token,'Sem dados',env); break }
        const t = a.title_english||a.title
        await editReply(token, {title:`🎬 Anime do Dia: ${t}`,description:(a.synopsis||'').slice(0,300)+'...',color:COR.rosa,url:`${SITE_URL}/anime/${a.mal_id}`,image:{url:imgHD(a)},
          fields:[{name:'⭐ Nota',value:a.score?.toFixed(1)||'?',inline:true},{name:'📺 Eps',value:`${a.episodes||'?'}`,inline:true},{name:'🎭',value:traduzir(a.genres),inline:true},{name:'▶ Assistir',value:`[Grátis!](${SITE_URL}/watch/${a.mal_id}?ep=1)`,inline:true}],
          footer:{text:'Up Anime+ • Anime do Dia'},timestamp:new Date().toISOString()}, `☀️ **${t}!**`, env)
        break
      }

      case 'aleatorio':
      case 'recomendacao': {
        const d = await jikan(`/top/anime?limit=25&page=${Math.floor(Math.random()*10)+1}`)
        const list = d.data||[]
        const a = list[Math.floor(Math.random()*list.length)]
        if (!a) { await editErr(token,'Sem dados',env); break }
        const t = a.title_english||a.title
        await editReply(token, {title:`🎲 ${cmd==='aleatorio'?'Aleatório':'Recomendação'}: ${t}`,description:(a.synopsis||'').slice(0,250)+'...',color:COR.verde,url:`${SITE_URL}/anime/${a.mal_id}`,image:{url:imgHD(a)},
          fields:[{name:'⭐ Nota',value:a.score?.toFixed(1)||'?',inline:true},{name:'📺 Eps',value:`${a.episodes||'?'}`,inline:true},{name:'🎭',value:traduzir(a.genres),inline:true},{name:'▶ Assistir',value:`[Clique aqui!](${SITE_URL}/watch/${a.mal_id}?ep=1)`,inline:false}],
          footer:{text:'Up Anime+'},timestamp:new Date().toISOString()}, '', env)
        break
      }

      case 'agenda': {
        const dias = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
        const d = await jikan(`/schedules?filter=${dias[new Date().getDay()]}&limit=9`)
        const list = (d.data||[]).slice(0,8)
        await editReply(token, {title:'📅 Lançamentos de Hoje',color:COR.verde,
          description:list.length ? '' : 'Nenhum anime hoje!',
          fields:list.map(a=>({name:(a.title_english||a.title).slice(0,50),value:`${traduzir(a.genres)}\n[▶](${SITE_URL}/anime/${a.mal_id})`,inline:true})),
          footer:{text:'Up Anime+'},timestamp:new Date().toISOString()}, '', env)
        break
      }

      case 'noticias': {
        const d = await jikan('/news?limit=5')
        const list = d.data||[]
        await editReply(token, {title:'📰 Últimas Notícias Otaku',color:COR.azul,
          fields:list.map(n=>({name:(n.title||'—').slice(0,80),value:`[Ler mais](${n.url})`,inline:false})),
          footer:{text:'Up Anime+ • via Jikan'},timestamp:new Date().toISOString()}, '', env)
        break
      }

      case 'generos': {
        const genero = opts.genero||''
        if (!genero) {
          await editReply(token, {title:'🎭 Gêneros Disponíveis',description:'Use `/generos [nome]` para filtrar!\n\nAção • Aventura • Comédia • Drama • Fantasia • Terror • Romance • Sci-Fi • Isekai • Shounen • Shoujo • Seinen • Mecha • Sobrenatural • Suspense',color:COR.azul}, '', env)
          break
        }
        const ptToEn = {'ação':'1','aventura':'2','comédia':'4','drama':'8','fantasia':'10','terror':'14','mistério':'7','romance':'22','sci-fi':'24','slice of life':'36','esportes':'30','sobrenatural':'37','suspense':'41','mecha':'18','isekai':'62','shounen':'27','shoujo':'25','seinen':'42','histórico':'13','magia':'16'}
        const id = ptToEn[genero.toLowerCase()]
        if (!id) { await editErr(token,`Gênero "${genero}" não encontrado. Use /generos para ver a lista.`,env); break }
        const d = await jikan(`/anime?genres=${id}&order_by=popularity&limit=6`)
        const list = d.data||[]
        await editReply(token, {title:`🎭 Animes de ${genero}`,color:COR.roxo,thumbnail:{url:imgHD(list[0])},
          fields:list.map(a=>({name:(a.title_english||a.title).slice(0,50),value:`${nota(a.score)}\n[▶](${SITE_URL}/anime/${a.mal_id})`,inline:true})),
          footer:{text:'Up Anime+'},timestamp:new Date().toISOString()}, '', env)
        break
      }

      case 'estudio': {
        const d = await jikan(`/producers?q=${encodeURIComponent(opts.nome||'')}&limit=1`)
        const prod = d.data?.[0]
        if (!prod) { await editErr(token,`Estúdio "${opts.nome}" não encontrado.`,env); break }
        const animes = await jikan(`/anime?producers=${prod.mal_id}&order_by=popularity&limit=6`)
        const list = animes.data||[]
        await editReply(token, {title:`🎬 ${prod.titles?.[0]?.title||opts.nome}`,color:COR.ouro,thumbnail:{url:imgHD(list[0])},
          fields:list.map(a=>({name:(a.title_english||a.title).slice(0,50),value:`${nota(a.score)}\n[▶](${SITE_URL}/anime/${a.mal_id})`,inline:true})),
          footer:{text:'Up Anime+'},timestamp:new Date().toISOString()}, '', env)
        break
      }

      case 'personagem': {
        const d = await jikan(`/characters?q=${encodeURIComponent(opts.nome||'')}&limit=1`)
        const c = d.data?.[0]
        if (!c) { await editErr(token,`"${opts.nome}" não encontrado.`,env); break }
        const animes = c.anime?.slice(0,3).map(a=>a.anime?.title).filter(Boolean).join(', ')||'—'
        await editReply(token, {title:`👤 ${c.name}`,description:(c.about||'').slice(0,300)||'Sem descrição.',color:COR.azul,
          thumbnail:{url:c.images?.jpg?.image_url||''},
          fields:[{name:'📺 Aparece em',value:animes,inline:false},{name:'❤️ Favoritos',value:`${c.favorites||0}`,inline:true}],
          footer:{text:'Up Anime+'},timestamp:new Date().toISOString()}, '', env)
        break
      }

      case 'anime': {
        const d = await jikan(`/anime?q=${encodeURIComponent(opts.nome||'')}&limit=1&sfw=true`)
        const a = d.data?.[0]
        if (!a) { await editErr(token,`"${opts.nome}" não encontrado.`,env); break }
        const t = a.title_english||a.title
        const status = a.status==='Finished Airing'?'✅ Finalizado':a.status==='Currently Airing'?'🔴 Em exibição':a.status||'?'
        await editReply(token, {title:t,description:(a.synopsis||'').slice(0,300)+'...',color:COR.verde,url:`${SITE_URL}/anime/${a.mal_id}`,thumbnail:{url:imgSM(a)},image:{url:imgHD(a)},
          fields:[{name:'⭐ Nota',value:nota(a.score),inline:true},{name:'📺 Eps',value:`${a.episodes||'?'}`,inline:true},{name:'🎭',value:traduzir(a.genres),inline:true},{name:'📅 Ano',value:a.aired?.from?.slice(0,4)||'?',inline:true},{name:'🏷️ Status',value:status,inline:true},{name:'▶ Assistir',value:`[Grátis!](${SITE_URL}/watch/${a.mal_id}?ep=1)`,inline:true}],
          footer:{text:`Up Anime+ • ID: ${a.mal_id}`},timestamp:new Date().toISOString()}, '', env)
        break
      }

      case 'assistir': {
        const d = await jikan(`/anime?q=${encodeURIComponent(opts.nome||'')}&limit=1&sfw=true`)
        const a = d.data?.[0]
        if (!a) { await editErr(token,`"${opts.nome}" não encontrado.`,env); break }
        const t = a.title_english||a.title
        await editReply(token, {title:`▶ ${t}`,description:`[🎌 Assistir EP 1 — Grátis!](${SITE_URL}/watch/${a.mal_id}?ep=1)`,color:COR.vermelho,image:{url:imgHD(a)},footer:{text:'Up Anime+'}},`🎌 **${t}** → ${SITE_URL}/watch/${a.mal_id}?ep=1`, env)
        break
      }

      case 'poster': {
        let a
        if (opts.anime) {
          const d = await jikan(`/anime?q=${encodeURIComponent(opts.anime)}&limit=1&sfw=true`)
          a = d.data?.[0]
        } else {
          const d = await jikan(`/top/anime?limit=25&page=${Math.floor(Math.random()*4)+1}&filter=bypopularity`)
          const list = d.data||[]
          a = list[Math.floor(Math.random()*list.length)]
        }
        if (!a) { await editErr(token,'Anime não encontrado.',env); break }
        const t = a.title_english||a.title
        const tag = `#${t.replace(/[^a-zA-Z0-9]/g,'').toLowerCase()}`
        const textos = {
          tiktok:`🎌 ${t}\n${traduzir(a.genres)} • ${nota(a.score)}\n\n▶ Assista grátis — link na bio!\n#anime #animebr ${tag}`,
          reddit:`**${t}** — ${traduzir(a.genres)}\n${nota(a.score)} | ${a.episodes||'?'} eps\n\nAssista: ${SITE_URL}/watch/${a.mal_id}?ep=1`,
          x:`🔥 ${t} ${nota(a.score)}\n${traduzir(a.genres)}\nAssista → ${SITE_URL}/watch/${a.mal_id}?ep=1\n#anime #animebr`,
        }
        const labels = {tiktok:'📱 TikTok',reddit:'🤖 Reddit',x:'𝕏 Twitter/X'}
        await editReply(token, {title:`${labels[opts.plataforma||'']||'🖼️ Poster HD'}: ${t}`,
          description:textos[opts.plataforma||'']||`[▶ Assistir](${SITE_URL}/watch/${a.mal_id}?ep=1)`,
          color:COR.ouro,image:{url:imgHD(a)},
          fields:[{name:'📋 Como usar',value:'Segura a imagem → Salvar • Copie o texto acima',inline:false}],
          footer:{text:'Up Anime+ • Segura para salvar em HD'},timestamp:new Date().toISOString()}, '', env)
        break
      }

      default: await editErr(token, 'Comando desconhecido.', env)
    }
  } catch(e) { await editErr(token, e.message, env).catch(()=>{}) }
}

// ── HANDLER ────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (url.searchParams.get('action')==='register')
      return new Response(await registerCommands(env))

    if (request.method!=='POST')
      return new Response('Up Anime+ Bot ativo ✅ — discord-slash6')

    const bodyText = await request.text()

    // Verificação rápida de assinatura
    if (!await verifyDiscord(request, env.PUBLIC_KEY||'', bodyText))
      return new Response('Assinatura inválida', {status:401})

    const body = JSON.parse(bodyText)

    // PING → responde instantaneamente
    if (body.type===1)
      return new Response(JSON.stringify({type:1}), {headers:{'Content-Type':'application/json'}})

    // SLASH COMMAND → responde DEFERRED imediatamente + processa em background
    if (body.type===2) {
      const cmd  = body.data.name
      const opts = Object.fromEntries((body.data.options||[]).map(o=>[o.name,o.value]))
      const token = body.token

      // Processa em background sem bloquear a resposta
      ctx.waitUntil(processCommand(cmd, opts, token, env))

      // Responde instantaneamente com "Bot está digitando..."
      return new Response(JSON.stringify({type:5}), {headers:{'Content-Type':'application/json'}})
    }

    return new Response('OK')
  }
    }
          
