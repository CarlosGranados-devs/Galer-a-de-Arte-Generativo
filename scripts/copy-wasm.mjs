import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const destination = resolve(root, 'public', 'sql-wasm.wasm');

await mkdir(dirname(destination), { recursive: true });

try {
  await copyFile(source, destination);
  console.log('[synapse] sql-wasm.wasm sincronizado en public/');
} catch (error) {
  console.error('[synapse] No se pudo copiar sql-wasm.wasm. Ejecuta npm install primero.');
  throw error;
}
