import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { z, ZodError } from 'zod';
import { evaluateCwlAutoSync } from './auto-sync.js';
import { config } from './config.js';
import { createSheetsService } from './sheets.js';
import { createSupercellService } from './supercell.js';

const SESSION_COOKIE = 'cwl_session';
const REDACTED_LOG_FIELDS = ['req.headers.authorization', 'req.headers.cookie', 'body.password', 'body.secret'];
const supercell = createSupercellService(config.COC_API_TOKEN, config.ALLOWED_CLAN_TAG);
const sheets = createSheetsService(config.APPS_SCRIPT_URL || undefined, config.APPS_SCRIPT_SECRET || undefined);

function clearSessionCookie(reply: any) {
  for (const sameSite of ['lax', 'none'] as const) {
    reply.clearCookie(SESSION_COOKIE, {
      path: '/',
      secure: sameSite === 'none' || config.NODE_ENV === 'production',
      sameSite
    });
  }
}

function verifyPassword(password: string) {
  const [, salt, expectedHex] = config.APP_PASSWORD_HASH.split('$');
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function safeCompareSecret(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function getAutomationSecret(request: { headers: Record<string, string | string[] | undefined> }) {
  const authorization = request.headers.authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  const header = request.headers['x-cwl-cron-secret'];
  if (Array.isArray(header)) return header[0] || '';
  return header || '';
}

function requireAutomationSecret(
  request: { headers: Record<string, string | string[] | undefined> },
  reply: any
) {
  if (!config.CRON_SECRET) {
    reply.code(503).send({
      detail: 'Configure CRON_SECRET na Render antes de usar o salvamento automático.',
      error: 'Automação não configurada.'
    });
    return false;
  }

  const provided = getAutomationSecret(request);
  if (!provided || !safeCompareSecret(provided, config.CRON_SECRET)) {
    reply.code(401).send({ error: 'Automação não autorizada.' });
    return false;
  }

  return true;
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

function errorResponse(error: unknown, notFoundMessage = 'A Supercell não encontrou uma CWL ativa para este clã.') {
  const statusCode = Number((error as { statusCode?: number }).statusCode) || 502;
  const originalMessage = (error as Error).message || '';

  if (statusCode === 400) {
    return {
      detail: 'Isso normalmente significa que a liga ainda não começou, ainda não foi liberada pela Supercell ou já saiu da janela oficial de consulta.',
      message: notFoundMessage,
      statusCode
    };
  }

  if (statusCode === 403) {
    return {
      detail: 'Confira se o token da Supercell está ativo e se o IP de saída do servidor está autorizado no painel da Supercell.',
      message: 'A chave da Supercell não está autorizada para este servidor.',
      statusCode
    };
  }

  if (statusCode === 404) {
    return {
      detail: 'Se a liga ainda não começou ou já saiu da janela oficial da API, a Supercell pode não entregar esses dados.',
      message: notFoundMessage,
      statusCode
    };
  }

  if (statusCode === 429) {
    return {
      detail: 'Aguarde alguns minutos antes de sincronizar novamente.',
      message: 'Limite da Supercell atingido.',
      statusCode
    };
  }

  return {
    detail: originalMessage,
    message: 'A comunicação com a Supercell falhou.',
    statusCode
  };
}

function sheetsErrorResponse(error: unknown) {
  const originalMessage = (error as Error).message || '';
  const normalized = originalMessage.toLowerCase();

  if (normalized.includes('acesso não autorizado')) {
    return {
      detail: 'O APPS_SCRIPT_SECRET da Render precisa ser exatamente igual ao APPS_SCRIPT_SECRET nas propriedades do Apps Script.',
      message: 'O segredo do Apps Script não confere.',
      statusCode: 502
    };
  }

  if (normalized.includes('unexpected token') || normalized.includes('<!doctype') || normalized.includes('html')) {
    return {
      detail: 'Confira se APPS_SCRIPT_URL usa a URL terminada em /exec e se a implantação está publicada como Aplicativo da Web.',
      message: 'A URL do Apps Script não retornou uma resposta válida.',
      statusCode: 502
    };
  }

  if (
    normalized.includes('openbyid')
    || normalized.includes('no item with the given id')
    || normalized.includes('permission')
    || normalized.includes('permissão')
    || normalized.includes('cannot call spreadsheetapp')
  ) {
    return {
      detail: 'Verifique se SPREADSHEET_2026_ID aponta para a planilha nova e se o Apps Script foi autorizado com a sua conta Google.',
      message: 'A planilha do histórico não pôde ser aberta.',
      statusCode: 502
    };
  }

  return {
    detail: originalMessage || 'Veja o registro de execução do Apps Script para mais detalhes.',
    message: 'Não foi possível acessar o histórico no Google Sheets.',
    statusCode: 502
  };
}

async function persistCwlSnapshot(cwl: Awaited<ReturnType<typeof supercell.currentCwl>>, log: any) {
  if (!sheets.configured) {
    cwl.persisted = false;
    return false;
  }

  try {
    await sheets.saveCwl(cwl);
    cwl.persisted = true;
    return true;
  } catch (sheetError) {
    log.error({ err: sheetError }, 'Falha ao salvar CWL no Google Sheets');
    cwl.persisted = false;
    cwl.warnings.push(
      `Histórico não salvo no Google Sheets: ${(sheetError as Error).message || 'falha desconhecida.'}`
    );
    return false;
  }
}

function createLoggerConfig() {
  if (config.NODE_ENV !== 'development') {
    return {
      redact: REDACTED_LOG_FIELDS
    };
  }

  return {
    level: 'info',
    redact: REDACTED_LOG_FIELDS,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname,reqId,req,res,responseTime',
        messageFormat: '{msg}',
        singleLine: true,
        translateTime: 'HH:MM:ss'
      }
    }
  };
}

export async function buildApp() {
  const app = Fastify({
    disableRequestLogging: config.NODE_ENV === 'development',
    logger: createLoggerConfig()
  });
  const requestStart = new WeakMap<object, number>();

  if (config.NODE_ENV === 'development') {
    app.addHook('onRequest', async request => {
      requestStart.set(request, Date.now());
    });

    app.addHook('onResponse', async (request, reply) => {
      const elapsed = Date.now() - (requestStart.get(request) ?? Date.now());
      const message = `API ${request.method} ${request.url} -> ${reply.statusCode} (${elapsed}ms)`;

      if (reply.statusCode >= 500) {
        request.log.error(message);
      } else if (reply.statusCode >= 400) {
        request.log.warn(message);
      } else {
        request.log.info(message);
      }
    });
  }

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

    if (statusCode === 400 && appError.message.includes('Body cannot be empty')) {
      return reply.code(400).send({
        detail: 'Atualize a página para carregar a versão corrigida do sistema e tente sincronizar novamente.',
        error: 'A requisição de sincronização foi enviada em um formato inválido.'
      });
    }

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
    clearSessionCookie(reply);
    reply.header('Clear-Site-Data', '"cookies"');
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
      return reply.code(result.statusCode).send({ detail: result.detail, error: result.message });
    }
  });

  app.get('/api/clan/members/:playerTag', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } }
  }, async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const params = z.object({ playerTag: z.string().min(4).max(20) }).parse(request.params);
    try {
      return await supercell.playerDetail(params.playerTag);
    } catch (error) {
      const result = errorResponse(error, 'A Supercell não encontrou este jogador.');
      request.log.error({ err: error }, 'Falha ao carregar perfil do jogador');
      return reply.code(result.statusCode).send({ detail: result.detail, error: result.message });
    }
  });

  app.get('/api/cwl/current', async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    try {
      return await supercell.currentCwl();
    } catch (error) {
      const result = errorResponse(error, 'Não existe uma CWL ativa disponível para este clã agora.');
      request.log.error({ err: error }, 'Falha ao carregar CWL atual');
      return reply.code(result.statusCode).send({ detail: result.detail, error: result.message });
    }
  });

  app.post('/api/cwl/sync', {
    config: { rateLimit: { max: 12, timeWindow: '1 minute' } }
  }, async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    try {
      const cwl = await supercell.currentCwl();
      await persistCwlSnapshot(cwl, request.log);
      return cwl;
    } catch (error) {
      const result = errorResponse(error, 'Não existe uma CWL ativa disponível para este clã agora.');
      request.log.error({ err: error }, 'Falha ao sincronizar CWL');
      return reply.code(result.statusCode).send({ detail: result.detail, error: result.message });
    }
  });

  app.route({
    method: ['GET', 'POST'],
    url: '/api/cwl/auto-sync',
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
    handler: async (request, reply) => {
      if (!requireAutomationSecret(request, reply)) return;
      if (!sheets.configured) {
        return reply.code(503).send({
          detail: 'Configure APPS_SCRIPT_URL e APPS_SCRIPT_SECRET para salvar o histórico.',
          error: 'Google Sheets não configurado.'
        });
      }

      try {
        const cwl = await supercell.currentCwl({ bypassCache: true });
        const decision = evaluateCwlAutoSync(cwl, new Date(), config.AUTO_SYNC_GRACE_MINUTES);

        if (decision.action === 'skip') {
          return {
            ok: true,
            action: decision.action,
            finalSnapshot: decision.finalSnapshot,
            reason: decision.reason,
            nextCheckAt: decision.nextCheckAt,
            cwlId: cwl.cwlId,
            groupState: cwl.groupState,
            targetRound: decision.targetRound
          };
        }

        const persisted = await persistCwlSnapshot(cwl, request.log);
        if (!persisted) {
          return reply.code(502).send({
            detail: cwl.warnings.at(-1) || 'Veja o registro do backend e do Apps Script.',
            error: 'Não foi possível salvar a CWL no Google Sheets.'
          });
        }

        request.log.info(
          `Auto-sync CWL ${cwl.cwlId} rodada ${decision.targetRound?.day ?? '--'} salvo no Google Sheets`
        );

        return {
          ok: true,
          action: decision.action,
          finalSnapshot: decision.finalSnapshot,
          reason: decision.reason,
          nextCheckAt: decision.nextCheckAt,
          persisted,
          cwlId: cwl.cwlId,
          groupState: cwl.groupState,
          targetRound: decision.targetRound,
          updatedAt: cwl.fetchedAt
        };
      } catch (error) {
        const result = errorResponse(error, 'Não existe uma CWL ativa disponível para este clã agora.');
        request.log.error({ err: error }, 'Falha no salvamento automático da CWL');
        return reply.code(result.statusCode).send({ detail: result.detail, error: result.message });
      }
    }
  });

  app.get('/api/cwl/history', async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    try {
      return { configured: sheets.configured, items: await sheets.listCwls() };
    } catch (error) {
      const result = sheetsErrorResponse(error);
      request.log.error({ err: error }, 'Falha ao carregar histórico no Google Sheets');
      return reply.code(result.statusCode).send({ detail: result.detail, error: result.message });
    }
  });

  app.get('/api/cwl/history/:cwlId', async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const params = z.object({ cwlId: z.string().min(4).max(80) }).parse(request.params);
    try {
      return await sheets.getCwl(params.cwlId);
    } catch (error) {
      const result = sheetsErrorResponse(error);
      request.log.error({ err: error }, 'Falha ao carregar CWL histórica');
      return reply.code(result.statusCode).send({ detail: result.detail, error: result.message });
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
      const result = sheetsErrorResponse(error);
      request.log.error({ err: error }, 'Falha ao salvar ajuste no Google Sheets');
      return reply.code(result.statusCode).send({ detail: result.detail, error: result.message });
    }
  });

  app.get('/', async () => ({
    name: 'Central CWL API',
    version: '2.0.0',
    health: '/api/health'
  }));

  return app;
}
