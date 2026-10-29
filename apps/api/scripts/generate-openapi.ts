import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from '../src/app.module.js';
import * as fs from 'fs';
import * as path from 'path';

async function generate() {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'a-very-long-dummy-jwt-secret-for-openapi-generation-32-chars';
  const app = await NestFactory.create(AppModule, new ExpressAdapter(), { logger: false });
  const config = new DocumentBuilder()
    .setTitle('TicketSupport API')
    .setDescription('Full REST API documentation for TicketSupport platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  cleanupOpenApiDoc(document);

  const outputPath = path.resolve(process.cwd(), 'openapi.json');
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2));
  console.log(`OpenAPI schema generated successfully at: ${outputPath}`);
  await app.close();
  process.exit(0);
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
