// Tradução PT-BR de gêneros e status vindos da API (nomes em inglês)

export const GENRE_LABELS = {
  'Action':'Ação','Adventure':'Aventura','Comedy':'Comédia','Drama':'Drama',
  'Fantasy':'Fantasia','Horror':'Terror','Mystery':'Mistério','Romance':'Romance',
  'Sci-Fi':'Sci-Fi','Slice of Life':'Slice of Life','Sports':'Esportes',
  'Supernatural':'Sobrenatural','Thriller':'Suspense','Mecha':'Mecha',
  'Music':'Musical','Psychological':'Psicológico','Ecchi':'Ecchi','Isekai':'Isekai',
  'Shounen':'Shounen','Shoujo':'Shoujo','Seinen':'Seinen','Josei':'Josei',
  'Historical':'Histórico','Military':'Militar','Harem':'Harem',
  'School':'Vida Escolar','Magic':'Magia','Demons':'Demônios','Vampire':'Vampiro',
  'Samurai':'Samurai','Space':'Espaço','Game':'Jogos','Video Game':'Jogos','Cars':'Carros',
  'Parody':'Paródia','Martial Arts':'Artes Marciais','Super Power':'Super Poderes',
  'Kids':'Infantil','Girls Love':'Girls Love','Boys Love':'Boys Love',
  'Avant Garde':'Avant Garde','Award Winning':'Premiado','Gourmet':'Gastronomia',
  'Suspense':'Suspense','Gore':'Gore','Erotica':'Adulto',
}

export const translateGenre = (name) => GENRE_LABELS[name] || name

export const STATUS_LABELS = {
  'Currently Airing': 'Em Exibição',
  'Finished Airing': 'Completo',
  'Not yet aired': 'Em Breve',
  'Cancelled': 'Cancelado',
  'On Hiatus': 'Em Hiato',
}

export const translateStatus = (status) => STATUS_LABELS[status] || status
