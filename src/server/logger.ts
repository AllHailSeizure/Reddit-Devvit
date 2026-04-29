const MAX_LOG_ENTRIES = 500;

type LogLevel = 'info' | 'warn' | 'error';

function fmt(level: LogLevel, module: string, message: string, extra?: unknown): string {
  const ts = new Date().toISOString();
  const suffix = extra !== undefined ? ' ' + JSON.stringify(extra) : '';
  return `[${ts}][${level.toUpperCase()}][${module}] ${message}${suffix}`;
}

async function persist(level: LogLevel, module: string, message: string, extra?: unknown): Promise<void> {
  try {
    const { redis } = await import('@devvit/web/server');
    const ts = Date.now();
    const entry = JSON.stringify({ ts, level, module, message, extra });
    const key = `bot:log:${level}`;
    await redis.zAdd(key, { score: ts, member: entry });
    await redis.zRemRangeByRank(key, 0, -(MAX_LOG_ENTRIES + 1));
  } catch {
    // never let logging break the bot
  }
}

export function logger(module: string) {
  return {
    info(message: string, data?: unknown): void {
      console.log(fmt('info', module, message, data));
      void persist('info', module, message, data);
    },

    warn(message: string, data?: unknown): void {
      console.warn(fmt('warn', module, message, data));
      void persist('warn', module, message, data);
    },

    error(message: string, err?: unknown, data?: unknown): void {
      const errInfo = err instanceof Error
        ? { message: err.message, stack: err.stack }
        : err;
      console.error(fmt('error', module, message, { ...((data as object) ?? {}), error: errInfo }));
      void persist('error', module, message, { ...((data as object) ?? {}), error: errInfo });
    },
  };
}
