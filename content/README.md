# `content/` — ★ EL PRODUCTO

Esto es lo caro y lo revisado. **Perderlo es volver a pagar y a revisar.**

El pipeline **propone**; una persona **aprueba**. La revisión editorial es
mergear un Pull Request: no hay panel, no hay base de datos, no hay servicio que
mantener (§10.1).

| Carpeta | Qué hay |
|---|---|
| `cards/plans/` · `cards/shows/` · `cards/museums/` | Una ficha por archivo. Vetar es **borrar el archivo** desde la interfaz web del PR |
| `archive/` | Fichas retiradas, **nunca borradas**. Si un montaje vuelve la temporada siguiente, se reactiva sin volver a pagar la redacción |
| `vetoed.json` | Slugs vetados, con fecha y motivo. Es **para siempre**, salvo que se borre la entrada a mano |
| `proposals/<fecha>.json` | El manifiesto de lo propuesto ese día. **Propuesto menos presente = vetado** |

## Un archivo por ficha, y no un JSON gigante

Porque vetar tiene que ser borrar un archivo desde el móvil. Con un JSON de 3 MB,
vetar sería editarlo a mano en la interfaz web de GitHub.

## `"locked": true`

Añadir ese campo a una ficha la **congela**: no se regenera nunca más, aunque
cambie el prompt o la fuente. Es la vía de escape para cuando el propietario sí
quiera escribir algo a mano (§3.7).

## Un slug nace una vez y no se reutiliza jamás

Es a la vez clave de caché, clave de deduplicación y clave de veto. `pnpm validate`
comprueba que no haya dos fichas con el mismo slug en colecciones distintas.
