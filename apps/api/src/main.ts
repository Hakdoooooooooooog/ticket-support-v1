import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

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
