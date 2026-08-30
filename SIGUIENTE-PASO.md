# Siguiente paso

> Escrito el **30 de agosto de 2026**, al terminar la Fase 0 y agotar la
> búsqueda de una alternativa gratuita a las APIs de IA.
>
> Este archivo existe para que, dentro de tres meses y sin recordar nada, sepas
> en un minuto **dónde está el proyecto, qué decisión falta y qué NO hay que
> volver a intentar**. Si algo de aquí contradice a la realidad, manda
> `pnpm doctor`, que lee el estado de verdad.

---

## 1 · Dónde estamos

**El proyecto está vivo y publicando.** Compruébalo tú:

```bash
pnpm doctor
```

Estado a fecha de hoy:

| | |
| --- | --- |
| URL pública | <https://oriol-1.github.io/Exporta-planes/v1/index.json> · **funcionando** |
| Fichas publicadas | 5 museos, escritas a mano en la Fase 0 |
| Coste hasta ahora | **0,00 €** |
| Tests | 258, en verde |
| Workflows | los cinco activos; el cron diario se ejecuta solo |

Lo que ya funciona **sin gastar un céntimo, y seguirá funcionando**: rastreo,
extracción, deduplicación, agrupación, los 45 puntos deterministas,
actualización de precios y horarios, retirada de lo caducado y publicación con
sumas de verificación. GitHub Actions y Pages son gratis para siempre en un
repositorio público.

Lo único que necesita IA de pago es **escribir fichas nuevas**.

---

## 2 · La decisión que falta, y la recomendación

**Carga 5 $ en la consola de OpenAI.** Es la recomendación, después de haber
probado y medido todas las alternativas gratuitas (apartado 4).

Ponlo en perspectiva antes de decidir:

| Qué haces | Coste/mes | Duración de 5 $ |
| --- | --- | --- |
| Solo cribar | 0,24 € | **19 meses** |
| Todo con OpenAI (`gpt-5-mini` criba, `gpt-5` redacta) | 0,98 € | **4 meses** |
| El plan original (añade Anthropic para redactar) | 2,28 € | — |

Una ficha de prueba cuesta **1,16 céntimos**. Un lote de 10 candidatos cribados,
**0,40 céntimos**. Estábamos peleando por céntimos al año.

---

## 3 · Qué hacer, paso a paso

### 3.1 · Cargar saldo y volver a OpenAI

1. Carga 5 $ en <https://platform.openai.com/settings/organization/billing>.
   **Desactiva la recarga automática**: así el saldo es un tope físico por
   debajo del tope lógico del código.
2. En `.env.local`, deja esto:

   ```bash
   OPENAI_API_KEY=sk-proj-…      # tu clave de OpenAI, no la de OpenRouter
   SCREEN_MODEL=gpt-5-mini
   # OPENAI_BASE_URL=            ← comentada: se habla con OpenAI directamente
   ```

3. Comprueba que arranca sin gastar:

   ```bash
   pnpm doctor
   pnpm curate --collection museums --dry-run --limit 5
   ```

### 3.2 · Medir el cribado antes de fiarte

```bash
pnpm eval:screen
```

Cuesta menos de un céntimo y te da el número de referencia. **Debe salir ≥ 21 de
24 aciertos y 0 vetos duros fallados.** Si sale eso, el cribado es de fiar. Si
no, hay algo mal y no conviene seguir hasta entenderlo.

### 3.3 · La primera tanda de verdad

```bash
pnpm curate --collection museums --limit 5    # unos céntimos
pnpm spend                                     # comprobar el gasto
```

Lee las cinco fichas enteras. **Es cuando más se aprende**: ajusta el prompt de
redacción con esas cinco delante, antes de lanzar las 50 restantes.

### 3.4 · El resto de la Fase 1

```bash
pnpm curate --collection museums              # las ~50 que faltan
```

Y después, **la prueba más importante de toda la fase**: vuelve a lanzarlo.

```bash
pnpm curate --collection museums
pnpm spend
```

**La segunda ejecución tiene que costar 0,00 €.** Si no lo hace, hay un error en
la clave de caché y **hay que pararse a arreglarlo antes de seguir**: es el
defecto que multiplica la factura por diez.

### 3.5 · Los secretos en GitHub, para que el cron trabaje solo

```bash
gh secret set OPENAI_API_KEY
gh secret set CRAWLER_CONTACT_EMAIL      # tu correo real: va en el User-Agent
```

Sin ellos el cron rastrea y publica, pero no escribe fichas nuevas.

### 3.6 · Proteger `main`

