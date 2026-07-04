/**
 * IPC handlers: auth, users.
 */
import { ipcMain } from 'electron';
import { getService, AuthService, UsersService } from '../../init/backend-loader';

export function registerAuthHandlers() {
  ipcMain.handle('auth:login', async (_, username: string, password: string) => {
    try {
      const authService = getService(AuthService);
      const loginResult = await authService.login(username, password);
      const usersService = getService(UsersService);
      const user = await usersService.findByUsername(username);
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
      const authService = getService(AuthService);
      return await authService.getMe(userId);
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
      const authService = getService(AuthService);
      return await authService.getMe(payload.sub);
    } catch (error: any) {
      console.error('[IPC] auth:verifyToken error:', error);
      throw error;
    }
  });

  ipcMain.handle('auth:verifyPassword', async (_, userId: number, password: string) => {
    const authService = getService(AuthService);
    return await authService.verifyPassword(userId, password);
  });

  ipcMain.handle('users:findAll', async () => {
    return await getService(UsersService).findAll();
  });
  ipcMain.handle('users:findOne', async (_, id: number) => {
    return await getService(UsersService).findOne(id);
  });
  ipcMain.handle('users:create', async (_, dto: any) => {
    return await getService(UsersService).create(dto);
  });
  ipcMain.handle('users:update', async (_, id: number, dto: any) => {
    return await getService(UsersService).update(id, dto);
  });
  ipcMain.handle('users:remove', async (_, id: number) => {
    return await getService(UsersService).remove(id);
  });
}
