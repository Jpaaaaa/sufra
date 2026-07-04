import { UsersService } from './users.service';
import { UnauthorizedException } from '../../utils/exceptions';
import * as jwt from 'jsonwebtoken';

export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET || 'sufra-lite-secret-key-change-in-production';
  private readonly jwtExpiresIn = '24h';

  constructor(private usersService: UsersService) {}

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
      access_token: jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn }),
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
    const user = await this.usersService.findByUsername((await this.usersService.findOne(userId)).username);
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
