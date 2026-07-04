import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

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
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  async getMe(userId: number) {
    const user = await this.usersService.findOne(userId);
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      // Only return permissions for customer role
      require_captain_approval: user.role === 'customer' ? user.require_captain_approval : false,
      customer_free_order: user.role === 'customer' ? user.customer_free_order : false,
    };
  }

  async verifyPassword(userId: number, password: string): Promise<{ valid: boolean }> {
    const user = await this.usersService.findByUsername((await this.usersService.findOne(userId)).username);
    if (!user) {
      return { valid: false };
    }
    
    // Only customer (captain), manager, or admin can verify password for printing
    if (!['customer', 'manager', 'admin'].includes(user.role)) {
      return { valid: false };
    }

    const isValid = await this.usersService.validatePassword(user, password);
    return { valid: isValid };
  }
}

