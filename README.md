# Exporta-planes · `bcn-curator`

> Un producto de datos que se ejecuta solo cada día, sin servidor y casi sin coste.

Rastrea una docena de webs de planes de Barcelona. Detecta que un mismo plan
aparece en varias y lo agrupa. Puntúa cada candidato combinando en cuántas
fuentes buenas sale con un juicio editorial hecho por un modelo de lenguaje. De
los pocos que sobreviven —un par al día— escribe una ficha **nueva y original en
español e inglés**, con precio verificado, horarios, duración, cómo llegar en
metro y si hay que reservar. Una persona aprueba o veta. Y publica el resultado
en tres archivos JSON en una URL pública.

```text
   12 webs          agrupar y          puntuar y          reescribir         3 archivos JSON
   de Barcelona ──▶ deduplicar  ──▶    seleccionar  ──▶   en ES y EN   ──▶   en una URL pública
                    (sin IA)           (IA barata)        (IA buena)         (GitHub Pages)
```

**El entregable son tres archivos JSON bien hechos, servidos en una URL.**

| | |
|---|---|
| Salida | `/v1/index.json` · `/v1/plans.json` · `/v1/shows.json` · `/v1/museums.json` |
| Coste de infraestructura | 0 € — Actions y Pages en repositorio público |
| Coste de IA | ≈ **2,30 €/mes**, con tope duro de 5 € |
| Licencia | código MIT · datos CC BY 4.0 |

El plan completo que define este proyecto está en
[`PLAN-PROYECTO-EXTERNO.md`](PLAN-PROYECTO-EXTERNO.md). Las referencias `§X.Y` de
todo el código apuntan a sus apartados.

---

## Estado: Fase 0 completa

| Fase | Qué incluye | Estado |
|---|---|---|
| **0 · Cimientos** | Tres zonas, contrato vendorizado, fixture dorado, config validada con la puerta `verifiedAt`, reloj inyectable, fetcher educado, tres extractores, y **cinco fichas de museo escritas a mano** | ✅ |
| **1 · Museos** | Catálogo de 55 museos, extracción determinista, `changeHash`, redactor por Batch API, verificación por evidencias, libro de gasto y PR de revisión | 🔧 código listo, falta ejecutarlo con claves |
| **2 · Conexión** | Trabajo **dentro de planonmap**. No es de este repositorio | ⏳ |
| **3 · Espectáculos** · **4 · Planes** | Adaptadores, clustering, cribado con `gpt-5-mini`, cuotas | 🔧 código listo |
| **5 · Afinado** | Métricas semanales, ajuste de `trust`, informe de salud | 🔧 código listo |

Las cinco fichas de la Fase 0 se escribieron **a mano y sin IA**, a propósito:
sirven para comprobar que el formato es correcto antes de invertir en nada más.
Como no hubo extracción, tampoco hay evidencias, así que su precio va `unknown` y
`verified.price` es `false` — la misma regla que en producción: **sin prueba
literal, el campo se omite** (§1.7, §6.4). La Fase 1 los rellena con extracción
verificada de la web oficial de cada museo.

---

## Empezar

```bash
pnpm install
cp .env.example .env.local        # rellenar solo si vas a gastar en IA

pnpm validate                     # config/ y content/ contra sus esquemas
pnpm test:run                     # 209 tests
pnpm publish:build                # genera dist/v1/ desde content/
```

Nada de eso sale a la red ni cuesta un céntimo.

### La frontera

Lo que se construye aquí empieza en `config/`, `contracts/`, `src/`, `content/`,
`.cache/`, `evals/` o `.github/`. **planonmap es el cliente que consume estos
tres JSON, no un repositorio que se toque**: fija el formato de salida y ahí
acaba la relación. Cuando el plan menciona rutas que empiezan por `types/`,
`lib/`, `app/` o `scripts/fetch-events.ts`, está describiendo el otro lado.

---

## Las tres zonas (§3.3)

La confusión entre producto y caché es un error de diseño barato de cometer y
caro de arreglar: si las fichas escritas viven junto al índice de URL vistas
—que se reescribe entero cada día—, **el diff del PR de revisión queda sepultado
bajo miles de líneas de ruido**, y el PR es precisamente el panel de revisión.

| Zona | Carpeta | Quién la escribe | ¿Se puede perder? |
|---|---|---|---|
| **Producto** | `content/` | El pipeline propone, la persona aprueba | **No.** Es lo caro y lo revisado |
| **Contrato** | `contracts/` | Solo una persona, al versionar | No, pero está transcrito en el plan |
| **Caché** | `.cache/` | Solo la máquina | **Sí.** Se regenera sola |

`.gitattributes` marca `.cache/**` como `linguist-generated`, así que GitHub la
colapsa en el diff del PR. El revisor abre el PR y ve lo único que le interesa:
las fichas.

---

## Comandos

Un solo verbo, `curate`, con parámetros. Antes había dos comandos casi iguales
que compartían el 90 % del código y podían divergir.

