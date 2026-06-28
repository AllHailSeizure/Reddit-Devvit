export interface BotConfig {
  botMention: string;     // 'u/LLMPhysics-bot'
  botUsername: string;    // 'llmphysics-bot'
  devSubreddit: string;   // 'llmphysics_dev'
  userAgent: string;      // 'llmphysics-bot/1.0 (Reddit bot; r/llmphysics)'
  botAuthors: Set<string>;// Set(['AutoModerator', 'FloodAssistant', 'LLMPhysics-ModTeam', 'llmphysics-bot'])
}

let _config: BotConfig | null = null;

export function initBotCore(config: BotConfig): void {
  _config = config;
}

export function getBotConfig(): BotConfig {
  if (!_config) throw new Error('bot-core: initBotCore() must be called before any handler fires');
  return _config;
}
