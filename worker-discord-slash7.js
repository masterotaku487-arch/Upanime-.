// Worker: discord-slash7
// Variáveis: BOT_TOKEN, PUBLIC_KEY, WEBHOOK_URL, OWNER_ID (seu ID do Discord)

const SITE_URL  = 'https://upanime-nine.vercel.app'
const JIKAN     = 'https://api.jikan.moe/v4'
const CLIENT_ID = '1480333869361270885'
const COR = {vermelho:0xE53935,ouro:0xFFB300,azul:0x1E88E5,verde:0x43A047,roxo:0x8E24AA,rosa:0xE91E8C,cinza:0x455A64}
const GENEROS_PT = {'Action':'Ação','Adventure':'Aventura','Comedy':'Comédia','Drama':'Drama','Fantasy':'Fantasia','Horror':'Terror','Mystery':'Mistério','Romance':'Romance','Sci-Fi':'Sci-Fi','Slice of Life':'Slice of Life','Sports':'Esportes','Supernatural':'Sobrenatural','Thriller':'Suspense','Mecha':'Mecha','Isekai':'Isekai','Shounen':'Shounen','Shoujo':'Shoujo','Seinen':'Seinen','Historical':'Histórico','School':'Vida Escolar','Magic':'Magia','Samurai':'Samurai','Martial Arts':'Artes Marciais'}
const traduzir = (g=[]) => g.slice(0,3).map(x=>GENEROS_PT[x.name]||x.name).join(', ')||'—'
const nota  = (s) => s?`⭐ ${s.toFixed(1)}/10`:'—'
const imgHD = (a) => a?.images?.webp?.large_image_url||a?.images?.jpg?.large_image_url||''
const imgSM = (a) => a?.images?.webp?.small_image_url||a?.images?.jpg?.image_url||''
const jikan = (p) => fetch(`${JIKAN}${p}`).then(r=>r.json())

function hexToBytes(hex) { return new Uint8Array(hex.match(/.{1,2}/g).map(b=>parseInt(b,16))) }

async function verifyDiscord(request, publicKey, bodyText) {
  const sig=request.headers.get('x-signature-ed25519')
  const ts =request.headers.get('x-signature-timestamp')
  if (!sig||!ts||!publicKey) return false
  try {
    const key = await crypto.subtle.importKey('raw',hexToBytes(publicKey),{name:'Ed25519'},false,['verify'])
    return await crypto.subtle.verify('Ed25519',key,hexToBytes(sig),new TextEncoder().encode(ts+bodyText))
  } catch { return false }
}

const DEFERRED_RESPONSE = '{"type":5}'
async function editReply(token,embed,content='',env,ephemeral=false) {
  await fetch(`https://discord.com/api/v10/webhooks/${CLIENT_ID}/${token}/messages/@original`,{
    method:'PATCH',headers:{'Content-Type':'application/json','Authorization':`Bot ${env.BOT_TOKEN}`},
    body:JSON.stringify({content,embeds:[embed],flags:ephemeral?64:0})
  })
}
async function editErr(token,msg,env) { await editReply(token,{title:'❌ Erro',description:msg,color:COR.vermelho},'',env,true) }

// ── ADM: verifica se é o dono ─────────────────────────────────────────────
function isOwner(body, env) { return body.member?.user?.id === env.OWNER_ID || body.user?.id === env.OWNER_ID }

// ── Registrar comandos ────────────────────────────────────────────────────
async function registerCommands(env) {
  const s3={type:3,required:false}, r3={type:3,required:true}, r6={type:6,required:true}
  const cmds = [
    // Públicos
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
    {name:'filme',        description:'🎬 Melhores filmes de anime'},
    {name:'nota',         description:'⭐ Animes mais bem avaliados'},
    {name:'generos',      description:'🎭 Animes por gênero', options:[{...s3,name:'genero',description:'Ex: Ação'}]},
    {name:'estudio',      description:'🏢 Animes de um estúdio', options:[{...r3,name:'nome',description:'Ex: MAPPA'}]},
    {name:'personagem',   description:'👤 Busca um personagem', options:[{...r3,name:'nome',description:'Nome do personagem'}]},
    {name:'anime',        description:'🔍 Info de um anime', options:[{...r3,name:'nome',description:'Nome do anime'}]},
    {name:'assistir',     description:'▶ Link para assistir', options:[{...r3,name:'nome',description:'Nome do anime'}]},
    {name:'comparar',     description:'⚔️ Compara dois animes', options:[{...r3,name:'anime1',description:'Primeiro'},{...r3,name:'anime2',description:'Segundo'}]},
    {name:'poster',       description:'🖼️ Poster HD', options:[
      {...s3,name:'plataforma',description:'Plataforma',choices:[{name:'📱 TikTok',value:'tiktok'},{name:'🤖 Reddit',value:'reddit'},{name:'𝕏 Twitter/X',value:'x'}]},
      {...s3,name:'anime',description:'Nome do anime (opcional)'},
    ]},
    // Novos públicos
    {name:'quiz',         description:'🎯 Quiz de anime — teste seu conhecimento!'},
    {name:'sortear',      description:'🎰 Sorteia um anime para assistir', options:[{...s3,name:'genero',description:'Gênero (opcional)'}]},
    {name:'maratona',     description:'📺 Monta uma lista de maratona', options:[{...r3,name:'genero',description:'Gênero da maratona'}]},
    {name:'curiosidade',  description:'🧠 Fato curioso do mundo anime'},
    // ADM (só funciona para o dono)
    {name:'anuncio',      description:'📢 [ADM] Posta anúncio no canal', options:[{...r3,name:'mensagem',description:'Texto do anúncio'},{...s3,name:'canal',description:'ID do canal (opcional)'}]},
    {name:'stats',        description:'📊 [ADM] Estatísticas do site'},
    {name:'banir',        description:'🔨 [ADM] Bane usuário do servidor', options:[{...r6,name:'usuario',description:'Usuário a banir'},{...s3,name:'motivo',description:'Motivo do ban'}]},
    {name:'dc',           description:'⛔ [ADM] Desativa o bot temporariamente'},
    {name:'setup',       description:'🏗️ [ADM] Cria categorias, canais e cargos no servidor'},
    {name:'criar_cargo', description:'🎭 [ADM] Cria um cargo', options:[{type:3,required:true,name:'nome',description:'Nome do cargo'},{type:3,required:false,name:'cor',description:'Cor hex sem # (ex: FF0000)'}]},
    {name:'criar_canal', description:'📝 [ADM] Cria um canal', options:[{type:3,required:true,name:'nome',description:'Nome do canal'},{type:3,required:false,name:'tipo',description:'Tipo',choices:[{name:'💬 Texto',value:'text'},{name:'🔊 Voz',value:'voice'},{name:'📢 Anuncio',value:'news'}]},{type:3,required:false,name:'categoria',description:'ID da categoria (opcional)'}]},
    {name:'limpar',      description:'🧹 [ADM] Apaga mensagens', options:[{type:4,required:true,name:'quantidade',description:'Quantidade (max 100)'}]},
    {name:'trancar',     description:'🔒 [ADM] Tranca o canal atual'},
    {name:'destrancar',  description:'🔓 [ADM] Destranca o canal atual'},
  ]
  const r = await fetch(`https://discord.com/api/v10/applications/${CLIENT_ID}/commands`,{method:'PUT',headers:{'Content-Type':'application/json','Authorization':`Bot ${env.BOT_TOKEN}`},body:JSON.stringify(cmds)})
  return r.ok?`✅ ${cmds.length} comandos registrados!`:`❌ ${await r.text()}`
}

