/**
 * HTTP Bridge for Frontend Compatibility
 * 
 * Starts a lightweight Express server on localhost:3333
 * that routes HTTP requests to the embedded backend core.
 * 
 * This allows the frontend to work without changes (still uses fetch)
 * while keeping everything offline and embedded.
 */

import express from 'express';
import { Server } from 'http';
import { SufraBackendCore } from '../../backend/dist/core';

let server: Server | null = null;

export async function startHttpBridge(backendCore: SufraBackendCore, port: number = 3333): Promise<void> {
  const app = express();
  
  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // CORS for localhost
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', mode: 'embedded' });
  });
  
  // Auth endpoints
  app.post('/auth/login', async (req, res) => {
    try {
      const result = await backendCore.auth.login(req.body.username, req.body.password);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ message: error.message });
    }
  });
  
  app.get('/auth/me', async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }
      const userId = await backendCore.auth.getUserIdFromToken(token);
      const user = await backendCore.auth.getMe(userId);
      res.json(user);
    } catch (error: any) {
      res.status(401).json({ message: error.message });
    }
  });
  
  app.post('/auth/verify-password', async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }
      const userId = await backendCore.auth.getUserIdFromToken(token);
      const valid = await backendCore.auth.verifyPassword(userId, req.body.password);
      res.json({ valid });
    } catch (error: any) {
      res.status(401).json({ message: error.message });
    }
  });
  
  // Add more endpoints as needed...
  // (This is a bridge - all endpoints route to backendCore services)
  
  // Start server
  return new Promise((resolve, reject) => {
    server = app.listen(port, '127.0.0.1', () => {
      console.log(`[HTTP BRIDGE] Listening on http://127.0.0.1:${port}`);
      console.log(`[HTTP BRIDGE] Routing requests to embedded backend core`);
      resolve();
    });
    
    server.on('error', (error) => {
      console.error('[HTTP BRIDGE] Server error:', error);
      reject(error);
    });
  });
}

export async function stopHttpBridge(): Promise<void> {
  if (server) {
    return new Promise((resolve) => {
      server!.close(() => {
        console.log('[HTTP BRIDGE] Server stopped');
        server = null;
        resolve();
      });
    });
  }
}

