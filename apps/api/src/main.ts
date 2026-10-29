import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module.js';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe.js';
import { PiiRedactingLoggingInterceptor } from './common/interceptors/pii-logging.interceptor.js';

async function bootstrap() {
  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET environment variable is required and must be at least 32 characters');
  }

  const app = await NestFactory.create(AppModule);

  // Trust proxy headers behind load balancers / reverse proxies
  const expressApp = app.getHttpAdapter().getInstance();
  if (typeof expressApp.set === 'function') {
    expressApp.set('trust proxy', 1);
  }

  // Security headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Cookie parser for secure httpOnly refresh tokens
  app.use(cookieParser());

  const payloadLimit = process.env.MAX_PAYLOAD_SIZE || '10mb';
  app.use(json({ limit: payloadLimit }));
  app.use(urlencoded({ extended: true, limit: payloadLimit }));

  // Global validation pipe with Zod DTO schema support
  app.useGlobalPipes(new ZodValidationPipe());

  // Global PII-redacting request/response interceptor
  app.useGlobalInterceptors(new PiiRedactingLoggingInterceptor());

  // Configured CORS with support for comma-separated origins
  const configuredCors = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || configuredCors.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
  });

  // Swagger OpenAPI documentation (disabled in production)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('TicketSupport API')
      .setDescription('Full REST API documentation for TicketSupport platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    cleanupOpenApiDoc(document);

    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api-json',
    });
  }

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Backend API is running on: http://localhost:${port}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Swagger OpenAPI documentation: http://localhost:${port}/api/docs`);
    console.log(`OpenAPI JSON spec: http://localhost:${port}/api-json`);
  }
}
void bootstrap();