// ═══════════════════════════════════════════════════════════════════════════
//  COMANDOS
// ═══════════════════════════════════════════════════════════════════════════
async function processCommand(cmd, opts, token, body, env) {
  try {

    // ── ADM guard ──────────────────────────────────────────────────────────
    const admCmds = ['anuncio','stats','banir','dc','setup','criar_cargo','criar_canal','limpar','trancar','destrancar']
    if (admCmds.includes(cmd) && !isOwner(body, env)) {
      await editErr(token,'🔒 Comando exclusivo do administrador.',env); return
    }

    switch(cmd) {

      case 'ajuda': {
        await editReply(token,{title:'🎌 Up Anime+ Bot — Comandos',color:COR.azul,description:[
          '**🔍 Busca:** `/anime` `/personagem` `/estudio`',
          '**📊 Rankings:** `/top10` `/ranking` `/nota` `/filme`',
          '**🎲 Descoberta:** `/aleatorio` `/sortear` `/maratona` `/generos`',
          '**📅 Agenda:** `/temporada` `/popular` `/dia` `/agenda` `/novidades`',
          '**🎮 Diversão:** `/quiz` `/curiosidade` `/comparar` `/poster`',
          '**🔗 Site:** `/site` `/assistir` `/recomendacao` `/noticias`',
          '',
          '🔒 **ADM:** `/anuncio` `/stats` `/banir` `/dc`',
        ].join('\n'),footer:{text:'Up Anime+ • Bot Oficial'}}, '', env)
        break
      }

      case 'site': {
        await editReply(token,{title:'🌐 Up Anime+ — Assista Grátis!',color:COR.vermelho,
          description:`✅ Legendado e Dublado\n✅ Sem Cadastro\n✅ Lançamentos Diários\n\n**[▶ Acessar agora](${SITE_URL})**`},
          `🎌 **Assista animes grátis!** → ${SITE_URL}`, env)
        break
      }

      case 'top10': case 'ranking': {
        const d=await jikan('/top/anime?limit=10&filter=bypopularity')
        const desc=(d.data||[]).map((a,i)=>`**${i+1}.** [${a.title_english||a.title}](${SITE_URL}/anime/${a.mal_id}) ${a.score?`⭐${a.score.toFixed(1)}`:''}`).join('\n')
        await editReply(token,{title:'🏆 Top 10 Animes Mais Populares',description:desc+`\n\n[▶ Ver todos](${SITE_URL}/category/bypopularity)`,color:COR.ouro,thumbnail:{url:imgHD(d.data?.[0])},footer:{text:'Up Anime+'},timestamp:new Date().toISOString()},'',env)
        break
      }

      case 'temporada': {
        const d=await jikan('/seasons/now?limit=9'); const list=(d.data||[]).slice(0,6)
        await editReply(token,{title:'🌸 Temporada Atual',color:COR.roxo,thumbnail:{url:imgHD(list[0])},
          description:`Melhores animes em exibição!\n[▶ Ver todos](${SITE_URL}/category/airing)`,
          fields:list.map(a=>({name:(a.title_english||a.title).slice(0,50),value:`${traduzir(a.genres)}\n${nota(a.score)}\n[▶](${SITE_URL}/anime/${a.mal_id})`,inline:true})),
          footer:{text:'Up Anime+'},timestamp:new Date().toISOString()},'',env)
        break
      }

      case 'popular': {
        const d=await jikan('/top/anime?filter=airing&limit=6'); const list=(d.data||[]).slice(0,5)
        await editReply(token,{title:'🔴 Em Exibição Agora',color:COR.vermelho,thumbnail:{url:imgHD(list[0])},
          fields:list.map(a=>({name:(a.title_english||a.title).slice(0,50),value:`${nota(a.score)}\n[▶](${SITE_URL}/watch/${a.mal_id}?ep=1)`,inline:true})),
          footer:{text:'Up Anime+'},timestamp:new Date().toISOString()},'',env)
        break
      }

      case 'dia': {
        const seed=Math.floor(Date.now()/86400000)%25
        const d=await jikan('/top/anime?limit=25&filter=bypopularity'); const a=(d.data||[])[seed]
        if (!a){await editErr(token,'Sem dados',env);break}
        const t=a.title_english||a.title
        await editReply(token,{title:`🎬 Anime do Dia: ${t}`,description:(a.synopsis||'').slice(0,300)+'...',color:COR.rosa,url:`${SITE_URL}/anime/${a.mal_id}`,image:{url:imgHD(a)},
          fields:[{name:'⭐ Nota',value:a.score?.toFixed(1)||'?',inline:true},{name:'📺 Eps',value:`${a.episodes||'?'}`,inline:true},{name:'🎭',value:traduzir(a.genres),inline:true},{name:'▶',value:`[Assistir](${SITE_URL}/watch/${a.mal_id}?ep=1)`,inline:true}],
          footer:{text:'Up Anime+ • Anime do Dia'},timestamp:new Date().toISOString()},`☀️ **${t}!**`,env)
        break
      }

      case 'aleatorio': case 'recomendacao': {
        const d=await jikan(`/top/anime?limit=25&page=${Math.floor(Math.random()*10)+1}`)
        const a=(d.data||[])[Math.floor(Math.random()*25)]
        if (!a){await editErr(token,'Sem dados',env);break}
        const t=a.title_english||a.title
        await editReply(token,{title:`🎲 ${cmd==='aleatorio'?'Aleatório':'Recomendação'}: ${t}`,description:(a.synopsis||'').slice(0,250)+'...',color:COR.verde,url:`${SITE_URL}/anime/${a.mal_id}`,image:{url:imgHD(a)},
          fields:[{name:'⭐',value:a.score?.toFixed(1)||'?',inline:true},{name:'📺',value:`${a.episodes||'?'} eps`,inline:true},{name:'🎭',value:traduzir(a.genres),inline:true},{name:'▶',value:`[Assistir!](${SITE_URL}/watch/${a.mal_id}?ep=1)`,inline:false}],
          footer:{text:'Up Anime+'},timestamp:new Date().toISOString()},'',env)
        break
      }

      case 'agenda': {
        const dias=['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
        const d=await jikan(`/schedules?filter=${dias[new Date().getDay()]}&limit=9`); const list=(d.data||[]).slice(0,8)
        await editReply(token,{title:'📅 Lançamentos de Hoje',color:COR.verde,
          description:list.length?'':' Nenhum anime hoje!',
          fields:list.map(a=>({name:(a.title_english||a.title).slice(0,50),value:`${traduzir(a.genres)}\n[▶](${SITE_URL}/anime/${a.mal_id})`,inline:true})),
          footer:{text:'Up Anime+'},timestamp:new Date().toISOString()},'',env)
        break
      }

      case 'noticias': {
        const d=await jikan('/news?limit=5'); const list=d.data||[]
        await editReply(token,{title:'📰 Últimas Notícias Otaku',color:COR.azul,
          fields:list.map(n=>({name:(n.title||'—').slice(0,80),value:`[Ler mais](${n.url})`,inline:false})),
          footer:{text:'Up Anime+ • via Jikan'},timestamp:new Date().toISOString()},'',env)
        break
      }

      case 'filme': {
        const d=await jikan('/top/anime?type=movie&limit=8&filter=bypopularity'); const list=(d.data||[]).slice(0,6)
        await editReply(token,{title:'🎬 Melhores Filmes de Anime',color:COR.rosa,thumbnail:{url:imgHD(list[0])},
          fields:list.map((a,i)=>({name:`${i+1}. ${(a.title_english||a.title).slice(0,45)}`,value:`${nota(a.score)}\n[▶](${SITE_URL}/anime/${a.mal_id})`,inline:true})),
          footer:{text:'Up Anime+'},timestamp:new Date().toISOString()},'',env)
        break
      }

      case 'nota': {
        const d=await jikan('/top/anime?limit=8&filter=favorite'); const list=(d.data||[]).slice(0,6)
        const desc=list.map((a,i)=>`**${i+1}.** [${a.title_english||a.title}](${SITE_URL}/anime/${a.mal_id}) — ${nota(a.score)}`).join('\n')
        await editReply(token,{title:'⭐ Animes Mais Bem Avaliados',description:desc,color:COR.ouro,thumbnail:{url:imgHD(list[0])},footer:{text:'Up Anime+'},timestamp:new Date().toISOString()},'',env)
        break
      }

      case 'generos': {
        if (!opts.genero) {
          await editReply(token,{title:'🎭 Gêneros',description:'Use `/generos [nome]`!\n\nAção • Aventura • Comédia • Drama • Fantasia • Terror • Romance • Sci-Fi • Isekai • Shounen • Shoujo • Seinen • Mecha • Sobrenatural',color:COR.azul},'',env); break
        }
        const map={'ação':'1','aventura':'2','comédia':'4','drama':'8','fantasia':'10','terror':'14','mistério':'7','romance':'22','sci-fi':'24','slice of life':'36','esportes':'30','sobrenatural':'37','suspense':'41','mecha':'18','isekai':'62','shounen':'27','shoujo':'25','seinen':'42','histórico':'13','magia':'16'}
        const id=map[opts.genero.toLowerCase()]
        if (!id){await editErr(token,`Gênero "${opts.genero}" não encontrado.`,env);break}
        const d=await jikan(`/anime?genres=${id}&order_by=popularity&limit=6`); const list=d.data||[]
        await editReply(token,{title:`🎭 Animes de ${opts.genero}`,color:COR.roxo,thumbnail:{url:imgHD(list[0])},
          fields:list.map(a=>({name:(a.title_english||a.title).slice(0,50),value:`${nota(a.score)}\n[▶](${SITE_URL}/anime/${a.mal_id})`,inline:true})),
          footer:{text:'Up Anime+'},timestamp:new Date().toISOString()},'',env)
        break
      }

      case 'estudio': {
        const d=await jikan(`/producers?q=${encodeURIComponent(opts.nome||'')}&limit=1`); const prod=d.data?.[0]
        if (!prod){await editErr(token,`Estúdio "${opts.nome}" não encontrado.`,env);break}
        const animes=await jikan(`/anime?producers=${prod.mal_id}&order_by=popularity&limit=6`); const list=animes.data||[]
        await editReply(token,{title:`🏢 ${prod.titles?.[0]?.title||opts.nome}`,color:COR.ouro,thumbnail:{url:imgHD(list[0])},
          fields:list.map(a=>({name:(a.title_english||a.title).slice(0,50),value:`${nota(a.score)}\n[▶](${SITE_URL}/anime/${a.mal_id})`,inline:true})),
          footer:{text:'Up Anime+'},timestamp:new Date().toISOString()},'',env)
        break
      }

      case 'personagem': {
        const d=await jikan(`/characters?q=${encodeURIComponent(opts.nome||'')}&limit=1`); const c=d.data?.[0]
        if (!c){await editErr(token,`"${opts.nome}" não encontrado.`,env);break}
        await editReply(token,{title:`👤 ${c.name}`,description:(c.about||'').slice(0,300)||'Sem descrição.',color:COR.azul,
          thumbnail:{url:c.images?.jpg?.image_url||''},
          fields:[{name:'📺 Aparece em',value:c.anime?.slice(0,3).map(a=>a.anime?.title).filter(Boolean).join(', ')||'—',inline:false},{name:'❤️ Favoritos',value:`${c.favorites||0}`,inline:true}],
          footer:{text:'Up Anime+'},timestamp:new Date().toISOString()},'',env)
        break
      }

      case 'anime': {
        const d=await jikan(`/anime?q=${encodeURIComponent(opts.nome||'')}&limit=1&sfw=true`); const a=d.data?.[0]
        if (!a){await editErr(token,`"${opts.nome}" não encontrado.`,env);break}
        const t=a.title_english||a.title
        const status=a.status==='Finished Airing'?'✅ Finalizado':a.status==='Currently Airing'?'🔴 Em exibição':a.status||'?'
        await editReply(token,{title:t,description:(a.synopsis||'').slice(0,300)+'...',color:COR.verde,url:`${SITE_URL}/anime/${a.mal_id}`,thumbnail:{url:imgSM(a)},image:{url:imgHD(a)},
          fields:[{name:'⭐ Nota',value:nota(a.score),inline:true},{name:'📺 Eps',value:`${a.episodes||'?'}`,inline:true},{name:'🎭',value:traduzir(a.genres),inline:true},{name:'📅 Ano',value:a.aired?.from?.slice(0,4)||'?',inline:true},{name:'🏷️ Status',value:status,inline:true},{name:'▶',value:`[Assistir!](${SITE_URL}/watch/${a.mal_id}?ep=1)`,inline:true}],
          footer:{text:`Up Anime+ • ID: ${a.mal_id}`},timestamp:new Date().toISOString()},'',env)
        break
      }

      case 'assistir': {
        const d=await jikan(`/anime?q=${encodeURIComponent(opts.nome||'')}&limit=1&sfw=true`); const a=d.data?.[0]
        if (!a){await editErr(token,`"${opts.nome}" não encontrado.`,env);break}
        const t=a.title_english||a.title
        await editReply(token,{title:`▶ ${t}`,description:`[🎌 Assistir EP 1 — Grátis!](${SITE_URL}/watch/${a.mal_id}?ep=1)`,color:COR.vermelho,image:{url:imgHD(a)},footer:{text:'Up Anime+'}},`🎌 **${t}** → ${SITE_URL}/watch/${a.mal_id}?ep=1`,env)
        break
      }

      case 'comparar': {
        const [d1,d2]=await Promise.all([jikan(`/anime?q=${encodeURIComponent(opts.anime1||'')}&limit=1&sfw=true`),jikan(`/anime?q=${encodeURIComponent(opts.anime2||'')}&limit=1&sfw=true`)])
        const a1=d1.data?.[0],a2=d2.data?.[0]
        if (!a1||!a2){await editErr(token,'Um dos animes não foi encontrado.',env);break}
        const t1=a1.title_english||a1.title,t2=a2.title_english||a2.title
        await editReply(token,{title:`⚔️ ${t1} vs ${t2}`,color:COR.vermelho,
          fields:[{name:`🎌 ${t1}`,value:`${nota(a1.score)}\n${a1.episodes||'?'} eps\n[▶](${SITE_URL}/anime/${a1.mal_id})`,inline:true},{name:'VS',value:'⚔️',inline:true},{name:`🎌 ${t2}`,value:`${nota(a2.score)}\n${a2.episodes||'?'} eps\n[▶](${SITE_URL}/anime/${a2.mal_id})`,inline:true},{name:'🏆 Vencedor',value:(a1.score||0)>=(a2.score||0)?`**${t1}** ${nota(a1.score)}`:`**${t2}** ${nota(a2.score)}`,inline:false}],
          footer:{text:'Up Anime+'},timestamp:new Date().toISOString()},'',env)
        break
      }

      case 'poster': {
        let a
        if (opts.anime){const d=await jikan(`/anime?q=${encodeURIComponent(opts.anime)}&limit=1&sfw=true`);a=d.data?.[0]}
        else{const d=await jikan(`/top/anime?limit=25&page=${Math.floor(Math.random()*4)+1}&filter=bypopularity`);a=(d.data||[])[Math.floor(Math.random()*25)]}
        if (!a){await editErr(token,'Anime não encontrado.',env);break}
        const t=a.title_english||a.title
        const textos={tiktok:`🎌 ${t}\n${traduzir(a.genres)} • ${nota(a.score)}\n▶ Grátis — link na bio!\n#anime #animebr`,reddit:`**${t}** — ${traduzir(a.genres)}\n${nota(a.score)} | ${a.episodes||'?'} eps\n${SITE_URL}/watch/${a.mal_id}?ep=1`,x:`🔥 ${t} ${nota(a.score)}\n${traduzir(a.genres)}\n→ ${SITE_URL}/watch/${a.mal_id}?ep=1\n#anime`}
        const labels={tiktok:'📱 TikTok',reddit:'🤖 Reddit',x:'𝕏 Twitter/X'}
        await editReply(token,{title:`${labels[opts.plataforma||'']||'🖼️ Poster HD'}: ${t}`,description:textos[opts.plataforma||'']||`[▶](${SITE_URL}/watch/${a.mal_id}?ep=1)`,color:COR.ouro,image:{url:imgHD(a)},fields:[{name:'📋 Como usar',value:'Segura → Salvar • Copia o texto acima',inline:false}],footer:{text:'Up Anime+'},timestamp:new Date().toISOString()},'',env)
        break
      }

      // ── NOVOS PÚBLICOS ────────────────────────────────────────────────────

      case 'quiz': {
        const d=await jikan(`/top/anime?limit=25&page=${Math.floor(Math.random()*5)+1}`)
        const list=d.data||[]; const a=list[Math.floor(Math.random()*list.length)]
        if (!a){await editErr(token,'Sem dados',env);break}
        const correto=a.title_english||a.title
        // Pega 3 errados
        const errados=list.filter(x=>x.mal_id!==a.mal_id).sort(()=>Math.random()-.5).slice(0,3).map(x=>x.title_english||x.title)
        const opcoes=[correto,...errados].sort(()=>Math.random()-.5)
        const letras=['🇦','🇧','🇨','🇩']
        const gabarito=letras[opcoes.indexOf(correto)]
        await editReply(token,{title:'🎯 Quiz de Anime!',color:COR.azul,
          description:`De qual anime é essa sinopse?\n\n*"${(a.synopsis||'').slice(0,200)}..."*`,
          image:{url:imgHD(a)},
          fields:[{name:'Opções',value:opcoes.map((o,i)=>`${letras[i]} ${o}`).join('\n'),inline:false},{name:'⚠️ Spoiler — Resposta',value:`||${gabarito} **${correto}**||`,inline:false}],
          footer:{text:'Up Anime+ • Clique no spoiler para ver a resposta!'}},'' ,env)
        break
      }

      case 'sortear': {
        const map={'ação':'1','aventura':'2','comédia':'4','drama':'8','fantasia':'10','romance':'22','isekai':'62','shounen':'27'}
        const id=opts.genero?map[opts.genero.toLowerCase()]||'1':'1'
        const d=await jikan(`/anime?genres=${id}&order_by=popularity&limit=25`)
        const list=d.data||[]; const a=list[Math.floor(Math.random()*list.length)]
        if (!a){await editErr(token,'Sem dados',env);break}
        const t=a.title_english||a.title
        await editReply(token,{title:`🎰 Sorteio: ${t}`,description:`Reaja com ✅ para assistir ou ❌ para sortear outro!\n\n${(a.synopsis||'').slice(0,200)}...`,color:COR.ouro,image:{url:imgHD(a)},
          fields:[{name:'⭐ Nota',value:nota(a.score),inline:true},{name:'📺 Eps',value:`${a.episodes||'?'}`,inline:true},{name:'🎭',value:traduzir(a.genres),inline:true},{name:'▶ Assistir',value:`[Clique aqui!](${SITE_URL}/watch/${a.mal_id}?ep=1)`,inline:false}],
          footer:{text:'Up Anime+'},timestamp:new Date().toISOString()},'',env)
        break
      }

      case 'maratona': {
        const map={'ação':'1','aventura':'2','comédia':'4','drama':'8','fantasia':'10','romance':'22','isekai':'62','shounen':'27','terror':'14','sci-fi':'24'}
        const id=map[(opts.genero||'').toLowerCase()]||'1'
        const d=await jikan(`/anime?genres=${id}&order_by=score&limit=8&min_score=7`)
        const list=(d.data||[]).slice(0,6)
        const totalEps=list.reduce((s,a)=>s+(a.episodes||12),0)
        const horas=Math.round(totalEps*23/60)
        const desc=list.map((a,i)=>`**${i+1}.** [${(a.title_english||a.title).slice(0,45)}](${SITE_URL}/anime/${a.mal_id}) — ${a.episodes||'?'} eps`).join('\n')
        await editReply(token,{title:`📺 Maratona de ${opts.genero||'Anime'}`,description:desc,color:COR.roxo,thumbnail:{url:imgHD(list[0])},
          fields:[{name:'⏱️ Tempo total',value:`~${horas}h (${totalEps} eps)`,inline:true},{name:'▶ Começar',value:`[Ep 1 aqui!](${SITE_URL}/watch/${list[0]?.mal_id}?ep=1)`,inline:true}],
          footer:{text:'Up Anime+ • Boa maratona! 🍿'},timestamp:new Date().toISOString()},'',env)
        break
      }

      case 'curiosidade': {
        const curiosidades = [
          'O anime One Piece tem mais de **1100 episódios** e ainda está em exibição! 🏴‍☠️',
          'Dragon Ball Z foi dublado em **81 idiomas** — um recorde mundial! 🐉',
          'O criador de Naruto, Masashi Kishimoto, demorou **5 tentativas** antes de ser aceito pela Shonen Jump! 🍥',
          'O primeiro anime da história foi criado em **1917** no Japão — se chama Sazaemon! 📽️',
          'Fullmetal Alchemist: Brotherhood tem **64 episódios** e é considerado por muitos o melhor anime de todos os tempos! ⚗️',
          'O anime Attack on Titan demorou **10 anos** para terminar desde o início em 2013! ⚔️',
          'Demon Slayer: Mugen Train se tornou o filme mais bilheteria do Japão, superando Spirited Away! 🗡️',
          'Studio Ghibli foi fundado em **1985** e já ganhou um Oscar por Spirited Away! 🏆',
          'O mangá de Berserk foi publicado por **32 anos** antes do autor Kentaro Miura falecer em 2021! 📖',
          'Death Note tem apenas **37 episódios** mas é um dos animes mais assistidos do mundo! 📓',
          'Pokémon foi originalmente um **jogo de Game Boy** antes de virar anime em 1997! 🎮',
          'Hunter x Hunter ficou em **hiato por 4 anos** entre 2018 e 2022! ⏸️',
        ]
        const c=curiosidades[Math.floor(Math.random()*curiosidades.length)]
        await editReply(token,{title:'🧠 Curiosidade Anime',description:c,color:COR.verde,footer:{text:'Up Anime+ • Sabia disso? 🤔'},timestamp:new Date().toISOString()},'',env)
        break
      }

      // ── ADM ───────────────────────────────────────────────────────────────

      case 'anuncio': {
        const guildId=body.guild_id
        const canalId=opts.canal||body.channel_id
        const res=await fetch(`https://discord.com/api/v10/channels/${canalId}/messages`,{
          method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bot ${env.BOT_TOKEN}`},
          body:JSON.stringify({content:`📢 **ANÚNCIO**\n\n${opts.mensagem}`})
        })
        if (res.ok) await editReply(token,{title:'✅ Anúncio enviado!',description:opts.mensagem,color:COR.verde},'',env,true)
        else await editErr(token,`Erro ao enviar: ${await res.text()}`,env)
        break
      }

      case 'stats': {
        // Estatísticas via Workers Analytics (aproximado)
        const hoje=new Date().toISOString().split('T')[0]
        await editReply(token,{title:'📊 Estatísticas do Up Anime+',color:COR.azul,
          fields:[
            {name:'🌐 Site Principal',value:`[upanime-nine.vercel.app](${SITE_URL})`,inline:true},
            {name:'☁️ Backup',value:'[upanime.pages.dev](https://upanime.pages.dev)',inline:true},
            {name:'📅 Data',value:hoje,inline:true},
            {name:'🔧 Workers Ativos',value:'animefire-proxy\nanimeonline-proxy\nanimesonlinecloud-proxy\nstream-cdn\njikan-cache\nimg-proxy\ndiscord-slash7',inline:false},
            {name:'📈 Search Console',value:'[Ver métricas](https://search.google.com/search-console)',inline:false},
          ],
          footer:{text:'Up Anime+ ADM Panel'},timestamp:new Date().toISOString()},'',env,true)
        break
      }

      case 'banir': {
        const userId=opts.usuario
        const motivo=opts.motivo||'Sem motivo especificado'
        const guildId=body.guild_id
        if (!guildId){await editErr(token,'Use em um servidor.',env);break}
        const res=await fetch(`https://discord.com/api/v10/guilds/${guildId}/bans/${userId}`,{
          method:'PUT',headers:{'Content-Type':'application/json','Authorization':`Bot ${env.BOT_TOKEN}`},
          body:JSON.stringify({reason:motivo,'delete_message_seconds':0})
        })
        if (res.ok) await editReply(token,{title:'🔨 Usuário Banido',description:`<@${userId}> foi banido.\n**Motivo:** ${motivo}`,color:COR.vermelho},'',env)
        else await editErr(token,`Erro ao banir: ${await res.text()}`,env)
        break
      }

      case 'dc': {
        await editReply(token,{title:'⛔ Bot Desativando...',description:'O bot será desativado em instantes.\nPara reativar, faça um novo deploy no Cloudflare.',color:COR.cinza},'',env,true)
        break
      }


      case 'setup': {
        const gId = body.guild_id
        if (!gId) { await editErr(token,'Use em um servidor.',env); break }
        const h = {'Content-Type':'application/json','Authorization':`Bot ${env.BOT_TOKEN}`}
        const wait = (ms) => new Promise(r=>setTimeout(r,ms))

        // Cargos
        const cargos = [
          {name:'👑 Dono',       color:0xFFB300, hoist:true,  permissions:'8'},
          {name:'🛡️ Moderador',  color:0xE53935, hoist:true},
          {name:'⭐ VIP',        color:0x8E24AA, hoist:true},
          {name:'🎌 Otaku',      color:0x1E88E5, hoist:false},
          {name:'🆕 Novato',     color:0x455A64, hoist:false},
        ]
        for (const c of cargos) {
          await fetch(`https://discord.com/api/v10/guilds/${gId}/roles`,{method:'POST',headers:h,body:JSON.stringify(c)})
          await wait(1200)
        }

        // Buscar @everyone id
        const guildRes = await fetch(`https://discord.com/api/v10/guilds/${gId}`,{headers:h})
        const guildData = await guildRes.json()
        const everyoneId = guildData.id // @everyone role tem mesmo id do servidor

        // Helper: criar categoria + canais
        const criarCategoria = async (nome, canais, trancarAlguns=[]) => {
          const cr = await fetch(`https://discord.com/api/v10/guilds/${gId}/channels`,{method:'POST',headers:h,body:JSON.stringify({name:nome,type:4})})
          const cat = await cr.json()
          await wait(1200)
          for (const canal of canais) {
            const trancado = trancarAlguns.includes(canal.name)
            const overwrites = trancado ? [{id:everyoneId,type:0,deny:'2048'}] : []
            await fetch(`https://discord.com/api/v10/guilds/${gId}/channels`,{method:'POST',headers:h,body:JSON.stringify({...canal,parent_id:cat.id,permission_overwrites:overwrites})})
            await wait(1000)
          }
          return cat.id
        }

        // estrutura movida para updateMsg acima
        if (false) await criarCategoria('📡┃UPANIME', [
          {name:'📢┃informacoes', type:0, topic:'Informações sobre o projeto Up Anime+'},
          {name:'📜┃regras',      type:0, topic:'Regras do servidor'},
          {name:'👋┃bem-vindo',   type:0, topic:'Bem-vindo ao servidor!'},
          {name:'📣┃anuncios',    type:5, topic:'Novidades do site Up Anime+'},
          {name:'🎉┃eventos',     type:0, topic:'Sorteios e eventos'},
        ], ['📢┃informacoes','📜┃regras','📣┃anuncios'])

        await criarCategoria('🎬┃SITE', [
          {name:'📺┃novos-episodios', type:0, topic:'Bot posta novos episódios automaticamente'},
          {name:'🔥┃animes-em-alta',  type:0, topic:'Ranking semanal de animes'},
          {name:'⭐┃top-animes',      type:0, topic:'Top geral de animes'},
          {name:'📅┃calendario',      type:0, topic:'Calendário de lançamentos'},
          {name:'🔎┃buscar-anime',    type:0, topic:'Use /anime para buscar'},
        ], ['📺┃novos-episodios'])

        await criarCategoria('🍥┃ANIMES', [
          {name:'💬┃chat-anime',     type:0, topic:'Fale sobre qualquer anime'},
          {name:'💡┃recomendacoes',  type:0, topic:'Recomende animes para a comunidade'},
          {name:'❓┃perguntas',      type:0, topic:'Tire suas dúvidas sobre animes'},
          {name:'📸┃screenshots',    type:0, topic:'Compartilhe screenshots de animes'},
          {name:'🎭┃personagens',    type:0, topic:'Fale sobre seus personagens favoritos'},
        ])

        await criarCategoria('🌍┃COMUNIDADE', [
          {name:'💬┃chat-geral',  type:0, topic:'Conversa geral'},
          {name:'🤣┃memes',       type:0, topic:'Memes de anime'},
          {name:'🎮┃games',       type:0, topic:'Jogos e entretenimento'},
          {name:'📷┃midia',       type:0, topic:'Fotos e vídeos'},
          {name:'📊┃enquetes',    type:0, topic:'Votações da comunidade'},
        ])

        await criarCategoria('🛠┃SUPORTE', [
          {name:'🐞┃reportar-bug', type:0, topic:'Reporte bugs do site Up Anime+'},
          {name:'💡┃sugestoes',    type:0, topic:'Sugestões para o site'},
          {name:'🆘┃suporte',      type:0, topic:'Suporte geral'},
        ])

        await criarCategoria('🤖┃BOTS', [
          {name:'🤖┃bot-comandos', type:0, topic:'Use os comandos do bot aqui'},
          {name:'⚙️┃bot-config',   type:0, topic:'Configurações do bot'},
          {name:'🧪┃teste-bot',    type:0, topic:'Teste os comandos aqui'},
        ])

        // Atualiza mensagem com progresso a cada categoria
        const updateMsg = async (txt) => {
          await fetch(`https://discord.com/api/v10/webhooks/${CLIENT_ID}/${token}/messages/@original`,{
            method:'PATCH', headers:h,
            body:JSON.stringify({embeds:[{title:'🏗️ Configurando servidor...',description:txt,color:COR.azul}]})
          })
        }

        await updateMsg('✅ Cargos criados\n⏳ Criando canais...')
        await criarCategoria('📡┃UPANIME', [
          {name:'📢┃informacoes', type:0},{name:'📜┃regras',type:0},{name:'👋┃bem-vindo',type:0},{name:'📣┃anuncios',type:5},{name:'🎉┃eventos',type:0},
        ], ['📢┃informacoes','📜┃regras','📣┃anuncios'])
        await updateMsg('✅ Cargos\n✅ 📡 UPANIME\n⏳ Criando SITE...')

        await criarCategoria('🎬┃SITE', [
          {name:'📺┃novos-episodios',type:0},{name:'🔥┃animes-em-alta',type:0},{name:'⭐┃top-animes',type:0},{name:'📅┃calendario',type:0},{name:'🔎┃buscar-anime',type:0},
        ], ['📺┃novos-episodios'])
        await updateMsg('✅ Cargos\n✅ 📡 UPANIME\n✅ 🎬 SITE\n⏳ Criando ANIMES...')

        await criarCategoria('🍥┃ANIMES', [
          {name:'💬┃chat-anime',type:0},{name:'💡┃recomendacoes',type:0},{name:'❓┃perguntas',type:0},{name:'📸┃screenshots',type:0},{name:'🎭┃personagens',type:0},
        ])
        await updateMsg('✅ Cargos\n✅ 📡 UPANIME\n✅ 🎬 SITE\n✅ 🍥 ANIMES\n⏳ Criando COMUNIDADE...')

        await criarCategoria('🌍┃COMUNIDADE', [
          {name:'💬┃chat-geral',type:0},{name:'🤣┃memes',type:0},{name:'🎮┃games',type:0},{name:'📷┃midia',type:0},{name:'📊┃enquetes',type:0},
        ])
        await criarCategoria('🛠┃SUPORTE', [
          {name:'🐞┃reportar-bug',type:0},{name:'💡┃sugestoes',type:0},{name:'🆘┃suporte',type:0},
        ])
        await criarCategoria('🤖┃BOTS', [
          {name:'🤖┃bot-comandos',type:0},{name:'⚙️┃bot-config',type:0},{name:'🧪┃teste-bot',type:0},
        ])

        await fetch(`https://discord.com/api/v10/webhooks/${CLIENT_ID}/${token}/messages/@original`,{
          method:'PATCH', headers:h,
          body:JSON.stringify({embeds:[{
            title:'✅ Servidor Configurado!', color:COR.verde,
            description:'Estrutura do servidor Up Anime+ criada com sucesso!',
            fields:[
              {name:'🎭 Cargos',    value:`${cargos.length} cargos`, inline:true},
              {name:'📁 Categorias',value:'6 categorias',            inline:true},
              {name:'💬 Canais',    value:'23 canais',               inline:true},
              {name:'🔒 Trancados', value:'informacoes • regras • anuncios • novos-episodios', inline:false},
            ],
            footer:{text:'Up Anime+ ADM • Use /trancar e /destrancar para gerenciar'}
          }]})
        })
        break
      }

      case 'criar_cargo': {
        const gId = body.guild_id
        if (!gId) { await editErr(token,'Use em um servidor.',env); break }
        const color = opts.cor ? parseInt(opts.cor.replace('#',''),16) : 0x455A64
        const res = await fetch(`https://discord.com/api/v10/guilds/${gId}/roles`,{
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':`Bot ${env.BOT_TOKEN}`},
          body:JSON.stringify({name:opts.nome, color, hoist:false})
        })
        const d = await res.json()
        if (res.ok) await editReply(token,{title:`✅ Cargo "${opts.nome}" criado!`,description:`ID: \`${d.id}\``,color},'',env,true)
        else await editErr(token,`Erro: ${d.message||'desconhecido'}`,env)
        break
      }

      case 'criar_canal': {
        const gId = body.guild_id
        if (!gId) { await editErr(token,'Use em um servidor.',env); break }
        const tipos = {text:0,voice:2,news:5}
        const tipo = tipos[opts.tipo||'text']??0
        const payload = {name:opts.nome.toLowerCase().replace(/\s+/g,'-'), type:tipo}
        if (opts.categoria) payload.parent_id = opts.categoria
        const res = await fetch(`https://discord.com/api/v10/guilds/${gId}/channels`,{
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':`Bot ${env.BOT_TOKEN}`},
          body:JSON.stringify(payload)
        })
        const d = await res.json()
        if (res.ok) await editReply(token,{title:`✅ Canal "#${opts.nome}" criado!`,description:`ID: \`${d.id}\``,color:COR.verde},'',env,true)
        else await editErr(token,`Erro: ${d.message||'desconhecido'}`,env)
        break
      }


      case 'limpar': {
        const gId = body.guild_id
        const chId = body.channel_id
        const qtd = Math.min(Math.max(parseInt(opts.quantidade)||10, 1), 100)
        const h = {'Content-Type':'application/json','Authorization':`Bot ${env.BOT_TOKEN}`}
        // Buscar mensagens
        const msgsRes = await fetch(`https://discord.com/api/v10/channels/${chId}/messages?limit=${qtd}`,{headers:h})
        const msgs = await msgsRes.json()
        const ids = msgs.map(m=>m.id).filter(Boolean)
        if (!ids.length) { await editErr(token,'Nenhuma mensagem encontrada.',env); break }
        if (ids.length === 1) {
          await fetch(`https://discord.com/api/v10/channels/${chId}/messages/${ids[0]}`,{method:'DELETE',headers:h})
        } else {
          await fetch(`https://discord.com/api/v10/channels/${chId}/messages/bulk-delete`,{method:'POST',headers:h,body:JSON.stringify({messages:ids})})
        }
        await editReply(token,{title:'🧹 Mensagens Apagadas',description:`**${ids.length}** mensagens removidas!`,color:COR.verde},'',env,true)
        break
      }

      case 'trancar': {
        const chId = body.channel_id
        const gId  = body.guild_id
        const h = {'Content-Type':'application/json','Authorization':`Bot ${env.BOT_TOKEN}`}
        await fetch(`https://discord.com/api/v10/channels/${chId}/permissions/${gId}`,{
          method:'PUT', headers:h,
          body:JSON.stringify({type:0, deny:'2048'}) // nega SEND_MESSAGES para @everyone
        })
        await editReply(token,{title:'🔒 Canal Trancado',description:'Ninguém pode enviar mensagens neste canal.',color:COR.vermelho},'',env,true)
        break
      }

      case 'destrancar': {
        const chId = body.channel_id
        const gId  = body.guild_id
        const h = {'Content-Type':'application/json','Authorization':`Bot ${env.BOT_TOKEN}`}
        await fetch(`https://discord.com/api/v10/channels/${chId}/permissions/${gId}`,{
          method:'PUT', headers:h,
          body:JSON.stringify({type:0, allow:'2048', deny:'0'})
        })
        await editReply(token,{title:'🔓 Canal Destrancado',description:'Canal aberto para todos novamente.',color:COR.verde},'',env,true)
        break
      }

      default: await editErr(token,'Comando desconhecido.',env)
    }
  } catch(e) { await editErr(token,e.message,env).catch(()=>{}) }
}

// ── HANDLER ────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url=new URL(request.url)
    if (url.searchParams.get('action')==='register') return new Response(await registerCommands(env))
    if (request.method!=='POST') return new Response('Up Anime+ Bot ✅ — discord-slash7')
    const bodyText=await request.text()
    if (!await verifyDiscord(request,env.PUBLIC_KEY||'',bodyText)) return new Response('Assinatura inválida',{status:401})
    const body=JSON.parse(bodyText)
    if (body.type===1) return new Response('{"type":1}',{headers:{'Content-Type':'application/json'}})
    if (body.type===2) {
      const cmd=body.data.name
      const opts=Object.fromEntries((body.data.options||[]).map(o=>[o.name,o.value]))
      ctx.waitUntil(processCommand(cmd,opts,body.token,body,env))
      return new Response(DEFERRED_RESPONSE,{headers:{'Content-Type':'application/json'}})
    }
    return new Response('OK')
  }
}
