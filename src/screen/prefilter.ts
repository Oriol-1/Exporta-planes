// src/screen/prefilter.ts
// El prefiltro determinista, ANTES de gastar un céntimo (§5.2).
//
// De ~250 URL descubiertas al día, el 84 % no ha cambiado (paso 1) y el
// prefiltro descarta la mitad de lo que queda. Al modelo llegan unas 20: un 8 %
// de lo rastreado. Es la pieza que hace que la factura sea de céntimos.
import type { Cluster } from '../types'
import type { Scoring } from '../../config/schema'
import { norm } from '../core/text'
import { inWindow, daysUntil } from '../normalize/dates'
import { inBarcelonaBbox } from '../normalize/geo'
import { goodSources } from '../cluster/group'

/** Rutas que delatan contenido comercial disfrazado de plan. */
const URL_BLOCKLIST =
  /\/(publirreportaje|branded|patrocinado|sponsored|sorteo|promo|casino|apuestas|betting)\//i

/** Marcadores publicitarios en el título o el sumario. */
const AD_MARKERS =
  /\b(contenido patrocinado|contingut patrocinat|en colaboracion con|en col·laboracio amb|#ad|codigo descuento|codi descompte|publirreportaje)\b/

/** Texto útil mínimo para poder escribir una ficha honesta. */
const MIN_USEFUL_TEXT = 200

export type PrefilterReason =
  | 'sin-cambios'
  | 'vetado'
  | 'sin-fecha'
  | 'fuera-de-ventana'
  | 'fuera-de-barcelona'
  | 'url-en-lista-negra'
  | 'marcadores-publicitarios'
  | 'material-insuficiente'
  | 'sin-consenso-ni-ficha'
  | 'ya-cubierto-por-planonmap'

export type PrefilterOutcome =
  | { readonly pass: true }
  | { readonly pass: false; readonly reason: PrefilterReason }

export interface PrefilterContext {
  readonly now: Date
  readonly scoring: Scoring
  /** semanticHash conocido de la última vez. Igual ⇒ ya está decidido. */
  readonly knownHashes: ReadonlySet<string>
  readonly vetoedSlugs: ReadonlySet<string>
  /** dedupeKeys que planonmap ya cubre BIEN (con texto, imagen y web oficial). */
  readonly wellCoveredKeys: ReadonlySet<string>
  /** Puntuación determinista, ya calculada, para el paso 9. */
  readonly deterministicScore: number
}

/**
 * Corre en este orden, cortando en cuanto uno acierta. El orden no es
 * arbitrario: los pasos baratos y los que descartan más van primero.
 */
export function prefilter(cluster: Cluster, ctx: PrefilterContext): PrefilterOutcome {
  // 1 · Ya decidido: mismo significado que la última vez. El paso que ahorra
  //     el 84 %. Se compara el semanticHash, NUNCA el hash del HTML (§5.2).
  if (ctx.knownHashes.has(cluster.semanticHash)) {
    return { pass: false, reason: 'sin-cambios' }
  }

  // 2 · El propietario ya dijo que no. Es para siempre.
  const slug = cluster.seedSlug ?? cluster.clusterId
  if (ctx.vetoedSlugs.has(slug)) {
    return { pass: false, reason: 'vetado' }
  }

  const isMuseum = cluster.collection === 'museums'

  // 3 · Sin fecha parseable y no es museo.
  if (!cluster.startDate && !isMuseum) {
    return { pass: false, reason: 'sin-fecha' }
  }

  // 4 · Fuera de la ventana de planonmap: de ayer a +60 días.
  if (cluster.startDate && !isMuseum) {
    if (!inWindow(cluster.startDate, ctx.now)) {
      const end = cluster.endDate
      // Un rango que ya empezó y sigue vivo SÍ está dentro: una exposición de
      // tres meses no puede caerse por haber abierto hace cinco semanas.
      const stillRunning = end !== undefined && new Date(end) >= ctx.now && new Date(cluster.startDate) <= ctx.now
      if (!stillRunning) return { pass: false, reason: 'fuera-de-ventana' }
    }
  }

  // 5 · Coordenadas fuera del recuadro metropolitano.
  if (!inBarcelonaBbox(cluster.venue.lat, cluster.venue.lng)) {
    return { pass: false, reason: 'fuera-de-barcelona' }
  }

  // 6 · La URL casa con la lista negra de rutas.
  if (cluster.sources.some((s) => URL_BLOCKLIST.test(s.url))) {
    return { pass: false, reason: 'url-en-lista-negra' }
  }

  // 7 · Marcadores publicitarios en el título o el sumario.
  if (AD_MARKERS.test(norm(`${cluster.title} ${cluster.description}`))) {
    return { pass: false, reason: 'marcadores-publicitarios' }
  }

  // 8 · Sin material no hay ficha honesta que escribir.
  const useful = cluster.extracts.reduce((n, e) => n + e.text.length, 0) + cluster.description.length
  if (useful < MIN_USEFUL_TEXT) {
    return { pass: false, reason: 'material-insuficiente' }
  }

  // 9 · Colección A con una sola fuente A/B y puntuación baja: no hay caso.
  //     Los museos NO pasan por aquí: entran por catálogo, no por consenso (§5.1).
  if (cluster.collection === 'plans' && !isMuseum) {
    const good = goodSources(cluster)
    if (good.length <= 1 && ctx.deterministicScore < ctx.scoring.singleSourceMinDeterministic) {
      return { pass: false, reason: 'sin-consenso-ni-ficha' }
    }
  }

  // 10 · planonmap ya lo cubre bien: no aportamos nada.
  if (ctx.wellCoveredKeys.has(cluster.planonmapDedupeKey)) {
    return { pass: false, reason: 'ya-cubierto-por-planonmap' }
  }

  return { pass: true }
}

/** Vigencia en puntos (0–5). Los museos puntúan 5 siempre (§5.1). */
export function freshnessPoints(cluster: Cluster, now: Date, scoring: Scoring): number {
  if (cluster.collection === 'museums') return scoring.freshness.d14
  if (!cluster.startDate) return 0
  const days = daysUntil(cluster.startDate, now)
  if (days <= 14) return scoring.freshness.d14
  if (days <= 30) return scoring.freshness.d30
  if (days <= 60) return scoring.freshness.d60
  return 0
}
