import { redis } from '@devvit/redis';
import { TILE_VALIDATORS, type BingoEvent } from './tiles';
import { evaluate, buildCountedThreadsFromEvents, type TriggeredTile } from './deterministic-tiles';

const TRIGGER_TTL = 60 * 60 * 24 * 8;

export async function recordFirstTrigger(gameId: string, valueKey: string, ts: number): Promise<void> {
  const atKey = `bot:bingo:game:${gameId}:triggered-at:${valueKey}`;
  if ((await redis.get(atKey)) == null) {
    await redis.set(atKey, String(ts));
    await redis.expire(atKey, TRIGGER_TTL);
  }
}

export async function appendBingoEvent(gameId: string, event: BingoEvent): Promise<void> {
  const key = `bot:bingo:game:${gameId}:events`;
  await redis.zAdd(key, { member: JSON.stringify(event), score: event.ts });
  await redis.zRemRangeByRank(key, 0, -1001);
  await redis.expire(key, 60 * 60 * 24 * 8);
}

export function evaluateEvents(events: BingoEvent[]): TriggeredTile[] {
  if (events.length === 0) return [];
  return evaluate(TILE_VALIDATORS, buildCountedThreadsFromEvents(events));
}

export async function runBatchValidation(gameId: string): Promise<void> {
  console.log(`[bingo-batch] Starting validation for game ${gameId}`);

  const events = (await redis.zRange(`bot:bingo:game:${gameId}:events`, 0, -1))
    .map((e: { member: string }) => JSON.parse(e.member) as BingoEvent);
  if (events.length === 0) {
    console.log('[bingo-batch] No events — skipping');
    return;
  }

  const triggered = evaluate(TILE_VALIDATORS, buildCountedThreadsFromEvents(events));
  if (triggered.length) {
    console.log(`[bingo-batch] Triggered: ${triggered.map((t) => t.valueKey).join(', ')}`);
  }

  const TILE_TTL = 60 * 60 * 24 * 8;
  for (const { valueKey, triggeredBy } of triggered) {
    if (!TILE_VALIDATORS.some((t) => t.valueKey === valueKey)) continue;

    const globalKey = `bot:bingo:game:${gameId}:value:${valueKey}`;
    const byKey = `bot:bingo:game:${gameId}:triggered-by:${valueKey}`;

    await redis.set(globalKey, '1');
    await redis.expire(globalKey, TILE_TTL);
    await recordFirstTrigger(gameId, valueKey, Date.now());

    const author = triggeredBy?.replace(/^u\//, '').toLowerCase() || null;
    const existingSelfTrigger = await redis.get(byKey);

    if (existingSelfTrigger && author && author !== existingSelfTrigger) {
      await redis.del(byKey);
    } else if (!existingSelfTrigger && author) {
      await redis.set(byKey, author);
      await redis.expire(byKey, TILE_TTL);
    }
  }
}
