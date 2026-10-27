import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { AuthMapper } from './mappers/auth.mapper.js';
import { AuthResponseDto, UserResponseDto } from './schemas/auth.schema.js';
import bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto): Promise<{ message: string; user: UserResponseDto }> {
    const validatedInput = AuthMapper.toRegisterInput(dto);

    const existing = await this.prisma.user.findUnique({
      where: { email: validatedInput.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(validatedInput.password, salt);

    const user = await this.prisma.user.create({
      data: {
        email: validatedInput.email,
        fullName: validatedInput.fullName,
        passwordHash,
        role: 'CUSTOMER',
      },
    });

    return {
      message: 'User registered successfully',
      user: AuthMapper.toUserResponseDto(user),
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const validatedInput = AuthMapper.toLoginInput(dto);

    const user = await this.prisma.user.findUnique({
      where: { email: validatedInput.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(validatedInput.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return AuthMapper.toAuthResponseDto({
      accessToken: `mock-jwt-token-for-${user.id}`,
      user: AuthMapper.toUserResponseDto(user),
      message: 'Authenticated successfully',
    });
  }
}
