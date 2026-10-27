import { createZodDto } from 'nestjs-zod';
import { registerSchema } from '../schemas/auth.schema.js';

export class RegisterDto extends createZodDto(registerSchema) {}
