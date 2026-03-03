import { useParams, Link } from 'react-router-dom'

const TERMS = {
  title: 'Termos de Uso',
  sections: [
    {
      heading: '1. Aceitação dos Termos',
      text: 'Ao acessar e usar o Up Anime+, você concorda com estes Termos de Uso. Se não concordar, por favor, não utilize o site.'
    },
    {
      heading: '2. Sobre o Serviço',
      text: 'O Up Anime+ é uma plataforma de descoberta e streaming de animes que utiliza APIs públicas (MyAnimeList / Jikan) e fontes de terceiros para exibição de conteúdo. Não hospedamos, armazenamos nem distribuímos arquivos de vídeo próprios.'
    },
    {
      heading: '3. Uso Permitido',
      text: 'O serviço é destinado exclusivamente para uso pessoal e não comercial. É proibido reproduzir, redistribuir, vender ou explorar comercialmente qualquer conteúdo do site sem autorização prévia.'
    },
    {
      heading: '4. Conteúdo de Terceiros',
      text: 'Os vídeos exibidos são fornecidos por serviços externos. O Up Anime+ não se responsabiliza pela disponibilidade, qualidade ou legalidade desse conteúdo. Os direitos autorais pertencem aos respectivos detentores.'
    },
    {
      heading: '5. Disponibilidade',
      text: 'Não garantimos disponibilidade contínua do serviço. Podemos suspender, alterar ou encerrar funcionalidades a qualquer momento sem aviso prévio.'
    },
    {
      heading: '6. Limitação de Responsabilidade',
      text: 'O Up Anime+ não se responsabiliza por danos diretos ou indiretos decorrentes do uso ou impossibilidade de uso do serviço.'
    },
    {
      heading: '7. Alterações',
      text: 'Estes termos podem ser atualizados a qualquer momento. O uso continuado do site após mudanças implica aceitação dos novos termos.'
    },
    {
      heading: '8. Contato',
      text: 'Dúvidas sobre estes termos podem ser enviadas pelo GitHub do projeto.'
    },
  ]
}

const PRIVACY = {
  title: 'Política de Privacidade',
  sections: [
    {
      heading: '1. Dados Coletados',
      text: 'O Up Anime+ não coleta dados pessoais identificáveis como nome, e-mail ou CPF. Não é necessário criar conta para usar o serviço.'
    },
    {
      heading: '2. Dados de Navegação',
      text: 'Podemos coletar de forma anônima dados de navegação (páginas visitadas, tempo de acesso) por meio de serviços de analytics como Vercel Analytics, com finalidade exclusiva de melhoria do serviço.'
    },
    {
      heading: '3. Armazenamento Local',
      text: 'O site pode usar o armazenamento local do seu navegador (localStorage / sessionStorage) para salvar preferências como qualidade de vídeo e histórico de navegação. Esses dados ficam apenas no seu dispositivo.'
    },
    {
      heading: '4. Cookies',
      text: 'Podemos utilizar cookies técnicos essenciais para o funcionamento do site. Não utilizamos cookies de rastreamento publicitário.'
    },
    {
      heading: '5. Serviços de Terceiros',
      text: 'O site utiliza APIs externas (Jikan/MyAnimeList, AnimeFire) que possuem suas próprias políticas de privacidade. Recomendamos a leitura dessas políticas.'
    },
    {
      heading: '6. Segurança',
      text: 'Adotamos medidas técnicas razoáveis para proteger os dados de navegação, mas nenhum sistema é 100% seguro.'
    },
    {
      heading: '7. Menores de Idade',
      text: 'O serviço não é direcionado a menores de 13 anos. Não coletamos intencionalmente dados de crianças.'
    },
    {
      heading: '8. Seus Direitos',
      text: 'Como não coletamos dados pessoais, não há dados para acessar, corrigir ou excluir. Dúvidas podem ser enviadas pelo GitHub do projeto.'
    },
    {
      heading: '9. Alterações',
      text: 'Esta política pode ser atualizada a qualquer momento. Recomendamos revisá-la periodicamente.'
    },
  ]
}

export default function LegalPage() {
  const { type } = useParams()
  const doc = type === 'privacidade' ? PRIVACY : TERMS

  return (
    <div style={{ minHeight: '100vh', paddingTop: 80, paddingBottom: 60 }}>
      <div className="container" style={{ maxWidth: 800, margin: '0 auto', padding: '0 20px' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 36, marginTop: 24 }}>
          <Link
            to="/termos"
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 14,
              background: type !== 'privacidade' ? '#e53935' : 'rgba(255,255,255,0.07)',
              color: '#fff',
              border: '1px solid',
              borderColor: type !== 'privacidade' ? '#e53935' : 'rgba(255,255,255,0.12)',
            }}
          >
            Termos de Uso
          </Link>
          <Link
            to="/privacidade"
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 14,
              background: type === 'privacidade' ? '#e53935' : 'rgba(255,255,255,0.07)',
              color: '#fff',
              border: '1px solid',
              borderColor: type === 'privacidade' ? '#e53935' : 'rgba(255,255,255,0.12)',
            }}
          >
            Privacidade
          </Link>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{doc.title}</h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 36 }}>
          Última atualização: março de 2026
        </p>

        {doc.sections.map((s, i) => (
          <div key={i} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#fff' }}>
              {s.heading}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, fontSize: 14 }}>
              {s.text}
            </p>
          </div>
        ))}

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Link to="/" style={{ color: '#e53935', textDecoration: 'none', fontSize: 14 }}>
            ← Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  )
}
