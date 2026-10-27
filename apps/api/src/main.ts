import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module.js';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe.js';
import { PiiRedactingLoggingInterceptor } from './common/interceptors/pii-logging.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const payloadLimit = process.env.MAX_PAYLOAD_SIZE || '10mb';
  app.use(json({ limit: payloadLimit }));
  app.use(urlencoded({ extended: true, limit: payloadLimit }));

  // Global validation pipe with Zod DTO schema support
  app.useGlobalPipes(new ZodValidationPipe());

  // Global PII-redacting request/response interceptor
  app.useGlobalInterceptors(new PiiRedactingLoggingInterceptor());

  // Enable CORS for Next.js frontend
  app.enableCors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  });

  // Swagger OpenAPI documentation
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

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Backend API is running on: http://localhost:${port}`);
  console.log(`Swagger OpenAPI documentation: http://localhost:${port}/api/docs`);
  console.log(`OpenAPI JSON spec: http://localhost:${port}/api-json`);
}
bootstrap();
