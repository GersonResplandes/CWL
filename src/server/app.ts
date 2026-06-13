import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { z, ZodError } from 'zod';
import { config } from './config.js';
import { createSheetsService } from './sheets.js';
import { createSupercellService } from './supercell.js';

const SESSION_COOKIE = 'cwl_session';
const supercell = createSupercellService(config.COC_API_TOKEN, config.ALLOWED_CLAN_TAG);
const sheets = createSheetsService(config.APPS_SCRIPT_URL || undefined, config.APPS_SCRIPT_SECRET || undefined);

function verifyPassword(password: string) {
  const [, salt, expectedHex] = config.APP_PASSWORD_HASH.split('$');
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function isAuthenticated(request: {
  cookies: Record<string, string | undefined>;
  unsignCookie(value: string): { valid: boolean; value: string | null };
}) {
  const signed = request.cookies[SESSION_COOKIE];
  if (!signed) return false;
  const result = request.unsignCookie(signed);
  return result.valid && result.value === 'authenticated';
}

function requireAuth(request: Parameters<typeof isAuthenticated>[0], reply: any) {
  if (isAuthenticated(request)) return true;
  reply.code(401).send({ error: 'Sua sessão expirou.' });
  return false;
}

function errorResponse(error: unknown) {
  const statusCode = Number((error as { statusCode?: number }).statusCode) || 502;
  const message = statusCode === 404
    ? 'A Supercell não encontrou uma CWL ativa para este clã.'
    : statusCode === 429
      ? 'Limite da Supercell atingido. Tente novamente em alguns minutos.'
      : (error as Error).message;
  return { statusCode, message };
}

export async function buildApp() {
  const app = Fastify({
    logger: {
      redact: ['req.headers.authorization', 'req.headers.cookie', 'body.password', 'body.secret']
    }
  });

  await app.register(cookie, { secret: config.SESSION_SECRET });
  await app.register(rateLimit, { global: false });
  await app.register(cors, {
    credentials: true,
    origin(origin, callback) {
      if (!origin || config.frontendOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Origem não autorizada.'), false);
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: 'Dados inválidos.', details: error.issues });
    }
    const appError = error as Error & { statusCode?: number };
    const statusCode = appError.statusCode && appError.statusCode < 500 ? appError.statusCode : 500;
    return reply.code(statusCode).send({
      error: statusCode === 500 ? 'Erro interno do servidor.' : appError.message
    });
  });

  app.get('/api/health', async () => ({ ok: true, sheetsConfigured: sheets.configured }));
  app.get('/api/auth/session', async request => ({ authenticated: isAuthenticated(request) }));

  app.post('/api/auth/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } }
  }, async (request, reply) => {
    const body = z.object({ password: z.string().min(1).max(200) }).parse(request.body);
    if (!verifyPassword(body.password)) return reply.code(401).send({ error: 'Senha inválida.' });

    reply.setCookie(SESSION_COOKIE, 'authenticated', {
      path: '/',
      signed: true,
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60
    });
    return { authenticated: true };
  });

  app.post('/api/auth/logout', async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE, {
      path: '/',
      secure: config.NODE_ENV === 'production',
      sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    return { authenticated: false };
  });

  app.get('/api/config', async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    return {
      clanTag: supercell.allowedClanTag,
      sheetsConfigured: sheets.configured
    };
  });

  app.get('/api/clan/roster', {
    config: { rateLimit: { max: 12, timeWindow: '1 minute' } }
  }, async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    try {
      return await supercell.roster();
    } catch (error) {
      const result = errorResponse(error);
      request.log.error({ err: error }, 'Falha ao carregar membros do clã');
      return reply.code(result.statusCode).send({ error: result.message });
    }
  });

  app.get('/api/cwl/current', async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    try {
      return await supercell.currentCwl();
    } catch (error) {
      const result = errorResponse(error);
      return reply.code(result.statusCode).send({ error: result.message });
    }
  });

  app.post('/api/cwl/sync', {
    config: { rateLimit: { max: 12, timeWindow: '1 minute' } }
  }, async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    try {
      const cwl = await supercell.currentCwl();
      if (sheets.configured) {
        await sheets.saveCwl(cwl);
        cwl.persisted = true;
      } else {
        cwl.persisted = false;
      }
      return cwl;
    } catch (error) {
      const result = errorResponse(error);
      request.log.error({ err: error }, 'Falha ao sincronizar CWL');
      return reply.code(result.statusCode).send({ error: result.message });
    }
  });

  app.get('/api/cwl/history', async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    try {
      return { configured: sheets.configured, items: await sheets.listCwls() };
    } catch (error) {
      return reply.code(502).send({ error: (error as Error).message });
    }
  });

  app.get('/api/cwl/history/:cwlId', async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const params = z.object({ cwlId: z.string().min(4).max(80) }).parse(request.params);
    try {
      return await sheets.getCwl(params.cwlId);
    } catch (error) {
      return reply.code(502).send({ error: (error as Error).message });
    }
  });

  app.post('/api/cwl/history/:cwlId/adjust', async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const params = z.object({ cwlId: z.string().min(4).max(80) }).parse(request.params);
    const body = z.object({
      warTag: z.string().min(2),
      playerTag: z.string().min(2),
      stars: z.number().int().min(0).max(3).optional(),
      destruction: z.number().min(0).max(100).optional(),
      defenseStars: z.number().int().min(0).max(3).optional(),
      reason: z.string().min(3).max(300)
    }).parse(request.body);
    try {
      return await sheets.saveAdjustment({ cwlId: params.cwlId, ...body });
    } catch (error) {
      return reply.code(502).send({ error: (error as Error).message });
    }
  });

  app.get('/', async () => ({
    name: 'Central CWL API',
    version: '2.0.0',
    health: '/api/health'
  }));

  return app;
}
