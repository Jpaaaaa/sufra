/**
 * IPC: remote support helpers (AnyDesk).
 */
import { ipcMain, shell } from 'electron';
import fs from 'fs';
import path from 'path';

const ANYDESK_DOWNLOAD =
  'https://anydesk.com/en/downloads/windows';

function anydeskExecutableCandidates(): string[] {
  if (process.platform === 'win32') {
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    const local = process.env.LOCALAPPDATA || '';
    const paths = [
      path.join(pf86, 'AnyDesk', 'AnyDesk.exe'),
      path.join(pf, 'AnyDesk', 'AnyDesk.exe'),
    ];
    if (local) {
      paths.push(path.join(local, 'Programs', 'AnyDesk', 'AnyDesk.exe'));
    }
    return paths;
  }
  if (process.platform === 'darwin') {
    return ['/Applications/AnyDesk.app/Contents/MacOS/AnyDesk'];
  }
  return ['/usr/bin/anydesk'];
}

export function registerSupportHandlers() {
  ipcMain.handle('support:anydeskOpen', async () => {
    try {
      for (const exe of anydeskExecutableCandidates()) {
        if (fs.existsSync(exe)) {
          const err = await shell.openPath(exe);
          if (!err) {
            return { ok: true as const, action: 'launched' as const };
          }
          console.warn('[support:anydeskOpen] openPath failed:', exe, err);
        }
      }
      await shell.openExternal(ANYDESK_DOWNLOAD);
      return { ok: true as const, action: 'openedDownloadPage' as const };
    } catch (e: any) {
      console.error('[support:anydeskOpen]', e);
      return { ok: false as const, error: e?.message || 'AnyDesk open failed' };
    }
  });

  ipcMain.handle('support:anydeskDownloadPage', async () => {
    try {
      await shell.openExternal(ANYDESK_DOWNLOAD);
      return { ok: true as const };
    } catch (e: any) {
      console.error('[support:anydeskDownloadPage]', e);
      return { ok: false as const, error: e?.message || 'Failed to open browser' };
    }
  });
}
