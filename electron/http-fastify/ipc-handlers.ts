import { ipcMain } from 'electron';

type IpcHandler = (...args: unknown[]) => Promise<unknown>;

export function getIpcHandler(channel: string): IpcHandler | null {
  const handlerMap = (ipcMain as { _handlers?: Map<string, IpcHandler> })._handlers;
  if (!handlerMap?.has(channel)) {
    return null;
  }
  return handlerMap.get(channel) ?? null;
}
