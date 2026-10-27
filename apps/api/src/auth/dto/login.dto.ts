import { createZodDto } from 'nestjs-zod';
import { loginSchema } from '../schemas/auth.schema.js';

export class LoginDto extends createZodDto(loginSchema) {}
