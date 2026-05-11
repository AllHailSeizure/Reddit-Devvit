import type { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { readAllSettings, writeSetting } from './helpers/settings-helper';
import { logger } from './helpers/log-helper';

const log = logger('admin');

type SettingsFormValues = {
  botSignature: string;
  depthCap: number;
  depthCapResponse: string;
  floodAssistantResponse: string;
  floodAssistantMaxPosts: number;
  floodAssistantWindowHours: number;
  floodAssistantIgnoreModerators: boolean;
  floodAssistantIgnoreContributors: boolean;
  floodAssistantIgnoreAutoRemoved: boolean;
  floodAssistantIgnoreRemoved: boolean;
  floodAssistantIgnoreDeleted: boolean;
  selfResponseResponse: string;
  selfResponseIgnoreModerators: boolean;
  selfResponseIgnoreContributors: boolean;
};

export function register(app: Hono): void {

  // ── Menu item: open settings form ────────────────────────────────────────────
  app.post('/internal/menu/bot-settings', async (c) => {
    const current = await readAllSettings();
    return c.json<UiResponse>({
      showForm: {
        name: 'bot-settings',
        form: {
          title: 'Bot Settings',
          acceptLabel: 'Save',
          fields: [
            {
              type: 'paragraph',
              name: 'botSignature',
              label: 'Bot signature',
              helpText: 'Enter plain text — each word is auto-formatted as superscript. Leave blank for no signature.',
              defaultValue: String(current.botSignature ?? ''),
              required: false,
            },
            {
              type: 'number',
              name: 'depthCap',
              label: 'Depth cap',
              helpText: 'Lock comment chains at this depth. Set to 0 to disable.',
              defaultValue: Number(current.depthCap ?? 10),
              required: false,
            },
            {
              type: 'paragraph',
              name: 'depthCapResponse',
              label: 'Depth cap triggered comment',
              helpText: 'Overrides the depth cap notice when set.',
              defaultValue: String(current.depthCapResponse ?? ''),
              required: false,
            },
            {
              type: 'number',
              name: 'floodAssistantMaxPosts',
              label: 'Flood Moderation — Max posts per window',
              helpText: 'Maximum number of posts a user can make within the time window.',
              defaultValue: Number(current.floodAssistantMaxPosts ?? 1),
              required: false,
            },
            {
              type: 'number',
              name: 'floodAssistantWindowHours',
              label: 'Flood Moderation — Time window (hours)',
              helpText: 'Rolling time window in hours.',
              defaultValue: Number(current.floodAssistantWindowHours ?? 24),
              required: false,
            },
            {
              type: 'paragraph',
              name: 'floodAssistantResponse',
              label: 'Flood Moderation — Triggered comment',
              helpText: 'Posted when a post is removed for exceeding the flood limit. Bot signature is appended.',
              defaultValue: String(current.floodAssistantResponse ?? ''),
              required: false,
            },
            {
              type: 'boolean',
              name: 'floodAssistantIgnoreModerators',
              label: 'Flood Moderation — Ignore moderator posts',
              helpText: 'Do not remove posts by moderators.',
              defaultValue: Boolean(current.floodAssistantIgnoreModerators ?? true),
              required: false,
            },
            {
              type: 'boolean',
              name: 'floodAssistantIgnoreContributors',
              label: 'Flood Moderation — Ignore approved submitters',
              helpText: 'Do not remove posts by users on the approved submitters list.',
              defaultValue: Boolean(current.floodAssistantIgnoreContributors ?? true),
              required: false,
            },
            {
              type: 'boolean',
              name: 'floodAssistantIgnoreAutoRemoved',
              label: 'Flood Moderation — Ignore auto-removed posts',
              helpText: 'Do not count posts that are immediately removed (removed as soon as posted).',
              defaultValue: Boolean(current.floodAssistantIgnoreAutoRemoved ?? true),
              required: false,
            },
            {
              type: 'boolean',
              name: 'floodAssistantIgnoreRemoved',
              label: 'Flood Moderation — Ignore moderator-removed posts',
              helpText: 'Do not count posts that are removed by moderators.',
              defaultValue: Boolean(current.floodAssistantIgnoreRemoved ?? true),
              required: false,
            },
            {
              type: 'boolean',
              name: 'floodAssistantIgnoreDeleted',
              label: 'Flood Moderation — Ignore deleted posts',
              helpText: 'Do not count posts that are deleted by the author.',
              defaultValue: Boolean(current.floodAssistantIgnoreDeleted ?? true),
              required: false,
            },
            {
              type: 'paragraph',
              name: 'selfResponseResponse',
              label: 'Self-response triggered comment',
              helpText: 'Posted when OP\'s top-level self-reply is removed. Leave blank to remove silently.',
              defaultValue: String(current.selfResponseResponse ?? ''),
              required: false,
            },
            {
              type: 'boolean',
              name: 'selfResponseIgnoreModerators',
              label: 'Self-Response Moderator — Ignore moderators',
              helpText: 'Do not enforce the self-response rule for moderators.',
              defaultValue: Boolean(current.selfResponseIgnoreModerators ?? true),
              required: false,
            },
            {
              type: 'boolean',
              name: 'selfResponseIgnoreContributors',
              label: 'Self-Response Moderator — Ignore approved submitters',
              helpText: 'Do not enforce the self-response rule for approved submitters.',
              defaultValue: Boolean(current.selfResponseIgnoreContributors ?? true),
              required: false,
            },
          ],
        },
      },
    });
  });

  // ── Form submission: save settings ───────────────────────────────────────────
  app.post('/internal/forms/bot-settings', async (c) => {
    const values = await c.req.json<Partial<SettingsFormValues>>();
    if (values.botSignature !== undefined) await writeSetting('botSignature', values.botSignature);
    if (values.depthCap !== undefined) await writeSetting('depthCap', Number(values.depthCap));
    if (values.depthCapResponse !== undefined) await writeSetting('depthCapResponse', values.depthCapResponse);
    if (values.floodAssistantResponse !== undefined) await writeSetting('floodAssistantResponse', values.floodAssistantResponse);
    if (values.floodAssistantMaxPosts !== undefined) await writeSetting('floodAssistantMaxPosts', Number(values.floodAssistantMaxPosts));
    if (values.floodAssistantWindowHours !== undefined) await writeSetting('floodAssistantWindowHours', Number(values.floodAssistantWindowHours));
    if (values.floodAssistantIgnoreModerators !== undefined) await writeSetting('floodAssistantIgnoreModerators', Boolean(values.floodAssistantIgnoreModerators));
    if (values.floodAssistantIgnoreContributors !== undefined) await writeSetting('floodAssistantIgnoreContributors', Boolean(values.floodAssistantIgnoreContributors));
    if (values.floodAssistantIgnoreAutoRemoved !== undefined) await writeSetting('floodAssistantIgnoreAutoRemoved', Boolean(values.floodAssistantIgnoreAutoRemoved));
    if (values.floodAssistantIgnoreRemoved !== undefined) await writeSetting('floodAssistantIgnoreRemoved', Boolean(values.floodAssistantIgnoreRemoved));
    if (values.floodAssistantIgnoreDeleted !== undefined) await writeSetting('floodAssistantIgnoreDeleted', Boolean(values.floodAssistantIgnoreDeleted));
    if (values.selfResponseResponse !== undefined) await writeSetting('selfResponseResponse', values.selfResponseResponse);
    if (values.selfResponseIgnoreModerators !== undefined) await writeSetting('selfResponseIgnoreModerators', Boolean(values.selfResponseIgnoreModerators));
    if (values.selfResponseIgnoreContributors !== undefined) await writeSetting('selfResponseIgnoreContributors', Boolean(values.selfResponseIgnoreContributors));
    log.info('Settings saved via form');
    return c.json<UiResponse>({ showToast: 'Settings saved.' });
  });
}
