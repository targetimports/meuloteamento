import { prisma } from './prisma';

interface RateLimitResult {
  ok: boolean;
  hits: number;
  limit: number;
  resetIn: number;
}

interface Options {
  key: string;
  limit: number;
  windowSeconds: number;
}

const memory = new Map<string, { hits: number; windowEnd: number }>();

export async function rateLimit({ key, limit, windowSeconds }: Options): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const inMem = memory.get(key);
  if (inMem && inMem.windowEnd > now) {
    inMem.hits += 1;
    return {
      ok: inMem.hits <= limit,
      hits: inMem.hits,
      limit,
      resetIn: Math.max(0, Math.round((inMem.windowEnd - now) / 1000)),
    };
  }
  memory.set(key, { hits: 1, windowEnd: now + windowMs });

  try {
    const bucket = await prisma.rateLimitBucket.upsert({
      where: { key },
      create: { key, hits: 1, windowEnd: new Date(now + windowMs) },
      update: {
        hits:
          inMem && inMem.windowEnd > now
            ? { increment: 1 }
            : 1,
        windowEnd: inMem && inMem.windowEnd > now ? undefined : new Date(now + windowMs),
      },
    });
    return {
      ok: bucket.hits <= limit,
      hits: bucket.hits,
      limit,
      resetIn: Math.max(0, Math.round((bucket.windowEnd.getTime() - now) / 1000)),
    };
  } catch {
    return { ok: true, hits: 1, limit, resetIn: windowSeconds };
  }
}

export function clientIp(req: { headers: Headers }): string {
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}
