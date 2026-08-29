// config/index.ts
// Carga, valida con Zod y CONGELA toda la configuración. Se ejecuta al arrancar
// y en ci.yml, así que un `tier: 'D'` inexistente o un `trust: "1.0"` con
// comillas no llegan nunca a producir un consenso mal calculado que nadie nota.
import {
  SourcesSchema,
  MuseumsSchema,
  ScoringSchema,
  QuotasSchema,
  BudgetSchema,
  type MuseumSeed,
  type SourceConfig,
} from './schema'
import { SOURCES } from './sources'
import { MUSEUMS } from './museums'
import { SCORING } from './scoring'
import { QUOTAS } from './quotas'
import { BUDGET } from './budget'

/** Días tras los que una revisión legal se considera caducada (§3.5). */
export const VERIFICATION_MAX_AGE_DAYS = 180

export interface ConfigWarning {
  readonly scope: 'source' | 'museum'
  readonly id: string
  readonly message: string
}

export interface LoadedConfig {
  /** Todas las fuentes declaradas, verificadas o no. */
  readonly allSources: readonly SourceConfig[]
  /** Solo las que tienen `verifiedAt`: las únicas que se rastrean. */
  readonly activeSources: readonly SourceConfig[]
  readonly museums: readonly MuseumSeed[]
  readonly scoring: typeof SCORING
  readonly quotas: typeof QUOTAS
  readonly budget: typeof BUDGET
  readonly warnings: readonly ConfigWarning[]
}

function daysSince(isoDate: string, now: Date): number {
  const then = new Date(`${isoDate}T00:00:00Z`).getTime()
  return Math.floor((now.getTime() - then) / 86_400_000)
}

/**
 * Valida y devuelve la configuración. El «ahora» se inyecta (§3.6): sin eso, un
 * fixture con fecha fija caduca solo y rompe la CI, que es exactamente el fallo
 * que planonmap ha sufrido tres veces.
 */
export function loadConfig(now: Date): LoadedConfig {
  const allSources = SourcesSchema.parse(SOURCES)
  const museums = MuseumsSchema.parse(MUSEUMS)
  const scoring = ScoringSchema.parse(SCORING)
  const quotas = QuotasSchema.parse(QUOTAS)
  const budget = BudgetSchema.parse(BUDGET)

  const warnings: ConfigWarning[] = []

  // LA PUERTA DE SEGURIDAD. Una fuente sin fecha de revisión legal y técnica se
  // salta en silencio; con la fecha a más de 180 días se rastrea pero avisa. Así
  // es imposible que una web entre en producción sin que alguien haya mirado su
  // robots.txt y sus condiciones de uso.
  const activeSources = allSources.filter((s) => {
    if (!s.verifiedAt) {
      warnings.push({
        scope: 'source',
        id: s.id,
        message: 'sin verificar (falta verifiedAt): se omite del rastreo',
      })
      return false
    }
    const age = daysSince(s.verifiedAt, now)
    if (age > VERIFICATION_MAX_AGE_DAYS) {
      warnings.push({
        scope: 'source',
        id: s.id,
        message: `verificada hace ${age} días (> ${VERIFICATION_MAX_AGE_DAYS}): revísala`,
      })
    }
    return true
  })

  // El presupuesto necesita el precio de los tres modelos que puede llegar a usar.
  for (const model of [budget.screenModel, budget.writerModel, budget.writerFallbackModel]) {
    if (!budget.pricing[model]) {
      throw new Error(
        `config/budget.ts: falta el precio del modelo "${model}". Sin precio no se puede ` +
          'estimar el coste antes de llamar, y el tope duro dejaría de ser duro.',
      )
    }
  }

  return Object.freeze({
    allSources: Object.freeze(allSources),
    activeSources: Object.freeze(activeSources),
    museums: Object.freeze(museums.filter((m) => m.enabled)),
    scoring,
    quotas,
    budget,
    warnings: Object.freeze(warnings),
  })
}

export function sourceById(
  cfg: LoadedConfig,
  id: string,
): SourceConfig | undefined {
  return cfg.allSources.find((s) => s.id === id)
}

export type { SourceConfig, MuseumSeed, Tier, Collection } from './schema'
