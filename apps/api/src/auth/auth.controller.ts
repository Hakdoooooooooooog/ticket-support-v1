import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UsePipes,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ZodSerializerInterceptor } from '../common/interceptors/zod-serializer.interceptor.js';
import { registerSchema, loginSchema } from './schemas/auth.schema.js';

@ApiTags('Authentication')
@Controller('auth')
@UseInterceptors(ZodSerializerInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UsePipes(new ZodValidationPipe(registerSchema))
  @ApiOperation({ summary: 'Register a new customer account' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(loginSchema))
  @ApiOperation({ summary: 'Authenticate user and return JWT' })
  @ApiResponse({ status: 200, description: 'Successfully authenticated' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