Queda pendiente y no tiene equivalente fiable en `gh`. En
**Settings → Rules → New branch ruleset**, sobre `main`: requerir PR antes de
mergear, bloquear force pushes, restringir borrados. Es lo que garantiza que
`main` solo contenga lo que has aprobado.

---

## 4 · Lo que NO hay que volver a intentar

Se probó todo esto el 30/08/2026, con medidas reales sobre el conjunto dorado de
24 candidatos. **El umbral para fiarse es ≥ 21 aciertos y 0 vetos duros
fallados.**

| Opción gratuita | Aciertos | Vetos fallados | Veredicto |
| --- | --- | --- | --- |
| `nvidia/nemotron-3-super-120b-a12b:free`, lotes de 4 | 10 / 24 | 3 | ❌ |
| Local `qwen2.5:7b` con Ollama | 11 / 24 | 6 | ❌ |
| `nvidia/nemotron-…:free`, lotes de 12 | 0 / 24 | — | ❌ no respeta el esquema |
| `z-ai/glm-5.2:free` | — | — | ❌ `429`, pool compartido saturado |
| `dots-studio/dots-3-note-preview:free` | — | — | ❌ devuelve los campos vacíos |
| `openrouter/free` | — | — | ❌ enruta a un modelo de código |
| GitHub Models | — | — | ⛔ `410`, retirado |
| Suscripción de ChatGPT Plus | — | — | ⛔ no aplica: cubre uso interactivo, no un programa desatendido |

**El patrón, que es lo que importa:** todas caen en 10–11 de 24 cuando hacen
falta 21. No es que puntúen algo peor — **no discriminan**. El modelo local dio
entre 5 y 19 puntos de 55 a *todos* los candidatos, incluidos la Sagrada Família
y el románico del MNAC. En producción publicaría cero fichas.

### Si aun así quieres reevaluarlo algún día

El proyecto admite cualquier endpoint compatible con OpenAI, y medirlo es
gratis y tarda tres minutos:

```bash
OPENAI_BASE_URL=https://…  SCREEN_MODEL=el-modelo  pnpm eval:screen --batch 4
```

El tamaño de lote resultó decisivo: el mismo modelo saca 0/24 con lotes de 12 y
10/24 con lotes de 4. Empieza por 4.

---

## 5 · Si algo se rompe

| Síntoma | Qué mirar |
| --- | --- |
| Cualquier duda sobre el estado | `pnpm doctor` — dice qué falla **y qué hacer** |
| El cron termina en verde pero no trae candidatos | Ya pasó una vez: los sub-sitemaps o el filtro de «esto parece una ficha». `pnpm curate --dry-run` lo enseña |
| Una fuente deja de traer datos | `pnpm report:health`. Tras 7 días degradada se desactiva sola |
| Gasto disparado | `pnpm spend`. Sospechosos: subir `PROMPT_VERSION` sin `--reprocess` acotado, o que la caché deje de acertar |
| Una ficha con un dato mal | `pnpm veto <slug> "<motivo>"`, o borra el JSON para que se regenere, o edítalo y añade `"locked": true` |
| El despliegue falla | Settings → Pages → Source debe ser **GitHub Actions**, no «Deploy from a branch» |

---

## 6 · Dos cosas pendientes de higiene

1. **Rotar la clave de OpenAI** que se pegó en `.env.local` durante la sesión del
   30/08: quedó visible en la conversación. Se hace en un minuto — creas la
   nueva, la pegas, revocas la vieja.
2. **Desinstalar Ollama** si no lo vas a usar para otra cosa: ocupa 4,7 GB con el
   modelo descargado.

   ```bash
   ollama rm qwen2.5:7b
   winget uninstall Ollama.Ollama
   ```

---

## 7 · Después de la Fase 1

El plan lo detalla en su §13, pero el orden corto es:

- **Fase 2 · Conexión con planonmap.** No es trabajo de este repositorio: se hace
  dentro del suyo. Tú solo entregas la URL y el fixture dorado
  (`contracts/golden/curated-golden.json`).
- **Fase 3 · Espectáculos** y **Fase 4 · Planes.** El código está escrito y el
  rastreo comprobado; falta ejecutarlos con presupuesto.
- **Fase 5 · Afinado.** Métricas semanales y ajuste de `trust` por fuente.

Antes de activar cualquier fuente nueva: léele el `robots.txt` entero, anótalo en
[`SOURCES.md`](SOURCES.md) y ponle `verifiedAt`. Sin esa fecha **no se rastrea**,
y es a propósito.
