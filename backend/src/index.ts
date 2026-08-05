import { buildApp } from './app.js';
import { HOST, PORT } from './config.js';

const app = await buildApp();

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Manga Reader API running at http://${HOST}:${PORT}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
