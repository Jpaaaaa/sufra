import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';

class LoginDto {
  username!: string;
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getMe(@Request() req: any) {
    return this.authService.getMe(req.user.sub);
  }

  @Post('verify-password')
  @UseGuards(AuthGuard)
  async verifyPassword(@Body() body: { password: string }, @Request() req: any) {
    return this.authService.verifyPassword(req.user.sub, body.password);
  }
}

