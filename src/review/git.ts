// src/review/git.ts
// Las operaciones de git y de `gh` que necesita el ciclo de revisión.
//
// Regla del §3.6: NADA se empuja a `main` directamente. Ni las fichas, ni la
// caché, ni el libro de gasto. Todo viaja en la rama de la propuesta y entra al
// mergear, así el estado de `main` siempre corresponde a algo que una persona
// aprobó.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

export interface GitResult {
  readonly ok: boolean
  readonly stdout: string
  readonly stderr: string
}

async function exec(cmd: string, args: readonly string[]): Promise<GitResult> {
  try {
    const { stdout, stderr } = await run(cmd, [...args], { maxBuffer: 10 * 1024 * 1024 })
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() }
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string }
    return {
      ok: false,
      stdout: (err.stdout ?? '').trim(),
      stderr: (err.stderr ?? err.message ?? '').trim(),
    }
  }
}

export function git(...args: string[]): Promise<GitResult> {
  return exec('git', args)
}

export function gh(...args: string[]): Promise<GitResult> {
  return exec('gh', args)
}

export function proposalBranch(date: string): string {
  return `propuesta/${date}`
}

export async function hasChanges(): Promise<boolean> {
  const status = await git('status', '--porcelain')
  return status.stdout.length > 0
}

export async function configureBotIdentity(): Promise<void> {
  await git('config', 'user.name', 'bcn-curator[bot]')
  await git('config', 'user.email', 'bcn-curator@users.noreply.github.com')
}

/**
 * Empuja a la rama de propuesta con REINTENTO CON REBASE: si el push falla por
 * carrera, se hace `git pull --rebase` y se reintenta hasta tres veces antes de
 * fallar (§3.6, regla 4).
 */
export async function pushWithRebase(branch: string, attempts = 3): Promise<GitResult> {
  let last: GitResult = { ok: false, stdout: '', stderr: 'sin intentos' }
  for (let i = 0; i < attempts; i++) {
    last = await git('push', '--set-upstream', 'origin', branch)
    if (last.ok) return last
    const pulled = await git('pull', '--rebase', 'origin', branch)
    if (!pulled.ok && i === attempts - 1) return last
  }
  return last
}

export async function commitAll(message: string): Promise<GitResult> {
  await git('add', '-A')
  if (!(await hasChanges())) {
    return { ok: true, stdout: 'nada que commitear', stderr: '' }
  }
  return await git('commit', '-m', message)
}

export async function checkoutBranch(branch: string): Promise<GitResult> {
  const existing = await git('rev-parse', '--verify', branch)
  if (existing.ok) return await git('checkout', branch)
  return await git('checkout', '-b', branch)
}

export interface PullRequest {
  readonly number: number
  readonly url: string
  readonly title: string
}

/** El PR abierto de propuesta, si lo hay. Solo puede haber UNO (§10.1). */
export async function findOpenProposalPr(): Promise<PullRequest | null> {
  const result = await gh(
    'pr',
    'list',
    '--state',
    'open',
    '--label',
    'propuesta',
    '--json',
    'number,url,title',
    '--limit',
    '1',
  )
  if (!result.ok || !result.stdout) return null
  try {
    const parsed = JSON.parse(result.stdout) as PullRequest[]
    return parsed[0] ?? null
  } catch {
    return null
  }
}

/**
 * Abre el PR, o actualiza el que ya hubiera. Un PR abierto como máximo: si ya
 * hay uno sin revisar, se le añaden los cambios en vez de abrir otro.
 */
export async function openOrUpdatePr(
  branch: string,
  title: string,
  body: string,
): Promise<GitResult> {
  const existing = await findOpenProposalPr()
  if (existing) {
    return await gh('pr', 'edit', String(existing.number), '--title', title, '--body', body)
  }
  return await gh(
    'pr',
    'create',
    '--head',
    branch,
    '--base',
    'main',
    '--label',
    'propuesta',
    '--title',
    title,
    '--body',
    body,
  )
}

/**
 * Abre UNA incidencia con este título, o comenta en la que ya exista. Se usa
 * para «fuente rota» y para «presupuesto agotado»: sin esta comprobación, una
 * fuente caída abriría una incidencia nueva cada día (§4.6, §7.6).
 */
export async function openOrCommentIssue(
  title: string,
  body: string,
  label: string,
): Promise<GitResult> {
  const search = await gh(
    'issue',
    'list',
    '--state',
    'open',
    '--search',
    title,
    '--json',
    'number,title',
    '--limit',
    '5',
  )

  if (search.ok && search.stdout) {
    try {
      const issues = JSON.parse(search.stdout) as { number: number; title: string }[]
      const match = issues.find((i) => i.title === title)
      if (match) {
        return await gh('issue', 'comment', String(match.number), '--body', body)
      }
    } catch {
      // Si el listado no se puede leer, se abre una nueva: repetir una
      // incidencia es molesto, perder el aviso es peor.
    }
  }

  return await gh('issue', 'create', '--title', title, '--body', body, '--label', label)
}

/** ¿Hay `gh` autenticado? En local casi nunca; en Actions, siempre. */
export async function ghAvailable(): Promise<boolean> {
  const result = await gh('auth', 'status')
  return result.ok
}
