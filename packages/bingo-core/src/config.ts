import type { TileValidatorDefinition, BingoEvent, CountedThread, TriggeredTile } from './types';

export interface BingoConfig {
  postTitle: string;                     // 'LLMPhysics Bingo!'
  tiles: TileValidatorDefinition[];      // tile pool — sub-specific, provided by deployment
  /** Convert a flat event list into per-thread CountedThread structs. */
  buildCountedThreads: (events: BingoEvent[]) => CountedThread[];
  /** Run tile evaluation over the given threads. */
  evaluate: (tiles: TileValidatorDefinition[], threads: CountedThread[]) => TriggeredTile[];
}

let _config: BingoConfig | null = null;

export function initBingoCore(config: BingoConfig): void {
  _config = config;
}

export function getBingoConfig(): BingoConfig {
  if (!_config) throw new Error('bingo-core: initBingoCore() must be called before any handler fires');
  return _config;
}
