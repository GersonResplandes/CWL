import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  COC_API_TOKEN: z.string().min(20),
  ALLOWED_CLAN_TAG: z.string().min(4),
  APP_PASSWORD_HASH: z.string().startsWith('scrypt$'),
  SESSION_SECRET: z.string().min(32),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  APPS_SCRIPT_URL: z.string().url().optional().or(z.literal('')),
  APPS_SCRIPT_SECRET: z.string().min(16).optional().or(z.literal('')),
  CRON_SECRET: z.string().min(16).optional().or(z.literal('')),
  AUTO_SYNC_GRACE_MINUTES: z.coerce.number().int().min(0).max(180).default(10),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development')
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const invalid = parsed.error.issues.map(issue => issue.path.join('.')).join(', ');
  throw new Error(`Configuração inválida: ${invalid}. Consulte o arquivo .env.example.`);
}

export const config = {
  ...parsed.data,
  frontendOrigins: parsed.data.FRONTEND_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean),
  sheetsConfigured: Boolean(parsed.data.APPS_SCRIPT_URL && parsed.data.APPS_SCRIPT_SECRET)
};
