# bcn-curator — Plan de construcción

> **Este documento es autosuficiente.** Todo lo necesario está dentro: no hay que pedir nada, ni
> clonar nada, ni abrir ningún otro archivo. Se construye en un **repositorio nuevo, vacío y
> propio**.
>
> **Fecha:** 29 de agosto de 2026 · **Versión del plan:** 1.4

---

## 0 · Empieza aquí

Lee este apartado entero antes que nada. Son cinco minutos y evita el único malentendido grave
que puede tener este documento: creer que hay que trabajar dentro de otro proyecto.

### 0.1 Qué vas a construir

**Un producto de datos que se ejecuta solo cada día, sin servidor y casi sin coste.**

Rastrea una docena de webs de planes de Barcelona. Detecta que un mismo plan aparece en varias y
lo agrupa. Puntúa cada candidato combinando en cuántas fuentes buenas sale con un juicio
editorial hecho por un modelo de lenguaje. De los pocos que sobreviven —un par al día—
escribe una ficha **nueva y original en español e inglés**, con precio verificado, horarios,
duración, cómo llegar en metro y si hay que reservar. Tú apruebas o vetas. Y publica el resultado
en tres archivos JSON en una URL pública.

```text
   12 webs          agrupar y          puntuar y          reescribir         3 archivos JSON
   de Barcelona ──▶ deduplicar  ──▶    seleccionar  ──▶   en ES y EN   ──▶   en una URL pública
                    (sin IA)           (IA barata)        (IA buena)         (GitHub Pages)
```

**El entregable son tres archivos JSON bien hechos, servidos en una URL.** Se llaman
`plans.json`, `shows.json` y `museums.json`. Si al final del proyecto esos tres archivos existen,
están bien escritos y se actualizan solos, has terminado.

### 0.2 Qué NO vas a construir

Esto importa tanto como lo anterior, porque ahorra semanas:

| No construyes | Por qué |
|---|---|
| Ninguna interfaz de usuario, web o app | El entregable es JSON. Pintarlo es trabajo de otro |
| Ninguna base de datos | El estado vive en archivos, dentro de tu propio repositorio |
| Ningún servidor ni API | GitHub Pages sirve archivos estáticos, gratis |
| Ningún panel de administración | La revisión editorial es aprobar un Pull Request |
| Ningún sistema de usuarios, login ni pagos | No hay usuarios. Hay un JSON público |
| **Absolutamente nada dentro de planonmap** | No tienes acceso a ese repositorio y **no lo necesitas**. Ver §0.4 |

### 0.3 Qué es «planonmap» y por qué se nombra tanto

planonmap es una web que muestra la agenda de actividades de Barcelona en un mapa. **No es tu
proyecto. No vas a tocarlo. No necesitas su código.**

Es, sencillamente, **el cliente que consume tus tres JSON**. Aparece con frecuencia en este
documento por una razón práctica: es quien **fija el formato de salida**. Igual que si te
encargaran emitir facturas en un formato concreto, el encargo hablaría de ese formato en cada
página — no porque tengas que construir la contabilidad del cliente, sino porque lo que entregas
tiene que encajar.

De todo planonmap, **solo necesitas cinco cosas**, y las cinco están escritas aquí dentro:

| Lo que de verdad necesitas | Dónde está |
|---|---|
| El esquema exacto de una ficha, en código pegable | **Anexo A.1** |
| Los diez nombres de categoría válidos | §1.6 |
| Cómo se expresa un precio (no es un número) | §1.7 |
| El algoritmo con el que se decide si dos planes son el mismo | §1.9 |
| Dónde van los textos en español e inglés | §1.13 |

Todo lo demás que se cuenta de planonmap —su framework, su base de datos, su panel, su caché, su
mapa— es **contexto para que entiendas por qué el formato es como es**. Ayuda, pero si te lo
saltas no te bloquea nada.

### 0.4 La frontera: qué es tuyo y qué no

```text
        TU REPOSITORIO  (bcn-curator)     │   REPOSITORIO DE PLANONMAP
        lo construyes tú, desde cero      │   ya existe · no tienes acceso · no lo tocas
   ─────────────────────────────────────  │  ─────────────────────────────────────────
        config/    sources.ts, museums.ts │   types/event.ts
        contracts/ event.ts, curated.ts   │   lib/sources/aggregate.ts
        src/       crawl, screen, enrich  │   lib/domain/…
        content/   las fichas escritas    │   scripts/fetch-events.ts
        .cache/    lo regenerable         │   app/…  (la web)
        dist/      los 3 JSON publicados  │
   ─────────────────────────────────────  │  ─────────────────────────────────────────
                      │                   │                    ▲
                      └───────────────────┼────────────────────┘
                        publicas una URL  │  alguien, algún día, la conecta.
                        y ahí acaba tu    │  Ese trabajo NO es tuyo.
                        responsabilidad   │
```

**Regla infalible para orientarte en cualquier página de este documento:** si un apartado
menciona rutas que empiezan por `types/`, `lib/`, `app/` o `scripts/fetch-events.ts`, está
describiendo **el otro lado** y es informativo. Lo tuyo siempre empieza por `config/`,
`contracts/`, `src/`, `content/`, `.cache/`, `evals/` o `.github/`.

Solo hay **un apartado entero** dedicado al otro lado, el §9.3, y lleva su propio aviso. Está ahí
para que sepas qué pasa con lo que publicas, no para que lo hagas.

### 0.5 De cero a publicar, en siete pasos

La ruta corta. Cada paso está detallado más adelante.

1. Crea un repositorio **público** y vacío. Público no es un detalle: es lo que hace que GitHub
   Actions y Pages sean gratis de verdad (§3.1).
2. Copia del **Anexo A** el `package.json`, el `tsconfig.json`, los `contracts/*.ts` y los
   workflows. Están escritos enteros y listos para pegar.
3. Escribe a mano **cinco fichas de museo** y publícalas. Sin IA, sin rastreo. Es la Fase 0, y
   sirve para comprobar que el formato es correcto antes de invertir en nada más (§13).
4. Añade el rastreo determinista: sitemaps, extracción de datos, horarios y precios. Todavía sin
   IA (§4).
5. Conecta el redactor y genera el catálogo de museos completo. Aquí gastas por primera vez, y
   son unos dos euros (§6, §7).
6. Añade el cribado y las otras dos colecciones (§5, fases 3 y 4).
7. Entrega la URL. Fin de tu parte.

### 0.6 Cómo leer el resto

| Si quieres… | Vete a |
|---|---|
| Ver qué exige el formato de salida | §1.4 a §1.9, y el **Anexo A.1** |
| Entender el diseño y sus porqués | §2 a §12 |
| **Empezar a teclear hoy** | §14 y el **Anexo A** |
| Saber qué construir primero | §13 |
| Saber cuánto cuesta | §7.4 |

**El Anexo A es lo que hace copiable este documento.** Contiene, enteros y sin abreviar: el
esquema Zod completo (A.1), el bloque `curated` (A.2), el envoltorio de salida (A.3), el
`package.json` (A.5), el `tsconfig.json` (A.6), el `.gitignore` y el `.gitattributes` (A.7), la
configuración de ESLint (A.8), **los cinco workflows de GitHub Actions** (A.9), la plantilla de
`SOURCES.md` (A.10), los requisitos previos (A.11) y lo único que hay que acordar con el
propietario de planonmap (A.12).

Lo que **no** encontrarás es el código de los módulos de `src/`: eso es el trabajo a hacer. El
documento define su contrato, su comportamiento y sus criterios de aceptación, no su
implementación línea a línea.

### 0.7 Diccionario de este documento

Cuatro términos que se usan constantemente y conviene fijar antes de empezar:

| Término | Significa exactamente |
|---|---|
| **Ficha** (o *card*) | Una entrada publicada: un museo, un espectáculo o un plan. Es la unidad de trabajo del proyecto |
| **Colección** | Uno de los tres archivos de salida: `plans`, `shows`, `museums` |
| **Consenso** | En cuántas fuentes buenas e independientes aparece un mismo plan. Aquí es señal de **calidad**, no ruido a eliminar |
| **`Event`** | El formato de una ficha, definido en el Anexo A.1. Es un formato ajeno que tú produces, no un tipo que inventes |

---

> **Decisiones ya tomadas por el propietario** (no las reabras):
>
> 1. La lista inicial de fuentes la propone este documento; se cambia editando un archivo de configuración.
> 2. Los museos viajan como eventos con rango abierto más un bloque extra. No son un tipo de dato aparte.
> 3. El repositorio de `bcn-curator` es **público** (Actions ilimitadas y GitHub Pages gratis).
> 4. El tope duro de gasto en APIs de IA es **5 €/mes**.

---

## Índice

