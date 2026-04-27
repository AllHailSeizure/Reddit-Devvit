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
