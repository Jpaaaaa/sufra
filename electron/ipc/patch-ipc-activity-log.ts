/**
 * Wraps ipcMain.handle so each invoke can attach an actor (from preload) as the last arg;
 * strips it before calling the real handler.
 */
import { ipcMain } from 'electron';

let patched = false;

interface IpcActorPayload {
  id: number;
  username: string;
  role: string;
}

function parseActor(last: unknown): IpcActorPayload | null {
  if (!last || typeof last !== 'object') return null;
  const o = last as Record<string, unknown>;
  if (o.__sufraActor !== true) return null;
  return {
    id: Number(o.id),
    username: String(o.username ?? ''),
    role: String(o.role ?? ''),
  };
}

/** Legacy name — only strips actor payload from IPC invocations (no persistence). */
export function patchIpcMainHandleForActivityLogging(): void {
  if (patched) return;
  patched = true;
  const originalHandle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any) => {
    return originalHandle(channel, async (event: Electron.IpcMainInvokeEvent, ...args: any[]) => {
      const last = args[args.length - 1];
      const actor = parseActor(last);
      const realArgs = actor ? args.slice(0, -1) : args;

      (event as unknown as { __sufraActor?: IpcActorPayload | null }).__sufraActor = actor;

      try {
        return await listener(event, ...realArgs);
      } finally {
        (event as { __sufraActor?: IpcActorPayload | null }).__sufraActor = undefined;
      }
    });
  };
}