0. **[Empieza aquí](#0--empieza-aquí)** — qué construyes, qué no, y dónde está la frontera
1. [El cliente: qué formato exige planonmap](#1-el-cliente-qué-formato-exige-planonmap)
2. [Objetivo y alcance](#2-objetivo-y-alcance)
3. [Arquitectura](#3-arquitectura)
4. [Motor de rastreo](#4-motor-de-rastreo)
5. [Motor de cribado](#5-motor-de-cribado)
6. [Motor de enriquecimiento](#6-motor-de-enriquecimiento)
7. [Estrategia de IA y costes](#7-estrategia-de-ia-y-costes)
8. [Formato de salida](#8-formato-de-salida)
9. [Publicación y entrega](#9-publicación-y-entrega)
10. [Revisión editorial](#10-revisión-editorial)
11. [Seguridad](#11-seguridad)
12. [Riesgos y mitigaciones](#12-riesgos-y-mitigaciones)
13. [Plan por fases](#13-plan-por-fases)
14. [Puesta en marcha](#14-puesta-en-marcha)

- **[Anexo A · Archivos literales para arrancar](#anexo-a--archivos-literales-para-arrancar)** — todo lo que se copia y se pega
- [Anexo B · Registro de revisión del documento](#anexo-b--registro-de-revisión-del-documento) — los nueve defectos que tuvo la v1.0 y cómo se corrigieron

---

## 1. El cliente: qué formato exige planonmap

> **Recordatorio de la frontera (§0.4): nada de este apartado es trabajo tuyo.** planonmap ya
> existe y no vas a tocarlo. Esto es la ficha técnica del cliente: describe **el formato que
> tienes que producir** y por qué es así.
>
> **Si tienes prisa, lee solo las seis subsecciones marcadas como ESENCIAL** (unas 200 líneas) y
> vuelve a las de contexto cuando te haga falta entender un porqué.

| Subsección | ¿Necesaria? | Para qué te sirve |
|---|---|---|
| 1.1 En una frase | Contexto | Saber qué es el cliente |
| 1.2 Pila técnica | Contexto | **No replicas nada de esto.** Está para situarte |
| 1.3 De dónde salen los eventos hoy | Contexto útil | Explica por qué hace falta curación, y de dónde sale la regla «un refresco pobre nunca degrada lo publicado», que tú también aplicarás |
| **1.4 El esquema de un evento** | **ESENCIAL** | Es el formato que produces. Versión pegable en el Anexo A.1 |
| **1.5 Identificadores** | **ESENCIAL** | Cómo construyes cada `id` |
| **1.6 Categorías** | **ESENCIAL** | Los diez únicos valores válidos |
| **1.7 Precio** | **ESENCIAL** | No es un número. Equivocarlo invalida la ficha |
| 1.8 Normalización interna | Contexto | Cómo lo hace el cliente. Inspiración, no requisito |
| **1.9 Deduplicación** | **ESENCIAL** | El algoritmo que reproduces para emparejar |
| 1.10 Almacenamiento y caché | Contexto | **No construyes nada de esto** |
| 1.11 Geolocalización | Casi esencial | Resumen: las coordenadas tienen que estar bien |
| 1.12 Renderizado | Contexto valioso | Explica por qué produces su formato y no uno propio |
| **1.13 Internacionalización** | **ESENCIAL** | Dónde colocas los textos en español e inglés |

### 1.1 En una frase

planonmap (`https://www.planonmap.com`) es una aplicación web que reúne en un mapa y en un
listado toda la agenda de actividades del área metropolitana de Barcelona, tomada de portales
de datos abiertos oficiales, y la presenta con filtros por fecha, categoría, precio, zona y
cercanía.

### 1.2 Pila técnica

| Pieza | Elección | Detalle |
|---|---|---|
| Framework | Next.js 16.2.12 con React 19.2.4 | App Router, Server Components, ISR |
| Lenguaje | TypeScript 5 | `strict` activado |
| Gestor de paquetes | pnpm 10.26.1 | Node 24 |
| Validación | Zod 4 | Todo dato externo se valida antes de entrar |
| Mapa | MapLibre GL 5 | Sin Mapbox (evita coste por vista) |
| Base de datos | Postgres en Neon (plan Free) vía Prisma 6 | **Solo** para el panel de administración |
| Despliegue | Vercel (plan Hobby), región `fra1` (Fráncfort) | `buildCommand: pnpm build:vercel` |
| Tareas programadas | GitHub Actions | Refresco de datos, backup, prueba de humo |

### 1.3 De dónde salen los eventos hoy

planonmap **no consulta las fuentes en tiempo de petición**. Descarga y normaliza todo por
adelantado y publica un único archivo estático, `public/data/events.json` (~8,4 MB, 4.761
eventos en la última generación). El servidor lee ese archivo; el usuario nunca espera a un
portal externo.

Las fuentes están registradas en un único array (`lib/sources/registry.ts`). El orden importa:
en un empate de deduplicación **gana la primera aparición**, así que la fuente más rica va
primero.

| Orden | Fuente | Qué aporta | Eventos hoy |
|---|---|---|---|
| 1 | `opendatabcn` | Agenda cultural del Ajuntament de Barcelona. La más rica: entradas, horarios, galería | 638 |
| 2 | `diputaciobcn` | Agenda turística de la Diputació de Barcelona | 254 |
| 3 | `diputacioescenari` | Artes escénicas y música de la Diputació | (contadas arriba) |
| 4 | `districteagenda` | Agendas de distrito: fiestas mayores de barrio que OpenData omite | 113 |
| 5 | `lhospitalet` | Agenda municipal de L'Hospitalet (CKAN) | 71 |
| 6 | `cornella` | Agenda municipal de Cornellà (HTML) | — |
| 7 | `agendacultura` | Agenda Cultural de la Generalitat (toda Cataluña) | 886 |
| 8 | `agendadiaria` | Agenda diaria del Ajuntament, más amplia que la cultural | 2.755 |
| 9 | `mercatsfires` | Directorio de mercados y ferias de calle | 44 |

**Cada cuánto se ejecuta:** un workflow de GitHub Actions (`refresh-data.yml`) corre a diario
a las 03:00 UTC. Ejecuta `pnpm refresh-data`, que llama a `scripts/fetch-events.ts`, y
**commitea el `events.json` resultante al repositorio**. Vercel detecta el commit y
redespliega. Se hace desde GitHub y no desde Vercel porque el portal del Ajuntament bloquea
las IP de los centros de datos.

**Lección que heredarás:** el pipeline de planonmap está lleno de
guardas que impiden que un refresco malo empeore lo que ya había. Si ninguna fuente responde,
conserva el JSON anterior. Si falta la fuente núcleo de Barcelona, lo conserva. Si una fuente
concreta se desploma respecto al día anterior, lo conserva. Si el lote nuevo trae menos campos
que el anterior, **rellena los huecos con lo viejo en vez de empobrecer la ficha**. Ese
principio —*un refresco pobre nunca degrada lo publicado*— es innegociable y se replica tal
cual en `bcn-curator`.

### 1.4 El esquema real de un evento

Es el contrato que `bcn-curator` debe producir. Está definido con Zod en `types/event.ts`.
Lo transcribo con los tipos exactos; todo campo es **obligatorio** salvo donde diga opcional.

```ts
Event = {
  id: string                    // único, ≤ 64 chars. Ver §1.5
  source: 'opendatabcn' | 'agendadiaria' | 'diputaciobcn' | 'districteagenda'
        | 'lhospitalet' | 'agendacultura' | 'cornella' | 'mercatsfires' | 'custom'
        // ← 'curated' se AÑADE a este enum el día de la conexión
  sourceId: string              // identificador dentro de la fuente
  sourceUrl: string (url)       // ficha en el portal de origen
  contentLang?: 'ca' | 'es' | 'en'   // idioma original del texto
  officialUrl?: string (url)    // web del organizador
  ticketsUrl?: string (url)     // venta de entradas
  registrationUrl?: string (url)
  icalUrl?: string (url)
  title: string (min 1)
  description: string           // puede ser cadena vacía
  image?: string (url)
  imageSource?: 'event' | 'venue' | 'festival'
  imageCredit?: string
  gallery?: { url, thumb?, alt? }[]
  documents?: { url, label?, type: 'pdf' }[]
  audience?: string (max 20)
  startDate: string             // ISO 8601 CON offset: "2026-09-10T19:30:00+02:00"
  endDate?: string              // ISO 8601 con offset
  schedule?: { days: string, hours: string, price?: string }[]
  venue: {
    name: string (min 1)
    address: string (min 1)
    lat: number (-90..90)
    lng: number (-180..180)
    neighborhood?: string
    district?: string
    municipality?: string       // slug: 'barcelona', 'lhospitalet', 'santacoloma'…
    zipCode?: string
    locationPrecision?: 'exact' | 'neighborhood' | 'district'
  }
  category: Category            // ver §1.6
  categories?: Category[]       // secundarias
  price: Price                  // ver §1.7
  contact?: { email?, phone?, instagram?, facebook?, youtube? }
  tags: string[]                // obligatorio; puede ir vacío
  signals?: {                   // lo calcula planonmap, NO lo envíes
    quality: 0..1, popularity: 0..1, touristVsLocal: -1..1,
    effectiveStartHour: 0..24 | null
  }
  festival?: { id, highlightKind?, intensity?: 'alta'|'media', auto? }
  i18n?: {
    title?:       { ca?: string, es?: string, en?: string }
    description?: { ca?: string, es?: string, en?: string }
  }
  officialSource?: {            // procedencia verificada
    urlStatus?: 'verified'|'candidate'|'unverified'|'broken'
    urlCheckedAt?: ISO
    imageStatus?: 'verified'|'candidate'|'fallback'|'broken'
    imageCheckedAt?: ISO
    verifiedBy?: 'auto'|'admin'
    matchReason?: string (max 200)
  }
}
```

Un evento real del dataset actual, copiado sin retocar:

```json
{
  "id": "opendatabcn|99400785311",
  "source": "opendatabcn",
  "sourceId": "99400785311",
  "sourceUrl": "https://guia.barcelona.cat/ca/detall/_99400785311.html",
  "title": "Concert \"Sina Bathaie\"",
  "description": "White Lotus World Tour - Live in Barcelona",
  "startDate": "2026-09-10T03:00:00+02:00",
  "endDate": "2026-09-10T03:00:00+02:00",
  "venue": {
    "name": "C Muntaner",
    "address": "C Muntaner, 246, Sarrià-Sant Gervasi",
    "lat": 41.39462416093732,
    "lng": 2.1490629497204705,
    "locationPrecision": "exact",
    "neighborhood": "Sant Gervasi - Galvany",
    "district": "Sarrià-Sant Gervasi",
    "zipCode": "08021",
    "municipality": "barcelona"
  },
  "category": "music",
  "price": { "type": "paid", "amount": 49.99, "currency": "EUR" },
  "tags": ["Concerts", "Música electrònica,  techno, dance"],
  "image": "https://estatics-nasia.dtibcn.cat/nasia-pro/media/sinabathaie.optimized.ceae493b.jpg",
  "schedule": [
    { "days": "Dijous", "hours": "de 19.30 h a 22.30 h",
      "price": "Entrada general de: 29.99 a 49.99 € (+ despeses de gestió)" }
  ],
  "officialUrl": "https://luzdegas.com/",
  "ticketsUrl": "https://windcatcherproduction.ticketspice.com/sina-bathaie-white-lotus…",
  "signals": { "quality": 0.8, "popularity": 0.8, "touristVsLocal": -0.5, "effectiveStartHour": 19.5 }
}
```

Fíjate en lo que este ejemplo revela, porque justifica que exista este proyecto: el título es
literalmente `Concert "Sina Bathaie"`, la descripción son ocho palabras en inglés, el lugar se
llama `C Muntaner` (es la sala Luz de Gas, pero el dato abierto no lo sabe) y `startDate`
lleva la hora centinela `03:00` porque el feed no publicó hora real. **Cantidad sin criterio y
sin explicación: exactamente el problema a resolver.**

### 1.5 Generación de identificadores

Todos los `id` salen de la misma función (`lib/utils/dates.ts`):

```ts
export function makeId(...parts: string[]): string {
  return parts.join('|').toLowerCase().replace(/[^a-z0-9|]/g, '-').slice(0, 64)
}
```

Partes unidas por `|`, todo a minúsculas, cualquier carácter que no sea `a-z0-9|` se convierte
en `-`, y se recorta a 64 caracteres. Ejemplos reales: `opendatabcn|99400785311`,
`agendacultura|123456`.

`bcn-curator` usará el mismo formato: **`curated|<colección>|<slug>`**, por ejemplo
`curated|museums|museu-picasso` o `curated|shows|el-rei-lear-lliure`. El `slug` es estable de
por vida: es a la vez clave de caché, clave de deduplicación y clave de veto editorial.

### 1.6 Categorías: nomenclatura exacta

Son diez y forman un enum cerrado de Zod. Escribirlas mal hace fallar la validación:

```text
music · family · arts · museums · exhibitions · sports · food · culture · outdoors · other
```

Etiquetas visibles:

| Clave | Español | Català | English | Emoji |
|---|---|---|---|---|
| `music` | Música | Música | Music | 🎵 |
| `museums` | Museos | Museus | Museums | 🏛️ |
| `exhibitions` | Exposiciones | Exposicions | Exhibitions | 🖼️ |
| `arts` | Arte | Art | Arts | 🎭 |
| `family` | Familia | Família | Family | 👨‍👩‍👧 |
| `sports` | Deporte | Esport | Sports | ⚽ |
| `food` | Gastronomía | Gastronomia | Food | 🍽️ |
| `culture` | Cultura | Cultura | Culture | 🎭 |
| `outdoors` | Natura | Natura | Outdoors | 🌿 |
| `other` | Otros | Altres | Other | 📅 |

Encima de las categorías hay cinco **grupos públicos**, que son los botones que ve el visitante
en la portada. Se resuelven en la consulta; ningún evento cambia de categoría:

```text
music              → [music]
family             → [family]
food               → [food]
cultura            → [museums, exhibitions, arts, culture] + obras de teatro detectadas
deporte-naturaleza → [sports, outdoors]
```

Reparto de las tres colecciones nuevas sobre esta taxonomía:

- **Colección A · Mejores planes** → la categoría que corresponda al plan (`culture`,
  `outdoors`, `food`, `arts`, `family`…). No existe una categoría «lo mejor»; la distinción la
  marca el bloque `curated`, no la taxonomía.
- **Colección B · Conciertos y teatro** → `music` para conciertos, `arts` para teatro.
- **Colección C · Museos** → `museums` siempre.

### 1.7 Precio: un tipo discriminado, no un número

Este campo es una de las cosas mejor pensadas de planonmap y hay que respetarla al pie de la
letra. **Nunca se marca «gratis» sin confirmación explícita de la fuente.**

```ts
Price =
  | { type: 'free' }                       // confirmado gratuito
  | { type: 'free-with-booking' }          // gratis pero hay que reservar
  | { type: 'included-with-admission' }    // la actividad no cuesta, pero se paga la entrada del recinto
  | { type: 'invitation' }                 // con invitación
  | { type: 'paid', amount: number, amountMax?: number, currency: 'EUR', hasSurcharge?: boolean }
  | { type: 'paid-unknown' }               // se paga, importe no parseable
  | { type: 'unknown' }                    // sin información fiable → la UI NO dice "Gratis"
```

`hasSurcharge: true` significa que el importe anunciado no es el total (hay suplementos).
`amountMax` se usa cuando hay rango: «de 29,99 a 49,99 €» → `amount: 29.99, amountMax: 49.99`.

### 1.8 Cómo se normalizan fuentes distintas al esquema común

Cada fuente tiene su normalizador en `lib/normalize/<fuente>.ts`. Todos hacen lo mismo:
descargar → mapear campos → clasificar → validar con Zod → devolver `Event[]`. La
clasificación palabra clave → categoría vive **en un solo sitio**
(`lib/normalize/classify.ts`), con reglas ordenadas por especificidad y un nivel de confianza
(`strong` / `weak`); la primera regla que casa gana. Hubo un periodo en que dos fuentes tenían
su propia copia de esas reglas y no recibían las mejoras: se unificó, y esa es la lección —
**una sola copia de cada regla.**

Tras agregar las fuentes, el pipeline aplica en orden: ventana temporal (de ayer a +60 días) →
deduplicación → limpieza de URLs genéricas → relleno de imagen del espacio → expansión de
programas de sala en conciertos sueltos → cálculo de `signals` → traducciones curadas →
guardas de degradación.

### 1.9 Deduplicación: el algoritmo exacto

`bcn-curator` tiene que reproducirlo **carácter por carácter** para poder decir «este plan
curado ya está en el feed». Está en `lib/sources/dedupe.ts`:

```ts
function normalizeTitleForDedupe(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // quita tildes y diacríticos
    .replace(/[^a-z0-9]/g, '')         // quita signos, espacios y emojis
    .slice(0, 40)
}

function dedupeKey(event: Event): string {
  const slug = normalizeTitleForDedupe(event.title)
  const date = event.startDate.slice(0, 10)      // "2026-09-10"
  const lat  = event.venue.lat.toFixed(2)        // ~1,1 km de precisión
  const lng  = event.venue.lng.toFixed(2)
  return `${slug}|${date}|${lat}|${lng}`
}
```

Para el ejemplo de arriba: `concertsinabathaie|2026-09-10|41.39|2.15`.

### 1.10 Almacenamiento, caché y revalidación

- **Dataset**: archivo estático `public/data/events.json`, versionado en git. No hay base de
  datos de eventos.
- **Base de datos (Neon)**: solo el *overlay* del panel de administración — ocultar un evento,
  corregir un precio, destacar algo. Se aplica sobre el dataset en cada lectura.
- **Revalidación (ISR)**: portada, landings y ficha de evento se regeneran cada **1.800 s**
  (30 min). La ficha usa `generateStaticParams()` devolviendo lista vacía: eso mete la ruta en
  modo estático, y la primera visita la genera y la cachea.
- **Caché de CDN de las APIs**: `Cache-Control: public, s-maxage=600, stale-while-revalidate=1800`.
- **Coste**: el plan gratuito de Vercel se agotó una vez por repetir trabajo no cacheable.
  Desde entonces la regla es: **el trabajo caro se hace una vez, fuera de la petición.** Otra
  razón para que `bcn-curator` publique JSON estático y no una API viva.

### 1.11 Geolocalización y orden por cercanía

- Distancia con la fórmula de Haversine (`lib/geo/haversine.ts`), radio terrestre 6.371 km.
- `sortEvents(events, 'distance', origin)` añade `distanceKm` a cada evento y ordena.
- El orden por defecto es `distance` si hay `lat/lng` del usuario y `date` si no.
- Hay además un ranking de relevancia con pesos que suman 1,00:
  `time 0,30 · geo 0,25 · price 0,10 · quality 0,10 · popularity 0,10 · festival 0,15`.
- Ninguna de estas piezas necesita nada nuevo por tu parte: **basta con que cada ficha
  traiga `venue.lat` y `venue.lng` correctas.** Es el campo más importante que produces, por
  delante incluso del texto.

### 1.12 Renderizado

- **Listado** (`components/EventCard.tsx`, `EventList.tsx`): imagen o placeholder degradado por
  categoría, título, fecha formateada, lugar, distancia si la hay, insignia de precio.
- **Ficha** (`app/event/[id]/page.tsx`): imagen de cabecera, título, categoría, fechas,
  horarios, precio, dirección con enlace a «Cómo llegar», descripción estructurada, documentos
  PDF, enlaces oficiales y de entradas, contacto, botón de favorito y de compartir, y JSON-LD
  `Event` para Google.
- La descripción plana se convierte en bloques (párrafo, lista, subtítulo, campo
  `Etiqueta: valor`) **sin inventar estructura**, aprovechando solo las pistas que ya trae el
  texto. Los datos prácticos etiquetados se separan de los créditos de ficha técnica.
- **Landings SEO**: `/conciertos-barcelona`, `/teatro-barcelona`, `/cultura-barcelona`,
  `/exposiciones-barcelona`, `/familia-barcelona`, `/deporte-barcelona`,
  `/planes-hoy-barcelona`, `/planes-este-finde-barcelona`, `/planes-gratis-barcelona`. Cada una
  filtra el dataset con un predicado y se regenera cada 30 min.

**Consecuencia práctica para ti:** si `bcn-curator` emite un `Event` válido, planonmap ya sabe
pintarlo en el mapa, en el listado, en el buscador, en la ficha y en las landings **sin
escribir una línea de renderizado nuevo**. Ese es el motivo de que el contrato sea el esquema
`Event` y no un formato propio.

### 1.13 Internacionalización

Tres idiomas: `es` (por defecto), `ca`, `en`. El diccionario de la interfaz vive en
`lib/i18n/dictionaries.ts`. La selección es de cliente: `localStorage` → idioma del navegador
→ `es`.

Para el **contenido** de cada evento hay dos campos y dos funciones de resolución:

```ts
pickEventTitle(event, locale)        // event.i18n.title[locale] ?? event.title
pickEventDescription(event, locale)  // event.i18n.description[locale] ?? event.description
```

Hoy solo 44 de 4.761 eventos tienen traducción. **Aquí está la segunda gran aportación del
proyecto:** al escribir cada ficha en español e inglés y ponerlas en
`i18n.title` / `i18n.description`, la web las muestra traducidas sin tocar nada.

Convenio que seguiremos: los campos planos `title` y `description` llevan el **español**,
`contentLang: 'es'`, y `i18n` lleva `es` y `en`. El catalán se deja ausente (la interfaz cae al
español, que es el idioma por defecto).

---

## 2. Objetivo y alcance

### 2.1 Para quién

Un **turista que pasa pocos días en Barcelona** y quiere acertar. No busca una agenda
exhaustiva: busca que alguien haya elegido por él y se lo haya explicado bien.

De ese perfil salen tres consecuencias de diseño que atraviesan todo el proyecto:

1. **Que un plan aparezca en varias fuentes es señal POSITIVA.** El consenso es aval de
   calidad. En un agregador normal sería ruido a deduplicar; aquí es la señal más barata y más
   fiable que tenemos, y por eso pesa 25 de los 100 puntos del cribado.
2. **La explicación importa más que el dato.** Una ficha con precio, horario y una frase que de
   verdad diga por qué merece la pena vale más que cincuenta fichas con el título en catalán.
3. **La barrera idiomática es criterio de selección, no una nota al pie.** Un monólogo en
   catalán puede ser excelente y aun así ser un mal plan para este usuario.

### 2.2 Qué NO es

- No es un agregador. No busca cobertura: busca acierto.
- No sustituye al feed de datos abiertos de planonmap: lo complementa por arriba.
- No copia texto de nadie. Cada ficha se **reescribe entera**.
- No es un servicio en vivo. Publica archivos; planonmap los recoge cuando quiere.

### 2.3 Las tres colecciones

| | A · Mejores planes | B · Conciertos y teatro | C · Museos |
|---|---|---|---|
| Qué es | Lo imprescindible de la ciudad y lo mejor que ocurre ahora | Espectáculos con sesión y fecha | Colección estable con ficha completa |
| Volumen objetivo | 30–60 fichas vivas | 20–40 fichas vivas | 40–60 fichas permanentes |
| Caduca | Sí (las de temporada) | Sí, con la última sesión | No |
| Frescura | Diaria | Diaria | Semanal, por detección de cambios |
| Categorías | `culture`, `outdoors`, `food`, `arts`, `family` | `music`, `arts` | `museums` |
| Consenso necesario | ≥ 2 fuentes de nivel A/B | ≥ 1 fuente especializada + ficha oficial | Solo ficha oficial |
| Coste de IA | Alto (es la que más se mueve) | Medio | Casi cero tras el arranque |

Mezcla que la colección A debe mantener siempre: **imprescindible atemporal** (el Park Güell
existe todo el año) y **novedad de temporada** (la exposición que cierra en octubre). Sin
imprescindibles, la colección parece una revista; sin novedades, parece una guía de 1998.

### 2.4 Restricciones que no se negocian

1. **Desacoplado.** Si `bcn-curator` desaparece hoy, planonmap sigue funcionando exactamente
   igual: lee un archivo versionado en su propio repositorio.
2. **Infraestructura a coste cero.** Sin tarjeta de crédito, sin servidores encendidos.
3. **El único gasto admitido son las APIs de IA**, con tope duro de 5 €/mes.
4. **Sin duplicar lo que ya viene de datos abiertos.** Si el plan curado ya existe en el feed,
   se fusiona; nunca aparece dos veces.
5. **El propietario aprueba o veta.** Nunca reescribe.

---

## 3. Arquitectura

### 3.1 Nombre y repositorio

**`bcn-curator`**. En inglés porque el repositorio es público y el nombre lo lee gente que no
habla español; descriptivo porque dentro de un año hay que saber qué hace sin abrirlo.

- Repositorio: `https://github.com/<tu-usuario>/bcn-curator` — **público**.
- Publicación: **GitHub Pages en modo «GitHub Actions»**, desplegando un artefacto (§9.2) →
  `https://<tu-usuario>.github.io/bcn-curator/v1/…`

**Por qué público, con todas las consecuencias sobre la mesa.** En repositorios privados los
minutos de GitHub Actions salen de una cuota mensual de 2.000 compartida por **toda la cuenta**,
así que un rastreo diario compite con cualquier otro proyecto que tengas ahí — y agotar la cuota
a mitad de mes los para todos a la vez. En repositorios públicos los minutos son **ilimitados** y
GitHub Pages está incluido. Es la única configuración en la que «coste cero» es verdad y no un
eufemismo. A cambio, el código y el JSON curado quedan a la vista: no es un
problema, porque el JSON está pensado para publicarse y los textos son propios. Lo que **nunca**
entra en el repositorio son las claves de API, que viven como *Secrets* de Actions.

### 3.2 Lenguaje y dependencias

**TypeScript sobre Node 24**, ejecutado con `tsx`. Tres razones:

1. El esquema `Event` de planonmap está escrito en Zod/TypeScript. Copiándolo tal cual,
   **el compilador garantiza que lo que publicas encaja**. En Python habría que reescribirlo y
   mantener dos verdades.
2. Es la misma pila que planonmap: quien mantiene uno mantiene el otro sin cambiar de contexto.
3. `fetch`, `AbortSignal.timeout` y el parseo de URL vienen en el runtime; no hace falta cliente
   HTTP.

*Alternativa descartada:* Python con `scrapy`/`beautifulsoup`. Mejor ecosistema de scraping,
pero introduce un segundo lenguaje, un segundo gestor de dependencias y una segunda copia del
esquema. El scraping que necesitamos (sitemaps, JSON-LD, cuatro selectores) no justifica ese
precio.

Dependencias exactas, con las versiones publicadas a 29/08/2026:

```jsonc
{
  "packageManager": "pnpm@10.26.1",
  "engines": { "node": "24.x" },
  "dependencies": {
    "@anthropic-ai/sdk": "0.122.0",   // redacción final
    "openai": "7.8.0",                // cribado en lote
    "zod": "4.4.1",                   // MISMA major que planonmap: el esquema se copia tal cual
    "cheerio": "1.2.0",               // parseo HTML sin navegador
    "fast-xml-parser": "5.11.1",      // sitemaps y RSS
    "robots-parser": "3.0.1",         // cumplimiento de robots.txt
    "p-limit": "7.3.1"                // concurrencia acotada por host
  },
  "devDependencies": {
    "tsx": "4.21.0",
    "typescript": "5.9.3",
    "vitest": "4.1.5"
  }
}
```

**Sin navegador headless.** Nada de Playwright ni Puppeteer. Casi todas las webs objetivo son
WordPress renderizado en servidor y emiten JSON-LD. Un navegador multiplicaría por veinte el
tiempo de ejecución en Actions y añadiría una superficie de fallo enorme. **Decisión: si una
fuente exige JavaScript para mostrar su agenda, se descarta la fuente.** Hay doce candidatas;
sobran.

### 3.3 Las tres zonas: producto, contrato y caché

Antes del árbol de carpetas hay que fijar el modelo mental, porque es lo que decide dónde va
cada archivo y quién puede escribirlo. El repositorio tiene **tres zonas con reglas distintas**:

| Zona | Carpeta | Quién la escribe | ¿Se puede perder? | Ruido en el diff |
|---|---|---|---|---|
| **Producto** | `content/` | El pipeline **propone**, la persona **aprueba** | **No.** Es lo caro y lo revisado. Perderlo es volver a pagar y a revisar | Se lee. Es el panel de revisión |
| **Contrato** | `contracts/` | Solo una persona, al versionar | No, pero está transcrito entero en el anexo A.1 | Casi nunca cambia |
| **Caché** | `.cache/` | Solo la máquina | **Sí.** Borrarla cuesta dinero y tiempo, pero se regenera sola | Se ignora, y GitHub lo colapsa |

La confusión entre producto y caché es un error de diseño barato de cometer y caro de arreglar:
si las fichas escritas viven junto al índice de URL vistas —que se reescribe entero cada día—,
**el diff del PR de revisión queda sepultado bajo miles de líneas de ruido**, y el PR es
precisamente el panel de revisión del proyecto. Separarlas desde el minuto uno cuesta nada.

Un `.gitattributes` remata la separación:

```gitattributes
.cache/**       linguist-generated=true -diff
content/**      linguist-generated=false
*.ndjson        -diff
```

Con `linguist-generated`, GitHub **colapsa por defecto** los archivos de `.cache/` en la vista
de un PR. El revisor abre el PR y ve lo único que le interesa: las fichas.

### 3.4 Estructura de carpetas completa

```text
bcn-curator/
├── .github/
│   ├── workflows/
│   │   ├── curate.yml            # ÚNICO workflow que gasta dinero y propone cambios
│   │   ├── publish.yml           # al mergear en main → construye y despliega Pages
│   │   ├── reconcile.yml         # al mergear/cerrar un PR de propuesta → registra vetos
│   │   ├── ci.yml                # typecheck, lint, tests, config y contrato
│   │   └── health.yml            # lunes: enlaces muertos, fuentes degradadas, informe
│   └── CODEOWNERS                # el propietario revisa TODO
│
├── config/                       # ← DECLARATIVO. Lo edita una persona. Ver §3.5
│   ├── index.ts                  # carga, valida con Zod y congela toda la configuración
│   ├── schema.ts                 # esquemas Zod de todo lo de esta carpeta
│   ├── sources.ts                # ★ LA LISTA DE WEBS
│   ├── museums.ts                # catálogo semilla de museos
│   ├── scoring.ts                # pesos y umbrales del cribado
│   ├── quotas.ts                 # cuotas de variedad
│   └── budget.ts                 # tope de gasto, modelos y precios por millón de tokens
│
├── contracts/                    # ← EL CONTRATO CON PLANONMAP
│   ├── UPSTREAM.md               # de qué commit de planonmap salió event.ts, y cuándo
│   ├── event.ts                  # copia vendorizada del Event de planonmap (Zod)
│   ├── curated.ts                # el bloque `curated`
│   ├── output.ts                 # envoltorio de colección e índice
│   └── golden/
│       └── curated-golden.json   # fixture de conformidad, IDÉNTICO en los dos repositorios
│
├── src/
│   ├── core/                     # puro: sin red, sin disco, sin reloj implícito
│   │   ├── clock.ts              # el «ahora» SIEMPRE se inyecta (ver §3.6)
│   │   ├── ids.ts                # makeId y slug, calcados de planonmap
│   │   ├── hash.ts               # semanticHash y cacheKey (§5.2)
│   │   ├── text.ts               # normalización, trigramas, solapamiento de n-gramas
│   │   └── result.ts             # Result<T> en vez de excepciones que cruzan capas
│   ├── crawl/
│   │   ├── fetcher.ts            # ÚNICO punto autorizado a salir a la red
│   │   ├── robots.ts             # lectura y caché de robots.txt
│   │   ├── discover.ts           # sitemaps y RSS → URL candidatas
│   │   ├── extract/{jsonld,opengraph,selectors}.ts
│   │   └── adapters/             # uno por fuente + index.ts con el registro
│   ├── normalize/{toCandidate,price,dates,geo,category,transit}.ts
│   ├── cluster/{group,planonmapKey}.ts
│   ├── screen/{prefilter,score,llmScreen,diversify}.ts
│   ├── enrich/{material,write,verify,images,museumDiff}.ts
│   ├── ai/
│   │   ├── clients.ts            # clientes de OpenAI y Anthropic
│   │   ├── batch.ts              # envío y recogida de lotes en los dos proveedores
│   │   ├── budget.ts             # tope de gasto duro y libro de gasto
│   │   └── cache.ts              # nunca se paga dos veces por lo mismo
│   ├── store/                    # ← ÚNICA capa que toca el disco
│   │   ├── paths.ts              # todas las rutas, en un solo sitio
│   │   ├── content.ts            # fichas, archivo, vetos, propuestas
│   │   └── cache.ts              # índice de URL, decisiones, geocodificación, salud
│   ├── publish/{build,checksums}.ts
│   ├── review/
│   │   ├── manifest.ts           # escribe content/proposals/<fecha>.json
│   │   ├── openPr.ts             # abre o actualiza el PR de revisión
│   │   └── reconcile.ts          # tras el merge: manifiesto vs publicado → vetos
│   ├── report/{health,metrics,summary}.ts
│   └── cli/                      # un archivo por comando de package.json
│
├── content/                      # ★ EL PRODUCTO. Revisado por una persona
│   ├── cards/
│   │   ├── plans/<slug>.json
│   │   ├── shows/<slug>.json
│   │   └── museums/<slug>.json
│   ├── archive/<slug>.json       # retiradas, NUNCA borradas (§3.7)
│   ├── vetoed.json               # slugs vetados, con fecha y motivo
│   └── proposals/<fecha>.json    # manifiesto de lo propuesto ese día (§10.1)
│
├── .cache/                       # ← DERIVADO. Regenerable. Colapsado en el diff
│   ├── index/<fuente>.ndjson     # una línea por URL: etag, semanticHash, fechas, veredicto
│   ├── decisions/<año-mes>.ndjson
│   ├── clusters/<clusterId>.json
│   ├── geocode.json              # permanente: una dirección se resuelve una vez en la vida
│   ├── transit.json              # paradas cercanas por coordenada
│   ├── pending-batches.json      # lotes enviados y aún no recogidos (§7.2 ter)
│   ├── sources-health.json       # medianas, degradadas, pausadas — lo escribe la máquina
│   └── spend/<año-mes>.json      # libro de gasto
│
├── evals/                        # ← ¿el cambio de prompt mejora o empeora? (§5.7)
│   ├── screen/golden.jsonl       # 24 candidatos etiquetados a mano
│   └── write/golden.jsonl        # 8 fichas con su material y su ficha aceptada
│
├── tests/{unit,integration,fixtures}/
│
├── .gitattributes
├── .env.example
├── SOURCES.md                    # ficha legal por fuente y fecha de revisión
├── LICENSE-CODE                  # MIT para el código
├── LICENSE-DATA                  # CC-BY-4.0 para los datos publicados
├── README.md
└── package.json
```

Cuatro decisiones de esta estructura merecen su porqué:

- **`src/store/` es la única capa que toca el disco.** Todo lo demás recibe y devuelve datos. Es
  lo que permite probar el cribado y el enriquecimiento enteros sin sistema de archivos, y lo
  que hace que mover `.cache/` a otro sitio algún día sea cambiar un archivo.
- **`src/core/clock.ts` y la prohibición de `Date.now()` suelto.** planonmap ha tenido la CI rota
  tres veces por fixtures con fecha fija que caducaron. Aquí el «ahora» se inyecta siempre, y una
  regla de ESLint prohíbe `Date.now()` y `new Date()` fuera de `core/clock.ts`.
- **`.ndjson` para lo que crece por líneas.** El índice de URL es la estructura que más ruido
  genera: 7.500 URL en un único JSON se reescribe entero cada día y produce un diff inmanejable.
  En NDJSON, ordenado de forma estable por URL, **cambian solo las líneas que cambian**.
- **Un archivo por ficha, agrupado por colección.** Vetar es borrar un archivo en la interfaz web
  de GitHub. Con un JSON gigante, vetar sería editar a mano un archivo de 3 MB desde el móvil.

### 3.5 Configuración: declarativa, validada y con puerta de seguridad

La configuración es **TypeScript validado con Zod al cargar**, no YAML ni JSON. El motivo es
concreto: un `trust: "1.0"` con comillas o un `tier: 'D'` inexistente se detectan en `pnpm
typecheck` **y** al arrancar, en vez de producir un consenso mal calculado que nadie nota.

```ts
// config/schema.ts
export const SourceConfigSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  tier: z.enum(['A', 'B', 'C']),
  trust: z.number().min(0).max(1),
  collections: z.array(z.enum(['plans', 'shows', 'museums'])).min(1),
  home: z.string().url().nullable(),
  discovery: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('sitemap'), url: z.string().url().optional(),
               pathIncludes: z.array(z.string()).optional() }),
    z.object({ kind: z.literal('rss'), url: z.string().url() }),
    z.object({ kind: z.literal('perEntity') }),
    z.object({ kind: z.literal('manual') }),
  ]),
  crawlDelayMs: z.number().int().min(1000),        // nunca por debajo de 1 s
  maxPagesPerDay: z.number().int().min(1).max(100),
  /** Fecha de la última revisión legal y técnica. SIN ESTO, LA FUENTE NO SE RASTREA. */
  verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Nota de esa revisión: qué dice su robots.txt y sus condiciones de uso. */
  verifiedNote: z.string().max(300).optional(),
})
```

**La puerta de seguridad es `verifiedAt`**, y es una mejora que vale por sí sola: una fuente sin
esa fecha **se salta en silencio**, y una con la fecha a más de 180 días se rastrea pero avisa.
Así es imposible que una web entre en producción sin que alguien haya mirado su `robots.txt` y
sus condiciones, que es exactamente el descuido que convierte un proyecto legítimo en uno
problemático. La comprobación vive en `config/index.ts` y en `ci.yml`:

```ts
// config/index.ts — se ejecuta al arrancar y en CI
const parsed = z.array(SourceConfigSchema).parse(SOURCES)
export const ACTIVE_SOURCES = parsed.filter((s) => {
  if (!s.verifiedAt) { warn(`fuente ${s.id} sin verificar: se omite`); return false }
  if (daysSince(s.verifiedAt) > 180) warn(`fuente ${s.id} verificada hace >180 días`)
  return true
})
```

**Qué es configuración y qué no.** La distinción es la misma que la de las tres zonas, y evita
el error clásico de que un proceso automático reescriba un archivo que una persona edita a mano:

| Vive en `config/` (lo edita una persona) | Vive en `.cache/` (lo escribe la máquina) |
|---|---|
| Lista de fuentes, nivel y `trust` base | `trust` **efectivo** tras el ajuste por aprobación |
| `crawlDelayMs` y `maxPagesPerDay` | Si la fuente está `degraded`, `paused` o `blocked` |
| `verifiedAt` y `verifiedNote` | Medianas de extracción de los últimos 7 días |
| Pesos, umbrales y cuotas | Puntuaciones concretas de cada candidato |
| Catálogo semilla de museos | Horarios y precios extraídos de cada museo |
| Tope de gasto y precios por modelo | Gasto acumulado del mes |

Añadir una fuente son **cinco líneas y un commit**:

```ts
// config/sources.ts
{ id: 'nueva-fuente', tier: 'A', trust: 0.90, collections: ['plans'],
  home: 'https://ejemplo.cat', discovery: { kind: 'sitemap' },
  crawlDelayMs: 5000, maxPagesPerDay: 30,
  verifiedAt: '2026-09-15',
  verifiedNote: 'robots.txt permite /agenda/. Condiciones sin cláusula anti-automatización.' },
```

### 3.6 Una sola vía de escritura

Este apartado corrige el defecto más silencioso del diseño anterior, donde dos workflows escribían
en las mismas carpetas y ambos empujaban a `main`. Cuatro reglas:

1. **Un solo workflow gasta dinero y propone cambios**: `curate.yml`. Recibe un parámetro
   `collection` (`plans` \| `shows` \| `museums` \| `all`) y dos entradas de cron distintas. No
   hay dos procesos compitiendo por `.cache/spend/`.
2. **Grupo de concurrencia único y compartido** por todo lo que escribe el repositorio:

   ```yaml
   concurrency:
     group: bcn-curator-write     # el MISMO en curate.yml y en reconcile.yml
     cancel-in-progress: false
   ```

   `publish.yml` usa un grupo propio (`bcn-curator-pages`), porque **no escribe el repositorio**:
   solo construye y despliega. Meterlo en el grupo de escritura lo dejaría esperando media hora
   detrás de un rastreo sin ninguna razón. Los workflows completos están en el anexo A.9.

3. **Nada se empuja a `main` directamente.** Ni las fichas, ni la caché, ni el libro de gasto.
   Todo viaja en la rama de la propuesta y entra al mergear. Así el estado de `main` siempre
   corresponde a algo que una persona aprobó, y el PR nunca nace desactualizado.
4. **Reintento con rebase.** Si el `push` a la rama de propuesta falla por carrera, se hace
   `git pull --rebase` y se reintenta hasta tres veces antes de fallar.

### 3.7 Ciclo de vida de una ficha

Un `slug` nace una vez y no se reutiliza jamás. Los estados:

```text
candidato ──criba──▶ propuesto ──merge──▶ publicado ──caduca──▶ archivado
     │                    │                    │
     └──descartado        └──veto──▶ vetado    └──veto──▶ vetado
```

- **Archivado, no borrado.** Cuando una ficha caduca (última función pasada, exposición
  terminada), se mueve a `content/archive/<slug>.json` y desaparece de la publicación. Si el
  montaje vuelve la temporada siguiente, **se reactiva sin volver a pagar la redacción**: solo se
  actualizan fechas y precio, que es extracción determinista.
- **Vetado es para siempre**, salvo que se borre la entrada a mano de `content/vetoed.json`. El
  veto guarda `{ slug, fecha, motivo }` para que dentro de seis meses se sepa por qué.
- **`locked: true`** en una ficha la congela: no se regenera aunque cambie el prompt o la fuente.
  Es la vía de escape para cuando el propietario sí quiera escribir algo a mano.

### 3.8 Cuándo se ejecuta

| Workflow | Disparo | Qué hace | Gasta | Escribe |
|---|---|---|---|---|
| `curate.yml` · fase **submit** | `30 2 * * *` (planes y espectáculos) · `0 2 * * 1` (museos) · `workflow_dispatch` | Rastrea, prefiltra, agrupa, **criba en síncrono**, selecciona y **envía el lote de redacción** | **Sí** | Rama de propuesta |
| `curate.yml` · fase **collect** | `30 6,10,14 * * *` · `workflow_dispatch` | Consulta el lote pendiente. Si está listo: verifica, escribe las fichas y **abre o actualiza el PR**. Si no, sale sin hacer nada | No | Rama de propuesta |
| `reconcile.yml` | `pull_request` cerrado con la etiqueta `propuesta` | Compara el manifiesto con lo mergeado y **registra los vetos** | No | Rama de propuesta |
| `publish.yml` | `push` a `main` | Construye `dist/v1/` y **despliega Pages por artefacto** | No | Nada del repositorio |
| `ci.yml` | cada PR | `typecheck`, `lint`, `test`, validación de `config/` y del contrato | No | Nada |
| `health.yml` | `0 6 * * 1` | Enlaces muertos, fuentes degradadas, informe semanal en una incidencia | No | Rama de mantenimiento |

Las 02:30 UTC están elegidas a propósito: **media hora antes del refresco de planonmap** (03:00
UTC), para que el dato curado ya esté publicado y fresco cuando planonmap venga a por él.

Todos llevan `workflow_dispatch: {}` con entradas (`collection`, `limit`, `dryRun`) para poder
lanzarlos a mano y acotados, que es como se depura sin gastar.

### 3.9 El embudo, en texto

```text
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ 1 · RASTREO                                        ~250 URL/día          │
 │   sitemap.xml + RSS de 12 fuentes                                        │
 │   robots.txt + rate limit + ETag/If-Modified-Since                       │
 │   descarga solo lo que cambió desde la última vez                        │
 └────────────────────────────────┬─────────────────────────────────────────┘
                                  │  −84 % (ya vistas, sin cambios)
 ┌────────────────────────────────▼─────────────────────────────────────────┐
 │ 2 · CANDIDATOS                                     ~40 páginas nuevas    │
 │   extracción JSON-LD → OpenGraph → selectores                            │
 │   normalización al esquema Event (fecha, precio, categoría, coords)      │
 │   agrupación: el mismo plan en varias webs = UN cluster                  │
 └────────────────────────────────┬─────────────────────────────────────────┘
                                  │  −50 % (prefiltro determinista, SIN IA)
 ┌────────────────────────────────▼─────────────────────────────────────────┐
 │ 3 · CRIBADO                                        ~20 clusters/día      │
 │   a) consenso + completitud + reputación   (0–45 pts, sin IA)            │
 │   b) criterio editorial                    (0–55 pts, modelo barato)     │
 │      → 2 lotes de 10 candidatos por llamada, síncrona                    │
 │   umbral ≥ 62 y sin vetos duros                                          │
 │   cuotas de variedad: categoría, barrio, precio, atemporal/temporada     │
 └────────────────────────────────┬─────────────────────────────────────────┘
                                  │  −90 %
 ┌────────────────────────────────▼─────────────────────────────────────────┐
 │ 4 · ENRIQUECIMIENTO                                ~2 fichas/día         │
 │   material recortado (≤ 2.500 tokens) → modelo caro, Batch API           │
 │   ficha bilingüe ES/EN reescrita entera                                  │
 │   VERIFICACIÓN: cada dato factual trae su evidencia literal;             │
 │   si la evidencia no está en el material, el campo se OMITE              │
 └────────────────────────────────┬─────────────────────────────────────────┘
                                  │
 ┌────────────────────────────────▼─────────────────────────────────────────┐
 │ 5 · PUBLICACIÓN                                                          │
 │   PR automático con las fichas nuevas y las modificadas                  │
 │   el propietario mergea (aprueba) o borra el archivo del PR (veta)       │
 │   al mergear: publicación de dist/v1 en Pages                                  │
 └──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Motor de rastreo

### 4.1 La lista de fuentes que propongo

Vive en `config/sources.ts`. **Añadir o quitar una web es editar este archivo**, nada más.
Los niveles no son decorativos: determinan cuánto pesa cada fuente en el consenso.

- **Nivel A** — medios y guías con criterio editorial propio. Su aparición es la señal de
  calidad más fuerte. Cuentan para el consenso con peso 1,0.
- **Nivel B** — agendas especializadas y portales oficiales. Cuentan con peso 0,8.
- **Nivel C** — fichas oficiales del propio recinto. **No cuentan para el consenso** (un museo
  siempre habla bien de sí mismo); sirven para **verificar** precio, horario y dirección.

```ts
// config/sources.ts
export const SOURCES: SourceConfig[] = [
  // ── Nivel A · medios curados ───────────────────────────────────────────
  { id: 'timeout-bcn',        tier: 'A', trust: 1.00, collections: ['plans', 'shows'],
    home: 'https://www.timeout.es/barcelona',
    discovery: { kind: 'sitemap', url: 'https://www.timeout.es/sitemap.xml',
                 pathIncludes: ['/barcelona/'] },
    crawlDelayMs: 5000, maxPagesPerDay: 40 },

  { id: 'barcelona-secreta',  tier: 'A', trust: 0.95, collections: ['plans'],
    home: 'https://barcelonasecreta.com',
    discovery: { kind: 'sitemap', url: 'https://barcelonasecreta.com/sitemap_index.xml' },
    crawlDelayMs: 5000, maxPagesPerDay: 40 },

  { id: 'lecool-bcn',         tier: 'A', trust: 0.90, collections: ['plans', 'shows'],
    home: 'https://lecool.com/barcelona', discovery: { kind: 'sitemap' },
    crawlDelayMs: 5000, maxPagesPerDay: 25 },

  { id: 'beteve-agenda',      tier: 'A', trust: 0.85, collections: ['plans'],
    home: 'https://beteve.cat/agenda', discovery: { kind: 'rss' },
    crawlDelayMs: 5000, maxPagesPerDay: 25 },

  { id: 'lavanguardia-quehacer', tier: 'A', trust: 0.85, collections: ['plans'],
    home: 'https://www.lavanguardia.com/que-hacer-en-barcelona',
    discovery: { kind: 'rss' }, crawlDelayMs: 5000, maxPagesPerDay: 25 },

  // ── Nivel B · agendas especializadas y portales oficiales ──────────────
  { id: 'teatre-barcelona',   tier: 'B', trust: 0.90, collections: ['shows'],
    home: 'https://www.teatrebarcelona.com',
    discovery: { kind: 'sitemap', url: 'https://www.teatrebarcelona.com/es/sitemap_index.xml' },
    crawlDelayMs: 10000,   // ← su robots.txt declara Crawl-delay: 10 para ClaudeBot
    maxPagesPerDay: 40 },

  { id: 'enderrock-agenda',   tier: 'B', trust: 0.80, collections: ['shows'],
    home: 'https://www.enderrock.cat/agenda', discovery: { kind: 'sitemap' },
    crawlDelayMs: 5000, maxPagesPerDay: 25 },

  { id: 'visit-barcelona',    tier: 'B', trust: 0.80, collections: ['plans', 'museums'],
    home: 'https://www.barcelonaturisme.com', discovery: { kind: 'sitemap' },
    crawlDelayMs: 5000, maxPagesPerDay: 30 },

  { id: 'bcn-cultura',        tier: 'B', trust: 0.80, collections: ['plans', 'museums'],
    home: 'https://www.barcelona.cat/barcelonacultura', discovery: { kind: 'sitemap' },
    crawlDelayMs: 10000, maxPagesPerDay: 30 },

  // ── Nivel C · fichas oficiales, solo para verificar ────────────────────
  { id: 'articket',           tier: 'C', trust: 0.00, collections: ['museums'],
    home: 'https://articketbcn.org', discovery: { kind: 'manual' },
    crawlDelayMs: 5000, maxPagesPerDay: 15 },

  { id: 'museus-bcn',         tier: 'C', trust: 0.00, collections: ['museums'],
    home: 'https://www.barcelona.cat/museus', discovery: { kind: 'sitemap' },
    crawlDelayMs: 10000, maxPagesPerDay: 20 },

  { id: 'venue-official',     tier: 'C', trust: 0.00, collections: ['museums', 'shows'],
    home: null,                       // la URL sale de config/museums.ts y de la ficha
    discovery: { kind: 'perEntity' }, crawlDelayMs: 5000, maxPagesPerDay: 60 },
]
```

**Lo que ya está verificado** (consultado el 29/08/2026, directamente sobre el `robots.txt` de
cada sitio):

| Fuente | `robots.txt` | Consecuencia |
|---|---|---|
| `timeout.es` | Bloquea una lista de bots antiguos por nombre; para `User-agent: *` prohíbe `/search*`, cuentas y duplicados por idioma. **No prohíbe los artículos.** Sin `Crawl-delay`. | Se rastrea; fijamos 5 s por prudencia. |
| `barcelonasecreta.com` | Prohíbe `/wp-admin/`, `/*/feed/`, y una lista de bots basura. **No bloquea GPTBot, ClaudeBot ni CCBot.** Publica `sitemap_index.xml`. | Se rastrea vía sitemap, **no** por feeds de categoría (están prohibidos). |
| `teatrebarcelona.com` | Prohíbe `/wp-`, `/feed/`, búsqueda y checkout. **Declara `Crawl-delay: 10` para ClaudeBot y Bytespider.** Sitemaps en catalán y en español. | Se rastrea a 10 s por petición y se usa el sitemap `/es/`. |

**Lo que hay que verificar en la Fase 0** antes de activar cada fuente restante: existencia y
ruta real del sitemap o RSS, `robots.txt`, presencia de JSON-LD, y condiciones de uso. El
resultado se anota en `SOURCES.md` con fecha. Una fuente sin esa ficha no se activa.

### 4.2 Descubrimiento: sitemaps y RSS, nunca «recorrer la web»

El rastreador **no navega**: pide el sitemap o el RSS, mira `lastmod`/`pubDate` y descarga solo
lo que cambió. Esto reduce el tráfico en dos órdenes de magnitud, es lo que los sitios esperan
que hagas y es lo que hace viable el «coste cero».

```ts
// src/crawl/discover.ts (esqueleto)
export async function discover(src: SourceConfig, since: Date): Promise<string[]> {
  if (src.discovery.kind === 'sitemap') {
    const index = await fetchXml(src.discovery.url ?? new URL('/sitemap.xml', src.home).href)
    const maps  = index.sitemapindex ? index.sitemapindex.sitemap.map(s => s.loc) : [src.discovery.url]
    const urls: string[] = []
    for (const map of maps.slice(0, 8)) {              // tope: 8 sub-sitemaps por fuente
      const sm = await fetchXml(map)
      for (const u of sm.urlset?.url ?? []) {
        if (u.lastmod && new Date(u.lastmod) < since) continue
        if (src.discovery.pathIncludes &&
            !src.discovery.pathIncludes.some(p => u.loc.includes(p))) continue
        urls.push(u.loc)
      }
    }
    return urls.slice(0, src.maxPagesPerDay)
  }
  // rss / perEntity / manual…
}
```

### 4.3 Descarga: educada por construcción

`src/crawl/fetcher.ts` es el **único** punto del proyecto autorizado a hacer peticiones a
terceros. Nadie llama a `fetch` directamente. Impone:

1. **`robots.txt`**, leído una vez por host y cacheado 24 h. Si prohíbe la ruta, no se pide.
   Si declara `Crawl-delay`, se usa ese valor (nunca menos del configurado).
2. **User-Agent identificable y con contacto**:
   `bcn-curator/1.0 (+https://github.com/<usuario>/bcn-curator)`. Nada de disfrazarse de
   navegador: si un sitio no nos quiere, queremos enterarnos y respetarlo.
3. **Un host a la vez** (`p-limit(1)` por host) con el retardo configurado entre peticiones.
   Entre hosts distintos, hasta 4 en paralelo.
4. **`If-None-Match` / `If-Modified-Since`** con los valores guardados en `.cache/index/<fuente>.ndjson`. Un
   `304 Not Modified` cuesta unos pocos bytes y ahorra el parseo entero.
5. **Timeout de 15 s** (`AbortSignal.timeout(15_000)`).
6. **Tope diario por fuente** (`maxPagesPerDay`). Se lleva la cuenta en `.cache/index/<fuente>.ndjson`.

### 4.4 Errores, reintentos y cortafuegos

| Situación | Qué hace el rastreador |
|---|---|
| `304` | Marca la URL como sin cambios y sigue. Coste cero. |
| `404` / `410` | Marca la ficha como muerta. Si la ficha estaba publicada, se retira de la próxima publicación y se anota en el informe. |
| `429` o `503` con `Retry-After` | Espera lo que diga la cabecera, hasta un máximo de 60 s. Un solo reintento. |
| `429` sin cabecera | Retroceso exponencial: 5 s, 20 s, 80 s. Tres intentos. Al tercero, **la fuente se marca `paused` durante 24 h**. |
| `403` persistente | La fuente se marca `blocked`, se abre una incidencia y **se deja de rastrear hasta revisión humana**. Un 403 es una respuesta, no un obstáculo a esquivar. |
| Error de red o timeout | Dos reintentos con retroceso. Después, la URL vuelve a la cola de mañana. |
| Excepción al parsear | Se registra con la URL, se descarta esa página y el resto continúa. Nunca tumba la ejecución. |

**Regla transversal, copiada de planonmap:** ninguna de estas situaciones puede empeorar lo ya
publicado. Si una fuente falla, sus fichas anteriores siguen publicándose tal cual hasta que la
fuente vuelva o hasta que la ficha caduque por fecha.

### 4.5 Extracción: tres niveles, del más estable al más frágil

```text
1. JSON-LD (schema.org)   ← preferido. Estable ante rediseños. Cubre Event, Museum,
                            Place, Offer, openingHoursSpecification.
2. OpenGraph + <meta>     ← respaldo. og:title, og:description, og:image, article:*
3. Selectores CSS         ← último recurso, declarados por fuente en su adaptador
```

Se intentan en orden y **se fusionan**: cada campo se queda con el primer valor no vacío. El
JSON-LD es la razón por la que no hace falta un navegador y por la que un rediseño de la web no
nos rompe: WordPress con Yoast o RankMath lo emite solo, y la mayoría de estas webs son eso.

```ts
// src/crawl/extract/jsonld.ts (núcleo)
export function extractJsonLd(html: string): RawExtract[] {
  const $ = cheerio.load(html)
  const out: RawExtract[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    let data: unknown
    try { data = JSON.parse($(el).contents().text()) } catch { return }  // JSON roto: se ignora
    for (const node of flattenGraph(data)) {
      const type = String(node['@type'] ?? '')
      if (!/Event|Museum|TouristAttraction|Place|ExhibitionEvent|TheaterEvent/.test(type)) continue
      out.push({
        title: str(node.name),
        description: str(node.description),
        startDate: str(node.startDate),
        endDate: str(node.endDate),
        image: firstUrl(node.image),
        offers: node.offers,                       // → precio
        location: node.location,                   // → venue + coords
        openingHours: node.openingHoursSpecification,
        url: str(node.url),
      })
    }
  })
  return out
}
```

### 4.6 Qué hacer cuando una web cambia su HTML

Este es el fallo que más veces mata a un proyecto de scraping, así que se ataca por tres vías a
la vez:

1. **Prevención.** El orden JSON-LD → OpenGraph → selectores hace que un rediseño solo duela si
   además quitan los datos estructurados. Los selectores nunca son la primera opción.
2. **Detección automática — canario de rendimiento por fuente.** Cada adaptador registra en
   `.cache/index/<fuente>.ndjson` cuántos elementos válidos extrajo. Se guarda la mediana de los últimos 7
   días. Si una ejecución extrae **0 elementos**, o **menos del 30 % de la mediana**, o si el
   **porcentaje de campos vacíos sube más de 40 puntos**, la fuente se marca `degraded`.
3. **Reacción.**
   - La fuente degradada **no participa en el consenso de esa ejecución** (evita que un cero
     técnico se lea como «este plan ya no está avalado»).
   - Sus fichas ya publicadas **se conservan** (carry-forward).
   - Se abre **una** incidencia en GitHub titulada `fuente rota: <id>` con la URL de ejemplo, lo
     que se esperaba y lo que llegó. Si ya existe una abierta, se comenta en ella en vez de
     crear otra.
   - Tras 7 días consecutivos en `degraded`, la fuente pasa a `disabled` y deja de intentarse
     hasta que alguien arregle el adaptador.

Esto es exactamente la lección que planonmap aprendió por las malas: una degradación silenciosa
—el refresco «funciona», trae datos, pero la calidad se desploma— es peor que un fallo ruidoso.
El canario existe para que nunca sea silenciosa.

### 4.7 Normalización al esquema de planonmap

De crudo a `Candidate` (que es un `Event` incompleto más metadatos de procedencia):

- **Fechas.** Se resuelven en zona `Europe/Madrid` y se emiten **con offset** (`+02:00` en
  verano, `+01:00` en invierno). Si solo hay día sin hora, se usan las 00:00 y se marca
  `timeConfidence: 'day'` (planonmap ya sabe convivir con eso; su propio feed usa una hora
  centinela). Si no hay fecha parseable y no es un museo, **el candidato se descarta**.
- **Precio.** El texto pasa por una batería de expresiones regulares y se traduce al tipo
  discriminado: `gratuito|gratis|entrada lliure|free` → `free`; `amb invitació` → `invitation`;
  `inclòs amb l'entrada` → `included-with-admission`; `12 €`, `de 12 a 25 €` → `paid` con
  `amount`/`amountMax`; se detecta `+ despeses de gestió` → `hasSurcharge: true`. **Si nada
  casa, `unknown`. Jamás `free` por defecto.**
- **Coordenadas.** Primero del JSON-LD (`geo.latitude/longitude`). Si no hay, geocodificación
  con Nominatim de OpenStreetMap, respetando su política de 1 petición/segundo y con caché
  permanente en `.cache/geocode.json` (una dirección se geocodifica una vez en la vida). Se
  valida que caiga dentro del recuadro del área metropolitana
  (`lat 41.20–41.60`, `lng 1.90–2.35`); fuera de él, se descarta el candidato.
- **Categoría.** Reglas de palabra clave ordenadas por especificidad, calcadas del criterio de
  planonmap (`museu|museo|museum` → `museums`; `exposició|exposición|exhibition` →
  `exhibitions`; `concert|concierto|gig` → `music`; `teatre|teatro|dansa` → `arts`;
  `ruta|parc|platja|mirador` → `outdoors`; `mercat|restaurant|tast|degustació` → `food`). Sin
  coincidencia → `culture` para la colección A (nunca `other`: `other` es la papelera de
  planonmap y no queremos alimentarla).

### 4.8 Agrupación: el mismo plan en varias webs

Dos candidatos son el mismo plan si coinciden **al menos dos** de estas tres:

1. `dedupeKey` de planonmap idéntica (título normalizado + día + coords a 2 decimales);
2. distancia entre coordenadas < 150 m **y** solapamiento de fechas;
3. similitud de títulos ≥ 0,82 por trigramas (Jaccard) tras normalizar.

El cluster resultante guarda: todas las URL de origen, todas las fuentes, y **el mejor valor de
cada campo** (el más completo gana; si empatan, gana el de la fuente con mayor `trust`).

```json
// .cache/clusters/sagrada-familia-torres.json  (recortado)
{
  "clusterId": "sagrada-familia-torres",
  "title": "Sagrada Família amb accés a les torres",
  "sources": [
    { "id": "timeout-bcn",     "tier": "A", "trust": 1.00, "url": "https://www.timeout.es/barcelona/…" },
    { "id": "visit-barcelona", "tier": "B", "trust": 0.80, "url": "https://www.barcelonaturisme.com/…" },
    { "id": "venue-official",  "tier": "C", "trust": 0.00, "url": "https://sagradafamilia.org/…" }
  ],
  "consensusScore": 25,
  "venue": { "name": "Basílica de la Sagrada Família", "lat": 41.4036, "lng": 2.1744 },
  "planonmapDedupeKey": "sagradafamiliaambaccesalestorres|2026-09-01|41.40|2.17",
  "firstSeen": "2026-09-01T02:31:00Z",
  "semanticHash": "e3b0c44298fc1c14…"
}
```

### 4.9 Identidad: qué es «el mismo plan» a lo largo del tiempo

Dos problemas de modelado que el primer diseño dejó sin resolver y que habrían salido a la luz en
producción, cuando ya duele.

#### El problema de lo atemporal y la clave de deduplicación

La clave de planonmap incluye el día: `slug|YYYY-MM-DD|lat|lng`. Para un concierto es perfecta.
**Para un museo es una bomba de relojería**, porque su `startDate` rueda hacia delante en cada
refresco semanal (§8.5) y por tanto **su `dedupeKey` cambia cada semana**. Cualquier lógica que
use esa clave como identidad —la fusión con el feed abierto, el veto, la caché— fallaría en
silencio: cada semana el museo parecería un plan nuevo.

La regla, explícita:

| | Identidad estable | Clave de fusión con el feed abierto |
|---|---|---|
| `temporality: 'temporada'` | `slug` | `dedupeKey`, que es estable porque la fecha lo es |
| `temporality: 'atemporal'` | `slug` | **Proximidad + título**: coordenadas a menos de 150 m y similitud de títulos ≥ 0,82. Nunca `dedupeKey` |

La identidad **siempre** es el `slug`, en las dos filas. `dedupeKey` no es un identificador: es
una heurística de emparejamiento con un feed ajeno, y solo sirve donde la fecha significa algo.
El campo se sigue publicando —planonmap lo usa como comprobación cruzada— pero el contrato
declara que **para una ficha atemporal es inestable por construcción** y que el consumidor debe
emparejar por la vía de proximidad. Está recogido igual en el documento permanente de planonmap,
que es donde manda.

#### El problema de las funciones múltiples

Un montaje de teatro tiene veinte funciones en cinco semanas. ¿Se publica un `Event` o veinte?

**Decisión: un solo `Event` por montaje.** `startDate` = primera función, `endDate` = última, y
las funciones van en `schedule[]` con la forma `{days, hours}`. Los motivos:

- **El mapa.** planonmap trunca a 500 pines. Veinte funciones del mismo montaje serían veinte
  pines idénticos en el mismo punto, comiéndose el cupo de otros planes. El mapa ya sufrió
  exactamente esto con los programas mensuales de sala.
- **La ficha.** Un turista quiere ver «hay función de miércoles a domingo», no veinte tarjetas
  iguales que solo se distinguen por la fecha.
- **El coste.** Una redacción por montaje, no veinte.
- **El filtro de fechas ya lo resuelve.** planonmap decide si un evento con rango cae dentro de
  «hoy» o «este finde» con `happensInRange`, que exige una **sesión concreta** dentro del rango y
  lee precisamente `schedule[]`. El comportamiento correcto sale gratis.

La excepción, deliberada: **un ciclo o festival con artistas distintos cada noche NO es un
montaje**. «Agosto en el Jamboree» son treinta conciertos diferentes, y planonmap ya los expande
en fichas sueltas. Regla operativa: si cambia el artista o la obra, es otra ficha; si solo cambia
la fecha, es la misma. Cuando la fuente no permite distinguirlo, se publica una sola ficha del
ciclo y se anota `verified.schedule: false`.

---

## 5. Motor de cribado

### 5.1 La puntuación: 100 puntos, 45 sin IA y 55 con IA

Los pesos viven en `config/scoring.ts` para poder afinarlos sin tocar código.

**Bloque determinista — 45 puntos, coste cero.**

| Señal | Puntos | Cómo se calcula |
|---|---|---|
| **Consenso** | 0–25 | Base por número de fuentes de nivel A/B que lo avalan (1 → 10 · 2 → 18 · 3 → 23 · ≥4 → 25), **multiplicada por la media de su `trust`**. Las de nivel C no cuentan. Fórmula exacta abajo. |
| **Completitud** | 0–10 | 2 puntos por cada uno: precio conocido, horario, dirección con coordenadas exactas, web oficial, imagen utilizable. |
| **Vigencia** | 0–5 | 5 si el plan está activo hoy o empieza en ≤ 14 días; 3 si en ≤ 30; 1 si en ≤ 60; 0 más allá. Los museos puntúan 5 siempre. |
| **Reputación de la fuente** | 0–5 | Media ponderada del `trust` **ajustado** por la tasa histórica de aprobación editorial de esa fuente (§5.5). |

**Bloque del modelo — 55 puntos, una sola llamada por lote.**

| Señal | Puntos | Qué pregunta |
|---|---|---|
| `vale_el_viaje` | 0–15 | ¿Justifica el tiempo de alguien que solo tiene tres días? |
| `caracteristico_bcn` | 0–15 | ¿Se vive igual en cualquier otra capital europea, o es de aquí? |
| `sin_barrera_idioma` | 0–10 | ¿Se disfruta sin dominar catalán o español, o al menos lo advierte con claridad? |
| `no_trampa_turistica` | 0–15 | 15 = valor real por su precio · 0 = trampa cara y vacía. |

**Vetos duros.** Si el modelo marca `true` cualquiera de estos, el candidato **se descarta sin
importar la puntuación**: `es_trampa_turistica`, `es_generico_europeo`, `requiere_ser_local`,
`es_marca_disfrazada` (evento publicitario de marca vendido como plan cultural).

Sin ambigüedad, porque «suma de trust» y «tabla por número de fuentes» no son lo mismo y el
código tiene que elegir una:

```ts
// config/scoring.ts
export const CONSENSO_BASE = { 1: 10, 2: 18, 3: 23 } as const   // 4 o más → 25

export function puntuarConsenso(fuentes: SourceRef[]): number {
  const buenas = fuentes.filter((f) => f.tier === 'A' || f.tier === 'B')
  if (buenas.length === 0) return 0
  const base = CONSENSO_BASE[Math.min(buenas.length, 4) as 1 | 2 | 3] ?? 25
  const trustMedio = buenas.reduce((a, f) => a + f.trust, 0) / buenas.length
  return Math.round(base * trustMedio)
}
```

Dos fuentes de nivel A (`trust` 1,00 y 0,95) dan `18 × 0,975 = 18`. Dos de nivel B (0,80) dan
`18 × 0,80 = 14`. Es la diferencia que se busca: **el aval de dos medios con criterio propio pesa
más que el de dos agendas institucionales.**

**Umbral de paso al enriquecimiento: ≥ 62 puntos** y sin ningún veto. Se eligió midiendo: 62
deja pasar a un plan de dos fuentes (18) con ficha completa (10), vigente (5), fuente sólida
(4) y un juicio editorial decente (25 de 55), y detiene a uno de una sola fuente con juicio
mediocre. Es el número más ajustable del proyecto; se revisa con las métricas de §5.5.

#### La excepción de los museos

**La colección de museos no pasa por este umbral, y conviene decirlo explícitamente porque si no
el sistema se contradice.** Los museos no entran por consenso: entran porque están en
`config/museums.ts`, una lista curada a mano. Su fuente principal es su propia web —nivel C, que
puntúa 0 en consenso—, así que aplicarles el corte de 62 los dejaría fuera a casi todos, y el
Museu Picasso no necesita que dos medios lo avalen para merecer una ficha.

En consecuencia:

| | Planes y espectáculos | Museos |
|---|---|---|
| **Qué decide que entren** | Superar 62 puntos y no tener vetos | **Estar en `config/museums.ts`** |
| Cribado con modelo | Sí, es el filtro | **No se ejecuta**: no hay nada que filtrar |
| `curated.score` | La puntuación real que decidió su entrada | Se calcula igual, **solo para informar y ordenar**; no gatea nada |
| Vetos duros | Descartan la ficha | No aplican |

Meter o sacar un museo del catálogo es, por tanto, una decisión editorial explícita del
propietario: una línea en un archivo, revisada en un PR. Es lo correcto para una colección de
cincuenta y cinco entradas que apenas cambia, y de paso ahorra el cribado de todas ellas.

### 5.2 El prefiltro determinista, antes de gastar un céntimo

#### La clave de caché: sobre el significado, nunca sobre los bytes

Esto merece su propio apartado porque **es lo que decide si el proyecto cuesta tres euros o
treinta**. La tentación es cachear por el hash del HTML descargado. Sería un error caro: casi
todas estas webs cambian bytes a diario sin cambiar nada relevante —un contador de comentarios,
un «últimas entradas», un carrusel de artículos relacionados, un token anti-CSRF, una marca de
tiempo en un comentario del CMS—. Con un hash del HTML, **el descarte del paso 1 se desplomaría
del 84 % a casi cero y se pagaría por reanalizar lo mismo un día tras otro.** En una web de
teatro, que actualiza disponibilidad de entradas, pasaría literalmente todos los días.

La clave se calcula sobre los **campos ya extraídos y normalizados**, no sobre la página:

```ts
// src/core/hash.ts
export function semanticHash(c: Candidate): string {
  const material = [
    norm(c.title),
    c.startDate?.slice(0, 10) ?? '',
    c.endDate?.slice(0, 10) ?? '',
    priceFingerprint(c.price),        // 'paid:15-32' | 'free' | 'unknown'
    norm(c.venue.name),
    c.venue.lat.toFixed(4), c.venue.lng.toFixed(4),
    c.schedule.map((s) => norm(s.days) + '@' + norm(s.hours)).sort().join(';'),
    norm(c.description).slice(0, 600),   // el cuerpo, recortado y normalizado
  ].join('')
  return sha256(material)
}

/** Lo que de verdad decide si hay que volver a pagar. */
export function cacheKey(c: Candidate, task: 'screen' | 'write'): string {
  return sha256([task, PROMPT_VERSION[task], MODEL[task], semanticHash(c)].join('|'))
}
```

Tres detalles que no son cosméticos:

- `norm()` colapsa espacios, quita acentos y pasa a minúsculas: un cambio de tipografía o un
  espacio de más no cuesta dinero.
- La descripción entra **recortada a 600 caracteres normalizados**. Un medio que añade un párrafo
  promocional al final no dispara una reescritura.
- La clave incluye `PROMPT_VERSION` y `MODEL`. Cambiar el prompt invalida a propósito, que es lo
  que se quiere; pero **invalidar 200 fichas de golpe cuesta dinero**, así que subir la versión
  del prompt exige `--reprocess` explícito y muestra el coste estimado antes de empezar.

El **hash de bytes sí se usa**, pero para otra cosa y antes: como `ETag` propio para saltarse el
parseo de una página cuyo servidor no manda `ETag`. Ahorra CPU, no dinero. Son dos capas
distintas y conviene no confundirlas.

#### El orden del prefiltro

Corre **antes** que cualquier llamada a un modelo. En este orden, cortando en cuanto uno acierta:

1. `semanticHash` idéntico al de la última vez → **fuera** (ya está decidido; se reutiliza el
   veredicto en caché).
2. `slug` en `content/vetoed.json` → **fuera** (el propietario ya dijo que no).
3. Sin fecha parseable y no es museo → **fuera**.
4. Fecha ya pasada, o inicio a más de 60 días → **fuera** (misma ventana que planonmap).
5. Coordenadas fuera del recuadro metropolitano → **fuera**.
6. La URL casa con la lista negra de rutas (`/publirreportaje/`, `/branded/`, `/patrocinado/`,
   `/sorteo/`, `/promo/`, `/casino/`, `/apuestas/`) → **fuera**.
7. El título o el sumario contienen marcadores publicitarios (`contenido patrocinado`,
   `en colaboración con`, `#ad`, `código descuento`) → **fuera**.
8. Menos de 200 caracteres de texto útil extraído → **fuera** (no hay material para escribir
   una ficha honesta).
9. Colección A y **una sola fuente de nivel A/B** con puntuación determinista < 20 → **fuera**
   (sin consenso ni ficha decente, no hay caso).
10. `dedupeKey` que ya existe en el feed público de planonmap **y** el evento de planonmap ya
    tiene descripción larga, imagen y web oficial → **fuera** (no aportamos nada).

**Descarte estimado en este punto: 84 % por el paso 1 (contenido sin cambios) y un 50 %
adicional de lo que queda por los pasos 2–10. Es decir, de ~250 URL descubiertas al día llegan
al modelo unas 20.** Es la pieza que hace que la factura sea de céntimos.

### 5.3 El prompt literal del cribado

Modelo: **`gpt-5-mini`** de OpenAI, en llamada **síncrona**. Justificación en §7.2 y §7.2 bis.

Configuración de la llamada: `response_format` de tipo `json_schema` con `strict: true`,
`reasoning_effort: 'low'`, **`max_output_tokens: 3000`**. Lote de **10 candidatos**.

**Ojo con `max_output_tokens`: incluye los tokens de razonamiento.** El JSON visible de un lote de
diez ronda los 650 tokens, así que un tope de 1.200 parece de sobra — y no lo es: a
`reasoning_effort: low` el modelo genera además unos 850 de razonamiento, y el tope se aplica a la
suma. Con 1.200 la respuesta se cortaría a mitad de JSON de forma intermitente, que es la peor
clase de fallo: aparece unas veces sí y otras no. 3.000 deja margen holgado y **no cuesta nada**,
porque se paga por tokens generados, no por el tope.

**Prompt de sistema** (constante, cacheable, versión `screen-v1`):

```text
Eres el filtro de calidad de una guía de Barcelona escrita para turistas que pasan
entre dos y cinco días en la ciudad. Tu única tarea es puntuar candidatos. No
escribes contenido, no corriges datos y no inventas nada.

CRITERIO. Un buen plan cumple:
- Vale el viaje y el tiempo de alguien con pocos días.
- Es característico de Barcelona: no se vive igual en Milán, Lisboa o Berlín.
- Está avalado por varias fuentes independientes.
- Tiene información práctica clara (precio, horario, dónde).
- Se disfruta sin dominar catalán ni español, o el propio plan lo advierte.

NO es un buen plan:
- Trampa turística: caro para lo que da, pensado solo para quien está de paso.
- Genérico europeo: existe igual en cualquier capital del continente.
- Requiere ser local: peña de barrio, asamblea vecinal, actividad para socios.
- Evento de marca disfrazado de plan cultural: el producto es el protagonista.

REGLAS DE PUNTUACIÓN.
- Puntúa SOLO con la información que te doy. Si falta un dato, eso baja la nota;
  no lo supongas.
- Un plan puede ser excelente y aun así puntuar bajo en "sin_barrera_idioma".
  Son ejes independientes.
- Que aparezca en muchas fuentes es SEÑAL POSITIVA de calidad, no repetición.
- La justificación va en español, en 12 palabras como máximo. Es para el
  propietario, no para el público.

Devuelve EXCLUSIVAMENTE el JSON del esquema. Sin texto antes ni después.
```

**Prompt de usuario** (una llamada por lote de 10):

```text
Puntúa estos candidatos. Devuelve un resultado por cada uno, con su `id`.

[1] id: sagrada-familia-torres
    titulo: Sagrada Família amb accés a les torres
    lugar: Basílica de la Sagrada Família (Eixample)
    fechas: permanente
    precio: 36 EUR
    fuentes: timeout-bcn(A), visit-barcelona(B), venue-official(C)
    texto: Visita a la basílica de Gaudí con subida en ascensor a una de las
      torres. Audioguía incluida en 16 idiomas. Se recomienda comprar la entrada
      con antelación; en temporada alta se agota con días de margen.

[2] id: nit-poesia-gracia
    titulo: Nit de poesia catalana al Casal de Gràcia
    lugar: Casal de Barri de Gràcia
    fechas: 2026-09-12 20:00
    precio: gratuito
    fuentes: beteve-agenda(A)
    texto: Recital obert de poetes del barri. Micro obert a partir de les 22 h.
      Activitat en català.

… (hasta 10)
```

**Esquema de salida forzado** (`json_schema`, `strict: true`):

```json
{
  "name": "screening",
  "schema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["results"],
    "properties": {
      "results": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": ["id", "vale_el_viaje", "caracteristico_bcn",
                       "sin_barrera_idioma", "no_trampa_turistica",
                       "es_trampa_turistica", "es_generico_europeo",
                       "requiere_ser_local", "es_marca_disfrazada",
                       "temporalidad", "motivo"],
          "properties": {
            "id":                  { "type": "string" },
            "vale_el_viaje":       { "type": "integer", "minimum": 0, "maximum": 15 },
            "caracteristico_bcn":  { "type": "integer", "minimum": 0, "maximum": 15 },
            "sin_barrera_idioma":  { "type": "integer", "minimum": 0, "maximum": 10 },
            "no_trampa_turistica": { "type": "integer", "minimum": 0, "maximum": 15 },
            "es_trampa_turistica": { "type": "boolean" },
            "es_generico_europeo": { "type": "boolean" },
            "requiere_ser_local":  { "type": "boolean" },
            "es_marca_disfrazada": { "type": "boolean" },
            "temporalidad":        { "type": "string", "enum": ["atemporal", "temporada"] },
            "motivo":              { "type": "string", "maxLength": 90 }
          }
        }
      }
    }
  }
}
```

Respuesta esperada para el lote de arriba (recortada):

```json
{ "results": [
  { "id": "sagrada-familia-torres", "vale_el_viaje": 15, "caracteristico_bcn": 15,
    "sin_barrera_idioma": 10, "no_trampa_turistica": 12,
    "es_trampa_turistica": false, "es_generico_europeo": false,
    "requiere_ser_local": false, "es_marca_disfrazada": false,
    "temporalidad": "atemporal", "motivo": "Icono único de la ciudad, audioguía multilingüe" },
  { "id": "nit-poesia-gracia", "vale_el_viaje": 5, "caracteristico_bcn": 11,
    "sin_barrera_idioma": 1, "no_trampa_turistica": 15,
    "es_trampa_turistica": false, "es_generico_europeo": false,
    "requiere_ser_local": true, "es_marca_disfrazada": false,
    "temporalidad": "temporada", "motivo": "Recital en catalán para público del barrio" }
]}
```

El segundo queda fuera por `requiere_ser_local: true`, y su motivo explica al propietario por
qué sin que tenga que abrir nada.

### 5.4 Cómo se mantiene la calidad al agrupar en lotes

Agrupar diez candidatos en una llamada abarata, pero introduce dos riesgos reales. Ambos se
mitigan de forma concreta:

- **Contaminación entre candidatos** (que el modelo puntúe alto por comparación con los otros
  nueve del lote, no en absoluto). Mitigación: el prompt de sistema define escalas absolutas y
  no menciona comparación; los lotes se **barajan** para que candidatos de la misma fuente o
  categoría no viajen juntos; y cada resultado se identifica por `id` obligatorio.
- **Deriva o truncamiento** (que el modelo devuelva ocho de diez). Mitigación: `strict: true`
  fuerza el esquema; el código comprueba que llegan exactamente los `id` enviados y **reintenta
  individualmente** los que falten. Lote máximo de 10; con 12.000 caracteres de entrada por
  lote no hay riesgo de contexto.

### 5.5 Cómo se mide si acierta (y cómo se afina)

Cada decisión se guarda en `.cache/decisions/<año-mes>.ndjson` con la puntuación desglosada, el
modelo, la versión del prompt y los tokens consumidos. **La etiqueta de verdad es gratis: es lo
que hace el propietario en el PR de revisión** — mergear es «acierto», borrar el archivo es
«fallo».

`src/report/metrics.ts` calcula cada semana:

| Métrica | Definición | Objetivo |
|---|---|---|
| **Precisión editorial** | fichas aprobadas / fichas propuestas | ≥ 0,80 |
| **Precisión por fuente** | ídem, filtrado por fuente que aportó el candidato | se usa para ajustar `trust` |
| **Coste por ficha publicada** | euros del mes / fichas aprobadas | ≤ 0,10 € |
| **Tasa de omisión** | campos omitidos por falta de evidencia / campos totales | ≤ 0,15 |
| **Enlaces muertos** | fichas publicadas cuya URL oficial devuelve 404 | 0 |

Ajuste automático de la reputación de fuente, mensual:

```ts
// Con al menos 20 propuestas acumuladas de esa fuente:
if (aprobacion < 0.30) source.trust = 0            // deja de contar para el consenso
else if (aprobacion < 0.50) source.trust *= 0.5    // se degrada a la mitad
else if (aprobacion > 0.85) source.trust = Math.min(1.0, source.trust * 1.1)
```

El cambio se propone en un PR, no se aplica solo: es una decisión editorial y el propietario la
ve.

### 5.6 Variedad forzada

La puntuación sola produce listas monótonas (seis museos de arte, todos en Ciutat Vella, todos
de 15 €). La selección final es una pasada codiciosa **con cuotas**, en el mismo espíritu que la
diversificación que ya usa el mapa de planonmap:

```ts
// src/screen/diversify.ts
export const QUOTAS = {
  maxPorCategoria: 2,        // por ejecución
  maxPorBarrio: 2,
  maxPorRecinto: 1,
  minGratuitos: 1,           // al menos 1 de cada 4 seleccionados es gratis o < 10 €
  minAtemporales: 1,         // imprescindible que existe todo el año
  minTemporada: 1,           // novedad que caduca
}
```

Algoritmo: ordenar por puntuación descendente; recorrer; aceptar si ninguna cuota se rompe;
si al final falta cubrir un mínimo (`minGratuitos`, `minAtemporales`, `minTemporada`), se
recorre otra vez **rebajando el umbral a 55** solo para ese hueco. Si aun así no hay candidato,
el hueco se queda vacío: **nunca se publica algo malo por rellenar una cuota.**

### 5.7 Cómo se sabe que un cambio de prompt mejora, y no empeora

Las métricas de §5.5 miden el sistema **en producción y a semanas vista**. Eso es imprescindible,
pero llega tarde para la pregunta que uno se hace de verdad: *acabo de reescribir el prompt,
¿está mejor o peor?* Sin una respuesta, los prompts se afinan por intuición y la calidad deriva
sin que nadie lo note, que es el modo habitual de fallar de estos sistemas.

**El conjunto dorado.** `evals/screen/golden.jsonl` guarda 24 candidatos reales que el
propietario ha etiquetado a mano una sola vez: 8 claramente buenos, 8 claramente malos y 8 en la
frontera, que son los que de verdad discriminan. Cada línea lleva el material recortado tal cual
lo vería el modelo y el veredicto humano.

```jsonl
{"id":"sagrada-familia-torres","material":"…","label":"aceptar","expectedBand":"alto","notes":"icono, multilingüe"}
{"id":"nit-poesia-gracia","material":"…","label":"rechazar","expectedVeto":"requiere_ser_local"}
{"id":"cata-vinos-hotel","material":"…","label":"rechazar","expectedVeto":"es_marca_disfrazada"}
{"id":"mercat-sant-antoni","material":"…","label":"aceptar","expectedBand":"medio","notes":"frontera: local pero accesible"}
```

**El comando.**

```bash
pnpm eval:screen                      # con el prompt actual
pnpm eval:screen --prompt screen-v2   # con el candidato
pnpm eval:screen --compare screen-v1 screen-v2
```

Corre los 24 en dos lotes con el modelo de cribado. Coste: **menos de un céntimo por pasada**,
porque son los mismos 24 candidatos y el prompt de sistema es idéntico. Informa de:

| Métrica | Qué mide | Umbral para aceptar el cambio |
|---|---|---|
| Aciertos totales | Coincidencia con la etiqueta humana | ≥ 21 de 24 |
| Falsos positivos | Malos que pasarían el umbral | ≤ 1 |
| Vetos duros correctos | Los cuatro vetos, uno a uno | 100 % en los casos claros |
| Estabilidad | Desviación de la puntuación al repetir la pasada | ≤ 4 puntos |

**Un falso positivo pesa más que un falso negativo**, y el umbral lo refleja: dejar fuera un buen
plan cuesta un plan; publicar una trampa turística cuesta credibilidad, que es todo lo que tiene
una guía curada.

`evals/write/golden.jsonl` hace lo propio con la redacción, sobre 8 fichas aceptadas, y comprueba
mecánicamente lo que se puede comprobar sin juicio: que ningún 8-grama coincide con el material,
que todas las evidencias son subcadenas literales, que ES y EN están dentro de las longitudes, y
que ningún término de la lista prohibida («imprescindible», «joya escondida», «hidden gem»…)
aparece. No juzga el estilo —eso lo hace una persona— pero **caza las regresiones objetivas**.

**Regla de oro:** subir `PROMPT_VERSION` sin haber pasado la evaluación está prohibido, y
`ci.yml` lo comprueba: si el commit toca un prompt y no toca el informe de evaluación
correspondiente, falla.

### 5.8 El contrato con planonmap no puede divergir en silencio

`contracts/event.ts` es una copia del `types/event.ts` de planonmap. Una copia que nadie vigila
es exactamente el fallo que este proyecto ya ha cometido dos veces —reglas de clasificación
duplicadas en dos normalizadores, traducciones aplicadas en un solo camino de los dos—, así que
la copia lleva tres salvaguardas:

1. **Procedencia registrada.** `contracts/UPSTREAM.md` (anexo A.4) anota de qué commit de
   planonmap salió la transcripción y cuándo. La cabecera del archivo lo repite. El esquema
   completo y listo para pegar está en el **anexo A.1**: no hace falta acceso a planonmap para
   crearlo.

2. **Fixture dorado compartido.** `contracts/golden/curated-golden.json` contiene un elemento de
   cada colección —los tres ejemplos del §8 valen tal cual— y **existe byte a byte en los dos
   repositorios**. Lo produce **este** proyecto y se entrega a planonmap al empezar la fase 2;
   la dirección importa, porque el productor es quien decide qué emite. `bcn-curator` comprueba
   que su esquema lo valida; planonmap comprueba lo mismo con el suyo. Si alguien cambia un campo
   obligatorio en cualquiera de los dos lados, **uno de los dos tests se pone en rojo el mismo
   día**, no seis meses después con doscientas fichas escritas.

3. **La validación autoritativa es la del consumidor.** `bcn-curator` valida para fallar pronto,
   pero quien decide qué entra es planonmap, que revalida todo lo que recibe. Si algún día las dos
   discrepan, **gana planonmap**, porque es quien sirve la web.

---

## 6. Motor de enriquecimiento

Es la parte que más importa y la única donde se usa el modelo caro.

### 6.1 Principio: se reescribe, no se copia

La ficha final **no contiene ni una frase de la fuente**. El modelo recibe material extraído
como *datos*, no como texto a versionar, y escribe de cero para un lector que no conoce la
ciudad. Esto no es solo una cuestión legal (§12.1): es que el texto de origen está escrito para
otro lector — alguien que ya sabe qué es un casal, dónde cae Gràcia y qué significa «entrada
lliure».

Tres barreras concretas contra la copia:

1. **El prompt lo prohíbe explícitamente** y describe el cambio de destinatario.
2. **Comprobación mecánica de solapamiento:** si algún 8-grama de palabras del texto generado
   aparece literalmente en el material de origen, la ficha se rechaza y se reintenta una vez con
   una instrucción adicional. Al segundo fallo, la ficha se marca `needs-human` y no se publica.
3. **Longitud y estructura distintas por diseño:** pedimos 90–130 palabras en un formato fijo
   que ninguna fuente usa.

### 6.2 Recorte del material antes de enviarlo

`src/enrich/material.ts` construye el paquete que viaja al modelo. Tope duro: **2.500 tokens**.
Nunca se envía una página entera.

```ts
export function buildMaterial(cluster: Cluster): string {
  return [
    `TITULOS_ORIGEN: ${cluster.titles.slice(0, 3).join(' | ')}`,
    `LUGAR: ${cluster.venue.name} — ${cluster.venue.address}`,
    `BARRIO: ${cluster.venue.neighborhood ?? '?'} · DISTRITO: ${cluster.venue.district ?? '?'}`,
    `COORDENADAS: ${cluster.venue.lat}, ${cluster.venue.lng}`,
    `TRANSPORTE: ${cluster.transitHints.join('; ')}`,       // paradas < 500 m, de OSM
    `FECHAS: ${cluster.dateSummary}`,
    `HORARIOS: ${cluster.scheduleLines.slice(0, 12).join(' / ')}`,
    `PRECIO_TEXTO: ${cluster.priceTexts.slice(0, 3).join(' | ')}`,
    `WEB_OFICIAL: ${cluster.officialUrl ?? '—'}`,
    `ENTRADAS: ${cluster.ticketsUrl ?? '—'}`,
    `FUENTES: ${cluster.sources.map(s => s.id).join(', ')}`,
    '--- EXTRACTOS (datos, no texto a copiar) ---',
    ...cluster.extracts.map((e, i) => `[${i + 1}] ${clip(e.text, 700)}`),   // máx. 3 extractos
  ].join('\n')
}
```

Las **paradas de transporte** salen de una consulta previa a Overpass API de OpenStreetMap
(metro, bus, FGC y Rodalies a menos de 500 m), cacheada por coordenada en `.cache/geocode.json`.
Se hace fuera del modelo a propósito: es un dato objetivo y gratis, y pedirle al modelo que
adivine la parada de metro es la forma más rápida de tener una alucinación con aspecto de dato.

### 6.3 El prompt literal de redacción

Modelo: **`claude-opus-5`** vía **Message Batches API** (50 % de descuento). Justificación en
§7.2. `max_tokens: 4000`, `output_config: { effort: 'low' }`.

**Por qué `effort: low` y no más.** Redactar una ficha con este prompt no es un problema difícil:
el material ya viene extraído y recortado, la rúbrica es explícita y la salida está forzada por
esquema. El pensamiento extra no mejora el texto y **se factura como salida** (§7.4), que es la
partida cara. Medido sobre el escenario esperado, pasar de `low` a `high` sube el coste mensual
de ~1,91 € a más del doble sin que la ficha mejore. Si algún día una colección pidiera juicio de
verdad, se sube el `effort` de esa colección y se mide con `pnpm eval:write`.

**Prompt de sistema** (constante y cacheado; versión `write-v1`):

```text
Escribes fichas para una guía de Barcelona dirigida a viajeros que pasan pocos días
en la ciudad y no conocen ni el idioma ni los barrios. Escribes en español y en
inglés, y las dos versiones son originales: la inglesa no es una traducción literal
de la española, sino el mismo contenido escrito para ese lector.

QUÉ HACES
- Reescribes por completo. NUNCA copies ni parafrasees de cerca el material de
  origen: son datos para ti, no texto a versionar. Cambia el orden, la estructura y
  el vocabulario.
- Explicas lo que un local da por supuesto: dónde cae el barrio, qué se ve, cuánto
  se tarda, si hay cola, si hace falta reservar.
- Escribes en segunda persona del plural implícita, tono claro y directo, sin
  adjetivos de folleto. Prohibido: "imprescindible", "no te lo puedes perder",
  "joya escondida", "experiencia única", "mágico", "hidden gem", "must-see".

QUÉ NO HACES NUNCA
- No inventas. Ni un precio, ni un horario, ni una fecha, ni una parada de metro, ni
  un dato de la exposición. Si el material no lo dice, el campo va vacío.
- No conviertes precios ni calculas duraciones que no estén en el material, salvo
  que la conversión sea aritmética directa sobre un dato presente.
- No opinas sobre la calidad artística. Dices qué es y por qué le puede interesar a
  este lector.

EVIDENCIAS (la regla más importante)
Para CADA campo factual —precio, horarios, fechas, duración, reserva, idioma— debes
incluir en "evidencias" el fragmento LITERAL del material del que lo sacaste,
copiado carácter a carácter. Si no puedes señalar el fragmento literal, deja el
campo vacío y no lo incluyas en "evidencias". Un campo sin evidencia se elimina
automáticamente después, así que inventarlo no sirve de nada.

LONGITUDES
- resumen: 90-130 palabras en cada idioma.
- porQueMerecePena: UNA frase, máximo 22 palabras, sin subordinadas encadenadas.
- comoLlegar: máximo 25 palabras, empezando por la parada más cercana del material.

Devuelve EXCLUSIVAMENTE el JSON del esquema, sin texto antes ni después.
```

**Prompt de usuario** (uno por ficha; se envían en lote de hasta 30 en una sola petición al
Batch API):

```text
COLECCION: museums
MATERIAL:
TITULOS_ORIGEN: Museu Picasso de Barcelona | Museu Picasso
LUGAR: Museu Picasso — Carrer Montcada, 15-23, 08003 Barcelona
BARRIO: Sant Pere, Santa Caterina i la Ribera · DISTRITO: Ciutat Vella
COORDENADAS: 41.385228, 2.180968
TRANSPORTE: Jaume I (L4) 350 m; Barceloneta (L4) 600 m; bus V15, 120
FECHAS: permanente
HORARIOS: Dimarts a diumenge 10:00-19:00 / Dijous 10:00-21:30 / Dilluns tancat
PRECIO_TEXTO: Entrada general 15 €; col·lecció permanent gratuïta dijous de 16 a
  19 h i primer diumenge de mes tot el dia; menors de 18 anys gratuït
WEB_OFICIAL: https://www.museupicasso.bcn.cat/
ENTRADAS: https://www.museupicasso.bcn.cat/es/entradas
FUENTES: articket, museus-bcn, venue-official
--- EXTRACTOS (datos, no texto a copiar) ---
[1] El museu conserva 4.251 obres de Picasso i és el més complet de la seva etapa
    de formació. Ocupa cinc palaus gòtics del carrer Montcada…
[2] Exposició temporal: "Picasso i el circ", fins al 18 de gener de 2027…
```

**Esquema de salida forzado** (herramienta con `strict: true`, o `output_config.format`):

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["slug", "titulo", "resumen", "porQueMerecePena", "evidencias"],
  "properties": {
    "slug":   { "type": "string", "pattern": "^[a-z0-9-]{3,60}$" },
    "titulo": { "type": "object", "additionalProperties": false,
                "required": ["es", "en"],
                "properties": { "es": { "type": "string", "maxLength": 90 },
                                "en": { "type": "string", "maxLength": 90 } } },
    "resumen": { "type": "object", "additionalProperties": false,
                 "required": ["es", "en"],
                 "properties": { "es": { "type": "string", "maxLength": 1200 },
                                 "en": { "type": "string", "maxLength": 1200 } } },
    "porQueMerecePena": { "type": "object", "additionalProperties": false,
                          "required": ["es", "en"],
                          "properties": { "es": { "type": "string", "maxLength": 160 },
                                          "en": { "type": "string", "maxLength": 160 } } },
    "comoLlegar":   { "type": "object", "properties": { "es": {"type":"string"}, "en": {"type":"string"} } },
    "queIncluye":   { "type": "object", "properties": { "es": {"type":"string"}, "en": {"type":"string"} } },
    "duracionMin":  { "type": "integer", "minimum": 15, "maximum": 600 },
    "reserva":      { "type": "string", "enum": ["ninguna", "recomendada", "obligatoria"] },
    "reservaDiasAntelacion": { "type": "integer", "minimum": 0, "maximum": 90 },
    "publico":      { "type": "string", "enum": ["todos", "familiar", "adultos", "mayores"] },
    "idiomaActividad": { "type": "array", "items": { "type": "string", "enum": ["ca","es","en","sin-idioma"] } },
    "museo": {
      "type": "object",
      "properties": {
        "horarios":  { "type": "array", "items": { "type": "object",
                       "required": ["dias","horas"],
                       "properties": { "dias": {"type":"string"}, "horas": {"type":"string"} } } },
        "gratuidades": { "type": "array", "items": { "type": "string", "maxLength": 120 } },
        "exposicionVigente": { "type": "object",
          "properties": { "titulo": {"type":"string"}, "hasta": {"type":"string","format":"date"} } },
        "minutosVisita": { "type": "integer", "minimum": 20, "maximum": 300 },
        "entradaAnticipada": { "type": "boolean" }
      }
    },
    "espectaculo": {
      "type": "object",
      "properties": {
        "artistaCompania": { "type": "string", "maxLength": 120 },
        "sala":            { "type": "string", "maxLength": 120 },
        "sobretitulos":    { "type": "array", "items": { "type": "string", "enum": ["ca","es","en"] } }
      }
    },
    "evidencias": {
      "type": "array",
      "items": { "type": "object", "additionalProperties": false,
                 "required": ["campo", "fragmento"],
                 "properties": { "campo": { "type": "string" },
                                 "fragmento": { "type": "string", "maxLength": 300 } } }
    }
  }
}
```

### 6.4 Verificación anti-alucinación: mecánica, gratis y despiadada

`src/enrich/verify.ts` corre **después** del modelo y **no usa IA**. Para cada evidencia:

1. Se normaliza (minúsculas, sin acentos, espacios colapsados) tanto el fragmento como el
   material de origen.
2. Se comprueba que el fragmento sea **subcadena literal** del material. Si no lo es → el campo
   asociado se **elimina de la ficha** y se anota en `verified.<campo> = false`.
3. Para campos numéricos (precio, duración, minutos de visita) se exige además que **el número
   aparezca como dígitos** en el fragmento.
4. Para fechas se exige que la fecha emitida se pueda derivar del fragmento y caiga dentro de la
   ventana de vigencia.

Y tres invariantes por encima:

- **Nunca se inventa un campo. Se omite.** Es la regla que decide qué hacer cuando falta un
  dato. Solo hay una excepción, abajo.
- **Se descarta la ficha entera** si falla alguno de los cuatro campos que la hacen útil:
  `titulo`, `resumen`, coordenadas del recinto, o —para la colección B— fecha y hora de la
  sesión. Sin ellos no hay ficha que publicar.
- **Nada se marca «gratis» sin evidencia explícita.** Si no hay prueba, `price.type = 'unknown'`,
  exactamente igual que hace planonmap con sus feeds.

| Situación | Qué se hace | Por qué |
|---|---|---|
| Falta el precio | `price.type = 'unknown'`, campo `queIncluye` omitido | La UI de planonmap ya sabe no decir nada. Mentir sobre el precio es el peor error posible. |
| Falta el horario | Se omite `schedule`; se conserva `startDate` | La ficha sigue siendo útil. |
| Falta el «cómo llegar» | Se omite | Es agradable, no imprescindible. |
| Falta la imagen | Se omite → planonmap usa su cascada propia | Ver §12.2. |
| Falta la fecha de una sesión (colección B) | **Se descarta la ficha** | Un espectáculo sin fecha no es un espectáculo. |
| Faltan coordenadas | **Se descarta la ficha** | Sin coordenadas no hay mapa, ni cercanía, ni «cómo llegar». |
| El modelo devuelve JSON inválido dos veces | **Se descarta**, se anota en el informe | No hay tercera. |

### 6.5 Cómo se gestiona el bilingüe

- El modelo escribe **ES y EN en la misma llamada**. Cuesta la mitad que dos llamadas y garantiza
  que ambas versiones cuentan lo mismo, con los mismos datos.
- El prompt pide explícitamente que la inglesa **no sea traducción literal**: los topónimos y
  los nombres propios se mantienen en su forma original (`Sagrada Família`, `Museu Picasso`,
  `Gràcia`), pero las explicaciones se escriben para un lector anglófono.
- El mapeo al esquema de planonmap:

  ```ts
  event.title            = ficha.titulo.es          // campo plano = español
  event.description      = ficha.resumen.es
  event.contentLang      = 'es'
  event.i18n.title       = { es: ficha.titulo.es,  en: ficha.titulo.en }
  event.i18n.description = { es: ficha.resumen.es, en: ficha.resumen.en }
  ```

  El catalán se deja ausente a propósito: la interfaz de planonmap cae al español, que es su
  idioma por defecto, y añadir una tercera versión subiría el coste un 40 % para un público que
  no es el destinatario de esta guía.
- **Comprobación automática de paridad:** si una versión tiene menos del 60 % de las palabras de
  la otra, o si una está vacía, la ficha se marca `needs-human` y no se publica.

### 6.6 Museos: por qué casi no cuestan

Un museo cambia de horario dos veces al año y de exposición temporal tres o cuatro. El resto del
tiempo, reprocesarlo es tirar el dinero. El flujo semanal es:

1. Se descarga la ficha oficial (una petición, con `If-None-Match`).
2. Se extraen **de forma determinista** los campos volátiles: horarios, precios, gratuidades,
   título y fecha de fin de la exposición temporal.
3. Se calcula `changeHash = sha256(JSON.stringify(camposVolátiles))`.
4. Si el hash **no cambió** → no se llama a ningún modelo. Coste: 0 €.
5. Si cambiaron **solo horarios o precios** → se actualizan los campos estructurados
   directamente. **Tampoco se llama a ningún modelo**: son datos, y el texto narrativo no
   hablaba de ellos.
6. Si cambió **la exposición temporal** → ahí sí se vuelve a llamar al modelo, porque el texto
   sí la menciona. Se estima en unas 4 fichas al mes.

Con eso, la colección C cuesta unos **0,12 €/mes** en régimen estacionario, frente a los ~1,73 €
del arranque. Es la mejor ilustración del principio general: **un plan ya analizado nunca se
vuelve a analizar.**

---

## 7. Estrategia de IA y costes

### 7.1 Infraestructura: dónde está el cero y dónde está el límite

Todo lo que no sean las APIs de IA es gratuito, sin tarjeta y sin servidores encendidos. Esta
es la tabla honesta, pieza por pieza:

| Pieza | Servicio | Límite del plan gratuito | Uso estimado | A partir de qué volumen se agota |
|---|---|---|---|---|
| Ejecución programada | GitHub Actions en **repositorio público** | Minutos **ilimitados**; 6 h por job; 20 jobs concurrentes | ~12 min/día ≈ 360 min/mes | No se agota por cuota. Solo tocaríamos el techo si un job pasara de 6 h. |
| Producto y caché | Git en el propio repositorio | Recomendado < 1 GB; aviso de GitHub a partir de 5 GB | ~15 MB de `content/` + `.cache/` tras un año | Décadas al ritmo actual. |
| Publicación de datos | GitHub Pages | 1 GB de sitio · **100 GB/mes de tráfico** · 10 builds/hora | JSON total < 3 MB; planonmap lo descarga 1–2 veces al día | Harían falta ~35.000 descargas del JSON completo al mes. Inalcanzable con un solo consumidor. |
| Panel de revisión | Pull Requests de GitHub | Ilimitado | 1 PR/día | Nunca. |
| Registro y alertas | Logs de Actions + Issues | 90 días de retención de logs; artefactos hasta 500 MB | Texto | Nunca. |
| Geocodificación | Nominatim (OpenStreetMap) | **Política de uso razonable**: 1 petición/segundo, User-Agent identificable | < 60 peticiones/mes tras el arranque, gracias a la caché permanente | No es una cuota contractual: es cortesía. Con caché permanente estamos tres órdenes de magnitud por debajo. |
| Paradas de transporte | Overpass API (OpenStreetMap) | Ídem, uso razonable | < 60 peticiones/mes | Ídem. |

**Aviso honesto sobre Nominatim y Overpass:** no son «planes gratuitos» con un contrato detrás;
son servicios comunitarios con una política de uso razonable. Si se abusa, bloquean por IP y
tienen todo el derecho. Por eso la caché de geocodificación es **permanente** (una dirección se
resuelve una vez en la vida) y por eso el fallo se degrada bien: si Nominatim no responde, el
candidato sin coordenadas **se descarta**, nunca se le inventa una posición.

### 7.2 Reparto de tareas entre los dos modelos

| Tarea | Proveedor y modelo | Modo | Precio por millón de tokens | Por qué |
|---|---|---|---|---|
| **Cribado y puntuación** | OpenAI · **`gpt-5-mini`** | **Síncrono** | entrada **$0,25** · salida **$2,00** | Clasificación con rúbrica fija y salida corta: lo que mejor hace un modelo pequeño. Va en síncrono a propósito (§7.2 bis): el resultado hace falta **en la misma ejecución** para decidir qué se redacta, y en lote cuesta solo 7 céntimos menos al mes. |
| **Redacción final bilingüe** | Anthropic · **`claude-opus-5`** | **Batch API** (−50 %) | entrada **$2,50** · salida **$12,50** | Prosa original en dos idiomas con restricciones duras y salida JSON compleja con evidencias. Aquí es donde un modelo puntero se paga solo. Y aquí es donde el descuento del 50 % vale de verdad: **2,85 € frente a 5,69 €**. |
| **Palanca de emergencia** | Anthropic · **`claude-sonnet-5`** | Batch API | entrada **$1,00** · salida **$5,00** | Si el gasto se acerca al tope, `WRITER_MODEL` pasa a Sonnet 5: la mitad de coste. Es cambiar una variable de entorno, sin tocar código. |

#### 7.2 bis · Por qué el cribado NO va en lote, aunque sea más barato

Es la decisión menos obvia del apartado y conviene entenderla, porque afecta a la forma de todo
el pipeline.

**El Batch API de los dos proveedores es asíncrono.** Envías el lote, te devuelve un
identificador, y los resultados llegan cuando llegan: en la práctica suele ser menos de una hora,
pero el compromiso de servicio es de **hasta 24 horas**. No es una llamada que se espera dentro
de un `await`.

Eso choca de frente con dos cosas: un job de GitHub Actions no puede quedarse esperando (ni debe:
pagarías minutos por dormir), y **el cribado y la redacción son dependientes** — no puedes redactar
hasta saber qué candidatos han pasado el corte. Encadenar dos lotes asíncronos convertiría el
pipeline en tres fases repartidas a lo largo del día.

Con el cribado en síncrono, todo se simplifica a **dos fases** (§7.2 ter) y el precio de esa
simplificación está medido: **7 céntimos al mes**. Un lote de 10 candidatos con salida JSON corta
tarda unos segundos; los dos lotes diarios caben de sobra en la ejecución.

La redacción se queda en lote porque ahí el descuento sí mueve la aguja —**2,84 € al mes de
diferencia**— y porque su latencia no molesta a nadie: nada de esto es urgente.

#### 7.2 ter · Las dos fases del día

```text
02:30 UTC · FASE «submit»                        06:30 UTC · FASE «collect»
────────────────────────────────                 ──────────────────────────────────
rastrear                                         consultar el lote pendiente
prefiltrar (sin IA)                              ¿listo?  no → salir sin hacer nada
agrupar                                                        (reintentos 10:30 y 14:30)
cribar  ← SÍNCRONO, resultado inmediato          ¿listo?  sí ↓
seleccionar y diversificar                       verificar evidencias
enviar el lote de redacción  ──────────┐         escribir las fichas
guardar el id en .cache/               │         abrir el PR de propuesta
pending-batches.json y commitear       │
                                       └──────▶ (el mismo lote, 4 h después)
```

`.cache/pending-batches.json` es lo que une las dos fases, y viaja en la rama de propuesta como
todo lo demás:

```json
[
  { "id": "msgbatch_01Xy…", "provider": "anthropic", "task": "write",
    "submittedAt": "2026-09-03T02:41:07Z", "expiresAt": "2026-09-04T02:41:07Z",
    "customIds": ["write|write-v1|claude-opus-5|9f2b4c1e…", "…"] }
]
```

Tres propiedades que hacen esto robusto:

- **Idempotente.** Cada elemento del lote lleva como `custom_id` su clave de caché (§5.2). Si una
  fase `collect` se ejecuta dos veces, la segunda encuentra las fichas ya escritas y no hace nada.
- **Sin pérdidas.** Si `collect` no encuentra el lote listo, **sale con éxito y sin tocar nada**.
  Los reintentos de las 10:30 y 14:30 lo recogen. El identificador sigue en el archivo.
- **Con caducidad.** Si a las 26 horas el lote sigue sin resolverse, se cancela, se registra el
  incidente y los candidatos vuelven a la cola del día siguiente. Nunca se queda colgado.

**Por qué `gpt-5-mini` y no `gpt-5-nano`.** `gpt-5-nano` cuesta cinco veces menos ($0,025 /
$0,20 en lote), pero el cribado tiene que distinguir «caro pero lo vale» de «trampa turística»,
que es un juicio con matiz. El ahorro absoluto entre uno y otro es de **tres céntimos al mes**:
no compensa perder criterio por eso. Si algún día el volumen se multiplicara por cien, se
reconsidera.

**Por qué dos proveedores y no uno.** Con un solo proveedor el proyecto sería algo más simple:
un SDK, una clave, un régimen de límites. Se usan dos porque (a) el propietario lo pidió
explícitamente y (b) hay un beneficio real: si uno tiene una incidencia, el pipeline sigue
funcionando en modo degradado con el otro (§7.7). El precio de la decisión es concreto y
asumible: dos dependencias, dos secretos y dos contadores de gasto.

### 7.3 Las cinco palancas de ahorro, con números

1. **Prefiltro sin IA (§5.2).** De ~250 URL descubiertas al día, el 84 % no ha cambiado desde
   la última visita (se detecta con `ETag`/`Last-Modified` y con `semanticHash`, sin descargar
   nada en muchos casos). De las ~40 restantes, el prefiltro determinista descarta la mitad.
   **Al modelo llegan unas 20 al día: un 8 % de lo rastreado.**
2. **Caché agresiva y persistente.** Clave:
   `sha256(tarea + promptVersion + modelo + semanticHash)` (§5.2). Si esa clave existe en
   `.cache/decisions/` o `content/cards/`, **no se llama al modelo, punto**. La caché vive en git,
   así que sobrevive a los runners efímeros y se puede auditar y revertir. Un museo analizado en
   octubre se vuelve a analizar solo si su ficha oficial cambia de verdad.
3. **Procesamiento en lote, y Batch API donde compensa.** Cribado: 10 candidatos por llamada
   síncrona (una sola copia del prompt de sistema para diez juicios). Redacción: hasta 30 fichas
   en un solo lote del **Batch API** (cada ficha es una petición dentro del lote), que descuenta el **50 %** — sobre la partida grande, eso
   divide la factura casi por dos. Se puede usar porque nada de esto es urgente: el pipeline
   envía de madrugada, recoge unas horas después y el resultado se revisa por la mañana (§7.2 ter).
4. **Salida estructurada y compacta.** JSON estricto por esquema en las dos llamadas. Prompts de
   sistema breves y constantes (cacheables). Material recortado a 2.500 tokens: nunca se envía
   una página entera. El campo `motivo` del cribado está limitado a 90 caracteres a propósito.
5. **Tope de gasto duro (§7.6).**

### 7.4 La tabla de costes

Supuestos y método, para que puedas rehacer los números tú mismo:

- Tipo de cambio: **1 USD = 0,93 €** (agosto de 2026). Los precios de las APIs están en dólares;
  las columnas en euros son conversión directa.
- La **redacción** va por Batch API (50 % de descuento ya aplicado); el **cribado** va en
  síncrono, a precio de lista, por el motivo del §7.2 bis.
- **Los tokens de razonamiento se facturan como salida, y aquí están contados.** Es el error de
  estimación más común con estos modelos y el que más desvía una previsión: tanto el
  `reasoning_effort` de OpenAI como el pensamiento adaptativo de Claude generan tokens que no ves
  en la respuesta pero que pagas al precio de salida. Por eso las cifras de abajo son más altas
  que si contaras solo el JSON visible.
- **Cribado**, por lote de 10 candidatos: entrada ~5.130 (430 de sistema + 470 × 10); salida
  ~1.500, de los cuales unos 650 son el JSON visible y ~850 razonamiento a `reasoning_effort: low`.
- **Redacción**, por ficha: entrada ~3.200 (700 de sistema + 2.500 de material); salida ~2.100,
  de los cuales ~1.400 son el JSON visible —los dos idiomas más las evidencias literales, que son
  lo que más pesa— y ~700 pensamiento a `effort: low`.
- Mes de 30 días.

**De dónde sale el volumen, que es la cifra que más condiciona el resultado.** No es una
suposición al aire: se deriva de los tamaños de colección del §2.3. Entre las tres hay
**90–160 fichas vivas**, y las de museos no caducan. Con una rotación mensual del 30–40 % en
planes y espectáculos salen **unas 2 fichas nuevas o reescritas al día**, no más. Una estimación
de 4 al día implicaría renovar el catálogo entero cada tres semanas, que no es lo que hace una
guía curada.

**Escenario ESPERADO** — régimen normal, temporada media:

| Etapa | Volumen diario | Volumen mensual | Tokens entrada/mes | Tokens salida/mes | Coste USD | Coste EUR |
|---|---|---|---|---|---|---|
| Rastreo (sin IA) | 250 URL descubiertas | 7.500 | — | — | 0,00 | **0,00 €** |
| Prefiltro (sin IA) | 40 nuevas → 20 clusters | 600 clusters | — | — | 0,00 | **0,00 €** |
| Cribado · `gpt-5-mini` (síncrono) | 2 lotes de 10 | 60 lotes | 307.800 | 90.000 | 0,257 | **0,24 €** |
| Redacción · `claude-opus-5` (lote) | 2 fichas | 60 fichas | 192.000 | 126.000 | 2,055 | **1,91 €** |
| Museos · `claude-opus-5` (lote) | — (semanal) | 4 fichas reescritas | 12.800 | 8.400 | 0,137 | **0,13 €** |
| Publicación (sin IA) | — | — | — | — | 0,00 | **0,00 €** |
| | | | | | **$2,45** | **≈ 2,28 €/mes** |

**Escenario MÍNIMO** — invierno, poca novedad, casi todo resuelto por caché:

| Etapa | Volumen mensual | Tokens entrada | Tokens salida | Coste USD | Coste EUR |
|---|---|---|---|---|---|
| Cribado · `gpt-5-mini` | 30 lotes de 10 | 153.900 | 45.000 | 0,128 | 0,12 € |
| Redacción · `claude-opus-5` | 30 fichas | 96.000 | 63.000 | 1,028 | 0,96 € |
| Museos · `claude-opus-5` | 1 ficha | 3.200 | 2.100 | 0,034 | 0,03 € |
| | | | | **$1,19** | **≈ 1,11 €/mes** |

**Escenario PEOR CASO** — La Mercè, primavera de festivales, y un reproceso por cambio de prompt:

| Etapa | Volumen mensual | Tokens entrada | Tokens salida | Coste USD | Coste EUR |
|---|---|---|---|---|---|
| Cribado · `gpt-5-mini` | 90 lotes de 10 | 461.700 | 135.000 | 0,385 | 0,36 € |
| Redacción · `claude-opus-5` | 240 fichas | 768.000 | 504.000 | 8,220 | 7,64 € |
| Museos · `claude-opus-5` | 12 fichas reescritas | 38.400 | 25.200 | 0,411 | 0,38 € |
| | | | | **$9,02** | **≈ 8,39 €/mes** |

**El peor caso casi duplica el tope de 5 €, y por eso el tope existe.** Al alcanzarlo, el sistema
deja de llamar a los modelos y sigue publicando la última versión buena (§7.6). No es un fallo
del diseño: es el diseño. Fíjate además en que ese escenario supone **240 fichas en un mes**
sobre unas colecciones de 90–160: no es un mes cargado, es un reproceso masivo, y lo normal es
que ocurra porque tú lo hayas pedido con `--reprocess`.

**Si prefieres que ni el peor mes se corte**, la palanca ya está preparada y medida:
`WRITER_MODEL=claude-sonnet-5` deja el escenario esperado en **≈ 1,05 €/mes** y el peor caso en
**≈ 3,4 €**, siempre por debajo del tope. Pierdes calidad de redacción, que es justo donde no
conviene ahorrar mientras el presupuesto aguante — por eso el titular es Opus y esto es una
palanca, no el ajuste por defecto.

**Coste de ARRANQUE (una sola vez, no recurrente):**

| Concepto | Volumen | Tokens entrada | Tokens salida | Coste EUR |
|---|---|---|---|---|
| Catálogo inicial de museos | 55 fichas escritas | 176.000 | 115.500 | 1,75 € |
| Cribado de la piscina inicial | 30 lotes (300 candidatos) | 153.900 | 45.000 | 0,12 € |
| Fichas iniciales de planes y espectáculos | 45 fichas escritas | 144.000 | 94.500 | 1,43 € |
| | | | | **≈ 3,30 € una sola vez** |

**Interpretación en una frase:** el primer mes cuesta unos **5,6 €** (arranque más operación) y
los siguientes rondan los **2,3 €**, con un tope duro que impide que se dispare. El coste por
ficha publicada sale a unos **3,6 céntimos**.

**Qué haría saltar estas cifras, por si lo ves en el libro de gasto:** subir la versión de un
prompt sin `--reprocess` acotado (reescribe todo lo que toque), añadir el catalán como tercer
idioma (~+40 % de salida), subir el `effort` de la redacción de `low` a `high` (el pensamiento se
multiplica), o que la caché deje de acertar por haber vuelto a indexar por el hash del HTML
(§5.2). Los cuatro se ven en `pnpm spend` el mismo día.

### 7.5 Lo que NO es gratis, dicho sin maquillar

- Las APIs de IA se pagan por uso. **No existe una versión gratuita real** de ninguna de las
  dos. El plan gratuito de OpenAI para desarrolladores no cubre esto, y Anthropic no ofrece
  crédito recurrente. Hay que poner una tarjeta y cargar saldo.
- Ambas exigen **saldo prepago o método de pago** antes de la primera llamada. Recomendación:
  cargar 10 $ en cada una y **no activar la recarga automática**, para que el saldo actúe como
  segundo tope físico por debajo del lógico.
- Si algún día quisieras las tres colecciones en catalán además de español e inglés, el coste de
  salida sube alrededor de un 40 %.
- Nominatim y Overpass son cortesía de la comunidad de OpenStreetMap, no un derecho.

### 7.6 Tope de gasto duro

- Se configura en `config/budget.ts` y se sobrescribe con la variable de entorno
  `AI_MONTHLY_BUDGET_EUR` (por defecto **5**).
- El libro de gasto vive en `.cache/spend/<año-mes>.json`, versionado:

  ```json
  {
    "month": "2026-09",
    "budgetEur": 5.0,
    "spentEur": 1.87,
    "byModel": { "gpt-5-mini": 0.04, "claude-opus-5": 1.83 },
    "calls": [
      { "at": "2026-09-03T02:34:11Z", "model": "claude-opus-5", "task": "write",
        "inputTokens": 12800, "outputTokens": 5600, "eur": 0.095, "batchId": "msgbatch_…" }
    ]
  }
  ```

- **Antes** de cada llamada se estima su coste (con `messages.count_tokens` de Anthropic para la
  redacción; con el recuento de caracteres partido por 3,6 para OpenAI, que sobreestima a
  propósito). Si `spentEur + estimado > budgetEur`, la llamada **no se hace**.
- **Con el Batch API, el gasto se apunta dos veces.** Al **enviar** se anota el importe
  *estimado* y se marca `pending: true`: así el tope ya cuenta con un lote en vuelo y no se puede
  enviar un segundo lote que juntos lo rebasarían. Al **recoger** se sustituye por el consumo
  *real* que devuelve la respuesta y se quita la marca. Sin ese apunte provisional, tres
  ejecuciones seguidas podrían enviar tres lotes creyendo cada una que hay presupuesto de sobra.
- **Qué pasa exactamente al alcanzarlo**, en este orden:
  1. Se registra el corte en el log con el desglose por modelo.
  2. Se abre **una** incidencia en GitHub: `presupuesto de IA agotado — <mes>`. Si ya existe, se
     comenta.
  3. Las etapas de rastreo, prefiltro, consenso, deduplicación y publicación **siguen corriendo**.
  4. Los candidatos que necesitaban IA quedan en `.cache/queue.json` con su material recortado ya
     preparado, listos para procesarse el día 1 del mes siguiente **sin volver a rastrear**.
  5. **La publicación no cambia:** `dist/v1/*.json` se regenera con las fichas ya escritas. La
     web de planonmap no nota nada.
- Un aviso a mitad de camino: al superar el **70 %** del tope se comenta en la incidencia del
  mes, para que haya margen de reacción antes del corte.

### 7.7 Degradación sin IA

El sistema tiene que seguir siendo útil con las dos APIs caídas. Qué se sigue publicando:

| Qué | ¿Funciona sin IA? | Detalle |
|---|---|---|
| Las tres colecciones ya publicadas | **Sí, íntegras** | Las fichas viven en `content/cards/`, no en el proveedor. Se republican tal cual. |
| Fechas, horarios y precios de fichas existentes | **Sí** | La extracción es determinista. Un cambio de horario se aplica sin tocar un modelo. |
| Retirada de fichas caducadas | **Sí** | Comparación de fechas. |
| Retirada de fichas con enlace muerto | **Sí** | Comprobación HTTP. |
| Detección de cambios en museos | **Sí** | Es un hash. Solo la reescritura del texto necesita modelo. |
| Fichas **nuevas** | **No** | Quedan en cola con el material ya preparado. |
| Reordenación por puntuación | **Parcialmente** | Se usan solo los 45 puntos deterministas; el ranking es peor, pero existe. |

Y la cascada de proveedor: si Anthropic falla o devuelve error persistente, el redactor pasa
automáticamente a `gpt-5` de OpenAI ($0,625/$5,00 en lote) para esa ejecución, se anota en la
ficha qué modelo la escribió, y se marca `needsRewrite: true` para que el redactor titular la
rehaga cuando vuelva. Si fallan los dos, se aplica la degradación de la tabla.

---

## 8. Formato de salida

> **Este apartado y el apartado 2 del documento `docs/fuente-externa.md` de planonmap describen
> el MISMO contrato. Si alguna vez divergen, gana `fuente-externa.md`**, porque es el que vive
> en el repositorio que consume los datos.

### 8.1 Estructura de archivos publicados

```text
https://<usuario>.github.io/bcn-curator/v1/index.json      ← índice y sumas de verificación
https://<usuario>.github.io/bcn-curator/v1/plans.json      ← colección A
https://<usuario>.github.io/bcn-curator/v1/shows.json      ← colección B
https://<usuario>.github.io/bcn-curator/v1/museums.json    ← colección C
```

`v1` es la versión del **contrato**, no del contenido. Un cambio incompatible estrena `v2` y
`v1` se mantiene servido en paralelo al menos 90 días (§9.4).

### 8.2 El índice

```json
{
  "schemaVersion": 1,
  "producer": "bcn-curator",
  "producerVersion": "1.4.2",
  "generatedAt": "2026-09-03T02:48:11.204Z",
  "collections": [
    { "name": "plans",   "url": "https://<usuario>.github.io/bcn-curator/v1/plans.json",
      "count": 41, "generatedAt": "2026-09-03T02:48:11.204Z",
      "sha256": "9f2b4c1e77a0d5f3b8c6e4a1d9027bc5f31e8a6d24b09c7e5f1a3d8b60c294e7" },
    { "name": "shows",   "url": "https://<usuario>.github.io/bcn-curator/v1/shows.json",
      "count": 23, "generatedAt": "2026-09-03T02:48:11.204Z",
      "sha256": "3ac81d90fe27b6c4a5083e1df9b27a6c04e5182d7fb3096ac1e847d5b2093f6e" },
    { "name": "museums", "url": "https://<usuario>.github.io/bcn-curator/v1/museums.json",
      "count": 52, "generatedAt": "2026-08-31T02:12:44.001Z",
      "sha256": "77e1c0d5a3924b8f60e2d1478ca509b36f24e8d05713ab9c8e6f204d1b3a5c92" }
  ]
}
```

`sha256` es la suma del archivo tal cual se sirve. planonmap la comprueba al descargar; si no
cuadra, descarta el archivo y conserva el que ya tenía.

### 8.3 El envoltorio de cada colección

```json
{
  "schemaVersion": 1,
  "collection": "museums",
  "generatedAt": "2026-08-31T02:12:44.001Z",
  "count": 52,
  "license": "CC-BY-4.0",
  "items": [ /* … */ ]
}
```

**Cada elemento de `items` es un `Event` de planonmap válido, con un bloque `curated` añadido.**
Esa es la decisión de diseño central: no inventamos un formato, extendemos el suyo. Si algún día
`bcn-curator` desaparece, los datos siguen siendo legibles por cualquier consumidor del esquema
`Event`.

### 8.4 El bloque `curated`, campo a campo

| Campo | Tipo | Oblig. | Descripción |
|---|---|---|---|
| `collection` | `'plans' \| 'shows' \| 'museums'` | **Sí** | Colección a la que pertenece. |
| `slug` | `string` `^[a-z0-9-]{3,60}$` | **Sí** | Identificador estable de por vida. Clave de caché y de veto. |
| `schemaVersion` | `1` | **Sí** | Versión del contrato. |
| `curatedAt` | ISO 8601 con offset | **Sí** | Cuándo se escribió esta versión de la ficha. |
| `promptVersion` | `string` | **Sí** | Versión del prompt de redacción (`write-v1`). Permite saber qué fichas rehacer al cambiarlo. |
| `score` | `number` 0–100 | **Sí** | Puntuación final del cribado. |
| `temporality` | `'atemporal' \| 'temporada'` | **Sí** | Imprescindible de siempre, o novedad que caduca. |
| `consensus.sourceCount` | `integer` ≥ 1 | **Sí** | Cuántas fuentes de nivel A/B lo avalan. |
| `consensus.sources` | `string[]` | **Sí** | Sus identificadores. |
| `whyWorthIt.es` / `.en` | `string` ≤ 160 | **Sí** (`es`) | Por qué merece la pena, en una frase. |
| `practical.durationMinutes` | `integer` | No | Duración estimada. |
| `practical.booking` | `'ninguna' \| 'recomendada' \| 'obligatoria'` | No | Si hay que reservar. |
| `practical.bookingLeadDays` | `integer` | No | Con cuánta antelación. |
| `practical.activityLang` | `('ca'\|'es'\|'en'\|'sin-idioma')[]` | No | Idioma **de la actividad**, no de la ficha. `sin-idioma` = no hace falta entender nada. |
| `practical.transit.es` / `.en` | `string` ≤ 200 | No | Cómo llegar en transporte público. |
| `practical.priceIncludes.es` / `.en` | `string` ≤ 200 | No | Qué incluye el precio. |
| `show.artistOrCompany` | `string` | No | Solo colección B. |
| `show.room` | `string` | No | Sala concreta dentro del recinto. |
| `show.surtitles` | `('ca'\|'es'\|'en')[]` | No | Sobretítulos o traducción disponibles. |
| `museum.openingHours` | `{days, hours}[]` | No | Horarios por día. Misma forma que `Event.schedule`. |
| `museum.freeAdmission` | `string[]` | No | Franjas de entrada gratuita, en texto. |
| `museum.currentExhibition.title` | `string` | No | Exposición temporal vigente. |
| `museum.currentExhibition.endsOn` | `YYYY-MM-DD` | No | Cuándo termina. |
| `museum.visitMinutes` | `integer` | No | Tiempo de visita recomendado. |
| `museum.bookAhead` | `boolean` | No | Si conviene entrada anticipada. |
| `provenance[]` | `{url, publisher, tier, retrievedAt}[]` | **Sí** | Fuentes consultadas. Mínimo 1. |
| `verified` | `{price, schedule, dates, location: boolean, method: string}` | **Sí** | Qué pasó la verificación por evidencias. |
| `planonmap.dedupeKey` | `string` | **Sí** | Clave calculada con el algoritmo de planonmap (§1.9). |
| `planonmap.mergeHint` | `'new' \| 'merge'` | **Sí** | Pista: si esperamos que ya exista en el feed abierto. |

### 8.5 Ejemplo completo · colección C (museos)

> Los valores son **ilustrativos**. En producción todos salen de extracción verificada.

```json
{
  "id": "curated|museums|museu-picasso",
  "source": "curated",
  "sourceId": "museu-picasso",
  "sourceUrl": "https://www.museupicasso.bcn.cat/",
  "officialUrl": "https://www.museupicasso.bcn.cat/",
  "ticketsUrl": "https://www.museupicasso.bcn.cat/es/entradas",
  "contentLang": "es",
  "title": "Museu Picasso",
  "description": "Cinco palacios góticos encadenados en la calle Montcada guardan la colección más completa de la juventud de Picasso: más de cuatro mil obras que van de los cuadernos de adolescencia a la serie de Las Meninas. No es el Picasso de los carteles, sino el que aprendía a serlo, y por eso se entiende mejor aquí que en ningún otro sitio. El recorrido es cómodo y bien señalizado, y los propios edificios —patios, escaleras exteriores, artesonados— valen la visita aparte. Está en el Born, así que la visita se encadena sin esfuerzo con Santa Maria del Mar y el paseo del Born.",
  "startDate": "2026-08-31T00:00:00+02:00",
  "endDate": "2027-08-31T00:00:00+02:00",
  "venue": {
    "name": "Museu Picasso",
    "address": "Carrer de Montcada, 15-23, 08003 Barcelona",
    "lat": 41.385228,
    "lng": 2.180968,
    "neighborhood": "Sant Pere, Santa Caterina i la Ribera",
    "district": "Ciutat Vella",
    "municipality": "barcelona",
    "zipCode": "08003",
    "locationPrecision": "exact"
  },
  "category": "museums",
  "price": { "type": "paid", "amount": 15, "currency": "EUR" },
  "tags": ["museo", "arte", "picasso", "ciutat-vella"],
  "audience": "todos",
  "schedule": [
    { "days": "Martes a domingo", "hours": "de 10.00 h a 19.00 h" },
    { "days": "Jueves", "hours": "de 10.00 h a 21.30 h" },
    { "days": "Lunes", "hours": "cerrado" }
  ],
  "i18n": {
    "title": { "es": "Museu Picasso", "en": "Museu Picasso" },
    "description": {
      "es": "Cinco palacios góticos encadenados en la calle Montcada guardan…",
      "en": "Five linked Gothic palaces on Carrer Montcada hold the most complete collection of Picasso's early years: over four thousand works, from teenage sketchbooks to his Las Meninas series. This is not the Picasso of the posters but the one still learning to be him, which is exactly why he makes more sense here than anywhere else. The route is easy to follow, and the buildings themselves — courtyards, outdoor staircases, coffered ceilings — are worth the ticket on their own. You are in El Born, so it pairs naturally with Santa Maria del Mar and a walk down Passeig del Born."
    }
  },
  "curated": {
    "collection": "museums",
    "slug": "museu-picasso",
    "schemaVersion": 1,
    "curatedAt": "2026-08-31T02:12:44.001Z",
    "promptVersion": "write-v1",
    "score": 91,
    "temporality": "atemporal",
    "consensus": { "sourceCount": 2, "sources": ["visit-barcelona", "bcn-cultura"] },
    "whyWorthIt": {
      "es": "La mejor colección del mundo del Picasso que aún estaba aprendiendo a ser Picasso.",
      "en": "The world's best collection of Picasso before he became Picasso."
    },
    "practical": {
      "durationMinutes": 105,
      "booking": "recomendada",
      "bookingLeadDays": 2,
      "activityLang": ["sin-idioma"],
      "transit": {
        "es": "Metro Jaume I (L4), a 350 m. Buses V15 y 120 en Via Laietana.",
        "en": "Jaume I metro (L4), 350 m away. Buses V15 and 120 on Via Laietana."
      },
      "priceIncludes": {
        "es": "Colección permanente y exposición temporal. Audioguía aparte.",
        "en": "Permanent collection and temporary exhibition. Audio guide sold separately."
      }
    },
    "museum": {
      "openingHours": [
        { "days": "Martes a domingo", "hours": "10:00–19:00" },
        { "days": "Jueves", "hours": "10:00–21:30" },
        { "days": "Lunes", "hours": "cerrado" }
      ],
      "freeAdmission": [
        "Jueves de 16:00 a 19:00 (colección permanente)",
        "Primer domingo de mes, todo el día",
        "Menores de 18 años, siempre"
      ],
      "currentExhibition": { "title": "Picasso i el circ", "endsOn": "2027-01-18" },
      "visitMinutes": 105,
      "bookAhead": true
    },
    "provenance": [
      { "url": "https://www.museupicasso.bcn.cat/es/horarios-y-precios",
        "publisher": "Museu Picasso de Barcelona", "tier": "C",
        "retrievedAt": "2026-08-31T02:04:19.882Z" },
      { "url": "https://www.barcelonaturisme.com/…",
        "publisher": "Barcelona Turisme", "tier": "B",
        "retrievedAt": "2026-08-31T02:05:02.117Z" }
    ],
    "verified": {
      "price": true, "schedule": true, "dates": true, "location": true,
      "method": "evidence-substring"
    },
    "planonmap": {
      "dedupeKey": "museupicasso|2026-08-31|41.39|2.18",
      "mergeHint": "new"
    }
  }
}
```

**Nota sobre `startDate` y `endDate` en museos.** Un museo no caduca, pero el esquema `Event`
exige `startDate`. Convenio: `startDate` = medianoche del día de generación (zona
`Europe/Madrid`) y `endDate` = un año después. En cada refresco semanal, ambas ruedan hacia
delante. **El `id` y el `slug` no cambian nunca**, así que los favoritos, los enlaces
compartidos y el posicionamiento en buscadores sobreviven al refresco. Esto encaja con la
ventana de vigencia de planonmap (de ayer a +60 días por `startDate`, retirada por `endDate`):
un museo siempre está dentro.

### 8.6 Ejemplo · colección B (espectáculos), recortado

```json
{
  "id": "curated|shows|el-rei-lear-lliure-2026",
  "source": "curated",
  "sourceId": "el-rei-lear-lliure-2026",
  "sourceUrl": "https://www.teatrelliure.com/…",
  "officialUrl": "https://www.teatrelliure.com/…",
  "ticketsUrl": "https://www.teatrelliure.com/…/entrades",
  "contentLang": "es",
  "title": "El rei Lear en el Teatre Lliure",
  "description": "Montaje de la tragedia de Shakespeare…",
  "startDate": "2026-10-08T20:00:00+02:00",
  "endDate": "2026-11-02T21:45:00+01:00",
  "venue": {
    "name": "Teatre Lliure — Sala Fabià Puigserver",
    "address": "Plaça de Margarida Xirgu, 1, 08004 Barcelona",
    "lat": 41.3721, "lng": 2.1531,
    "neighborhood": "El Poble-sec", "district": "Sants-Montjuïc",
    "municipality": "barcelona", "locationPrecision": "exact"
  },
  "category": "arts",
  "price": { "type": "paid", "amount": 20, "amountMax": 32, "currency": "EUR" },
  "tags": ["teatro", "shakespeare", "poble-sec"],
  "schedule": [
    { "days": "Miércoles a sábado", "hours": "20:00" },
    { "days": "Domingo", "hours": "18:00" }
  ],
  "i18n": { "title": { "es": "…", "en": "King Lear at Teatre Lliure" },
            "description": { "es": "…", "en": "…" } },
  "curated": {
    "collection": "shows", "slug": "el-rei-lear-lliure-2026", "schemaVersion": 1,
    "curatedAt": "2026-09-03T02:47:02.551Z", "promptVersion": "write-v1",
    "score": 74, "temporality": "temporada",
    "consensus": { "sourceCount": 2, "sources": ["teatre-barcelona", "timeout-bcn"] },
    "whyWorthIt": {
      "es": "Shakespeare en catalán con sobretítulos en inglés, en la sala pública más ambiciosa de la ciudad.",
      "en": "Shakespeare in Catalan with English surtitles, in the city's most ambitious public theatre."
    },
    "practical": {
      "durationMinutes": 165, "booking": "obligatoria", "bookingLeadDays": 5,
      "activityLang": ["ca"],
      "transit": { "es": "Metro Poble Sec (L3), a 400 m.", "en": "Poble Sec metro (L3), 400 m away." }
    },
    "show": {
      "artistOrCompany": "Companyia del Teatre Lliure",
      "room": "Sala Fabià Puigserver",
      "surtitles": ["en", "es"]
    },
    "provenance": [ { "url": "https://www.teatrebarcelona.com/es/…", "publisher": "Teatre Barcelona",
                      "tier": "B", "retrievedAt": "2026-09-03T02:33:10.004Z" } ],
    "verified": { "price": true, "schedule": true, "dates": true, "location": true,
                  "method": "evidence-substring" },
    "planonmap": { "dedupeKey": "elreilearenelteatrelliure|2026-10-08|41.37|2.15",
                   "mergeHint": "merge" }
  }
}
```

Fíjate en `mergeHint: "merge"`: el Lliure publica su temporada en la agenda del Ajuntament, así
que es muy probable que planonmap ya tenga este evento por la vía de datos abiertos. La ficha
curada no lo duplica: lo mejora (§9.3 y §5 del documento permanente).

### 8.7 Ejemplo · colección A (mejores planes), recortado

```json
{
  "id": "curated|plans|sagrada-familia-torres",
  "source": "curated",
  "sourceId": "sagrada-familia-torres",
  "sourceUrl": "https://sagradafamilia.org/",
  "officialUrl": "https://sagradafamilia.org/",
  "ticketsUrl": "https://sagradafamilia.org/entradas",
  "contentLang": "es",
  "title": "Sagrada Família con subida a las torres",
  "description": "…",
  "startDate": "2026-09-03T00:00:00+02:00",
  "endDate": "2027-09-03T00:00:00+02:00",
  "venue": {
    "name": "Basílica de la Sagrada Família",
    "address": "Carrer de Mallorca, 401, 08013 Barcelona",
    "lat": 41.4036, "lng": 2.1744,
    "neighborhood": "La Sagrada Família", "district": "Eixample",
    "municipality": "barcelona", "locationPrecision": "exact"
  },
  "category": "culture",
  "categories": ["culture", "museums"],
  "price": { "type": "paid", "amount": 36, "currency": "EUR" },
  "tags": ["gaudi", "modernismo", "eixample", "imprescindible"],
  "audience": "todos",
  "i18n": { "title": { "es": "…", "en": "Sagrada Família with tower access" },
            "description": { "es": "…", "en": "…" } },
  "curated": {
    "collection": "plans", "slug": "sagrada-familia-torres", "schemaVersion": 1,
    "curatedAt": "2026-09-03T02:47:02.551Z", "promptVersion": "write-v1",
    "score": 96, "temporality": "atemporal",
    "consensus": { "sourceCount": 3, "sources": ["timeout-bcn", "visit-barcelona", "bcn-cultura"] },
    "whyWorthIt": {
      "es": "El interior es el motivo real de la visita: la luz de las vidrieras no se parece a nada.",
      "en": "The interior is the actual reason to go: the stained-glass light is like nothing else."
    },
    "practical": {
      "durationMinutes": 90, "booking": "obligatoria", "bookingLeadDays": 7,
      "activityLang": ["sin-idioma"],
      "transit": { "es": "Metro Sagrada Família (L2 y L5), a 100 m.",
                   "en": "Sagrada Família metro (L2 and L5), 100 m away." },
      "priceIncludes": { "es": "Basílica, audioguía y ascensor a una torre. La bajada es a pie.",
                         "en": "Basilica, audio guide and lift up one tower. You walk back down." }
    },
    "provenance": [ /* … */ ],
    "verified": { "price": true, "schedule": false, "dates": true, "location": true,
                  "method": "evidence-substring" },
    "planonmap": { "dedupeKey": "sagradafamiliaconsubidaalastorres|2026-09-03|41.40|2.17",
                   "mergeHint": "new" }
  }
}
```

Observa `verified.schedule: false`: no se encontró evidencia literal de un horario, así que
`schedule` **se omitió** en lugar de inventarse. La ficha se publica igual, porque los cuatro
campos que la hacen útil sí están.

---

## 9. Publicación y entrega

### 9.1 El mecanismo elegido: JSON estático versionado sobre GitHub Pages

**Decisión: `bcn-curator` publica archivos JSON estáticos en GitHub Pages, y planonmap los
descarga en su refresco diario y guarda una copia versionada en su propio repositorio.**

Las tres opciones que se compararon:

| | **JSON estático en Pages** (elegida) | API propia (Vercel / Cloudflare Workers) | Base de datos externa (Supabase / Neon) |
|---|---|---|---|
| Coste | 0 € real, sin tarjeta | 0 € en el plan gratuito, pero consume la misma cuota de funciones que ya se agotó una vez en planonmap | Los planes gratuitos **pausan por inactividad** y hay que despertarlos |
| Acoplamiento | **Ninguno**: planonmap lee un archivo de su propio repositorio | planonmap depende de que un servicio responda | planonmap necesita credenciales y un cliente de base de datos |
| Si tu proyecto deja de publicar | planonmap sigue igual, indefinidamente | Las peticiones fallan; hay que programar el respaldo | Ídem, y además hay que gestionar la conexión muerta |
| Historial y reversión | `git revert` sobre el commit del snapshot | Requiere versionado propio | Requiere migraciones y copias |
| Caché | La CDN de GitHub, gratis | Hay que configurarla y pagarla en CPU | No aplica |
| Revisión antes de publicar | **Es un diff en un PR**: se lee como texto | Requiere un panel | Requiere un panel |
| Latencia para el usuario final | Cero: el dato ya está en el build de planonmap | Una petición de red por visita o por revalidación | Ídem |

La primera fila decide, pero la segunda es la que importa de verdad: la restricción número uno
del encargo es «si la fuente deja de publicar, planonmap sigue funcionando igual». Con un archivo
versionado eso no es una promesa, es una **imposibilidad de fallo**: planonmap lee un archivo de
su propio disco.

Además, planonmap **ya tiene este patrón funcionando**. El catálogo de la tienda Merakis vive
en `data/sources/merakis-products.json`, un snapshot versionado que se refresca a mano y se
procesa en el build. La fuente externa entra por el mismo carril, sin inventar mecanismos.

### 9.2 Cómo publica `bcn-curator`

1. `curate.yml` escribe en la **rama de propuesta** —nunca en `main`— y abre o actualiza el PR de
   revisión (§10).
2. Al mergear el PR, se dispara `publish.yml`, que ejecuta `src/publish/build.ts`: lee
   `content/cards/`, aplica los vetos, archiva lo caducado, valida **cada elemento contra el
   esquema Zod completo** y escribe `dist/v1/*.json` más el `index.json` con las sumas.
3. Si **un solo elemento** no valida, se registra y se **excluye ese elemento**; el resto se
   publica. Si fallan más del 20 % de los elementos de una colección, **no se publica esa
   colección** y se conserva la anterior.
4. `dist/` se sube como **artefacto de Pages** y se despliega.

**`dist/` no se commitea, y esa es una corrección deliberada respecto al primer diseño.** Publicar
por artefacto (`actions/upload-pages-artifact` + `actions/deploy-pages`, la vía estándar y
gratuita en repositorios públicos) en vez de commitear la salida generada evita tres problemas
reales:

- **Historial limpio.** Commitear `dist/` duplicaría en cada publicación todo lo que ya está en
  `content/`, con diffs de miles de líneas que no aportan información y que enterrarían el único
  diff que se lee: el de las fichas.
- **Sin carreras.** Un artefacto no compite por un `push`; commitear la salida sí.
- **Una sola fuente de verdad.** `content/` es el producto; `dist/` es una proyección. Tener las
  dos versionadas invita a que diverjan.

Reversión: como `dist/` se deriva de `content/`, volver atrás es `git revert` del commit de
contenido y relanzar `publish.yml`. Se recupera exactamente el estado anterior, que es más de lo
que da un `dist/` commiteado.

Cabeceras que sirve Pages: `Cache-Control: max-age=600` y `ETag`. planonmap manda
`If-None-Match` y un `304` no cuesta nada.

### 9.3 Cómo lo recoge planonmap

> ⛔ **ESTE APARTADO NO ES TRABAJO TUYO.**
>
> Es el único del documento que describe archivos **dentro del repositorio de planonmap**. No los
> crees en el tuyo: no pintarían nada y no encajarían en ninguna parte. Tu responsabilidad
> termina cuando publicas la URL con los tres JSON.
>
> Está aquí por dos motivos legítimos: para que sepas **qué le pasa a lo que produces** —y por
> tanto por qué el formato tiene las exigencias que tiene—, y para que puedas responder si
> alguien te pregunta cómo se conecta. Cuando llegue ese día, lo hará quien tenga acceso a
> planonmap, siguiendo su propia documentación.
>
> Léelo como quien lee el manual de instalación del aparato que ha fabricado: interesa saberlo,
> pero el instalador es otro.

Tres pasos, ninguno en tiempo de petición:

```bash
# En el repositorio de planonmap:
pnpm fetch:curated     # descarga, verifica sha256, valida con Zod y escribe el snapshot
```

1. **`scripts/fetch-curated.ts`** (nuevo en planonmap) descarga `index.json`, comprueba la suma
   de cada colección, descarga los tres archivos, los valida con Zod y escribe:

   ```text
   data/sources/curated-plans.json
   data/sources/curated-shows.json
   data/sources/curated-museums.json
   ```

   Si algo falla —red, suma incorrecta, esquema inválido— **no escribe nada** y termina con
   código 0. El snapshot anterior sigue en su sitio. Misma filosofía que las guardas del
   `fetch-events.ts` actual.

2. Se añade `pnpm fetch:curated` al workflow `refresh-data.yml` de planonmap, justo antes de
   `pnpm refresh-data`. El snapshot actualizado entra en el mismo commit diario que el dataset.

3. **`lib/domain/curated.ts::applyCurated(events)`** fusiona el snapshot con el dataset, en el
   mismo punto del pipeline donde hoy se aplican las traducciones curadas. Se llama desde
   `scripts/fetch-events.ts` (build) y desde `lib/sources/aggregate.ts` (runtime), para que las
   dos rutas no puedan discrepar — que es el fallo recurrente de este proyecto.

**Acoplamiento en tiempo de ejecución: cero.** planonmap nunca llama a `bcn-curator` para servir
una página.

### 9.4 Versionado del contrato

- La ruta lleva la versión: `/v1/`. Un cambio **compatible** (campo opcional nuevo) no cambia la
  versión: los consumidores antiguos lo ignoran.
- Un cambio **incompatible** (renombrar, borrar o cambiar el tipo de un campo obligatorio)
  estrena `/v2/`, y `/v1/` se sigue publicando **al menos 90 días** en paralelo.
- `schemaVersion` viaja dentro de cada archivo y de cada elemento: si planonmap recibe un número
  mayor del que conoce, **descarta el archivo y conserva el anterior**, en vez de intentar
  interpretarlo.
- El campo `producerVersion` del índice es informativo (versión del código), no del contrato.

---

## 10. Revisión editorial

### 10.1 El mecanismo: el Pull Request ES el panel

No se construye ningún panel. La revisión editorial se hace con una herramienta que ya existe,
es gratis, funciona desde el móvil y guarda historial: **el Pull Request de GitHub**.

Flujo completo:

1. `curate.yml` escribe las fichas nuevas y modificadas en `content/cards/` **de la rama de
   propuesta**, y junto a ellas un **manifiesto** `content/proposals/2026-09-03.json`.
2. `src/review/openPr.ts` empuja la rama `propuesta/2026-09-03` y abre un PR con la etiqueta
   `propuesta` y un cuerpo generado. **Un PR abierto como máximo**; si ya hay uno sin revisar, se
   le añaden los cambios en vez de abrir otro.
3. El propietario abre el PR desde la app de GitHub y decide.
4. Al cerrarse el PR, `reconcile.yml` ejecuta `src/review/reconcile.ts`, que compara el
   manifiesto con lo que realmente quedó en `content/cards/` y registra los vetos.

**El manifiesto es la corrección clave respecto al primer diseño**, que deducía lo vetado
leyendo el cuerpo del PR. Eso era frágil: basta que alguien edite el texto del PR, o que un
título lleve un carácter raro, para que el veto se pierda y la ficha vuelva a proponerse —y a
pagarse— al día siguiente. Un manifiesto es un archivo versionado, no una cadena de texto que
haya que interpretar:

```json
{
  "date": "2026-09-03",
  "promptVersion": "write-v1",
  "runCostEur": 0.11,
  "proposed": [
    { "slug": "sagrada-familia-torres", "collection": "plans",  "kind": "new",      "score": 96 },
    { "slug": "el-rei-lear-lliure-2026", "collection": "shows", "kind": "new",      "score": 74 },
    { "slug": "museu-picasso",           "collection": "museums","kind": "modified", "score": 91 }
  ],
  "discarded": [
    { "slug": "nit-poesia-gracia", "reason": "requiere ser local" }
  ]
}
```

La reconciliación es entonces una resta trivial y sin ambigüedad: **propuesto menos presente =
vetado**.

| Decisión | Qué hace el propietario | Qué pasa |
|---|---|---|
| **Aprobar todo** | Pulsa «Merge» | Se publica todo. Dos toques. |
| **Vetar una ficha** | Borra ese archivo desde la interfaz web del PR y mergea | Se publica el resto. `reconcile.ts` ve que estaba en el manifiesto y no en `content/cards/`, y **añade el slug a `content/vetoed.json`** con fecha y motivo `veto-manual`. |
| **Vetar todo** | Cierra el PR sin mergear | No se publica nada nuevo. Todos los slugs del manifiesto quedan vetados. |
| **Dejarlo para mañana** | No hace nada | El PR del día siguiente acumula, y su manifiesto también. A los 7 días sin tocar, el workflow comenta un recordatorio. **Nunca se auto-mergea.** |
| **Aprobar y pedir cambios en una ficha** | Edita el JSON en el PR y añade `"locked": true` | Se publica lo editado y esa ficha **no se regenera nunca más** (§3.7). |

El coste es cero, el esfuerzo del propietario es «aprobar o vetar, no reescribir», y **la
decisión queda registrada como etiqueta de entrenamiento** para las métricas de §5.5.

### 10.2 El cuerpo del PR, pensado para decidir en 30 segundos

```markdown
## Propuesta del 3 de septiembre de 2026

**3 fichas nuevas · 1 modificada · 0 retiradas**
Coste de esta ejecución: 0,11 € · Gasto del mes: 1,98 € de 5,00 €

---
### ✨ NUEVA · Sagrada Família con subida a las torres
**Puntuación 96** · plans · atemporal · Eixample · 36 € · avalado por 3 fuentes

> El interior es el motivo real de la visita: la luz de las vidrieras no se parece a nada.

- ⏱ 90 min · 🎟 reserva obligatoria, 7 días antes · 🗣 no hace falta idioma
- 🚇 Metro Sagrada Família (L2 y L5), a 100 m
- ✅ Precio, fechas y ubicación verificados · ⚠️ sin horario (no había evidencia)
- 🔗 [Ficha oficial](https://sagradafamilia.org/) · [Time Out](…) · [Visit Barcelona](…)
- 🖼 Sin imagen propia: planonmap usará su cascada

<details><summary>Texto completo (ES / EN)</summary>
…
</details>

---
### ♻️ MODIFICADA · Museu Picasso
**Cambió:** exposición temporal («Picasso i el circ», hasta el 18/01/2027) y precio (14 € → 15 €)
[Ver diff](…)

---
### ❌ DESCARTADAS HOY (8)
| Título | Motivo |
|---|---|
| Nit de poesia catalana al Casal de Gràcia | requiere ser local |
| Cata de vinos DO Penedès en hotel | evento de marca disfrazado |
| … | … |
```

La sección de descartadas importa tanto como la de propuestas: es donde el propietario detecta
que el criterio se está torciendo, y es gratis (el motivo ya venía en el cribado).

### 10.3 Cómo se corrige un error sin reescribir

Si una ficha publicada tiene un dato mal, hay tres salidas, de menor a mayor esfuerzo:

1. **Vetar el slug** (una línea en `content/vetoed.json`): desaparece en la siguiente publicación.
2. **Forzar reescritura**: borrar `content/cards/<colección>/<slug>.json`. El siguiente ciclo la regenera con
   el material fresco.
3. **Corrección manual**: editar el JSON de la ficha y añadir `"locked": true`. Una ficha
   bloqueada **no se regenera nunca** aunque cambie el prompt o la fuente. Es la vía de escape
   para el caso en que el propietario sí quiera escribir algo a mano.

---

## 11. Seguridad

### 11.1 Autenticación de lectura: no la hay, y es lo correcto

Los datos publicados son **públicos por diseño**: son fichas de museos y de espectáculos
destinadas a aparecer en una web abierta. Poner una clave de lectura añadiría un secreto que
gestionar y rotar, y no protegería nada que no fuera ya visible en la web de planonmap.

Lo que sí se hace, que es lo que de verdad protege al consumidor:

- **Origen fijado.** planonmap tiene la URL base en una variable de entorno
  (`CURATED_SOURCE_URL`) y **solo** acepta datos de ese origen, sobre HTTPS.
- **Integridad.** El `index.json` publica la `sha256` de cada colección; planonmap la comprueba
  antes de escribir el snapshot. Un archivo alterado en tránsito se descarta.
- **Validación de esquema.** Todo elemento pasa por Zod antes de entrar. Un elemento inválido se
  descarta; una colección con más del 20 % inválido se rechaza entera.
- **Sin ejecución.** Los datos son JSON, nunca código. planonmap no evalúa nada de lo que recibe.
- **Hosts de imagen en lista blanca.** planonmap ya solo pinta imágenes de una lista cerrada de
  hosts; una URL de imagen fuera de esa lista se ignora, así que ni siquiera un JSON malicioso
  podría hacer cargar un recurso arbitrario.

### 11.2 Cómo se impide que otros escriban

| Vector | Defensa |
|---|---|
| Alguien abre un PR al repositorio público | La rama `main` está protegida: **requiere PR y revisión del propietario**. Un tercero puede proponer, no publicar. |
| Un fork ejecuta el workflow con los secretos | Los workflows con secretos **no se disparan en `pull_request` de forks** (GitHub no expone secretos ahí) y **jamás se usa `pull_request_target`**, que es el patrón que filtra secretos. |
| Un colaborador añade un paso malicioso al workflow | Los workflows viven en `.github/`, protegidos por la misma regla de rama. Todas las acciones de terceros se fijan por versión mayor de fuente conocida (`actions/checkout@v5`), nunca por rama móvil. |
| Escritura directa en Pages | Pages solo sirve lo que hay en `main`. No hay otra vía de escritura. |
| Un tercero suplanta el origen | planonmap tiene la URL fijada y comprueba la `sha256`. |

Permisos por workflow, siempre los mínimos:

```yaml
permissions:
  contents: write        # solo en el que escribe la rama de propuesta
  pull-requests: write
  issues: write          # para las incidencias de fuente rota y presupuesto
# El resto de workflows: permissions: contents: read
```

### 11.3 Claves y secretos

- `ANTHROPIC_API_KEY` y `OPENAI_API_KEY` viven **exclusivamente** como *Secrets* del repositorio
  (`Settings → Secrets and variables → Actions`). Nunca en el código, nunca en `content/` ni `.cache/`, nunca
  en un log.
- En local van en `.env.local`, que está en `.gitignore`. Se versiona un `.env.example` con
  nombres reales y valores ficticios del estilo `your_openai_api_key_here` — mismo convenio que
  planonmap.
- **Rotación cada 90 días.** Ambas consolas permiten crear la nueva antes de revocar la vieja,
  así que la rotación es sin corte: crear → actualizar el Secret → lanzar el workflow a mano →
  revocar la anterior.
- **Alcance mínimo.** En OpenAI, clave de proyecto restringida al proyecto `bcn-curator` con
  límite de gasto propio en la consola. En Anthropic, clave del espacio de trabajo dedicado.
  Ese límite de la consola es el **tercer** tope, por debajo del saldo prepago y del tope lógico
  del código: si el código fallara, la consola corta igual.
- **Escaneo de secretos** activado en el repositorio (es gratis y automático en repos públicos),
  más una comprobación propia en CI que rechaza el commit si aparece algo con forma de
  `sk-ant-…`, `sk-…` o `ghp_…` en el diff.
- Lo versionado **no contiene nunca** las claves ni las respuestas crudas del modelo con
  material de terceros: solo la ficha final y los metadatos de la decisión.

### 11.4 Higiene del rastreador

- User-Agent identificable y con URL de contacto: si alguien quiere que paremos, sabe a quién
  escribir.
- `robots.txt` respetado siempre, sin excepciones ni «modo agresivo».
- Un `403` persistente **desactiva la fuente**. No se rota User-Agent, no se usan proxies, no se
  resuelven captchas. Si un sitio no nos quiere, no entramos.
- Sin credenciales de terceros: solo se leen páginas públicas. No se crean cuentas, no se
  aceptan cookies de sesión, no se accede a nada tras un muro de pago.

---

## 12. Riesgos y mitigaciones

### 12.1 Legales

**Rastrear páginas públicas para extraer hechos.** Fechas, precios, direcciones y horarios son
**datos, no obras**: no tienen protección de derecho de autor. Extraerlos de una página pública,
a ritmo educado y respetando `robots.txt`, es la práctica estándar de cualquier agregador. El
riesgo real no es el hecho en sí, sino tres cosas concretas alrededor:

| Riesgo | Mitigación |
|---|---|
| Reproducir **expresión** protegida (el texto tal como está escrito) | Cada ficha se **reescribe entera** y se comprueba mecánicamente el solapamiento de 8-gramas (§6.1). Cero frases copiadas, verificado por código y no por confianza. |
| Extraer una parte **sustancial de una base de datos** (derecho *sui generis*, art. 12 y ss. de la Ley de Propiedad Intelectual y Directiva 96/9/CE) | Se toman **decenas de fichas al mes**, no el catálogo. El tope `maxPagesPerDay` por fuente es a la vez una defensa técnica y jurídica: hace imposible una extracción sustancial. |
| Incumplir las **condiciones de uso** de un sitio | `SOURCES.md` guarda, por fuente: URL de las condiciones, fecha de revisión y veredicto. Si prohíben expresamente el acceso automatizado, **la fuente no se activa**. Se revisa cada 6 meses. |
| Que un sitio nos pida parar | UA identificable con contacto; un `403` desactiva la fuente sola. Se atiende cualquier petición sin discutir. |

**Atribución.** Cada ficha publica su `provenance[]` con las URL de origen. No es una obligación
legal cuando solo se usan hechos, pero es buena fe, es útil para el lector y hace el sistema
auditable. planonmap puede mostrar «Fuentes consultadas» en la ficha.

**Licencia de salida.** El JSON publicado va bajo **CC-BY-4.0**, declarado en el envoltorio y en
el `README`. Los textos son originales, así que se pueden licenciar; los hechos no son
licenciables por nadie.

### 12.2 Imágenes: el punto más delicado, y la decisión

Una fotografía **sí** es obra protegida. Que una web exponga `og:image` no es una licencia para
republicarla, y enlazarla en caliente tampoco resuelve el problema — el uso sigue existiendo, y
además consume ancho de banda ajeno.

**Decisión: `bcn-curator` no publica imágenes de terceros.** El campo `image` se rellena solo si
la imagen supera esta cascada, en orden:

1. **Imagen con licencia libre verificada.** Wikimedia Commons, consultando su API para leer la
   licencia real del archivo y aceptando solo dominio público, CC0, CC-BY o CC-BY-SA. Se guarda
   la atribución exacta en `imageCredit`. El host `upload.wikimedia.org` **ya está en la lista
   blanca de planonmap**, así que se pinta sin tocar nada.
2. **Imagen del propio recinto público**, cuando el recinto es una institución pública, el
   archivo es el cartel del propio acto, y el dominio está **ya** en la lista de hosts
   renderizables de planonmap (`**.barcelona.cat`, `**.macba.cat`, `**.diba.cat`,
   `**.cultura.gencat.cat`…). Fuera de esa lista, se descarta.
3. **Foto propia del propietario**, subida a Cloudinary (planonmap ya lo tiene configurado).
4. **Nada.** Se omite `image` y planonmap aplica su propia cascada: foto del espacio → cartel de
   la fiesta → placeholder degradado por categoría. Los placeholders están bien resueltos; una
   ficha sin foto no queda rota.

**Nunca**: fotos de medios (Time Out, Barcelona Secreta, La Vanguardia), bancos de imágenes, ni
capturas de pantalla.

Es la opción conservadora, y es deliberada: el beneficio de tener foto no compensa el riesgo de
republicar la de un medio. En la práctica, las tres primeras vías cubren bien los museos —que es
justo donde la foto más ayuda—.

### 12.3 Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Una web cambia su HTML | **Alta** (varias veces al año) | Medio | JSON-LD primero; canario por fuente; carry-forward; incidencia automática (§4.6). |
| Una web bloquea el rastreo | Media | Medio | La fuente se desactiva sola; el consenso se recalcula con las demás. Doce fuentes: perder una no rompe nada. |
| Nominatim u Overpass no responden | Media | Bajo | Caché permanente; sin coordenadas se descarta el candidato, nunca se inventan. |
| GitHub Actions cae o cambia condiciones | Baja | Alto | `content/` y `.cache/` están en git: el pipeline se puede ejecutar en local con `pnpm curate` y publicar a mano. No hay ninguna dependencia de la nube que no se pueda replicar en un portátil. |
| Un cambio de precios de las APIs | Media | Bajo | El tope duro corta igual. El precio por modelo vive en `config/budget.ts`, en un solo sitio. |
| El JSON crece demasiado | Baja | Bajo | Con 150 fichas ronda los 3 MB. Si llegara a 20 MB habría que paginar; queda a años vista. |
| Deriva del modelo entre versiones | Media | Medio | `promptVersion` viaja en cada ficha; un cambio de prompt no reescribe lo ya escrito salvo que se pida explícitamente. |

### 12.4 De calidad

| Riesgo | Mitigación |
|---|---|
| **Alucinación de precios u horarios** — el riesgo más grave, porque un turista actúa sobre ese dato | Verificación por evidencias literales (§6.4), mecánica y sin IA. Un dato sin fragmento literal en el material **se elimina**. |
| **Sesgo de consenso**: lo popular expulsa a lo bueno pero poco cubierto | El consenso son 25 de 100 puntos, no la mitad. El criterio editorial pesa 55. Y las cuotas de variedad (§5.6) reservan sitio a barrios y categorías infrarrepresentados. |
| **Monotonía**: seis museos de arte en Ciutat Vella | Cuotas duras por categoría, barrio y recinto. |
| **Envejecimiento silencioso**: fichas correctas que dejan de serlo | Comprobación semanal de vigencia de enlaces; detección de cambios en museos; retirada automática de lo caducado por fecha. |
| **Trampa turística con buena prensa** | Es exactamente lo que preguntan `no_trampa_turistica` y el veto duro `es_trampa_turistica`. Y el propietario lo ve en el PR antes de que se publique. |
| **Duplicar lo que ya tiene planonmap** | El prefiltro descarta lo que ya está bien cubierto (§5.2, paso 10) y `mergeHint` señala lo que hay que fusionar. |
| **El criterio se tuerce sin que nadie lo note** | La sección «descartadas hoy» del PR y las métricas semanales de §5.5. |

---

## 13. Plan por fases

Cada fase es entregable, verificable y aporta valor por sí sola. El criterio de «esto ya
funciona» es **comprobable con un comando**, no una impresión.

### ¿Empezar por museos? Sí, y por más razones de las que crees

**Comparto la intuición, y añado tres motivos que la refuerzan y uno que la matiza.**

A favor:

1. **Son estables.** Una ficha de museo escrita en octubre sigue siendo válida en marzo. Eso
   convierte la colección C en un **coste de una sola vez** (1,56 €) y en la prueba definitiva
   de que la caché funciona: la segunda ejecución debe costar 0,00 €. Si eso no ocurre, hay un
   error de diseño y lo descubres la primera semana, con 55 fichas, no con 500.
2. **No dependen del consenso**, que es la parte más frágil del sistema. Un museo se verifica
   contra su propia web oficial. Empezar por aquí te permite montar y probar todo el pipeline
   —rastreo, extracción, verificación, redacción bilingüe, publicación, revisión— **sin haber
   resuelto todavía la agrupación multi-fuente**.
3. **Son justo lo que busca el destinatario.** Un turista con tres días visita museos; puede que
   no le cuadre ninguna obra de teatro.
4. **El volumen está acotado y es conocido de antemano.** ~55 fichas. Puedes revisarlas todas de
   una sentada y calibrar el prompt con datos reales antes de automatizar nada.

Y el motivo que la matiza, que es en realidad otra ventaja: planonmap ya tiene **65 eventos con
categoría `museums`** en su feed. Casi todos son actividades sueltas (conferencias, visitas
guiadas), no los museos en sí, pero **habrá solapes**. Es decir: empezar por museos te obliga a
resolver la fusión con datos abiertos desde el primer día. Eso puede sonar a inconveniente, pero
es lo contrario: **es la integración arriesgada, afrontada pronto y con los datos más fáciles
del proyecto.** Descubrir el problema de fusión en la fase 1 con museos es infinitamente mejor
que descubrirlo en la fase 4 con 200 planes.

El orden que propongo, entonces:

### Fase 0 · Cimientos, sin gastar un céntimo

**Qué se construye:** el repositorio con las **tres zonas** (§3.3) y su `.gitattributes`;
`contracts/` con el esquema vendorizado, su `UPSTREAM.md` y el **fixture dorado**; `config/`
validado con Zod y con la puerta `verifiedAt`; `src/core/` con el reloj inyectable; el `fetcher`
con `robots.txt` y límites; los tres extractores; un adaptador para **una sola fuente**
(`museus-bcn`); y la publicación en Pages de un `museums.json` con **cinco fichas escritas a
mano**.

**Por qué a mano:** para validar el contrato de datos antes de meter IA en la ecuación. Si el
contrato está mal, ninguna cantidad de modelo lo arregla.

**Criterio de «esto ya funciona»:**

```bash
curl -s https://<usuario>.github.io/bcn-curator/v1/museums.json | jq '.items | length'   # → 5
pnpm validate                                  # → 0 errores de esquema y de config
pnpm test:contract                             # → el fixture dorado valida en los DOS repos
pnpm curate --collection museums --dry-run     # extrae horarios y precios, sin IA
```

Tres comprobaciones que importan más que el JSON en sí:

- Pegar uno de esos cinco elementos en un `EventSchema.parse()` de planonmap y que pase.
- Borrar `.cache/` entera y comprobar que **todo se regenera** y `content/` no se toca. Es lo que
  demuestra que la separación de zonas es real y no decorativa.
- Quitar `verifiedAt` de la única fuente y comprobar que el rastreo **no la toca** y lo dice.

**Coste de IA: 0 €.**

### Fase 1 · Colección C completa (museos)

**Qué se construye:** `config/museums.ts` con ~55 museos (nombre, web oficial, coordenadas);
extracción determinista de horarios, precios, gratuidades y exposición vigente; `changeHash`;
el redactor con `claude-opus-5` por Batch API; la verificación por evidencias; el libro de gasto
y el tope duro; el PR de revisión.

**Criterio de «esto ya funciona»:**

- 55 fichas publicadas, bilingües, todas con `verified.price` y `verified.schedule` en `true`.
- **La segunda ejecución del workflow cuesta 0,00 €** (todo en caché). Es el criterio más
  importante de toda la fase: si no se cumple, hay un error en la clave de caché y **hay que
  pararse a arreglarlo antes de seguir**, porque es el defecto que multiplica la factura.
- **Prueba específica del `semanticHash`:** se cambia a mano un byte irrelevante de la página
  cacheada de un museo (un espacio, un comentario HTML) y se relanza. **No debe llamarse a ningún
  modelo.** Después se cambia un precio, se relanza, y **solo se reescribe esa ficha**.
- El gasto total del arranque de los museos queda por debajo de **2 €**, comprobado en
  `.cache/spend/<año-mes>.json`. Si se dispara, lo primero que hay que mirar es el `effort` de la
  redacción: el pensamiento se factura como salida (§7.4).
- Se fuerza el tope a `AI_MONTHLY_BUDGET_EUR=0.01` y el workflow **publica igual** las fichas ya
  escritas, sin errores.
- Se borra una ficha del PR antes de mergear y se comprueba que `reconcile.yml` la registra en
  `content/vetoed.json` y que **no vuelve a proponerse** en la ejecución siguiente.
- `pnpm eval:screen` pasa con el conjunto dorado inicial (aunque en esta fase el cribado apenas
  se use: los museos entran por catálogo, no por consenso).

### Fase 2 · Conexión con planonmap

**Qué se construye, esta vez dentro de planonmap:** `'curated'` añadido al enum `source`; el
bloque `curated` añadido a `types/event.ts`; `scripts/fetch-curated.ts`;
`lib/domain/curated.ts::applyCurated()`; el snapshot en `data/sources/`; la llamada en
`refresh-data.yml`; y la documentación afectada.

**Criterio de «esto ya funciona»:**

- Los 55 museos aparecen en `https://www.planonmap.com/?group=cultura` y en el mapa.
- La ficha de uno de ellos muestra el texto en español y, cambiando el idioma, en inglés.
- **Se borra el archivo `data/sources/curated-museums.json`, se reconstruye, y la web funciona
  exactamente igual que antes.** Este es el criterio innegociable.
- Se apunta `CURATED_SOURCE_URL` a una URL inexistente, se ejecuta `pnpm fetch:curated`, y
  termina sin error conservando el snapshot anterior.
- `pnpm docs:check`, `pnpm typecheck` y `pnpm test:run` en verde.

### Fase 3 · Colección B (conciertos y teatro)

**Qué se construye:** adaptadores de `teatre-barcelona` y `enderrock-agenda`; la agrupación
multi-fuente (clustering); los campos `show`; el manejo de sesiones múltiples.

**Criterio:** 20 espectáculos publicados con fecha y hora exactas verificadas; ninguno duplicado
respecto al feed abierto (comprobación automática de `dedupeKey` contra el `events.json` de
planonmap); al menos 5 con `surtitles` detectados.

### Fase 4 · Colección A (mejores planes)

**Qué se construye:** las cinco fuentes de nivel A; el consenso; el cribado con `gpt-5-mini`; las
cuotas de variedad; la sección de descartadas del PR.

**Criterio:** 30 planes publicados; ninguna categoría con más de 6; al menos 4 barrios distintos;
al menos 5 gratuitos o de menos de 10 €; mezcla de atemporales y de temporada; y **precisión
editorial ≥ 0,70** en las dos primeras semanas (se sube el listón a 0,80 después).

### Fase 5 · Afinado y salud

**Qué se construye:** métricas semanales; ajuste automático de `trust` por fuente; informe de
enlaces muertos; comprobación de paridad ES/EN; alerta de presupuesto al 70 %.

**Criterio:** un informe semanal automático en una incidencia de GitHub con precisión editorial,
coste por ficha, cobertura por barrio y salud por fuente. Y una decisión tomada a partir de él
(subir o bajar el umbral de 62, degradar una fuente).

### Lo que NO está en el plan, a propósito

- Catalán como tercer idioma: +40 % de coste de salida para un público que no es el destinatario.
- Panel web propio: el PR ya hace ese trabajo.
- Rastreo de redes sociales: alto coste, baja fiabilidad y condiciones de uso hostiles.
- Traducción automática de las fichas del feed abierto: es otro proyecto.

---

## 14. Puesta en marcha

### 14.1 Cuentas que hay que crear

| Servicio | Para qué | Plan | ¿Tarjeta? |
|---|---|---|---|
| GitHub | Repositorio, Actions, Pages, revisión | Free | No |
| **OpenAI Platform** | Cribado en lote | De pago por uso | **Sí** |
| **Anthropic Console** | Redacción final | De pago por uso | **Sí** |

Las dos de IA requieren método de pago. **Carga 10 $ en cada una y desactiva la recarga
automática**: así el saldo es un tope físico por debajo del lógico.

### 14.2 Pasos literales

```bash
# 1 · Crear el repositorio PÚBLICO y clonarlo
gh repo create bcn-curator --public --clone
cd bcn-curator

# 2 · Estructura y dependencias
pnpm init
pnpm add @anthropic-ai/sdk@0.122.0 openai@7.8.0 zod@4.4.1 cheerio@1.2.0 \
         fast-xml-parser@5.11.1 robots-parser@3.0.1 p-limit@7.3.1
pnpm add -D tsx@4.21.0 typescript@5.9.3 vitest@4.1.5

# 3 · Crear los archivos base copiándolos del ANEXO A de este documento.
#     NO hace falta acceso al repositorio de planonmap: el esquema completo,
#     el package.json, el tsconfig, los workflows y la configuración de ESLint
#     están escritos ahí, literales y listos para pegar.
mkdir -p contracts/golden config src/{core,crawl/{extract,adapters},normalize,cluster} \
         src/{screen,enrich,ai,store,publish,review,report,cli} \
         content/{cards/{plans,shows,museums},archive,proposals} \
         .cache/{index,decisions,clusters,spend} evals/{screen,write} \
         tests/{unit,integration,fixtures} .github/workflows
#     Anexo A.1 → contracts/event.ts        A.6 → tsconfig.json
#     Anexo A.2 → contracts/curated.ts      A.7 → .gitignore y .gitattributes
#     Anexo A.3 → contracts/output.ts       A.8 → eslint.config.mjs
#     Anexo A.4 → contracts/UPSTREAM.md     A.9 → .github/workflows/*.yml
#     Anexo A.5 → package.json              A.10 → SOURCES.md

# 4 · Claves en local
cp .env.example .env.local
#    Rellenar OPENAI_API_KEY y ANTHROPIC_API_KEY con los valores reales.
#    .env.local está en .gitignore: NUNCA se commitea.

# 5 · Primera ejecución en seco, sin gastar nada
pnpm curate --collection museums --dry-run --limit 5

# 6 · Primera ejecución real, acotada a 5 fichas
pnpm curate --collection museums --limit 5
cat .cache/spend/$(date +%Y-%m).json          # comprobar el gasto: debe rondar 0,15 €

# 7 · Publicar
pnpm publish:build
git add -A && git commit -m "feat: primeras 5 fichas de museos"
git push
```

### 14.3 Configuración en GitHub

Los workflows del anexo A.9 leen **ocho** valores. Créalos todos ahora: si falta el
`CRAWLER_USER_AGENT`, el rastreador sale a la red sin identificarse, y toda la política de
cortesía de §11.4 y de defensa legal de §12.1 se apoya precisamente en eso.

```bash
# ── SECRETOS (cifrados, nunca visibles) ──────────────────────────────────
gh secret set OPENAI_API_KEY           # te lo pedirá por teclado
gh secret set ANTHROPIC_API_KEY
gh secret set CRAWLER_CONTACT_EMAIL    # va en el User-Agent; secreto para no publicarlo

# ── VARIABLES (visibles; son configuración, no credenciales) ─────────────
gh variable set CRAWLER_USER_AGENT \
  --body "bcn-curator/1.0 (+https://github.com/TU-USUARIO/bcn-curator)"
gh variable set PUBLISH_BASE_URL \
  --body "https://TU-USUARIO.github.io/bcn-curator"
gh variable set AI_MONTHLY_BUDGET_EUR --body "5"
gh variable set SCREEN_MODEL          --body "gpt-5-mini"
gh variable set WRITER_MODEL          --body "claude-opus-5"

# Comprobación: deben salir 3 secretos y 5 variables
gh secret list && gh variable list
```

Y tres ajustes en la interfaz web, que no tienen equivalente en `gh`:

```text
1 · Pages
    Settings → Pages → Source: GitHub Actions
    NO uses "Deploy from a branch": este proyecto publica por ARTEFACTO (§9.2),
    y con el modo rama el paso deploy-pages del workflow falla.

2 · Protección de la rama main
    Settings → Rules → New branch ruleset, sobre `main`:
      · Require a pull request before merging
      · Block force pushes
      · Restrict deletions
    Es lo que garantiza que main solo contenga lo que has aprobado (§3.6).

3 · Escaneo de secretos
    Settings → Code security → Secret scanning: Enable
    Gratis y automático en repositorios públicos.
```

### 14.4 Variables de entorno

Ninguna lleva valores reales en el repositorio. `.env.example` versionado con valores ficticios:

```bash
# --- APIs de IA (las únicas de pago) ---
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# --- Modelos (permiten cambiar sin tocar código) ---
SCREEN_MODEL=gpt-5-mini
WRITER_MODEL=claude-opus-5
WRITER_FALLBACK_MODEL=gpt-5

# --- Tope de gasto ---
AI_MONTHLY_BUDGET_EUR=5

# --- Identidad del rastreador (obligatoria: robots.txt y cortesía) ---
CRAWLER_USER_AGENT=bcn-curator/1.0 (+https://github.com/your_user_here/bcn-curator)
CRAWLER_CONTACT_EMAIL=your_contact_email_here

# --- Publicación ---
PUBLISH_BASE_URL=https://your_user_here.github.io/bcn-curator
```

**Esta no la configuras tú.** Al conectar la fase 2, quien tenga acceso a planonmap añadirá en
**su** repositorio una única variable nueva. Se documenta aquí solo para que sepas qué valor
tendrás que darle cuando te lo pidan — es tu `PUBLISH_BASE_URL` con `/v1` al final:

```bash
# EN EL REPOSITORIO DE PLANONMAP, no en el tuyo.
# URL base de la fuente de planes curados. No es un secreto: es una URL pública.
CURATED_SOURCE_URL=https://your_user_here.github.io/bcn-curator/v1
```

### 14.5 Comandos del día a día

Un solo verbo, `curate`, con parámetros. Antes había dos comandos casi iguales
(`crawl:plans` y `crawl:museums`) que compartían el 90 % del código y podían divergir:

| Comando | Qué hace | ¿Gasta? |
|---|---|---|
| `pnpm curate --phase submit --collection plans,shows` | Rastrea, criba y **envía** el lote de redacción de A y B | Sí |
| `pnpm curate --phase collect` | **Recoge** el lote pendiente, verifica y escribe las fichas | No (ya pagado al enviar) |
| `pnpm curate --phase submit --collection museums` | Ídem para la colección C | Solo si algo cambió |
| `pnpm curate --dry-run` | Rastrea, criba y **se para antes de llamar a ningún modelo**. Imprime qué habría enviado y cuánto habría costado | **No** |
| `pnpm curate --limit 5` | Acota a 5 fichas. Para probar sin gastar apenas | Sí, poco |
| `pnpm curate --reprocess <slug…>` | Fuerza la reescritura de fichas concretas. Pide confirmación mostrando el coste | Sí |
| | | |
| `pnpm publish:build` | Regenera `dist/v1/*.json` desde `content/` | No |
| `pnpm validate` | Valida `content/`, `config/` y lo publicado contra los esquemas | No |
| `pnpm test:contract` | Valida el fixture dorado compartido con planonmap (§5.8) | No |
| | | |
| `pnpm eval:screen` | Evalúa el prompt de cribado contra el conjunto dorado (§5.7) | Céntimos |
| `pnpm eval:write` | Comprobaciones mecánicas de la redacción: copia, evidencias, longitudes | No |
| | | |
| `pnpm report:health` | Salud por fuente: extracciones, fallos, degradadas, sin verificar | No |
| `pnpm report:metrics` | Precisión editorial, coste por ficha, cobertura por barrio | No |
| `pnpm spend` | Gasto del mes y desglose por modelo y por tarea | No |
| | | |
| `pnpm veto <slug> "<motivo>"` | Veta una ficha y la retira en la siguiente publicación | No |
| `pnpm archive <slug>` | Retira sin vetar: se mueve a `content/archive/` y puede volver | No |
| `pnpm sources:check` | Recomprueba `robots.txt` y `verifiedAt` de todas las fuentes | No |

**`--dry-run` es el comando más importante de la lista** y por eso está pronto: es el que
permite tocar prompts, umbrales y adaptadores durante horas sin gastar un céntimo. Imprime el
material que habría enviado y el coste estimado, que es justo lo que hace falta ver para afinar.

### 14.6 Los primeros siete días

| Día | Qué hacer |
|---|---|
| 1 | Fase 0 completa. Cinco fichas a mano publicadas y validadas. Coste: 0 €. |
| 2 | `config/museums.ts` con 55 museos. `pnpm curate --collection museums --dry-run` y revisar la extracción determinista: ¿salen bien horarios y precios? |
| 3 | Primera tanda real de 10 museos. Leer las 10 fichas enteras. **Ajustar el prompt de redacción con esas 10 delante**, que es cuando más se aprende. |
| 4 | Las 45 restantes. Revisar el PR y mergear. Comprobar `.cache/spend/<año-mes>.json`. |
| 5 | Relanzar el workflow. **Verificar que el coste es 0,00 €.** Si no lo es, parar y arreglar la caché antes de seguir. |
| 6 | Fase 2: conectar con planonmap en una rama. Ver los museos en la web local. |
| 7 | Probar la degradación: borrar el snapshot, apuntar a una URL rota, poner el tope a 0,01 €. **Nada puede romperse en ninguno de los tres casos.** |

---

## Anexo A · Archivos literales para arrancar

> **Este anexo existe para que no necesites nada más.** Todo lo que hay aquí se copia y se pega
> tal cual. No hace falta acceso al repositorio de planonmap: el esquema que planonmap usa para
> validar está transcrito completo en A.1, y es la única pieza que de verdad no podrías deducir
> del resto del documento.

### A.1 · `contracts/event.ts`

El esquema con el que planonmap valida todo lo que recibe, transcrito íntegro. **Si esto valida,
planonmap lo acepta.** Está en Zod 4 y usa deliberadamente `z.string().url()` y
`z.string().datetime({ offset: true })` —en lugar de los ayudantes `z.url()` / `z.iso.datetime()`
de Zod 4— porque son las formas exactas que usa planonmap, y el objetivo es que las dos
validaciones se comporten igual, no que el código sea moderno.

```ts
// contracts/event.ts
// TRANSCRIPCIÓN del esquema de eventos de planonmap. Ver contracts/UPSTREAM.md.
// NO EDITAR A MANO salvo para versionar el contrato (§9.4 del plan).
import { z } from 'zod'

// ── Categorías normalizadas ──────────────────────────────────────────────────
export const CategorySchema = z.enum([
  'music',
  'family',
  'arts',
  'museums',
  'exhibitions',
  'sports',
  'food',
  'culture',
  'outdoors',
  'other',
])
export type Category = z.infer<typeof CategorySchema>

// ── Precio ───────────────────────────────────────────────────────────────────
// Solo se marca 'free' cuando la fuente lo confirma explícitamente.
// 'unknown' = sin información fiable → la interfaz NO debe mostrar "Gratis".
export const PriceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('free') }),
  z.object({ type: z.literal('free-with-booking') }),
  z.object({ type: z.literal('included-with-admission') }),
  z.object({ type: z.literal('invitation') }),
  z.object({
    type: z.literal('paid'),
    amount: z.number().nonnegative(),
    amountMax: z.number().nonnegative().optional(),
    currency: z.literal('EUR'),
    hasSurcharge: z.boolean().optional(),
  }),
  z.object({ type: z.literal('paid-unknown') }),
  z.object({ type: z.literal('unknown') }),
])
export type Price = z.infer<typeof PriceSchema>

export const PRICE_TYPES = [
  'free',
  'free-with-booking',
  'included-with-admission',
  'invitation',
  'paid',
  'paid-unknown',
  'unknown',
] as const
export type PriceType = (typeof PRICE_TYPES)[number]

// ── Contacto ─────────────────────────────────────────────────────────────────
export const ContactSchema = z.object({
  email: z.string().optional(),
  phone: z.string().optional(),
  instagram: z.string().url().optional(),
  facebook: z.string().url().optional(),
  youtube: z.string().url().optional(),
})
export type Contact = z.infer<typeof ContactSchema>

// ── Galería y documentos ─────────────────────────────────────────────────────
export const GalleryImageSchema = z.object({
  url: z.string().url(),
  thumb: z.string().url().optional(),
  alt: z.string().optional(),
})
export type GalleryImage = z.infer<typeof GalleryImageSchema>

export const EventDocumentSchema = z.object({
  url: z.string().url(),
  label: z.string().optional(),
  type: z.literal('pdf').default('pdf'),
})
export type EventDocument = z.infer<typeof EventDocumentSchema>

// ── Tramo de horario ─────────────────────────────────────────────────────────
export const ScheduleSlotSchema = z.object({
  days: z.string(),                  // "Martes a domingo"
  hours: z.string(),                 // "de 10.00 h a 19.00 h"
  price: z.string().optional(),      // texto literal del precio en esa franja
})
export type ScheduleSlot = z.infer<typeof ScheduleSlotSchema>

// ── Lugar ────────────────────────────────────────────────────────────────────
export const VenueSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  neighborhood: z.string().optional(),
  district: z.string().optional(),
  /** Slug estable de municipio: 'barcelona', 'lhospitalet', 'santacoloma'… */
  municipality: z.string().optional(),
  zipCode: z.string().optional(),
  /**
   * Precisión de lat/lng. Ausente se interpreta como 'exact'. Si NO es 'exact',
   * la interfaz avisa de "ubicación aproximada".
   */
  locationPrecision: z.enum(['exact', 'neighborhood', 'district']).optional(),
})
export type Venue = z.infer<typeof VenueSchema>

// ── Marca de fiesta de barrio (la calcula planonmap; NO la envíes) ───────────
export const EventFestivalRefSchema = z.object({
  id: z.string().min(1),
  highlightKind: z.string().optional(),
  intensity: z.enum(['alta', 'media']).optional(),
  auto: z.boolean().optional(),
})
export type EventFestivalRef = z.infer<typeof EventFestivalRefSchema>

// ── Señales derivadas (las calcula planonmap; NO las envíes) ─────────────────
export const SignalsSchema = z.object({
  quality: z.number().min(0).max(1),
  popularity: z.number().min(0).max(1),
  touristVsLocal: z.number().min(-1).max(1),
  effectiveStartHour: z.number().min(0).max(24).nullable(),
})
export type Signals = z.infer<typeof SignalsSchema>

// ── Contenido localizado ─────────────────────────────────────────────────────
export const LocalizedStringSchema = z.object({
  ca: z.string().optional(),
  es: z.string().optional(),
  en: z.string().optional(),
})
export type LocalizedString = z.infer<typeof LocalizedStringSchema>

export const EventI18nSchema = z.object({
  title: LocalizedStringSchema.optional(),
  description: LocalizedStringSchema.optional(),
})
export type EventI18n = z.infer<typeof EventI18nSchema>

// ── Procedencia oficial verificada ───────────────────────────────────────────
export const OfficialSourceSchema = z.object({
  urlStatus: z.enum(['verified', 'candidate', 'unverified', 'broken']).optional(),
  urlCheckedAt: z.string().datetime({ offset: true }).optional(),
  imageStatus: z.enum(['verified', 'candidate', 'fallback', 'broken']).optional(),
  imageCheckedAt: z.string().datetime({ offset: true }).optional(),
  verifiedBy: z.enum(['auto', 'admin']).optional(),
  matchReason: z.string().max(200).optional(),
})
export type OfficialSource = z.infer<typeof OfficialSourceSchema>

// ── Evento ───────────────────────────────────────────────────────────────────
export const EventSchema = z.object({
  id: z.string().min(1),
  source: z.enum([
    'opendatabcn',
    'agendadiaria',
    'diputaciobcn',
    'districteagenda',
    'lhospitalet',
    'agendacultura',
    'cornella',
    'mercatsfires',
    'custom',
    'curated',            // ← lo añade planonmap al conectar la fuente externa
  ]),
  contentLang: z.enum(['ca', 'es', 'en']).optional(),
  sourceId: z.string().min(1),
  sourceUrl: z.string().url(),
  officialUrl: z.string().url().optional(),
  ticketsUrl: z.string().url().optional(),
  registrationUrl: z.string().url().optional(),
  icalUrl: z.string().url().optional(),
  title: z.string().min(1),
  description: z.string(),
  image: z.string().url().optional(),
  imageSource: z.enum(['event', 'venue', 'festival']).optional(),
  imageCredit: z.string().optional(),
  gallery: z.array(GalleryImageSchema).optional(),
  documents: z.array(EventDocumentSchema).optional(),
  audience: z.string().max(20).optional(),
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }).optional(),
  schedule: z.array(ScheduleSlotSchema).optional(),
  venue: VenueSchema,
  category: CategorySchema,
  categories: z.array(CategorySchema).optional(),
  price: PriceSchema,
  contact: ContactSchema.optional(),
  tags: z.array(z.string()),
  signals: SignalsSchema.optional(),
  festival: EventFestivalRefSchema.optional(),
  i18n: EventI18nSchema.optional(),
  officialSource: OfficialSourceSchema.optional(),
})
export type Event = z.infer<typeof EventSchema>
```

**Este esquema está verificado, no transcrito de memoria.** El 29/08/2026 se comprobaron tres
cosas contra el código real de planonmap y contra Zod 4.4.1:

| Comprobación | Resultado |
|---|---|
| A.1, A.2 y A.3 compilan con `strict` y `exactOptionalPropertyTypes` | ✅ 0 errores |
| El ejemplo de museo del §8.5 valida contra este esquema y contra `CuratedEventSchema` | ✅ |
| Ese mismo ejemplo, con `source: "custom"`, valida contra el `types/event.ts` **real** de planonmap **sin ningún otro cambio** | ✅ |
| Con `source: "curated"` falla contra el esquema real, y falla **por un solo motivo**: ese valor aún no existe en su enum | ✅ esperado |

La última fila es la que importa: confirma que **la única modificación que planonmap necesita en
su esquema es añadir `'curated'` al enum `source`**. Todo lo demás encaja hoy.

**Tres trampas de este esquema**, por si el compilador no basta:

- `startDate` **exige offset**. `"2026-09-10T19:30:00"` falla; `"2026-09-10T19:30:00+02:00"`
  pasa. En `Europe/Madrid` es `+02:00` en horario de verano y `+01:00` en invierno.
- `tags` es **obligatorio**. Puede ir vacío (`[]`), pero el campo tiene que estar.
- `price` es una **unión discriminada**, no un número. `{ "type": "paid", "amount": 15,
  "currency": "EUR" }`, nunca `15`. Y `currency` solo admite el literal `"EUR"`.

### A.2 · `contracts/curated.ts`

```ts
// contracts/curated.ts
import { z } from 'zod'
import { EventSchema, ScheduleSlotSchema } from './event'

export const CuratedCollectionSchema = z.enum(['plans', 'shows', 'museums'])
export type CuratedCollection = z.infer<typeof CuratedCollectionSchema>

/** Texto bilingüe. El español es obligatorio; el inglés, muy recomendable. */
const BilingualSchema = z.object({
  es: z.string().min(1),
  en: z.string().min(1).optional(),
})

export const ProvenanceSchema = z.object({
  url: z.string().url(),
  publisher: z.string().min(1).max(120),
  tier: z.enum(['A', 'B', 'C']),
  retrievedAt: z.string().datetime({ offset: true }),
})

export const CuratedSchema = z.object({
  collection: CuratedCollectionSchema,
  /** Identificador estable de por vida. Clave de caché, de veto y de identidad. */
  slug: z.string().regex(/^[a-z0-9-]{3,60}$/),
  schemaVersion: z.literal(1),
  curatedAt: z.string().datetime({ offset: true }),
  promptVersion: z.string().min(1).max(40),
  score: z.number().min(0).max(100),
  temporality: z.enum(['atemporal', 'temporada']),

  consensus: z.object({
    sourceCount: z.number().int().min(1),
    sources: z.array(z.string().min(1)).min(1),
  }),

  whyWorthIt: z.object({
    es: z.string().min(1).max(160),
    en: z.string().min(1).max(160).optional(),
  }),

  practical: z.object({
    durationMinutes: z.number().int().min(15).max(600).optional(),
    booking: z.enum(['ninguna', 'recomendada', 'obligatoria']).optional(),
    bookingLeadDays: z.number().int().min(0).max(90).optional(),
    activityLang: z.array(z.enum(['ca', 'es', 'en', 'sin-idioma'])).optional(),
    transit: BilingualSchema.optional(),
    priceIncludes: BilingualSchema.optional(),
  }),

  show: z
    .object({
      artistOrCompany: z.string().max(120).optional(),
      room: z.string().max(120).optional(),
      surtitles: z.array(z.enum(['ca', 'es', 'en'])).optional(),
    })
    .optional(),

  museum: z
    .object({
      openingHours: z.array(ScheduleSlotSchema).optional(),
      freeAdmission: z.array(z.string().max(120)).optional(),
      currentExhibition: z
        .object({
          title: z.string().min(1).max(200),
          endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
        .optional(),
      visitMinutes: z.number().int().min(20).max(300).optional(),
      bookAhead: z.boolean().optional(),
    })
    .optional(),

  provenance: z.array(ProvenanceSchema).min(1),

  verified: z.object({
    price: z.boolean(),
    schedule: z.boolean(),
    dates: z.boolean(),
    location: z.boolean(),
    method: z.string().min(1).max(60),   // 'evidence-substring'
  }),

  planonmap: z.object({
    /**
     * Clave de emparejamiento con el feed abierto. OJO: para temporality
     * 'atemporal' es INESTABLE por construcción (§4.9). La identidad es el slug.
     */
    dedupeKey: z.string().min(1),
    mergeHint: z.enum(['new', 'merge']),
  }),

  /** Una ficha bloqueada no se regenera jamás, aunque cambie el prompt (§3.7). */
  locked: z.boolean().optional(),
})
export type Curated = z.infer<typeof CuratedSchema>

/** Lo que de verdad se publica: un Event de planonmap + el bloque curated. */
export const CuratedEventSchema = EventSchema.extend({
  source: z.literal('curated'),
  curated: CuratedSchema,
})
export type CuratedEvent = z.infer<typeof CuratedEventSchema>
```

### A.3 · `contracts/output.ts`

```ts
// contracts/output.ts
import { z } from 'zod'
import { CuratedEventSchema, CuratedCollectionSchema } from './curated'

export const CollectionFileSchema = z.object({
  schemaVersion: z.literal(1),
  collection: CuratedCollectionSchema,
  generatedAt: z.string().datetime({ offset: true }),
  count: z.number().int().min(0),
  license: z.string().min(1),                 // 'CC-BY-4.0'
  items: z.array(CuratedEventSchema),
})
export type CollectionFile = z.infer<typeof CollectionFileSchema>

export const IndexFileSchema = z.object({
  schemaVersion: z.literal(1),
  producer: z.literal('bcn-curator'),
  producerVersion: z.string().min(1),
  generatedAt: z.string().datetime({ offset: true }),
  /**
   * Entre UNA y tres colecciones. No exactamente tres, a propósito: durante las
   * fases 0 a 3 solo existe `museums`, y exigir las tres haría imposible validar
   * —y por tanto publicar— hasta tener el proyecto entero terminado.
   * Una colección ausente significa «todavía no se publica», no «está vacía».
   */
  collections: z
    .array(
      z.object({
        name: CuratedCollectionSchema,
        url: z.string().url(),
        count: z.number().int().min(0),
        generatedAt: z.string().datetime({ offset: true }),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .min(1)
    .max(3)
    .refine((cs) => new Set(cs.map((c) => c.name)).size === cs.length, {
      message: 'colecciones duplicadas en el índice',
    }),
})
export type IndexFile = z.infer<typeof IndexFileSchema>

/** Coherencia interna: count debe cuadrar con items.length. */
export function assertCoherent(file: CollectionFile): void {
  if (file.count !== file.items.length) {
    throw new Error(`count=${file.count} pero items=${file.items.length}`)
  }
}
```

### A.4 · `contracts/UPSTREAM.md`

```markdown
# Procedencia del contrato

`event.ts` es una transcripción del esquema de eventos de planonmap.

| Campo | Valor |
|---|---|
| Origen | planonmap · `types/event.ts` |
| Commit de referencia | `2cba2f0` |
| Fecha de la transcripción | 2026-08-29 |
| Versión del contrato publicada | `v1` |

## Cómo se actualiza

1. Obtener del propietario de planonmap el `types/event.ts` vigente y su commit.
2. Sustituir la parte transcrita de `event.ts`, conservando `'curated'` en el enum `source`.
3. `pnpm test:contract` — valida el fixture dorado con el esquema nuevo.
4. Si el fixture ya no valida, el cambio es INCOMPATIBLE: estrena `/v2/` (§9.4 del plan) y
   mantén `/v1/` publicado 90 días.
5. Actualizar la tabla de arriba.

## El fixture dorado

`golden/curated-golden.json` contiene un elemento de cada colección. Lo produce ESTE proyecto y
se entrega a planonmap, que lo guarda en su repositorio y lo valida con su propio esquema. Si
alguno de los dos tests se pone en rojo, los esquemas han divergido — y se entera el mismo día
quien lo rompió, no seis meses después.
```

### A.5 · `package.json`

```json
{
  "name": "bcn-curator",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.26.1",
  "engines": { "node": "24.x" },
  "scripts": {
    "curate": "tsx src/cli/curate.ts",
    "publish:build": "tsx src/cli/publishBuild.ts",
    "review:pr": "tsx src/cli/reviewPr.ts",
    "review:reconcile": "tsx src/cli/reconcile.ts",
    "validate": "tsx src/cli/validate.ts",
    "eval:screen": "tsx src/cli/evalScreen.ts",
    "eval:write": "tsx src/cli/evalWrite.ts",
    "report:health": "tsx src/cli/reportHealth.ts",
    "report:metrics": "tsx src/cli/reportMetrics.ts",
    "spend": "tsx src/cli/spend.ts",
    "veto": "tsx src/cli/veto.ts",
    "archive": "tsx src/cli/archive.ts",
    "sources:check": "tsx src/cli/sourcesCheck.ts",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest",
    "test:run": "vitest run",
    "test:contract": "vitest run tests/integration/contract.test.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "0.122.0",
    "openai": "7.8.0",
    "zod": "4.4.1",
    "cheerio": "1.2.0",
    "fast-xml-parser": "5.11.1",
    "robots-parser": "3.0.1",
    "p-limit": "7.3.1"
  },
  "devDependencies": {
    "tsx": "4.21.0",
    "typescript": "5.9.3",
    "vitest": "4.1.5",
    "eslint": "9.40.0",
    "typescript-eslint": "8.55.0",
    "@types/node": "24.10.1"
  }
}
```

### A.6 · `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@contracts/*": ["contracts/*"],
      "@config/*": ["config/*"]
    }
  },
  "include": ["src", "config", "contracts", "tests", "evals"]
}
```

`exactOptionalPropertyTypes` no está por gusto: obliga a **omitir** una propiedad opcional en vez
de ponerla a `undefined`, que es exactamente el contrato de salida —un campo sin evidencia se
omite, no se emite vacío— y así el compilador vigila la regla del §6.4.

### A.7 · `.gitignore` y `.gitattributes`

```gitignore
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
# .cache/ SÍ se versiona: es lo que hace que no se pague dos veces (§3.3)
```

```gitattributes
# La caché es derivada: GitHub la colapsa en el diff del PR de revisión
.cache/**   linguist-generated=true -diff
*.ndjson    -diff
# El producto SÍ se lee: es el panel de revisión
content/**  linguist-generated=false
# Finales de línea estables entre Windows y los runners de Linux
* text=auto eol=lf
*.json      text eol=lf
```

### A.8 · `eslint.config.mjs`

```js
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.cache/**'] },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      // El "ahora" se inyecta SIEMPRE. planonmap ha tenido la CI rota tres veces
      // por fechas fijas caducadas en fixtures; aquí no puede pasar.
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='Date'][property.name='now']",
          message: 'Usa el reloj inyectado de src/core/clock.ts, no Date.now().',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Usa el reloj inyectado de src/core/clock.ts, no new Date().',
        },
      ],
      // Nadie sale a la red salvo el fetcher.
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Usa src/crawl/fetcher.ts: aplica robots.txt y límites.' },
      ],
    },
  },
  // Las dos excepciones, y solo estas.
  {
    files: ['src/core/clock.ts', 'src/crawl/fetcher.ts'],
    rules: { 'no-restricted-syntax': 'off', 'no-restricted-globals': 'off' },
  },
)
```

### A.9 · Los cinco workflows

Un bloque de pasos se repite en los cinco; se escribe entero la primera vez y después se abrevia con
`# ── preparación (igual que en curate.yml) ──`.

#### `.github/workflows/curate.yml`

El único que gasta dinero y el único que propone cambios. Tiene **dos fases** (§7.2 ter): la de
las 02:30 rastrea, criba y envía el lote de redacción; las de las 06:30, 10:30 y 14:30 intentan
recogerlo. La fase se deduce del cron, así que no hay dos workflows que mantener sincronizados.

```yaml
name: Curate

on:
  schedule:
    - cron: '30 2 * * *'        # submit  · diario → planes y espectáculos
    - cron: '0 2 * * 1'         # submit  · lunes  → museos
    - cron: '30 6,10,14 * * *'  # collect · tres intentos de recogida
  workflow_dispatch:
    inputs:
      phase:
        description: Fase a ejecutar
        type: choice
        options: ['submit', 'collect']
        default: 'submit'
      collection:
        description: Colecciones a procesar (solo en submit)
        type: choice
        options: ['plans,shows', 'museums', 'plans,shows,museums']
        default: 'plans,shows'
      limit:
        description: Máximo de fichas a escribir (0 = sin límite)
        type: string
        default: '0'
      dryRun:
        description: No llamar a ningún modelo
        type: boolean
        default: false

permissions:
  contents: write           # escribe la rama de propuesta
  pull-requests: write      # abre o actualiza el PR
  issues: write             # incidencias de fuente rota y de presupuesto

# EL MISMO grupo que reconcile.yml: nunca dos escrituras a la vez (§3.6)
concurrency:
  group: bcn-curator-write
  cancel-in-progress: false

jobs:
  curate:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0        # reconcile compara ramas; necesita historial

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Deducir fase y colección del disparador
        id: cfg
        run: |
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            echo "phase=${{ inputs.phase }}"           >> "$GITHUB_OUTPUT"
            echo "collection=${{ inputs.collection }}" >> "$GITHUB_OUTPUT"
          elif [ "${{ github.event.schedule }}" = "30 6,10,14 * * *" ]; then
            echo "phase=collect"    >> "$GITHUB_OUTPUT"
            echo "collection="      >> "$GITHUB_OUTPUT"
          elif [ "${{ github.event.schedule }}" = "0 2 * * 1" ]; then
            echo "phase=submit"     >> "$GITHUB_OUTPUT"
            echo "collection=museums" >> "$GITHUB_OUTPUT"
          else
            echo "phase=submit"     >> "$GITHUB_OUTPUT"
            echo "collection=plans,shows" >> "$GITHUB_OUTPUT"
          fi

      # Ahorra una ejecución entera cuando no hay nada que recoger: sin esto,
      # las tres recogidas diarias instalarían dependencias para nada.
      - name: ¿Hay algo pendiente que recoger?
        id: pend
        if: steps.cfg.outputs.phase == 'collect'
        run: |
          if [ -s .cache/pending-batches.json ] && [ "$(jq 'length' .cache/pending-batches.json)" != "0" ]; then
            echo "hay=true" >> "$GITHUB_OUTPUT"
          else
            echo "hay=false" >> "$GITHUB_OUTPUT"
            echo "Nada pendiente. Salida limpia." >> "$GITHUB_STEP_SUMMARY"
          fi

      - name: Curar
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          AI_MONTHLY_BUDGET_EUR: ${{ vars.AI_MONTHLY_BUDGET_EUR || '5' }}
          SCREEN_MODEL: ${{ vars.SCREEN_MODEL || 'gpt-5-mini' }}
          WRITER_MODEL: ${{ vars.WRITER_MODEL || 'claude-opus-5' }}
          CRAWLER_USER_AGENT: ${{ vars.CRAWLER_USER_AGENT }}
          CRAWLER_CONTACT_EMAIL: ${{ secrets.CRAWLER_CONTACT_EMAIL }}
        if: steps.cfg.outputs.phase == 'submit' || steps.pend.outputs.hay == 'true'
        run: |
          pnpm curate \
            --phase "${{ steps.cfg.outputs.phase }}" \
            --collection "${{ steps.cfg.outputs.collection }}" \
            --limit "${{ inputs.limit || '0' }}" \
            ${{ inputs.dryRun == true && '--dry-run' || '' }}

      # El resumen se lee en la pestaña del workflow, no ocupa sitio en el repo
      - name: Resumen de la ejecución
        if: always()
        run: |
          if [ -f .cache/last-run-summary.md ]; then
            cat .cache/last-run-summary.md >> "$GITHUB_STEP_SUMMARY"
          fi

      # El PR solo se abre cuando hay fichas escritas, es decir, tras recoger.
      - name: Abrir o actualizar el PR de propuesta
        if: ${{ inputs.dryRun != true && steps.cfg.outputs.phase == 'collect' && steps.pend.outputs.hay == 'true' }}
        env:
          GH_TOKEN: ${{ github.token }}
        run: pnpm review:pr

      # En 'submit' solo se guarda el identificador del lote pendiente.
      - name: Guardar el lote pendiente en la rama de propuesta
        if: ${{ inputs.dryRun != true && steps.cfg.outputs.phase == 'submit' }}
        env:
          GH_TOKEN: ${{ github.token }}
        run: pnpm review:pr --only-state
```

**`--dry-run` no toca los secretos por casualidad**: los recibe igual, pero el código se para
antes de construir el cliente. Si prefieres una garantía dura, mueve las dos claves a un paso
condicionado con `if: ${{ inputs.dryRun != true }}`.

#### `.github/workflows/reconcile.yml`

Convierte «esta ficha no está en el merge» en un veto registrado.

```yaml
name: Reconcile

on:
  pull_request:
    types: [closed]

permissions:
  contents: write

concurrency:
  group: bcn-curator-write      # el MISMO que curate.yml
  cancel-in-progress: false

jobs:
  reconcile:
    # Solo los PR de propuesta, y solo del propio repositorio.
    if: >-
      contains(github.event.pull_request.labels.*.name, 'propuesta') &&
      github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      # ── preparación (igual que en curate.yml) ──
      - uses: actions/checkout@v5
        with: { ref: main, fetch-depth: 0 }
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v5
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile

      - name: Manifiesto contra lo publicado → vetos
        env:
          GH_TOKEN: ${{ github.token }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
          PR_MERGED: ${{ github.event.pull_request.merged }}
        run: pnpm review:reconcile
```

**Nota de seguridad:** el disparador es `pull_request`, **nunca `pull_request_target`**. Es la
diferencia entre un workflow seguro y uno que filtra secretos: `pull_request` desde un fork corre
con permisos de solo lectura y sin acceso a los secretos. La condición del `if` lo remata
exigiendo además que la rama sea del propio repositorio.

#### `.github/workflows/publish.yml`

Construye y despliega. No escribe nada en el repositorio.

```yaml
name: Publish

on:
  push:
    branches: [main]
    paths:
      - 'content/**'
      - 'contracts/**'
      - 'src/publish/**'
  workflow_dispatch: {}

permissions:
  contents: read
  pages: write
  id-token: write

# Grupo PROPIO: publicar no escribe el repositorio, así que no compite con
# curate/reconcile y no tiene por qué esperar media hora detrás de un rastreo.
concurrency:
  group: bcn-curator-pages
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      # ── preparación (igual que en curate.yml) ──
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v5
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile

      - name: Construir dist/v1
        env:
          PUBLISH_BASE_URL: ${{ vars.PUBLISH_BASE_URL }}
        run: pnpm publish:build

      - name: Validar lo que se va a publicar
        run: pnpm validate

      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v5
```

#### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      # ── preparación (igual que en curate.yml) ──
      - uses: actions/checkout@v5
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v5
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile

      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test:run
      - run: pnpm test:contract       # el fixture dorado sigue validando
      - run: pnpm validate            # config/ y content/ contra sus esquemas

      # Puerta del §5.7: tocar un prompt sin evaluarlo está prohibido.
      - name: Un prompt cambiado exige su informe de evaluación
        run: |
          BASE="${{ github.event.pull_request.base.sha || github.event.before }}"
          if [ -z "$BASE" ] || [ "$BASE" = "0000000000000000000000000000000000000000" ]; then
            echo "Sin base con la que comparar; se omite."; exit 0
          fi
          CAMBIADOS="$(git diff --name-only "$BASE" HEAD)"
          if echo "$CAMBIADOS" | grep -qE '^src/(screen/llmScreen|enrich/write)\.ts$'; then
            if ! echo "$CAMBIADOS" | grep -qE '^evals/'; then
              echo "::error::Has tocado un prompt sin actualizar evals/. Ejecuta pnpm eval:screen."
              exit 1
            fi
          fi
```

#### `.github/workflows/health.yml`

```yaml
name: Health

on:
  schedule:
    - cron: '0 6 * * 1'       # lunes, después del rastreo de museos
  workflow_dispatch: {}

permissions:
  contents: read
  issues: write

jobs:
  health:
    runs-on: ubuntu-latest
    steps:
      # ── preparación (igual que en curate.yml) ──
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v5
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile

      - name: Enlaces muertos, fuentes degradadas y verificaciones caducadas
        env:
          CRAWLER_USER_AGENT: ${{ vars.CRAWLER_USER_AGENT }}
        run: pnpm report:health

      - name: Precisión editorial, coste por ficha y cobertura
        run: pnpm report:metrics

      - name: Publicar el informe semanal como incidencia
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          cat .cache/weekly-report.md >> "$GITHUB_STEP_SUMMARY"
          gh issue create \
            --title "Informe semanal · $(date -u +%Y-%m-%d)" \
            --body-file .cache/weekly-report.md \
            --label informe
```

### A.10 · `SOURCES.md`

Plantilla. **Una fuente sin su ficha aquí y sin `verifiedAt` en `config/sources.ts` no se
rastrea** (§3.5). Es la barrera que impide que una web entre en producción sin que nadie haya
mirado sus condiciones.

```markdown
# Fuentes rastreadas

Revisión obligatoria cada 6 meses. `pnpm sources:check` avisa de las caducadas.

## timeout-bcn · Time Out Barcelona

| | |
|---|---|
| Nivel | A (cuenta para el consenso, peso 1,00) |
| Home | `https://www.timeout.es/barcelona` |
| Descubrimiento | `sitemap.xml`, filtrando rutas que contengan `/barcelona/` |
| `robots.txt` | Bloquea por nombre una lista de bots antiguos. Para `User-agent: *` prohíbe `/search*`, cuentas y duplicados por idioma. **No prohíbe los artículos.** Sin `Crawl-delay` declarado |
| Ritmo aplicado | 5.000 ms entre peticiones (prudencia propia), 40 páginas/día |
| Condiciones de uso | Revisadas: sin cláusula que prohíba el acceso automatizado a contenido público |
| Datos que se toman | Título, fechas, precio, lugar, sumario. **Nunca la imagen** (§12.2) |
| `verifiedAt` | 2026-08-29 |
| Revisado por | <nombre> |

## barcelona-secreta · Barcelona Secreta

| | |
|---|---|
| Nivel | A (peso 0,95) |
| Descubrimiento | `sitemap_index.xml` |
| `robots.txt` | Prohíbe `/wp-admin/`, **`/*/feed/`** y una lista de bots basura. No bloquea GPTBot, ClaudeBot ni CCBot |
| Consecuencia | Se entra **por sitemap, nunca por los feeds de categoría**: están prohibidos |
| `verifiedAt` | 2026-08-29 |

## teatre-barcelona · Teatre Barcelona

| | |
|---|---|
| Nivel | B (peso 0,90) |
| Descubrimiento | `https://www.teatrebarcelona.com/es/sitemap_index.xml` |
| `robots.txt` | Prohíbe `/wp-`, `/feed/`, búsqueda y checkout. **Declara `Crawl-delay: 10` para ClaudeBot y Bytespider** |
| Ritmo aplicado | **10.000 ms**, respetando su declaración |
| `verifiedAt` | 2026-08-29 |

## <pendientes de verificar antes de activar>

lecool-bcn · beteve-agenda · lavanguardia-quehacer · enderrock-agenda ·
visit-barcelona · bcn-cultura · articket · museus-bcn

Para cada una, antes de ponerle `verifiedAt`: comprobar que existe sitemap o RSS y su ruta real,
leer el `robots.txt` entero, comprobar que emite JSON-LD, y leer las condiciones de uso buscando
cláusulas sobre acceso automatizado.
```

### A.11 · Requisitos previos y comprobación de entorno

Antes del primer comando:

| Herramienta | Versión | Para qué | Comprobar con |
|---|---|---|---|
| Node.js | **24.x** | Runtime | `node -v` |
| pnpm | 10.26.1 | Dependencias | `pnpm -v` |
| git | cualquiera reciente | Todo | `git --version` |
| GitHub CLI (`gh`) | ≥ 2.40 | Crear el repositorio, secretos y PR | `gh --version` |
| `jq` | **requerido** | Lo usa `curate.yml` para saber si hay lote pendiente; viene preinstalado en los runners de GitHub | `jq --version` |

Node 24 se instala con `nvm install 24 && nvm use 24` (o `fnm`). pnpm, con
`corepack enable && corepack prepare pnpm@10.26.1 --activate`. `gh`, desde
`https://cli.github.com`; después, `gh auth login`.

### A.12 · Qué hay que pedirle al propietario de planonmap, y qué no

Este documento es autosuficiente: **no necesitas acceso al repositorio de planonmap para
construir nada**. Lo único que hay que acordar con su propietario es de ida y vuelta:

| Momento | Qué se pide | Qué se entrega |
|---|---|---|
| Al empezar | Nada | Nada |
| Al terminar la Fase 1 | Nada | La **URL pública** de `/v1/index.json` |
| Al empezar la Fase 2 | Que añada `'curated'` a su enum `source` y el bloque `curated` a su esquema | El **fixture dorado** `curated-golden.json`, para que lo guarde y lo valide con su propio esquema |
| Cuando planonmap cambie su esquema | El `types/event.ts` nuevo y su commit | Nada |

Si en algún momento el esquema de A.1 y el de planonmap discrepan, **manda el de planonmap**: es
quien sirve la web.

---

## Anexo B · Registro de revisión del documento

La versión 1.0 se auditó buscando defectos, no confirmaciones. Salieron nueve. Tres eran graves
—dos habrían roto el modelo de costes o el contrato, y uno habría hecho que dos procesos se
pisaran—. Todos están corregidos en este documento; se listan aquí porque **entender por qué
algo está así importa tanto como el cómo**, y porque estos son los errores que un segundo par de
ojos debería seguir buscando.

| # | Defecto de la v1.0 | Gravedad | Corrección | Dónde |
|---|---|---|---|---|
| 1 | La caché se indexaba por el hash del **HTML**. Cualquier web con un contador, un «últimas entradas» o una marca de tiempo cambia bytes a diario: el descarte del 84 % se habría desplomado y se habría **pagado por reanalizar lo mismo cada día** | **Grave** | `semanticHash` sobre los campos extraídos y normalizados, nunca sobre los bytes | §5.2 |
| 2 | La `dedupeKey` incluye el día, y el `startDate` de los museos **rueda cada semana**: la clave cambiaba sola y la regla de fusión del contrato no habría emparejado nunca | **Grave** | La identidad es siempre el `slug`. Lo atemporal se empareja por proximidad y título, no por clave | §4.9 y contrato |
| 3 | Dos workflows escribían en las mismas carpetas y ambos empujaban a `main`, con grupos de concurrencia distintos. Carreras en el libro de gasto y ramas de propuesta nacidas desactualizadas | **Grave** | Un solo workflow que gasta, grupo de concurrencia compartido, y **nada se empuja a `main`: todo entra por el PR** | §3.6, §3.8 |
| 4 | Producto y caché mezclados en `state/`. El diff del PR —que **es** el panel de revisión— quedaba sepultado bajo miles de líneas de caché regenerable | Medio | Tres zonas: `content/` (producto), `contracts/` (contrato), `.cache/` (derivado), con `.gitattributes` que colapsa la caché | §3.3, §3.4 |
| 5 | La salida generada se commiteaba en `main`, duplicando en cada publicación lo que ya estaba en `content/` | Medio | Pages por artefacto. `dist/` no se versiona | §9.2 |
| 6 | El veto se deducía **leyendo el cuerpo del PR**. Un texto editado o un carácter raro perdía el veto y la ficha volvía a proponerse — y a pagarse | Medio | Manifiesto `content/proposals/<fecha>.json`. Vetado = propuesto menos presente | §10.1 |
| 7 | Un montaje con veinte funciones no estaba resuelto: ¿un evento o veinte? Veinte habrían sido veinte pines idénticos comiéndose el cupo del mapa | Medio | **Un `Event` por montaje**, funciones en `schedule[]`. La excepción son los ciclos con artista distinto cada noche | §4.9 |
| 8 | No había forma de saber si un cambio de prompt mejora o empeora hasta semanas después | Bajo | `evals/` con conjunto dorado etiquetado a mano y umbrales de aceptación | §5.7 |
| 9 | El esquema era «una copia literal» de planonmap, sin nada que impidiera que divergieran en silencio — el fallo que este proyecto ya ha cometido dos veces | Bajo | Procedencia registrada, **fixture dorado compartido** y validación autoritativa del consumidor | §5.8 |

Además, tres refuerzos que no corrigen un fallo pero cierran una puerta:

- **Puerta `verifiedAt`**: una fuente sin fecha de revisión legal y técnica **no se rastrea**.
  Hace imposible que una web entre en producción sin que nadie haya mirado su `robots.txt`.
- **Un solo verbo `curate`** con parámetros, en vez de dos comandos casi iguales que podían
  divergir. Y `--dry-run` como herramienta principal de trabajo: afinar sin gastar.
- **El «ahora» se inyecta siempre.** planonmap ha tenido la CI rota tres veces por fechas fijas
  caducadas en fixtures; aquí una regla de ESLint lo impide desde el primer día.

Lo que la auditoría **confirmó** y no se toca: TypeScript sobre Node 24 con el esquema
compartido; GitHub Actions y Pages en repositorio público; el PR como panel de revisión; publicar
un `Event` de planonmap con un bloque `curated` en vez de inventar un formato; y versionar la
caché en git en lugar de usar Actions Cache, que se expira sola a los siete días.

### Revisión v1.2 — legibilidad para quien lo recibe

La v1.1 era correcta pero estaba **escrita desde dentro de planonmap**, y eso podía llevar a
alguien a creer que su trabajo era tocar ese proyecto. Se midió: 142 menciones a planonmap y
**356 líneas sobre él antes de decir qué hay que construir** — justo el tramo donde el lector se
forma la idea de la tarea. Cuatro cambios:

| Problema | Corrección |
|---|---|
| El título hablaba de un «proyecto externo». ¿Externo a qué? Solo tiene sentido visto desde planonmap; para quien recibe el encargo, esto **es** el proyecto | Título: **`bcn-curator — Plan de construcción`**, y esa expresión eliminada de las siete veces que aparecía en el cuerpo (esta tabla la cita para explicarse, y es la única vez que queda) |
| 356 líneas sobre el cliente antes de decir qué se construye | **§0 «Empieza aquí»**: qué construyes, qué no, la frontera dibujada y la ruta de siete pasos, todo antes de nada |
| El §1 parecía trabajo a realizar | Retitulado a «El cliente: qué formato exige» y encabezado por una tabla que marca **cuáles de sus trece subsecciones son ESENCIALES** (seis) y cuáles contexto saltable |
| El §9.3 describe archivos **dentro** de planonmap sin avisarlo. Alguien podría crearlos en su repo | Aviso ⛔ al principio del apartado: no es trabajo tuyo, y por qué está ahí igualmente |

Además, el registro de revisión que estabas leyendo se movió del principio al final: es historia
del documento, no instrucciones, y ocupaba el sitio donde ahora está lo que de verdad hay que
leer primero.

### Revisión v1.3 — el Batch API es asíncrono

Una auditoría de coherencia encontró un **defecto de arquitectura** que habría aparecido el
primer día de ejecución real, y tres arrastres de correcciones anteriores.

| # | Defecto | Gravedad | Corrección |
|---|---|---|---|
| 10 | **El Batch API es asíncrono** —hasta 24 h de compromiso— y el workflow enviaba el lote y abría el PR **en la misma ejecución**, con `timeout-minutes: 30`. No podía funcionar. Y todo el modelo de coste dependía de ese descuento del 50 % | **Grave** | El cribado pasa a **síncrono** (cuesta 7 céntimos más al mes y su resultado hace falta de inmediato para decidir qué se redacta); la redacción sigue en lote y se recoge en una **segunda fase** 4 h después, con reintentos. Ver §7.2 bis y §7.2 ter |
| 11 | El §14.3 creaba **2 de los 8 valores** que leen los workflows. Sin `CRAWLER_USER_AGENT` el rastreador sale sin identificarse — y sobre eso se apoya toda la política de cortesía del §11.4 y la defensa legal del §12.1 | Medio | Los ocho, con sus `gh secret set` y `gh variable set` y una comprobación final |
| 12 | El §14.3 seguía diciendo «Pages: Deploy from a branch → main → /docs», el diseño **anterior** a la corrección nº 5. Con ese ajuste, el paso `deploy-pages` falla | Medio | Modo «GitHub Actions», y §3.1 corregido, que arrastraba lo mismo |
| 13 | El anexo A.9 se titulaba «Los cuatro workflows» y contenía cinco | Bajo | Corregido |

Lo que la auditoría **comprobó y estaba bien**: las 46 referencias cruzadas `§X.Y` resuelven; los
tres escenarios de coste cuadran al céntimo con sus propios supuestos; las carpetas que crea el
§14.2 coinciden con el árbol del §3.4; y el TypeScript del anexo A compila contra Zod 4.4.1 y
valida los ejemplos del §8.

**Efecto en el presupuesto:** el escenario esperado pasa de 3,03 € a 3,10 €/mes. Siete céntimos
por una arquitectura que funciona. *(Esa cifra la corrigió después la revisión v1.4.)*

### Revisión v1.4 — auditoría metódica punto por punto

Una pasada sistemática sobre cada apartado, verificando con herramientas lo que hasta entonces
solo estaba afirmado. Salieron seis defectos más, dos de ellos en el corazón del modelo de coste.

| # | Defecto | Gravedad | Corrección |
|---|---|---|---|
| 14 | **Los tokens de razonamiento no estaban contados.** Tanto el `reasoning_effort` de OpenAI como el pensamiento de Claude generan tokens que no se ven en la respuesta pero **se facturan al precio de salida**. La previsión contaba solo el JSON visible, así que subestimaba la partida cara | **Grave** | Contados y explicados en los supuestos del §7.4. La redacción baja a `effort: low`, que en una tarea de rúbrica no pierde calidad y sí evita pagar pensamiento de más |
| 15 | **El volumen se contradecía con el propio documento.** El modelo asumía 4 fichas/día (120 al mes) sobre colecciones que el §2.3 declara de 90–160 fichas vivas: renovar el catálogo entero cada tres semanas | **Grave** | Volumen derivado de los tamaños de colección: **~2 al día**, con el razonamiento escrito para que se pueda discutir |
| 16 | `max_output_tokens: 1200` en el cribado. Ese tope **incluye el razonamiento** (~850), así que el JSON se habría cortado a mitad de forma intermitente — la peor clase de fallo | **Grave** | Subido a 3.000, que no cuesta nada porque se paga por token generado, no por el tope |
| 17 | `IndexFileSchema` exigía **exactamente tres colecciones**, pero en las fases 0 a 3 solo existe `museums`. El `pnpm validate` de esas fases no podía pasar nunca: bloqueaba el despliegue por fases entero | **Grave** | Entre una y tres, sin duplicados. Corregido también en el contrato permanente de planonmap |
| 18 | Las tres acciones de GitHub Pages estaban pinchadas en versiones antiguas (`configure-pages@v5`, `upload-pages-artifact@v4`, `deploy-pages@v4`) | Medio | Verificadas contra sus repositorios: **v6, v5 y v5** |
| 19 | El §5.1 definía el consenso como «suma de trust» y a la vez como tabla por número de fuentes. Son cosas distintas y el código tiene que elegir una. Y los museos, que entran por catálogo, no tenían definido cómo se saltan el umbral de 62 | Medio | Fórmula explícita (`base por número × media de trust`) con ejemplo, y una tabla que fija la excepción de los museos |

**Verificado con herramientas en esta pasada, no solo afirmado:** los cinco workflows se parsean
como YAML válido y tienen `runs-on` y `steps`; las comparaciones de cron casan carácter por
carácter con los crons declarados; las 46 referencias `§X.Y` y las 12 al anexo resuelven; los tres
escenarios de coste cuadran al céntimo con sus supuestos; el TypeScript del anexo compila contra
Zod 4.4.1 y el esquema del índice acepta una, dos o tres colecciones y rechaza duplicados y
cuartas.

**Efecto en el presupuesto:** el escenario esperado queda en **2,28 €/mes** —más barato que antes,
porque el volumen ahora es coherente— y el peor caso sube a 8,39 €, que es donde corta el tope.

---

## Resumen en diez líneas

1. `bcn-curator`: repositorio **público** de TypeScript sobre Node 24, con GitHub Actions y Pages.
2. Rastrea 12 webs por sitemap y RSS, respetando `robots.txt` y con topes por fuente.
3. Extrae con JSON-LD primero, OpenGraph después, selectores como último recurso.
4. Descarta el **92 %** sin IA: contenido sin cambios, fuera de ventana, fuera de Barcelona, sin consenso.
5. Criba ~20 candidatos al día con `gpt-5-mini` en lotes de 10, en síncrono, por 0,24 €/mes.
6. Redacta ~2 fichas al día en español e inglés con `claude-opus-5` por Batch API (asíncrono,
   recogido en una segunda fase 4 h después), por 1,91 €/mes.
7. Verifica cada dato factual contra una **evidencia literal**; sin evidencia, el campo se omite.
8. Publica tres JSON en una URL pública, con el formato que exige el cliente (Anexo A.1).
9. La revisión editorial es **mergear un PR**. Vetar es borrar un archivo de ese PR.
10. Coste total: **≈ 2,30 €/mes**, con tope duro de 5 € y degradación que nunca deja de publicar.

Y la línea que resume la frontera: **tu trabajo empieza en un repositorio vacío y termina en una
URL**. Lo que ocurra después con esos JSON lo hará otra persona, en otro repositorio, siguiendo
su propia documentación.
