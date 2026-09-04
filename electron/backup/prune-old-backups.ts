import fs from 'fs';
import path from 'path';
import { getBackupsRoot } from './backup-paths';

export function pruneOldBackups(retentionCount: number): void {
  const root = getBackupsRoot();
  if (!fs.existsSync(root)) return;

  const folders = fs
    .readdirSync(root)
    .filter((name) => name.startsWith('backup-'))
    .map((name) => path.join(root, name))
    .filter((p) => fs.existsSync(p) && fs.statSync(p).isDirectory())
    .sort((a, b) => path.basename(b).localeCompare(path.basename(a)));

  const toDelete = folders.slice(retentionCount);
  for (const folder of toDelete) {
    try {
      fs.rmSync(folder, { recursive: true, force: true });
      console.log('[BACKUP] Pruned old backup:', path.basename(folder));
    } catch (err) {
      console.warn('[BACKUP] Failed to prune:', folder, err);
    }
  }
}