| Comando | Qué hace | ¿Gasta? |
|---|---|---|
| `pnpm curate --phase submit --collection plans,shows` | Rastrea, criba y **envía** el lote de redacción | Sí |
| `pnpm curate --phase collect` | **Recoge** el lote, verifica y escribe las fichas | No (ya pagado al enviar) |
| `pnpm curate --phase submit --collection museums` | Ídem para la colección C | Solo si algo cambió |
| **`pnpm curate --dry-run`** | Rastrea, criba y **se para antes de llamar a ningún modelo**. Imprime qué habría enviado y cuánto habría costado | **No** |
| `pnpm curate --limit 5` | Acota a 5 fichas | Sí, poco |
| | | |
| `pnpm publish:build` | Regenera `dist/v1/*.json` desde `content/` | No |
| `pnpm validate` | Valida `content/`, `config/` y lo publicado | No |
| `pnpm test:contract` | Valida el fixture dorado compartido con planonmap | No |
| | | |
| `pnpm eval:screen` | Evalúa el prompt de cribado contra el conjunto dorado | Céntimos |
| `pnpm eval:write` | Comprobaciones mecánicas de la redacción | No |
| | | |
| `pnpm report:health` | Salud por fuente y enlaces muertos | No |
| `pnpm report:metrics` | Precisión editorial, coste por ficha, cobertura | No |
| `pnpm spend` | Gasto del mes, desglosado | No |
| | | |
| `pnpm veto <slug> "<motivo>"` | Veta una ficha y la retira | No |
| `pnpm archive <slug>` | Retira sin vetar: puede volver | No |
| `pnpm sources:check` | Recomprueba `robots.txt` y `verifiedAt` | No |
| `pnpm prompts:check --base <ref>` | ¿Ha cambiado algún prompt desde `<ref>`? Es la puerta del §5.7 | No |

**`--dry-run` es el comando más importante de la lista**: permite tocar prompts,
umbrales y adaptadores durante horas sin gastar un céntimo.

---

## Las cinco decisiones que sostienen el proyecto

**1 · La caché se indexa sobre el SIGNIFICADO, nunca sobre los bytes** (§5.2,
`src/core/hash.ts`). Es lo que decide si esto cuesta tres euros o treinta. Casi
todas estas webs cambian bytes a diario sin cambiar nada relevante —un contador
de comentarios, un carrusel de relacionados, un token anti-CSRF—. Con un hash del
HTML se pagaría por reanalizar lo mismo cada día.

**2 · Nada se afirma sin evidencia literal** (§6.4, `src/enrich/verify.ts`). Para
cada dato factual el modelo debe señalar el fragmento del material del que lo
sacó, copiado carácter a carácter. Si el fragmento no está en el material, **el
campo se elimina**. Y nada se marca «gratis» sin confirmación explícita.

**3 · El Pull Request ES el panel de revisión** (§10.1). No se construye ninguna
interfaz: mergear aprueba, borrar un archivo del PR veta, y `reconcile.yml` lo
registra comparando el manifiesto versionado con lo que quedó. Propuesto menos
presente = vetado.

**4 · El consenso es señal de CALIDAD, no ruido** (§2.1). En un agregador normal
que un plan salga en varias webs es duplicación a eliminar; aquí es el aval más
barato y más fiable que hay, y pesa 25 de los 100 puntos.

**5 · Un refresco pobre nunca degrada lo publicado** (§4.4, §9.2). Si una fuente
cae, sus fichas siguen publicándose. Si un elemento no valida, se excluye ese
elemento. Si falla más del 20 % de una colección, se conserva la anterior. Si el
presupuesto se agota, se sigue publicando lo ya escrito.

---

## Coste (§7.4)

| Escenario | Cribado | Redacción | Total |
|---|---|---|---|
| Mínimo · invierno | 0,12 € | 0,99 € | **≈ 1,11 €/mes** |
| **Esperado** | 0,24 € | 2,04 € | **≈ 2,28 €/mes** |
| Peor caso · reproceso masivo | 0,36 € | 8,02 € | ≈ 8,39 €/mes → **cortado a 5 €** |

Estas cifras están comprobadas en `tests/unit/budget.test.ts`, no solo escritas.
Los tokens de razonamiento se facturan como salida y **están contados**: es el
error de estimación más común con estos modelos.

Al alcanzar el tope: se registra el corte, se abre una incidencia, el rastreo y
la publicación **siguen corriendo**, y los candidatos que necesitaban IA quedan
en cola con su material ya preparado, listos para el mes siguiente sin volver a
rastrear.

---

## Puesta en marcha en GitHub (§14.3)

Los workflows leen **ocho** valores. Créalos todos: si falta
`CRAWLER_USER_AGENT`, el rastreador sale a la red sin identificarse, y toda la
política de cortesía y la defensa legal se apoyan precisamente en eso.

