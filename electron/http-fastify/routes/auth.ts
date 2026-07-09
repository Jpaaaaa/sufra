/**
 * Auth and users routes — migrated from electron/http/routes/auth.ts
 */
import { getBackendApp } from '../../state';
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
import { extractUserIdFromAuthHeader } from '../../http-shared/extract-user-token';
import type { FastifyRouteContext } from '../types';
import { sendRouteError } from '../errors';

type LoginBody = { username?: string; password?: string };
type VerifyPasswordBody = { password?: string };

function userIdFromRequest(authorization: string | undefined): number | null {
  return extractUserIdFromAuthHeader(authorization);
}

async function buildLoginPayload(username: string, password: string) {
  const loginResult = await authLogin(username, password);
  const user = await usersFindByUsername(username);
  if (!user) {
    return { notFound: true as const };
  }
  return {
    notFound: false as const,
    body: {
      access_token: loginResult.access_token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        require_captain_approval:
          user.role === 'customer' ? user.require_captain_approval : false,
        customer_free_order:
          user.role === 'customer' ? user.customer_free_order : false,
      },
    },
  };
}

export function registerAuthRoutes(ctx: FastifyRouteContext): void {
  const { app } = ctx;

  app.get('/test/auth-service', async (request, reply) => {
    try {
      if (!getBackendApp()) {
        return reply.status(503).send({ error: 'Backend not initialized' });
      }
      return {
        success: true,
        message: 'Auth is accessible',
      };
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post<{ Body: LoginBody }>('/test/login', async (request, reply) => {
    try {
      if (!getBackendApp()) {
        return reply.status(503).send({ error: 'Backend not initialized' });
      }
      const { username, password } = request.body ?? {};
      if (!username || !password) {
        return reply.status(400).send({
          error: 'Username and password required',
          received: { hasUsername: !!username, hasPassword: !!password },
        });
      }
      const loginResult = await authLogin(username, password);
      return {
        success: true,
        message: 'Login test successful',
        hasToken: !!loginResult?.access_token,
      };
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post<{ Body: LoginBody }>('/auth/login', async (request, reply) => {
    try {
      console.log('[FASTIFY] POST /auth/login called');
      if (!getBackendApp()) {
        return reply.status(503).send({
          error: 'Backend not initialized. Please wait and try again.',
        });
      }
      const { username, password } = request.body ?? {};
      if (!username || !password) {
        return reply.status(400).send({ error: 'Username and password required' });
      }
      const result = await buildLoginPayload(username, password);
      if (result.notFound) {
        return reply.status(404).send({ error: 'User not found after login' });
      }
      return result.body;
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get('/auth/me', async (request, reply) => {
    try {
      const userId = userIdFromRequest(request.headers.authorization);
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
      return await authGetMe(userId);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post<{ Body: LoginBody }>('/api/auth/login', async (request, reply) => {
    try {
      const { username, password } = request.body ?? {};
      if (!username || !password) {
        return reply.status(400).send({ error: 'Username and password required' });
      }
      const result = await buildLoginPayload(username, password);
      if (result.notFound) {
        return reply.status(404).send({ error: 'User not found after login' });
      }
      return result.body;
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get('/api/auth/me', async (request, reply) => {
    try {
      const userId = userIdFromRequest(request.headers.authorization);
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
      return await authGetMe(userId);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post<{ Body: VerifyPasswordBody }>(
    '/api/auth/verify-password',
    async (request, reply) => {
      try {
        const userId = userIdFromRequest(request.headers.authorization);
        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }
        const { password } = request.body ?? {};
        return await authVerifyPassword(userId, password ?? '');
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.get('/api/users', async (request, reply) => {
    try {
      return await usersFindAll();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get<{ Params: { id: string } }>('/api/users/:id', async (request, reply) => {
    try {
      return await usersFindOne(parseInt(request.params.id, 10));
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post('/api/users', async (request, reply) => {
    try {
      return await usersCreate(request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.put<{ Params: { id: string } }>('/api/users/:id', async (request, reply) => {
    try {
      return await usersUpdate(parseInt(request.params.id, 10), request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.delete<{ Params: { id: string } }>('/api/users/:id', async (request, reply) => {
    try {
      await usersRemove(parseInt(request.params.id, 10));
      return { success: true };
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });
}
