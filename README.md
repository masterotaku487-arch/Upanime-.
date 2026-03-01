# 🔥 Up Anime+

Site de streaming de animes gratuito, construído com React + Vite.

## ✨ Funcionalidades

- 🏠 **Home** com hero animado e seções de destaque
- 🔍 **Busca** de animes
- 📺 **Player de vídeo** integrado (via Consumet API)
- 📋 **Detalhe** do anime com sinopse, episódios e estatísticas
- 🎭 **Gêneros** de animes
- 📱 **Responsivo** para mobile e desktop

## 🚀 APIs Utilizadas

| API | Uso | Chave necessária |
|-----|-----|-----------------|
| [Jikan API](https://jikan.moe) | Dados dos animes (MyAnimeList) | ❌ Não |
| [Consumet API](https://github.com/consumet/api.consumet.org) | Streaming de vídeo (GogoAnime) | ❌ Não (self-hosted) |

---

## 📦 Instalação local

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/up-anime-plus.git
cd up-anime-plus

# Instale as dependências
npm install

# Configure o .env
cp .env.example .env
# Edite o .env com sua URL do Consumet

# Rode em desenvolvimento
npm run dev
```

---

## ☁️ Deploy

### Opção 1 — Tudo no Vercel (mais simples)

1. Suba para o GitHub
2. Acesse [vercel.com](https://vercel.com) → **New Project**
3. Importe seu repositório
4. Em **Environment Variables**, adicione:
   - `VITE_CONSUMET_URL` = URL da sua Consumet API (veja abaixo)
5. Clique em **Deploy** ✅

---

### Opção 2 — Frontend no Vercel + Consumet no Render

#### Passo 1: Deploy da Consumet API no Render

1. Faça fork de: https://github.com/consumet/api.consumet.org
2. Acesse [render.com](https://render.com) → **New Web Service**
3. Conecte seu fork
4. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance:** Free
5. Copie a URL gerada (ex: `https://consumet-api-xxxx.onrender.com`)

#### Passo 2: Deploy do Frontend no Vercel

1. Suba este projeto para GitHub
2. No Vercel, importe o repo
3. Em **Environment Variables**:
   - `VITE_CONSUMET_URL` = URL da Consumet do Render
4. Deploy ✅

---

## 📁 Estrutura

```
up-anime-plus/
├── public/
│   └── logo.png          ← Seu logo aqui
├── src/
│   ├── components/       ← Navbar, Hero, AnimeCard, Footer
│   ├── pages/            ← Home, AnimePage, WatchPage, SearchPage...
│   ├── services/
│   │   └── api.js        ← Jikan + Consumet API
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── .env.example
├── vercel.json
└── package.json
```

---

## 🛠️ Tech Stack

- **React 18** + React Router 6
- **Vite** (build tool)
- **Jikan API** (dados gratuitos do MyAnimeList)
- **Consumet API** (streaming via GogoAnime)
- **CSS puro** (sem framework CSS — design custom)

---

## ⚠️ Notas

- A Jikan API tem rate limit de **3 requisições/segundo**
- O streaming via Consumet depende de fontes externas e pode variar
- O plano gratuito do Render hiberna após inatividade — primeira requisição pode demorar ~30s

---

Feito com ❤️ e 🔥
