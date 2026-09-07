import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { buildOpenApiDocument } from '../src/openapi/openapi';

async function exportOpenApi() {
  const checkOnly = process.argv.includes('--check');
  const outputArgument = process.argv.slice(2).find((arg) => arg !== '--check');
  const outputPath = resolve(
    process.cwd(),
    outputArgument ?? 'openapi/tailpoint.openapi.json',
  );
  const app = await NestFactory.create(AppModule, {
    logger: ['error'],
    preview: true,
  });

  try {
    app.setGlobalPrefix('/api/');
    const document = buildOpenApiDocument(app);
    const serialized = `${JSON.stringify(document, null, 2)}\n`;

    if (checkOnly) {
      const committed = await readFile(outputPath, 'utf8');
      if (committed !== serialized) {
        throw new Error(
          `OpenAPI contract drift detected. Run npm run openapi:export and commit ${outputPath}.`,
        );
      }
      process.stdout.write(`OpenAPI contract is current: ${outputPath}\n`);
      return;
    }

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, serialized, 'utf8');
    process.stdout.write(`OpenAPI contract written to ${outputPath}\n`);
  } finally {
    await app.close();
  }
}

void exportOpenApi().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
