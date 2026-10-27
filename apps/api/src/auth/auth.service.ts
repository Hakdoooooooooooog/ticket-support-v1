import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma.service.js';
import { LoginDto, RegisterDto, AuthResponseDto, UserResponseDto } from './dto/index.js';
import { AuthMapper } from './mappers/auth.mapper.js';
import { getJwtSecret } from './strategies/jwt.strategy.js';

interface SeedAccountConfig {
  email: string;
  fullName: string;
  password: string;
  role: 'ADMIN' | 'AGENT' | 'CUSTOMER';
}

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyPasswordHash?: string;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (typeof this.prisma?.user?.upsert !== 'function' && typeof this.prisma?.user?.findUnique !== 'function') {
      return;
    }

    const seedAccounts = this.loadLocalSeedAccounts();
    if (seedAccounts.length === 0) {
      return;
    }

    await this.runTransaction(async (tx) => {
      for (const account of seedAccounts) {
        const normalizedEmail = account.email.toLowerCase().trim();
        const passwordHash = await this.hashPassword(account.password);

        if (typeof tx.user.upsert === 'function') {
          await tx.user.upsert({
            where: { email: normalizedEmail },
            update: {
              fullName: account.fullName,
              role: account.role,
              passwordHash,
            },
            create: {
              email: normalizedEmail,
              fullName: account.fullName,
              passwordHash,
              role: account.role,
            },
          });
        } else {
          const existing = await tx.user.findUnique({
            where: { email: normalizedEmail },
          });
          if (!existing) {
            await tx.user.create({
              data: {
                email: normalizedEmail,
                fullName: account.fullName,
                passwordHash,
                role: account.role,
              },
            });
          }
        }
      }
    });
  }

  /**
   * Executes a callback inside an interactive Prisma transaction so any failure
   * automatically rolls back all database mutations within the unit of work.
   */
  protected async runTransaction<T>(
    fn: (tx: PrismaService) => Promise<T>,
  ): Promise<T> {
    if (typeof this.prisma.$transaction === 'function') {
      return this.prisma.$transaction(async (tx) => fn(tx as unknown as PrismaService));
    }
    return fn(this.prisma);
  }

  /**
   * Loads optional local seed accounts from environment variables or a gitignored
   * `seed.local.json` file so dummy credentials are never committed to version control.
   */
  protected loadLocalSeedAccounts(): SeedAccountConfig[] {
    const accounts: SeedAccountConfig[] = [];

    const localSeedPath = resolve(process.cwd(), 'seed.local.json');
    if (existsSync(localSeedPath)) {
      try {
        const parsed = JSON.parse(readFileSync(localSeedPath, 'utf-8'));
        if (Array.isArray(parsed)) {
          const seenEmails = new Set<string>();
          for (const item of parsed) {
            if (item?.email && item?.password && item?.role) {
              const email = String(item.email).toLowerCase().trim();
              if (!seenEmails.has(email)) {
                seenEmails.add(email);
                accounts.push({
                  email,
                  fullName: String(item.fullName || 'Local User').trim(),
                  password: String(item.password),
                  role: item.role,
                });
              }
            }
          }
          return accounts;
        }
      } catch {
        // Ignore malformed local seed file
      }
    }

    const isPlaceholder = (val?: string) =>
      !val || val.includes('your_') || val.endsWith('@example.com');

    if (
      !isPlaceholder(process.env.SEED_ADMIN_EMAIL) &&
      !isPlaceholder(process.env.SEED_ADMIN_PASSWORD)
    ) {
      accounts.push({
        email: process.env.SEED_ADMIN_EMAIL!.toLowerCase().trim(),
        fullName: process.env.SEED_ADMIN_NAME || 'IT Administrator',
        password: process.env.SEED_ADMIN_PASSWORD!,
        role: 'ADMIN',
      });
    }
    if (
      !isPlaceholder(process.env.SEED_AGENT_EMAIL) &&
      !isPlaceholder(process.env.SEED_AGENT_PASSWORD)
    ) {
      accounts.push({
        email: process.env.SEED_AGENT_EMAIL!.toLowerCase().trim(),
        fullName: process.env.SEED_AGENT_NAME || 'Support Engineer',
        password: process.env.SEED_AGENT_PASSWORD!,
        role: 'AGENT',
      });
    }
    if (
      !isPlaceholder(process.env.SEED_CUSTOMER_EMAIL) &&
      !isPlaceholder(process.env.SEED_CUSTOMER_PASSWORD)
    ) {
      accounts.push({
        email: process.env.SEED_CUSTOMER_EMAIL!.toLowerCase().trim(),
        fullName: process.env.SEED_CUSTOMER_NAME || 'Demo Customer',
        password: process.env.SEED_CUSTOMER_PASSWORD!,
        role: 'CUSTOMER',
      });
    }

    return accounts;
  }

  async register(
    dto: RegisterDto,
  ): Promise<{ message: string; user: UserResponseDto; accessToken: string }> {
    const validatedInput = AuthMapper.toRegisterInput(dto);
    const passwordHash = await this.hashPassword(validatedInput.password);

    const user = await this.runTransaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { email: validatedInput.email },
      });

      if (existing) {
        throw new ConflictException('Email already registered');
      }

      try {
        return await tx.user.create({
          data: {
            email: validatedInput.email,
            fullName: validatedInput.fullName,
            passwordHash,
            role: validatedInput.role ?? 'CUSTOMER',
          },
        });
      } catch (err: unknown) {
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code?: string }).code === 'P2002'
        ) {
          throw new ConflictException('Email already registered');
        }
        throw err;
      }
    });

    const sanitizedUser = AuthMapper.toUserResponseDto(user);
    const accessToken = this.generateAuthToken(
      sanitizedUser.id,
      sanitizedUser.email,
      sanitizedUser.role,
    );

    return {
      message: 'User registered successfully',
      user: sanitizedUser,
      accessToken,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const validatedInput = AuthMapper.toLoginInput(dto);

    const user = await this.prisma.user.findUnique({
      where: { email: validatedInput.email },
    });

    if (!user) {
      // Mitigate timing-based email enumeration attacks using a runtime-generated dummy hash
      this.dummyPasswordHash ??= await this.hashPassword(
        randomBytes(32).toString('hex'),
      );
      await this.verifyPassword(validatedInput.password, this.dummyPasswordHash);
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await this.verifyPassword(validatedInput.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const sanitizedUser = AuthMapper.toUserResponseDto(user);
    const accessToken = this.generateAuthToken(
      sanitizedUser.id,
      sanitizedUser.email,
      sanitizedUser.role,
    );

    return AuthMapper.toAuthResponseDto({
      accessToken,
      user: sanitizedUser,
      message: 'Authenticated successfully',
    });
  }

  async findAgents(): Promise<UserResponseDto[]> {
    const users = await this.prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'AGENT'] },
      },
      distinct: ['email', 'fullName', 'role'],
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
      },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    });

    return users.map((u) => AuthMapper.toUserResponseDto(u));
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
   * Generates a standard RFC 7519 HS256 JWT token verified by Passport JwtStrategy.
   */
  protected generateAuthToken(
    userId: string,
    email = '',
    role: 'ADMIN' | 'AGENT' | 'CUSTOMER' = 'CUSTOMER',
  ): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
      'base64url',
    );
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(
      JSON.stringify({
        sub: userId,
        email,
        role,
        iat: now,
        exp: now + 60 * 60 * 24 * 7, // 7 days
      }),
    ).toString('base64url');

    const signature = createHmac('sha256', getJwtSecret())
      .update(`${header}.${payload}`)
      .digest('base64url');

    return `${header}.${payload}.${signature}`;
  }
}
