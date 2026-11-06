import { store } from './repo'
import { TABLES, type Snapshot } from './store/types'
import { today } from './dates'

/**
 * Full backup: every table as JSON. The file is saved by the browser; nothing is uploaded.
 * It is also the migration path to any future backend: dump here, `replaceAll` there.
 */
export interface BackupFile {
  app: 'haber'
  version: 1
  exportedAt: string
  tables: Partial<Snapshot>
}

export async function makeBackup(): Promise<BackupFile> {
  const tables: Partial<Snapshot> = {}
  for (const t of TABLES) (tables as Record<string, unknown>)[t] = await store.all(t)
  return { app: 'haber', version: 1, exportedAt: new Date().toISOString(), tables }
}

export function isBackup(x: unknown): x is BackupFile {
  const b = x as BackupFile
  return !!b && b.app === 'haber' && b.version === 1 && typeof b.tables === 'object' && b.tables !== null
}

/** Replace ALL local data with the backup's contents. Caller must confirm first. */
export async function restoreBackup(b: BackupFile): Promise<void> {
  await store.replaceAll(b.tables)
}

export async function downloadBackup(): Promise<void> {
  const b = await makeBackup()
  download(`haber-respaldo-${today()}.json`, JSON.stringify(b), 'application/json')
}

export function download(name: string, data: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
