// `pnpm doctor` reúne en una pantalla lo que si no habría que mirar en cinco
// sitios. Estos tests comprueban las piezas que lee, no la impresión: si el
// comando dejara de encontrar algo, el informe mentiría en silencio.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from '../../src/store/paths'

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>
}

describe('comandos declarados', () => {
  it('`pnpm doctor` existe y apunta a su CLI', () => {
    expect(pkg.scripts['doctor']).toBe('tsx src/cli/doctor.ts')
  })

  it('cada script apunta a un archivo que existe de verdad', () => {
    // Un script roto en package.json no lo caza ni el typecheck ni el lint: se
    // descubre el día que alguien lo ejecuta.
    for (const [nombre, comando] of Object.entries(pkg.scripts)) {
      const m = /^tsx (src\/cli\/\S+\.ts)$/.exec(comando)
      if (!m?.[1]) continue
      expect(() => readFileSync(join(ROOT, m[1]!), 'utf8'), `${nombre} → ${m[1]}`).not.toThrow()
    }
  })

  it('los comandos que el README promete están todos declarados', () => {
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8')
    const prometidos = [...readme.matchAll(/`pnpm ([a-z:]+)/g)].map((m) => m[1]!)
    for (const p of new Set(prometidos)) {
      expect(pkg.scripts[p], `el README promete "pnpm ${p}" y no existe`).toBeDefined()
    }
  })
})

describe('el informe sabe qué es «estar bien»', () => {
  const fuente = readFileSync(join(ROOT, 'src/cli/doctor.ts'), 'utf8')

  it('comprueba las siete áreas', () => {
    for (const area of [
      'El contrato con planonmap',
      'Configuración',
      'Claves de IA',
      'El producto',
      'Lo publicado',
      'Automatización en GitHub',
      'Gasto y estado',
    ]) {
      expect(fuente).toContain(area)
    }
  })

  it('verifica la sha256 de lo publicado, que es lo que comprueba planonmap', () => {
    expect(fuente).toContain('sha256 cuadra')
    expect(fuente).toContain('planonmap lo descartaría')
  })

  it('sale con código 1 si hay fallos, para poder usarlo en un script', () => {
    expect(fuente).toContain('process.exit(r.fallos > 0 ? 1 : 0)')
  })

  it('funciona sin red con --offline', () => {
    expect(fuente).toContain("hasFlag(args, 'offline')")
  })
})
