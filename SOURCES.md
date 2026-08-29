# Fuentes rastreadas

Revisión obligatoria cada 6 meses. `pnpm sources:check` avisa de las caducadas.

> **Una fuente sin su ficha aquí y sin `verifiedAt` en `config/sources.ts` NO SE
> RASTREA** (§3.5). No es una recomendación: `config/index.ts` la filtra en
> silencio y `pnpm validate` lo dice. Es la barrera que impide que una web entre
> en producción sin que nadie haya mirado sus condiciones — exactamente el
> descuido que convierte un proyecto legítimo en uno problemático.

Qué hay que comprobar antes de poner una fecha en `verifiedAt`:

1. Que existe sitemap o RSS, y **cuál es su ruta real**.
2. El `robots.txt` **entero**: qué prohíbe para `User-agent: *`, si nombra bots
   concretos y si declara `Crawl-delay`.
3. Que la web **emite JSON-LD** (si no, dependeríamos de selectores frágiles).
4. Las **condiciones de uso**, buscando cláusulas sobre acceso automatizado.

---

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

## barcelona-secreta · Barcelona Secreta

| | |
|---|---|
| Nivel | A (peso 0,95) |
| Home | `https://barcelonasecreta.com` |
| Descubrimiento | `sitemap_index.xml` |
| `robots.txt` | Prohíbe `/wp-admin/`, **`/*/feed/`** y una lista de bots basura. No bloquea GPTBot, ClaudeBot ni CCBot |
| Consecuencia | Se entra **por sitemap, nunca por los feeds de categoría**: están prohibidos |
| Ritmo aplicado | 5.000 ms, 40 páginas/día |
| Datos que se toman | Título, fechas, precio, lugar, sumario. **Nunca la imagen** |
| `verifiedAt` | 2026-08-29 |

## teatre-barcelona · Teatre Barcelona

| | |
|---|---|
| Nivel | B (peso 0,90) |
| Home | `https://www.teatrebarcelona.com` |
| Descubrimiento | `https://www.teatrebarcelona.com/es/sitemap_index.xml` |
| `robots.txt` | Prohíbe `/wp-`, `/feed/`, búsqueda y checkout. **Declara `Crawl-delay: 10` para ClaudeBot y Bytespider** |
| Ritmo aplicado | **10.000 ms**, respetando su declaración |
| Datos que se toman | Título, fechas, sesiones, precio, sala, sobretítulos |
| `verifiedAt` | 2026-08-29 |

## museus-bcn · Museus de Barcelona

| | |
|---|---|
| Nivel | C (**no cuenta para el consenso**; sirve para verificar) |
| Home | `https://www.barcelona.cat/museus` |
| Descubrimiento | Sitemap del portal municipal |
| `robots.txt` | El de `barcelona.cat` no restringe `/museus` |
| Ritmo aplicado | 10.000 ms, 20 páginas/día |
| Datos que se toman | Horarios, precios y gratuidades, para **verificar** lo del catálogo |
| `verifiedAt` | 2026-08-29 |

## venue-official · Ficha oficial del propio recinto

| | |
|---|---|
| Nivel | C (**no cuenta para el consenso**) |
| Home | — (una URL por entidad, desde `config/museums.ts`) |
| Descubrimiento | `perEntity`: la URL la trae el catálogo, no un sitemap |
| Ritmo aplicado | 5.000 ms, 60 páginas/día repartidas entre todos los recintos |
| Datos que se toman | Solo la página pública de horarios y precios |
| Nota | Un museo siempre habla bien de sí mismo: por eso puntúa 0 en consenso y solo se usa para **verificar** precio, horario y dirección |
| `verifiedAt` | 2026-08-29 |

---

## Pendientes de verificar antes de activar

Estas fuentes están **declaradas en `config/sources.ts` pero SIN `verifiedAt`**, así
que hoy se omiten del rastreo. Para activarlas hay que hacer las cuatro
comprobaciones de arriba, escribir su ficha en este archivo y añadir la fecha.

- `lecool-bcn` — Le Cool Barcelona (nivel A, 0,90)
- `beteve-agenda` — betevé (nivel A, 0,85)
- `lavanguardia-quehacer` — La Vanguardia (nivel A, 0,85)
- `enderrock-agenda` — Enderrock (nivel B, 0,80)
- `visit-barcelona` — Barcelona Turisme (nivel B, 0,80)
- `bcn-cultura` — Barcelona Cultura (nivel B, 0,80)
- `articket` — Articket BCN (nivel C)

---

## Higiene del rastreador (§11.4)

Se aplica a **todas** las fuentes, sin excepción:

- User-Agent identificable y con URL de contacto: si alguien quiere que paremos,
  sabe a quién escribir.
- `robots.txt` respetado siempre, sin «modo agresivo».
- Un `403` persistente **desactiva la fuente** y abre una incidencia. No se rota
  User-Agent, no se usan proxies, no se resuelven captchas. Si un sitio no nos
  quiere, no entramos.
- Sin credenciales de terceros: solo páginas públicas. No se crean cuentas, no se
  aceptan cookies de sesión, no se accede a nada tras un muro de pago.
- `maxPagesPerDay` por fuente es a la vez una defensa técnica y jurídica: hace
  imposible una extracción sustancial de una base de datos ajena (§12.1).
