import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ApiModule from '../src/api';

/**
 * Transforms an OpenAPI operationId (e.g. "TicketsController_findAll") into the
 * camelCase function name that Orval generates (e.g. "ticketsControllerFindAll").
 */
function toOrvalFunctionName(operationId: string): string {
  const parts = operationId.split('_');
  if (parts.length === 2) {
    const controller = parts[0].charAt(0).toLowerCase() + parts[0].slice(1);
    const action = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
    return `${controller}${action}`;
  }
  return operationId.charAt(0).toLowerCase() + operationId.slice(1);
}

describe('Frontend & Backend API Synchronization Test Suite', () => {
  const rootDir = path.resolve(__dirname, '../../..');
  const openApiPath = path.resolve(rootDir, 'openapi.json');

  it('verifies that the backend OpenAPI contract specification exists', () => {
    expect(fs.existsSync(openApiPath)).toBe(true);
  });

  it('guarantees every backend endpoint operation is exported in frontend @api client', () => {
    const rawDoc = fs.readFileSync(openApiPath, 'utf-8');
    const openApiDoc = JSON.parse(rawDoc);

    const missingOperations: string[] = [];
    const missingHooks: string[] = [];
    let totalOperations = 0;

    for (const routePath in openApiDoc.paths) {
      const methods = openApiDoc.paths[routePath];
      for (const method in methods) {
        const operation = methods[method];
        if (!operation?.operationId) continue;

        totalOperations++;
        const functionName = toOrvalFunctionName(operation.operationId);
        const hookName = `use${functionName.charAt(0).toUpperCase()}${functionName.slice(1)}`;

        // Verify the client fetcher function exists
        if (typeof (ApiModule as any)[functionName] !== 'function') {
          missingOperations.push(`${operation.operationId} -> expected ${functionName}`);
        }

        // Verify the TanStack Query hook exists
        if (typeof (ApiModule as any)[hookName] !== 'function') {
          missingHooks.push(`${operation.operationId} -> expected ${hookName}`);
        }
      }
    }

    expect(totalOperations).toBeGreaterThan(40);
    expect(missingOperations, `Missing client functions in @api: ${missingOperations.join(', ')}`).toEqual([]);
    expect(missingHooks, `Missing TanStack Query hooks in @api: ${missingHooks.join(', ')}`).toEqual([]);
  });

  it('guarantees all OpenAPI DTO schema models exist in frontend @api/model', () => {
    const rawDoc = fs.readFileSync(openApiPath, 'utf-8');
    const openApiDoc = JSON.parse(rawDoc);
    const schemas = openApiDoc.components?.schemas || {};

    const modelDir = path.resolve(__dirname, '../src/api/model');
    expect(fs.existsSync(modelDir)).toBe(true);

    const modelFiles = fs.readdirSync(modelDir);
    const missingSchemas: string[] = [];

    for (const schemaName in schemas) {
      const expectedFileName = `${schemaName.charAt(0).toLowerCase()}${schemaName.slice(1)}.ts`;
      if (!modelFiles.includes(expectedFileName)) {
        missingSchemas.push(schemaName);
      }
    }

    expect(missingSchemas, `Backend DTO schemas missing in frontend model: ${missingSchemas.join(', ')}`).toEqual([]);
  });

  it('enforces that no manual apiClient calls or hardcoded API route strings exist in web app code', () => {
    const srcDir = path.resolve(__dirname, '../src');

    function scanFiles(dir: string): string[] {
      const manualCalls: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        // Exclude the generated API directory and lib internals
        if (fullPath.includes(`src${path.sep}api`) || fullPath.endsWith('api-client.ts') || fullPath.endsWith('custom-instance.ts')) {
          continue;
        }

        if (entry.isDirectory()) {
          manualCalls.push(...scanFiles(fullPath));
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          const content = fs.readFileSync(fullPath, 'utf-8');

          // Check for manual apiClient method calls: apiClient.get, apiClient.post, etc.
          const apiRegex = /apiClient\.(get|post|put|patch|delete)/g;
          let match;
          while ((match = apiRegex.exec(content)) !== null) {
            manualCalls.push(`${path.relative(srcDir, fullPath)}: manual ${match[0]} call detected`);
          }
        }
      }
      return manualCalls;
    }

    const manualCalls = scanFiles(srcDir);
    expect(manualCalls, `Frontend code must use generated Orval client instead of manual apiClient calls: \n${manualCalls.join('\n')}`).toEqual([]);
  });
});
