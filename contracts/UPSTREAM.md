# Procedencia del contrato

`event.ts` es una transcripción del esquema de eventos de planonmap.

| Campo | Valor |
| --- | --- |
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
