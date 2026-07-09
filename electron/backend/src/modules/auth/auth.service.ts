import * as jwt from 'jsonwebtoken';
import { UnauthorizedException } from '../../utils/exceptions';
import { requireUsers } from '../users/users.service';

const JWT_SECRET = process.env.JWT_SECRET || 'sufra-lite-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

class AuthService {
  constructor(private usersService: ReturnType<typeof requireUsers>) {}

  async login(username: string, password: string) {
    const user = await this.usersService.findByUsername(username);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.usersService.validatePassword(user, password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, username: user.username, role: user.role };

    return {
      access_token: jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }),
    };
  }

  async getMe(userId: number) {
    const user = await this.usersService.findOne(userId);
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      require_captain_approval: user.role === 'customer' ? user.require_captain_approval : false,
      customer_free_order: user.role === 'customer' ? user.customer_free_order : false,
    };
  }

  async verifyPassword(userId: number, password: string): Promise<{ valid: boolean }> {
    const user = await this.usersService.findByUsername(
      (await this.usersService.findOne(userId)).username,
    );
    if (!user) {
      return { valid: false };
    }

    if (!['customer', 'manager', 'admin'].includes(user.role)) {
      return { valid: false };
    }

    const isValid = await this.usersService.validatePassword(user, password);
    return { valid: isValid };
  }
}

let authInstance: AuthService | null = null;

export function initializeAuth(): void {
  authInstance = new AuthService(requireUsers());
}

function requireAuth(): AuthService {
  if (!authInstance) {
    throw new Error('Auth not initialized');
  }
  return authInstance;
}

export function login(
  ...args: Parameters<AuthService['login']>
): ReturnType<AuthService['login']> {
  return requireAuth().login(...args);
}

export function getMe(
  ...args: Parameters<AuthService['getMe']>
): ReturnType<AuthService['getMe']> {
  return requireAuth().getMe(...args);
}

export function verifyPassword(
  ...args: Parameters<AuthService['verifyPassword']>
): ReturnType<AuthService['verifyPassword']> {
  return requireAuth().verifyPassword(...args);
}
