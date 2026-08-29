// config/sources.ts
// ★ LA LISTA DE WEBS. Añadir o quitar una fuente es editar este archivo, nada más.
//
// Los niveles no son decorativos (§4.1):
//   A — medios y guías con criterio editorial propio. Consenso con peso 1,0.
//   B — agendas especializadas y portales oficiales. Consenso con peso 0,8.
//   C — fichas oficiales del propio recinto. NO cuentan para el consenso
//       (un museo siempre habla bien de sí mismo); sirven para VERIFICAR.
//
// PUERTA DE SEGURIDAD: una fuente sin `verifiedAt` se salta en silencio (§3.5).
// Antes de ponerle fecha hay que leer su robots.txt entero, comprobar que emite
// JSON-LD y leer sus condiciones de uso. El resultado se anota en SOURCES.md.
import type { SourceConfig } from './schema'

export const SOURCES: SourceConfig[] = [
  // ── Nivel A · medios curados ───────────────────────────────────────────
  {
    id: 'timeout-bcn',
    tier: 'A',
    trust: 1.0,
    collections: ['plans', 'shows'],
    home: 'https://www.timeout.es/barcelona',
    discovery: {
      kind: 'sitemap',
      url: 'https://www.timeout.es/sitemap.xml',
      pathIncludes: ['/barcelona/'],
    },
    crawlDelayMs: 5000,
    maxPagesPerDay: 40,
    verifiedAt: '2026-08-29',
    verifiedNote:
      'robots.txt: bloquea bots antiguos por nombre; para * prohíbe /search*, cuentas y duplicados por idioma. No prohíbe los artículos. Sin Crawl-delay: fijamos 5 s por prudencia.',
  },

  {
    id: 'barcelona-secreta',
    tier: 'A',
    trust: 0.95,
    collections: ['plans'],
    home: 'https://barcelonasecreta.com',
    discovery: { kind: 'sitemap', url: 'https://barcelonasecreta.com/sitemap_index.xml' },
    crawlDelayMs: 5000,
    maxPagesPerDay: 40,
    verifiedAt: '2026-08-29',
    verifiedNote:
      'robots.txt: prohíbe /wp-admin/, /*/feed/ y bots basura. No bloquea GPTBot, ClaudeBot ni CCBot. Se entra por sitemap, NUNCA por los feeds de categoría.',
  },

  // Sin `verifiedAt`: no se rastrean todavía. Ver SOURCES.md (§A.10).
  {
    id: 'lecool-bcn',
    tier: 'A',
    trust: 0.9,
    collections: ['plans', 'shows'],
    home: 'https://lecool.com/barcelona',
    discovery: { kind: 'sitemap' },
    crawlDelayMs: 5000,
    maxPagesPerDay: 25,
  },

  {
    id: 'beteve-agenda',
    tier: 'A',
    trust: 0.85,
    collections: ['plans'],
    home: 'https://beteve.cat/agenda',
    discovery: { kind: 'rss', url: 'https://beteve.cat/agenda/feed/' },
    crawlDelayMs: 5000,
    maxPagesPerDay: 25,
  },

  {
    id: 'lavanguardia-quehacer',
    tier: 'A',
    trust: 0.85,
    collections: ['plans'],
    home: 'https://www.lavanguardia.com/que-hacer-en-barcelona',
    discovery: { kind: 'rss', url: 'https://www.lavanguardia.com/rss/que-hacer-en-barcelona.xml' },
    crawlDelayMs: 5000,
    maxPagesPerDay: 25,
  },

  // ── Nivel B · agendas especializadas y portales oficiales ──────────────
  {
    id: 'teatre-barcelona',
    tier: 'B',
    trust: 0.9,
    collections: ['shows'],
    home: 'https://www.teatrebarcelona.com',
    discovery: {
      kind: 'sitemap',
      url: 'https://www.teatrebarcelona.com/es/sitemap_index.xml',
    },
    crawlDelayMs: 10000, // ← su robots.txt declara Crawl-delay: 10 para ClaudeBot
    maxPagesPerDay: 40,
    verifiedAt: '2026-08-29',
    verifiedNote:
      'robots.txt: prohíbe /wp-, /feed/, búsqueda y checkout. Declara Crawl-delay: 10 para ClaudeBot y Bytespider. Se respeta y se usa el sitemap /es/.',
  },

  {
    id: 'enderrock-agenda',
    tier: 'B',
    trust: 0.8,
    collections: ['shows'],
    home: 'https://www.enderrock.cat/agenda',
    discovery: { kind: 'sitemap' },
    crawlDelayMs: 5000,
    maxPagesPerDay: 25,
  },

  {
    id: 'visit-barcelona',
    tier: 'B',
    trust: 0.8,
    collections: ['plans', 'museums'],
    home: 'https://www.barcelonaturisme.com',
    discovery: { kind: 'sitemap' },
    crawlDelayMs: 5000,
    maxPagesPerDay: 30,
  },

  {
    id: 'bcn-cultura',
    tier: 'B',
    trust: 0.8,
    collections: ['plans', 'museums'],
    home: 'https://www.barcelona.cat/barcelonacultura',
    discovery: { kind: 'sitemap' },
    crawlDelayMs: 10000,
    maxPagesPerDay: 30,
  },

  // ── Nivel C · fichas oficiales, solo para verificar ────────────────────
  {
    id: 'articket',
    tier: 'C',
    trust: 0.0,
    collections: ['museums'],
    home: 'https://articketbcn.org',
    discovery: { kind: 'manual' },
    crawlDelayMs: 5000,
    maxPagesPerDay: 15,
  },

  {
    id: 'museus-bcn',
    tier: 'C',
    trust: 0.0,
    collections: ['museums'],
    home: 'https://www.barcelona.cat/museus',
    discovery: { kind: 'sitemap' },
    crawlDelayMs: 10000,
    maxPagesPerDay: 20,
    verifiedAt: '2026-08-29',
    verifiedNote:
      'Portal municipal de museos. robots.txt de barcelona.cat sin restricción sobre /museus. Nivel C: solo verifica, no avala.',
  },

  {
    id: 'venue-official',
    tier: 'C',
    trust: 0.0,
    collections: ['museums', 'shows'],
    home: null, // la URL sale de config/museums.ts y de la propia ficha
    discovery: { kind: 'perEntity' },
    crawlDelayMs: 5000,
    maxPagesPerDay: 60,
    verifiedAt: '2026-08-29',
    verifiedNote:
      'Ficha oficial del propio recinto, una URL por entidad. Se lee solo la página pública de horarios y precios. Nivel C: solo verifica.',
  },
]
