# `.cache/` — zona DERIVADA

Todo lo de aquí lo escribe **la máquina**, y todo se puede regenerar. Borrar esta
carpeta cuesta dinero y tiempo —hay que volver a rastrear y, en el peor caso, a
pagar redacciones— pero **no pierde nada irrecuperable**.

Se versiona en git a propósito (§3.3): así sobrevive a los runners efímeros de
GitHub Actions, se puede auditar y se puede revertir. `.gitattributes` la marca
como `linguist-generated`, de modo que GitHub la **colapsa** en el diff del PR y
el revisor ve lo único que le interesa: las fichas de `content/`.

| Archivo | Qué guarda |
|---|---|
| `index/<fuente>.ndjson` | Una línea por URL vista: etag, `semanticHash`, fechas, veredicto |
| `decisions/<año-mes>.ndjson` | Cada decisión con su puntuación, modelo y tokens. Es a la vez caché y etiqueta de entrenamiento |
| `clusters/<id>.json` | Clusters y el estado que la fase `collect` necesita para reconstruir una ficha |
| `spend/<año-mes>.json` | El libro de gasto |
| `geocode.json` | Caché **permanente**: una dirección se resuelve una vez en la vida |
| `transit.json` | Paradas cercanas por coordenada |
| `robots.json` | `robots.txt` por host, cacheado 24 h |
| `pending-batches.json` | Lotes enviados y aún no recogidos: lo que une las dos fases del día |
| `sources-health.json` | Medianas, degradadas, pausadas — el canario del §4.6 |
| `queue.json` | Lo que esperaba a la IA cuando se agotó el presupuesto |

**Nunca** entran aquí claves de API ni respuestas crudas del modelo con material
de terceros: solo la ficha final y los metadatos de la decisión (§11.3).
