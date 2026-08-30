// REGRESIÓN GRAVE Y SILENCIOSA: `.env.local` no llegaba al presupuesto.
//
// `config/budget.ts` leía `process.env` AL IMPORTARSE, y los imports de ES se
// evalúan antes que cualquier sentencia — o sea, antes de que `readEnv()` haya
// cargado `.env.local`. Consecuencia: SCREEN_MODEL, WRITER_MODEL y, lo más
// grave, AI_MONTHLY_BUDGET_EUR puestos en `.env.local` se ignoraban sin decir
// nada. Quien bajara el tope a 1 € seguía teniendo 5.
//
// Se descubrió al configurar OpenRouter: pedimos un modelo gratuito y la
// ejecución llamó igualmente a `gpt-5-mini`, de pago.
import { describe, expect, it } from 'vitest'
import { applyEnv, BUDGET } from '../../config/budget'

describe('applyEnv · el entorno se aplica en tiempo de EJECUCIÓN', () => {
  it('sin entorno, se queda con los valores por defecto', () => {
    const b = applyEnv(BUDGET, {})
    expect(b.screenModel).toBe('gpt-5-mini')
    expect(b.writerModel).toBe('claude-opus-5')
    expect(b.monthlyBudgetEur).toBe(5)
  })

  it('EL TOPE DE GASTO obedece al entorno', () => {
    // Es lo más grave que ocultaba el fallo: un tope que no se aplica no es un
    // tope, y todo el §7.6 depende de él.
    expect(applyEnv(BUDGET, { AI_MONTHLY_BUDGET_EUR: '1' }).monthlyBudgetEur).toBe(1)
    expect(applyEnv(BUDGET, { AI_MONTHLY_BUDGET_EUR: '0.5' }).monthlyBudgetEur).toBe(0.5)
  })

  it('un tope ilegible o absurdo NO abre la mano: se queda el por defecto', () => {
    for (const malo of ['', '   ', 'gratis', '-3', '0']) {
      expect(applyEnv(BUDGET, { AI_MONTHLY_BUDGET_EUR: malo }).monthlyBudgetEur, malo).toBe(5)
    }
  })

  it('los modelos obedecen al entorno', () => {
    const b = applyEnv(BUDGET, { SCREEN_MODEL: 'z-ai/glm-5.2:free', WRITER_MODEL: 'gpt-5' })
    expect(b.screenModel).toBe('z-ai/glm-5.2:free')
    expect(b.writerModel).toBe('gpt-5')
  })

  it('una variable vacía no pisa el valor por defecto', () => {
    // Una variable de Actions sin configurar llega vacía, no ausente.
    expect(applyEnv(BUDGET, { SCREEN_MODEL: '' }).screenModel).toBe('gpt-5-mini')
    expect(applyEnv(BUDGET, { SCREEN_MODEL: '  ' }).screenModel).toBe('gpt-5-mini')
  })
})

describe('precios con endpoint propio', () => {
  const conEndpoint = { OPENAI_BASE_URL: 'https://openrouter.ai/api/v1' }

  it('un modelo sin precio de catálogo se declara a coste CERO', () => {
    const b = applyEnv(BUDGET, { ...conEndpoint, SCREEN_MODEL: 'z-ai/glm-5.2:free' })
    expect(b.pricing['z-ai/glm-5.2:free']).toEqual({
      inputPerMTokUsd: 0,
      outputPerMTokUsd: 0,
      batch: false,
    })
  })

  it('SIN endpoint propio, un modelo desconocido sigue sin precio', () => {
    // El guardián del §7.6 no se relaja: sin precio no se llama.
    const b = applyEnv(BUDGET, { SCREEN_MODEL: 'z-ai/glm-5.2:free' })
    expect(b.pricing['z-ai/glm-5.2:free']).toBeUndefined()
  })

  it('un modelo DE PAGO no se abarata por haber endpoint propio', () => {
    // Es justo lo que pasó al configurar OpenRouter: la petición fue a
    // `gpt-5-mini` de verdad, y de verdad se cobró. Sobreestimar es la
    // dirección segura cuando hay un tope duro de por medio.
    const b = applyEnv(BUDGET, { ...conEndpoint, SCREEN_MODEL: 'gpt-5-mini' })
    expect(b.pricing['gpt-5-mini']?.inputPerMTokUsd).toBe(0.25)
  })

  it('el modelo de respaldo también entra en el cálculo', () => {
    const b = applyEnv(BUDGET, { ...conEndpoint, WRITER_FALLBACK_MODEL: 'algun/modelo:free' })
    expect(b.pricing['algun/modelo:free']).toBeDefined()
  })

  it('los cuatro precios de catálogo siguen intactos', () => {
    const b = applyEnv(BUDGET, { ...conEndpoint, SCREEN_MODEL: 'x/y:free' })
    for (const m of ['gpt-5-mini', 'gpt-5', 'claude-opus-5', 'claude-sonnet-5']) {
      expect(b.pricing[m], m).toBeDefined()
    }
  })
})
