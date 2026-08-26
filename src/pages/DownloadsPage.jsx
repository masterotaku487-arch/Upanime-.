import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FiDownload, FiTrash2, FiPlay } from 'react-icons/fi'
import { getDownloads, removeDownload, clearDownloads } from '../services/downloads'
import './DownloadsPage.css'

function timeAgo(ts) {
  const diff = Date.now() - ts
  const min  = Math.floor(diff / 60000)
  if (min < 1)   return 'agora mesmo'
  if (min < 60)  return `Há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24)    return `Há ${h}h`
  const d = Math.floor(h / 24)
  if (d === 1)   return 'Ontem'
  if (d < 7)     return `${d} dias atrás`
  return new Date(ts).toLocaleDateString('pt-BR')
}

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState([])

  useEffect(() => { setDownloads(getDownloads()) }, [])

  const handleRemove = (id) => {
    removeDownload(id)
    setDownloads(getDownloads())
  }

  const handleClear = () => {
    if (!confirm('Limpar todo o histórico de downloads? Isso não apaga os arquivos já baixados no seu aparelho, só a lista aqui.')) return
    clearDownloads()
    setDownloads([])
  }

  return (
    <div className="downloads-page">
      <div className="list-top">
        <div className="list-title">Downloads</div>
        <div className="list-sub">
          {downloads.length > 0 ? `${downloads.length} episódio${downloads.length > 1 ? 's' : ''} baixado${downloads.length > 1 ? 's' : ''}` : 'Nenhum download ainda'}
        </div>
      </div>

      {downloads.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><FiDownload /></div>
          <div className="empty-title">Nenhum download ainda</div>
          <p className="empty-text">
            Toque em "Baixar" na tela de um episódio pra salvar no seu
            aparelho. Ele aparece aqui depois.
          </p>
        </div>
      ) : (
        <>
          <div className="dl-note">
            Os arquivos vão pra pasta de <b>Downloads</b> do seu aparelho
            (definida pelo navegador/sistema) — aqui é só o seu histórico.
          </div>

          <div className="dl-list">
            {downloads.map(d => (
              <div key={d.id} className="dl-row">
                <Link to={`/watch/${d.animeId}?ep=${d.ep}`} className="dl-thumb">
                  {d.image
                    ? <img src={d.image} alt="" loading="lazy" />
                    : <div className="dl-no-img"><FiPlay /></div>
                  }
                  <div className="dl-playmini"><FiPlay /></div>
                </Link>
                <div className="dl-info">
                  <Link to={`/watch/${d.animeId}?ep=${d.ep}`} className="dl-name">
                    {d.title} — EP {d.ep}
                  </Link>
                  <div className="dl-meta">
                    <span>{d.filename}</span>
                    <span>{timeAgo(d.time)}</span>
                  </div>
                </div>
                <button className="dl-remove" onClick={() => handleRemove(d.id)} title="Remover do histórico">
                  <FiTrash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          <button className="dl-clear" onClick={handleClear}>
            Limpar histórico de downloads
          </button>
        </>
      )}
    </div>
  )
}
