import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from '../dist/app.module.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  document.openapi = '3.1.0';

  const rootDir = path.resolve(__dirname, '../../..');
  const outputPath = path.resolve(rootDir, 'openapi.json');
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2));
  console.log(`OpenAPI schema generated successfully at: ${outputPath}`);
  await app.close();
  process.exit(0);
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
