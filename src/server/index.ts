import { buildApp } from './app.js';
import { config } from './config.js';

const app = await buildApp();

if (config.NODE_ENV !== 'test') {
  await app.listen({ host: '0.0.0.0', port: config.PORT });
}

export { app };
