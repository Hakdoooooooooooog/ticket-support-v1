import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UsePipes,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
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
  @UsePipes(new ZodValidationPipe(registerSchema))
  @ApiOperation({ summary: 'Register a new customer account or staff member with an invite code' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 400, description: 'Invalid or expired invite code' })
  @ApiResponse({ status: 403, description: 'Public registration restricted to customers' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(loginSchema))
  @ApiOperation({ summary: 'Authenticate user via Passport JWT and return token' })
  @ApiResponse({ status: 200, description: 'Successfully authenticated' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all IT Support Agents and Administrators' })
  @ApiResponse({ status: 200, description: 'List of IT personnel' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getAgents() {
    return this.authService.findAgents();
  }

  @Get('invites/verify/:code')
  @ApiOperation({ summary: 'Verify validity of a staff invitation code' })
  @ApiResponse({ status: 200, description: 'Invitation verification response' })
  verifyInvite(@Param('code') code: string) {
    return this.authService.verifyInviteCode(code);
  }

  @Post('admin/invites')
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all staff invitations (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of invitations' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  listInvites(@Req() req: AuthenticatedRequest) {
    return this.authService.listInvites(req.user);
  }

  @Delete('admin/invites/:id')
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
