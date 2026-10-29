import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UsePipes,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import {
  LoginDto,
  RegisterDto,
  registerSchema,
  loginSchema,
  CreateInviteDto,
  createInviteSchema,
  AdminCreateUserDto,
  adminCreateUserSchema,
} from './dto/index.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ZodSerializerInterceptor } from '../common/interceptors/zod-serializer.interceptor.js';

interface AuthenticatedRequest {
  user?: {
    id: string;
    email: string;
    role: 'ADMIN' | 'AGENT' | 'CUSTOMER';
  };
}

@ApiTags('Authentication')
@Controller('auth')
@UseInterceptors(ZodSerializerInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ auth_register: { limit: process.env.NODE_ENV === 'test' ? 100 : 15, ttl: 60000 } })
  @UsePipes(new ZodValidationPipe(registerSchema))
  @ApiOperation({ summary: 'Register a new customer account or staff member with an invite code' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 400, description: 'Invalid or expired invite code' })
  @ApiResponse({ status: 403, description: 'Public registration restricted to customers' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const result = await this.authService.register(registerDto);
    this.setRefreshTokenCookie(res, result.refreshToken);
    return {
      message: result.message,
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('login')
  @Throttle({ auth_login: { limit: process.env.NODE_ENV === 'test' ? 100 : 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(loginSchema))
  @ApiOperation({ summary: 'Authenticate user via Passport JWT and return token' })
  @ApiResponse({ status: 200, description: 'Successfully authenticated' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const result = await this.authService.login(loginDto);
    this.setRefreshTokenCookie(res, result.refreshToken);
    return {
      message: result.message,
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('refresh')
  @Throttle({ auth_refresh: { limit: process.env.NODE_ENV === 'test' ? 100 : 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue a fresh 15-minute access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid, expired, or reused refresh token' })
  async refresh(
    @Req() req: any,
    @Body('refreshToken') bodyRefreshToken?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const rawToken = this.extractRefreshToken(req, bodyRefreshToken);
    const result = await this.authService.refreshSession(rawToken || '');
    this.setRefreshTokenCookie(res, result.refreshToken);
    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke active refresh token and clear authentication cookie' })
  @ApiResponse({ status: 200, description: 'Successfully logged out' })
  async logout(
    @Req() req: any,
    @Body('refreshToken') bodyRefreshToken?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const rawToken = this.extractRefreshToken(req, bodyRefreshToken);
    this.clearRefreshTokenCookie(res);
    return this.authService.logout(rawToken || '');
  }

  /**
   * Sets the HTTP-only rotating refresh token cookie on the outgoing response.
   */
  private setRefreshTokenCookie(res?: Response, refreshToken?: string): void {
    if (!res || !refreshToken) return;
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('rt', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  /**
   * Clears the HTTP-only refresh token cookie upon logout.
   */
  private clearRefreshTokenCookie(res?: Response): void {
    if (!res) return;
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('rt', {
      path: '/',
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
    });
  }

  /**
   * Safely extracts the refresh token from either HTTP-only cookies or body fallback.
   */
  private extractRefreshToken(req: any, bodyRefreshToken?: string): string | undefined {
    return req?.cookies?.rt || bodyRefreshToken;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile via Passport JWT' })
  @ApiResponse({ status: 200, description: 'Current authenticated user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProfile(@Req() req: AuthenticatedRequest) {
    return req.user;
  }

  @Get('agents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all IT Support Agents and Administrators' })
  @ApiResponse({ status: 200, description: 'List of IT personnel' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  getAgents() {
    return this.authService.findAgents();
  }

  @Get('invites/verify/:code')
  @Throttle({ auth_invite: { limit: process.env.NODE_ENV === 'test' ? 100 : 15, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify validity of a staff invitation code' })
  @ApiResponse({ status: 200, description: 'Invitation verification response' })
  verifyInvite(@Param('code') code: string) {
    return this.authService.verifyInviteCode(code);
  }

  @Post('admin/invites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @UsePipes(new ZodValidationPipe(createInviteSchema))
  @ApiOperation({ summary: 'Generate a new staff invitation code (Admin only)' })
  @ApiResponse({ status: 201, description: 'Invitation created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  createInvite(
    @Body() dto: CreateInviteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.authService.createInvite(dto, req.user);
  }

  @Get('admin/invites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all staff invitations (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of invitations' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  listInvites(@Req() req: AuthenticatedRequest) {
    return this.authService.listInvites(req.user);
  }

  @Delete('admin/invites/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke an invitation by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Invitation revoked' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  revokeInvite(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.authService.revokeInvite(id, req.user);
  }

  @Post('admin/users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @UsePipes(new ZodValidationPipe(adminCreateUserSchema))
  @ApiOperation({ summary: 'Directly provision a new staff account (Admin only)' })
  @ApiResponse({ status: 201, description: 'Staff account created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  adminCreateUser(
    @Body() dto: AdminCreateUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.authService.adminCreateUser(dto, req.user);
  }
}
