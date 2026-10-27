import {
  registerSchema,
  loginSchema,
  userResponseSchema,
  authResponseSchema,
  UserResponseDto,
  AuthResponseDto,
} from '../dto/index.js';

export class AuthMapper {
  /**
   * Validates and normalizes registration input payload.
   */
  static toRegisterInput(dto: unknown) {
    return registerSchema.parse(dto);
  }

  /**
   * Validates and normalizes login input payload.
   */
  static toLoginInput(dto: unknown) {
    return loginSchema.parse(dto);
  }

  /**
   * Transforms raw Prisma User database record into public UserResponseDto.
   * Strips passwordHash and populates default values.
   */
  static toUserResponseDto(rawUser: unknown): UserResponseDto {
    return userResponseSchema.parse(rawUser);
  }

  /**
   * Transforms login/session payload into sanitized AuthResponseDto.
   */
  static toAuthResponseDto(rawAuth: unknown): AuthResponseDto {
    return authResponseSchema.parse(rawAuth);
  }
}
