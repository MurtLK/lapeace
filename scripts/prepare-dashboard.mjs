import { copyFile, mkdir } from 'node:fs/promises';
// Keep the live Call Check interface in one canonical file, also shipped as a static frontend page.
const output = new URL('../web/public/dashboard-app/', import.meta.url);
await mkdir(output, { recursive: true });
await copyFile(new URL('../backend/public/call-check.html', import.meta.url), new URL('call-check.html', output));
