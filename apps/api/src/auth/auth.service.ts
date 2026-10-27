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

    const passwordHash = await this.hashPassword(validatedInput.password);

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

    const isMatch = await this.verifyPassword(validatedInput.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = this.generateAuthToken(user.id);

    return AuthMapper.toAuthResponseDto({
      accessToken,
      user: AuthMapper.toUserResponseDto(user),
      message: 'Authenticated successfully',
    });
  }

  /**
   * Generates a secure salt and computes the bcrypt password hash.
   */
  protected async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  /**
   * Compares plain-text candidate password with the stored bcrypt hash.
   */
  protected async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  /**
   * Generates access authentication token.
   */
  protected generateAuthToken(userId: string): string {
    return `mock-jwt-token-for-${userId}`;
  }
}