```bash
# ── SECRETOS (cifrados, nunca visibles) ──
gh secret set OPENAI_API_KEY
gh secret set ANTHROPIC_API_KEY
gh secret set CRAWLER_CONTACT_EMAIL     # va en el User-Agent

# ── VARIABLES (visibles; son configuración, no credenciales) ──
gh variable set CRAWLER_USER_AGENT \
  --body "bcn-curator/1.0 (+https://github.com/Oriol-1/Exporta-planes)"
gh variable set PUBLISH_BASE_URL \
  --body "https://oriol-1.github.io/Exporta-planes"
gh variable set AI_MONTHLY_BUDGET_EUR --body "5"
gh variable set SCREEN_MODEL          --body "gpt-5-mini"
gh variable set WRITER_MODEL          --body "claude-opus-5"

gh secret list && gh variable list      # deben salir 3 y 5
```

Y tres ajustes en la interfaz web, sin equivalente en `gh`:

1. **Pages** → Settings → Pages → Source: **GitHub Actions**.
   No uses «Deploy from a branch»: este proyecto publica por **artefacto**, y con
   el modo rama el paso `deploy-pages` falla.
2. **Protección de `main`** → Settings → Rules → New branch ruleset: requerir PR
   antes de mergear, bloquear force pushes, restringir borrados.
3. **Escaneo de secretos** → Settings → Code security: activar. Gratis en
   repositorios públicos.

Las claves de IA se pagan por uso: **no existe versión gratuita real** de
ninguna de las dos. Carga 10 $ en cada consola y **desactiva la recarga
automática**, para que el saldo sea un segundo tope físico por debajo del lógico.

---

## Estructura

```text
config/       ← DECLARATIVO. Lo edita una persona. Validado con Zod al cargar
contracts/    ← EL CONTRATO con planonmap, más el fixture dorado compartido
src/
  core/       ← puro: sin red, sin disco, sin reloj implícito
  crawl/      ← fetcher (ÚNICO punto autorizado a salir a la red), robots, extractores
  normalize/  ← precio, fechas, geo, categoría, transporte
  cluster/    ← agrupación y la clave de deduplicación de planonmap
  screen/     ← prefiltro, puntuación, cribado con modelo, cuotas de variedad
  enrich/     ← material, redacción, verificación, imágenes, diff de museos
  ai/         ← clientes, lotes, tope de gasto, caché
  store/      ← ÚNICA capa que toca el disco
  pipeline/   ← cose las etapas: submit y collect
  publish/    ← construcción de dist/v1 y sumas de verificación
  review/     ← manifiesto, PR y reconciliación
  report/     ← salud, métricas, resumen
  cli/        ← un archivo por comando de package.json
content/      ← ★ EL PRODUCTO. Revisado por una persona
.cache/       ← DERIVADO. Regenerable. Colapsado en el diff
evals/        ← ¿el cambio de prompt mejora o empeora?
```

Dos reglas que el linter hace cumplir, y no son manías:

- **`Date.now()` y `new Date()` están prohibidos** fuera de `src/core/clock.ts`.
  El «ahora» se inyecta siempre. planonmap ha tenido la CI rota tres veces por
  fixtures con fecha fija que caducaron solos.
- **`fetch` está prohibido** fuera de `src/crawl/fetcher.ts`, que es donde viven
  `robots.txt`, el ritmo por host, los reintentos y el tope diario. Concentrarlo
  ahí es lo que hace que la cortesía sea una propiedad del sistema y no una
  promesa.

---

## Desviaciones respecto al plan, y por qué

Tres, todas menores y deliberadas:

1. **`eslint@9.39.5` en vez de `9.40.0`.** Esa versión no existe en el registro;
   9.39.5 es la última de la rama 9.x. Todo lo demás está pinado exactamente como
   dice el §3.2.
2. **`src/pipeline/` no aparece en el árbol del §3.4.** El plan define el
   contrato de cada módulo, no cómo se cosen. Coserlos dentro de un CLI habría
   hecho `curate.ts` inmanejable; `crawl/`, `normalize/` y `cluster/` siguen sin
   conocerse entre sí.
3. **La puerta del §5.7 compara el CONTENIDO del prompt, no si el archivo se tocó.**
   Tal y como estaba escrita en el anexo A.9 daba falsos positivos: `llmScreen.ts`
   contiene el prompt *y* el manejo de errores de red, así que arreglar un
   reintento hacía fallar la CI pidiendo una evaluación que no venía a cuento —
   y eso solo enseña a saltarse el guardián. `pnpm prompts:check` extrae las
   constantes de prompt en la base y en HEAD y compara sus huellas: no deja
   pasar un cambio de prompt ni protesta por uno que no lo es.
4. **`evals/write/golden.jsonl` tiene 5 fichas, no 8.** Son las cinco escritas a
   mano de la Fase 0: es lo que hay hasta que la Fase 1 produzca fichas
   aceptadas de verdad. Las comprobaciones mecánicas ya corren sobre ellas.

---

## Licencias

- **Código**: MIT — [`LICENSE-CODE`](LICENSE-CODE)
- **Datos publicados**: CC BY 4.0 — [`LICENSE-DATA`](LICENSE-DATA)
