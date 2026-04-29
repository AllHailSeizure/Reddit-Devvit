import type {
  OnAppInstallRequest,
  OnAppUpgradeRequest,
  OnPostSubmitRequest,
  OnCommentCreateRequest,
  OnPostReportRequest,
  OnCommentReportRequest,
  OnModActionRequest,
} from '@devvit/web/shared';

export type ModuleHandler<T> = (event: T) => Promise<void>;

export type AppInstallHandler    = ModuleHandler<OnAppInstallRequest>;
export type AppUpgradeHandler    = ModuleHandler<OnAppUpgradeRequest>;
export type PostSubmitHandler    = ModuleHandler<OnPostSubmitRequest>;
export type CommentCreateHandler = ModuleHandler<OnCommentCreateRequest>;
export type PostReportHandler    = ModuleHandler<OnPostReportRequest>;
export type CommentReportHandler = ModuleHandler<OnCommentReportRequest>;
export type ModActionsHandler    = ModuleHandler<OnModActionRequest>;

// ─── Command types ─────────────────────────────────────────────────────────────

export type ContentType = 'comment' | 'post' | 'both';

export interface CommandDefinition {
  commandName: string;
  contentType: ContentType;
  requiresArgument: boolean;
}

export type CommandEvent = OnCommentCreateRequest | OnPostSubmitRequest;
export type CommandHandler = (event: CommandEvent, argument: string | null) => Promise<void>;

export interface RegisteredCommand {
  definition: CommandDefinition;
  handler: CommandHandler;
}
