import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(scriptsDir, '..');
const source = path.join(backendDir, 'src', 'db', 'schema.sql');
const destination = path.join(backendDir, 'dist', 'db', 'schema.sql');

fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.copyFileSync(source, destination);
