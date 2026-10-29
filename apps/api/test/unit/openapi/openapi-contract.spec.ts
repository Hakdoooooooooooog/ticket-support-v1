import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Backend OpenAPI Specification & Frontend Contract Alignment', () => {
  const rootDir = path.resolve(__dirname, '../../../../..');
  const openApiPath = path.resolve(rootDir, 'openapi.json');
  const webApiEndpointsDir = path.resolve(rootDir, 'apps/web/src/api/endpoints');

  it('verifies openapi.json is generated with valid OpenAPI 3.1.0 version', () => {
    expect(fs.existsSync(openApiPath)).toBe(true);
    const doc = JSON.parse(fs.readFileSync(openApiPath, 'utf-8'));
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toBe('TicketSupport API');
  });

  it('guarantees every endpoint in the OpenAPI specification has an operationId for codegen', () => {
    const doc = JSON.parse(fs.readFileSync(openApiPath, 'utf-8'));
    const missingOperationIds: string[] = [];

    for (const [routePath, methods] of Object.entries(doc.paths || {})) {
      for (const [method, operation] of Object.entries(methods as Record<string, any>)) {
        if (!operation.operationId) {
          missingOperationIds.push(`${method.toUpperCase()} ${routePath}`);
        }
      }
    }

    expect(
      missingOperationIds,
      `All endpoints must specify an operationId for Orval codegen: ${missingOperationIds.join(', ')}`,
    ).toEqual([]);
  });

  it('guarantees every OpenAPI tag has a generated endpoint module in the frontend web application', () => {
    const doc = JSON.parse(fs.readFileSync(openApiPath, 'utf-8'));
    expect(fs.existsSync(webApiEndpointsDir)).toBe(true);

    const generatedDirs = fs
      .readdirSync(webApiEndpointsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    // Extract all unique tags used across OpenAPI endpoints
    const tagsInSpec = new Set<string>();
    for (const methods of Object.values(doc.paths || {})) {
      for (const operation of Object.values(methods as Record<string, any>)) {
        if (Array.isArray(operation.tags)) {
          operation.tags.forEach((t: string) => tagsInSpec.add(t));
        }
      }
    }

    // Convert OpenAPI tags (e.g. "Incident Banners", "Knowledge Base") to folder kebab-case
    const missingTagModules: string[] = [];
    for (const tag of tagsInSpec) {
      const folderName = tag.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (!generatedDirs.includes(folderName)) {
        missingTagModules.push(`${tag} -> expected folder apps/web/src/api/endpoints/${folderName}`);
      }
    }

    expect(
      missingTagModules,
      `Generated Orval endpoint modules missing in frontend: ${missingTagModules.join(', ')}`,
    ).toEqual([]);
  });
});
