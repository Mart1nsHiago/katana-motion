import { copyFile, mkdir, stat, writeFile, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wasmSource = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmTarget = join(root, 'public', 'wasm');
const modelTarget = join(root, 'public', 'models', 'hand_landmarker.task');
const modelUrl = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const wasmFiles = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

await mkdir(wasmTarget, { recursive: true });
await mkdir(dirname(modelTarget), { recursive: true });

for (const name of wasmFiles) {
  await copyFile(join(wasmSource, name), join(wasmTarget, name));
}

const existing = await stat(modelTarget).catch(() => null);
if (!existing || existing.size < 1_000_000) {
  const response = await fetch(modelUrl, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Falha ao baixar o modelo MediaPipe: HTTP ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length < 1_000_000) throw new Error('Modelo MediaPipe recebido está incompleto.');
  const temporaryPath = `${modelTarget}.download`;
  try {
    await writeFile(temporaryPath, data);
    await rename(temporaryPath, modelTarget);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

console.log('MediaPipe pronto: modelo de mãos e runtime WASM disponíveis em public/.');
