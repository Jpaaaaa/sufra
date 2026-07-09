/**
 * IPC handlers: auth, users.
 */
import { ipcMain } from 'electron';
import {
  authLogin,
  authGetMe,
  authVerifyPassword,
  usersFindAll,
  usersFindOne,
  usersFindByUsername,
  usersCreate,
  usersUpdate,
  usersRemove,
} from '../../init/backend-loader';

export function registerAuthHandlers() {
  ipcMain.handle('auth:login', async (_, username: string, password: string) => {
    try {
      const loginResult = await authLogin(username, password);
      const user = await usersFindByUsername(username);
      if (!user) throw new Error('User not found after login');
      return {
        access_token: loginResult.access_token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          require_captain_approval: user.role === 'customer' ? user.require_captain_approval : false,
          customer_free_order: user.role === 'customer' ? user.customer_free_order : false,
        },
      };
    } catch (error: any) {
      console.error('[IPC] auth:login error:', error);
      throw error;
    }
  });

  ipcMain.handle('auth:me', async (_, userId: number) => {
    try {
      return await authGetMe(userId);
    } catch (error: any) {
      console.error('[IPC] auth:me error:', error);
      throw error;
    }
  });

  ipcMain.handle('auth:verifyToken', async (_, token: string) => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Invalid token format');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      if (!payload?.sub) throw new Error('Invalid token: missing user ID');
      return await authGetMe(payload.sub);
    } catch (error: any) {
      console.error('[IPC] auth:verifyToken error:', error);
      throw error;
    }
  });

  ipcMain.handle('auth:verifyPassword', async (_, userId: number, password: string) => {
    return await authVerifyPassword(userId, password);
  });

  ipcMain.handle('users:findAll', async () => usersFindAll());
  ipcMain.handle('users:findOne', async (_, id: number) => usersFindOne(id));
  ipcMain.handle('users:create', async (_, dto: any) => usersCreate(dto));
  ipcMain.handle('users:update', async (_, id: number, dto: any) => usersUpdate(id, dto));
  ipcMain.handle('users:remove', async (_, id: number) => usersRemove(id));
}
