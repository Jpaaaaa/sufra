/**
 * Auth and users HTTP routes.
 */
import express from 'express';
import { getBackendApp } from '../../state';
import { getService, AuthService, UsersService } from '../../init/backend-loader';
import type { RouteContext } from '../types';

export function registerAuthRoutes(ctx: RouteContext) {
  const { app, asyncHandler, extractUserFromToken } = ctx;

  app.get('/test/auth-service', asyncHandler(async (req, res) => {
    if (!getBackendApp()) {
      return res.status(503).json({ error: 'Backend not initialized' });
    }
    const authService = getService(AuthService);
    res.json({ success: true, message: 'AuthService is accessible', serviceType: authService.constructor.name });
  }));

  app.post('/test/login', asyncHandler(async (req, res) => {
    if (!getBackendApp()) {
      return res.status(503).json({ error: 'Backend not initialized' });
    }
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required', received: { hasUsername: !!username, hasPassword: !!password } });
    }
    const authService = getService(AuthService);
    const loginResult = await authService.login(username, password);
    res.json({ success: true, message: 'Login test successful', hasToken: !!loginResult?.access_token });
  }));

  app.post('/auth/login', asyncHandler(async (req, res) => {
    console.log('[HTTP] POST /auth/login called');
    if (!getBackendApp()) {
      return res.status(503).json({ error: 'Backend not initialized. Please wait and try again.' });
    }
    if (!req.body) {
      return res.status(400).json({ error: 'Request body is required' });
    }
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    const authService = getService(AuthService);
    const loginResult = await authService.login(username, password);
    const usersService = getService(UsersService);
    const user = await usersService.findByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found after login' });
    }
    res.json({
      access_token: loginResult.access_token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        require_captain_approval: user.role === 'customer' ? user.require_captain_approval : false,
        customer_free_order: user.role === 'customer' ? user.customer_free_order : false,
      },
    });
  }));

  app.get('/auth/me', asyncHandler(async (req, res) => {
    const userId = await extractUserFromToken(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const authService = getService(AuthService);
    const user = await authService.getMe(userId);
    res.json(user);
  }));

  app.post('/api/auth/login', asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    const authService = getService(AuthService);
    const loginResult = await authService.login(username, password);
    const usersService = getService(UsersService);
    const user = await usersService.findByUsername(username);
    if (!user) return res.status(404).json({ error: 'User not found after login' });
    res.json({
      access_token: loginResult.access_token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        require_captain_approval: user.role === 'customer' ? user.require_captain_approval : false,
        customer_free_order: user.role === 'customer' ? user.customer_free_order : false,
      },
    });
  }));

  app.get('/api/auth/me', asyncHandler(async (req, res) => {
    const userId = await extractUserFromToken(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const authService = getService(AuthService);
    const user = await authService.getMe(userId);
    res.json(user);
  }));

  app.post('/api/auth/verify-password', asyncHandler(async (req, res) => {
    const userId = await extractUserFromToken(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { password } = req.body;
    const authService = getService(AuthService);
    const isValid = await authService.verifyPassword(userId, password);
    res.json({ valid: isValid });
  }));

  app.get('/api/users', asyncHandler(async (req, res) => {
    const usersService = getService(UsersService);
    const users = await usersService.findAll();
    res.json(users);
  }));

  app.get('/api/users/:id', asyncHandler(async (req, res) => {
    const usersService = getService(UsersService);
    const user = await usersService.findOne(parseInt(req.params.id));
    res.json(user);
  }));

  app.post('/api/users', asyncHandler(async (req, res) => {
    const usersService = getService(UsersService);
    const user = await usersService.create(req.body);
    res.json(user);
  }));

  app.put('/api/users/:id', asyncHandler(async (req, res) => {
    const usersService = getService(UsersService);
    const user = await usersService.update(parseInt(req.params.id), req.body);
    res.json(user);
  }));

  app.delete('/api/users/:id', asyncHandler(async (req, res) => {
    const usersService = getService(UsersService);
    await usersService.remove(parseInt(req.params.id));
    res.json({ success: true });
  }));
}
