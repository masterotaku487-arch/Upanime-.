// Componente para usar na Home.jsx
// Import: import FanDubsHomeSection from '../components/FanDubsHomeSection'
// Uso: <FanDubsHomeSection />

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API = 'https://studio-proxy.masterotaku487.workers.dev'

export default function FanDubsHomeSection() {
  const nav = useNavigate()
  const [fanDubs, setFanDubs] = useState([])

  useEffect(() => {
    fetch(`${API}/api/fanDubs`)
      .then(r => r.json())
      .then(d => setFanDubs((d.fanDubs || []).slice(0, 10)))
      .catch(() => {})
  }, [])

  if (!fanDubs.length) return null

  return (
    <section style={{padding:'20px 0 8px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px',marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',gap:8,fontFamily:"var(--font-cond,'Barlow Condensed',sans-serif)",fontSize:'1.15rem',fontWeight:900}}>
          <span style={{width:4,height:18,background:'var(--accent,#E53935)',borderRadius:2,display:'block'}} />
          🎙️ Fan-Dubs da Comunidade
        </div>
        <span style={{fontSize:'.78rem',fontWeight:700,color:'var(--accent,#E53935)',cursor:'pointer'}}
          onClick={() => nav('/fandubs')}>
          Ver tudo ›
        </span>
      </div>
      <div style={{display:'flex',gap:10,padding:'0 16px',overflowX:'auto',scrollbarWidth:'none',paddingBottom:4}}>
        {fanDubs.map(d => (
          <div key={d.id} style={{flexShrink:0,width:130,cursor:'pointer',position:'relative',borderRadius:12,overflow:'hidden',background:'#111'}}
            onClick={() => nav(`/fandub/${d.id}`)}>
            <img src={d.capa||d.animeCapa} alt={d.titulo}
              style={{width:130,height:185,objectFit:'cover',display:'block'}}
              onError={e=>{e.target.src='https://via.placeholder.com/130x185/111/E53935?text=DUB'}} />
            <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,.92) 0%,transparent 50%)'}} />
            <div style={{position:'absolute',top:7,left:7,background:'#E53935',color:'#fff',fontSize:'.58rem',fontWeight:900,padding:'2px 6px',borderRadius:4}}>🇧🇷 DUB</div>
            {d.genero && <div style={{position:'absolute',top:7,right:7,background:'rgba(0,0,0,.7)',color:'#fff',fontSize:'.58rem',fontWeight:700,padding:'2px 6px',borderRadius:4,border:'1px solid rgba(255,255,255,.15)'}}>{d.genero}</div>}
            <div style={{position:'absolute',bottom:0,left:0,right:0,padding:8}}>
              <div style={{fontSize:'.72rem',fontWeight:700,lineHeight:1.2,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{d.animeTitulo}</div>
              <div style={{fontSize:'.62rem',color:'rgba(255,255,255,.55)',marginTop:2}}>{d.studioNome}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
