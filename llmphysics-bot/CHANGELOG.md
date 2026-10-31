# Changelog

All notable changes to llmphysics-bot. Format: `module(<scope>): description`.

---

## [Unreleased]

- `module(nonresponder-check)`: Warn nonresponding authors on post submit. A previous post qualifies with 3+ comments from other users (excluding OP, ignored users, app accounts, removed/deleted/spam); only OP replies to another human's comment count as responses. Checks the latest 2 qualifying posts (bounded scans, duplicate protection, approved-user exemption, configurable warning; no moderator exemption). Editable `nonresponderIgnoredUsers` defaults to `tap-the-sign, moderator-toolbox, adversarial-review, automoderator`; skips listed posters and excludes their comments/reply targets. Saved blank clears the list; app accounts are always excluded. If those posts were also warned, reports the new post to mods (`nonresponderReportRepeat`, default true; warnings tracked in Redis for 180 days with a comment-scan fallback).

- Engineering standards baseline: ESLint, Prettier, MODULE descriptor, structured logging standard, settings naming convention, Redis key convention, hierarchical CLAUDE.md files

---

## [2.11.0] — Previously published (Adversarial LLM Reviewer)

- `module(adversarial-reviewer)`: PDF paper review pipeline with LLM critique; mod-menu triggered; Supabase review_jobs table

## [2.9.1] — Previously published

- `fix(length-moderator)`: Module toggle bugfix; trigger on flair change

## [2.9.0] — Previously published

- Flood Moderator, Depth Cap, Self-Response, Length Moderator, Chain Mop, Saved Responses, Define Command — initial verified versions

---

_Versions prior to 2.9.0 not reconstructed. Future entries added by `/module-promote`._
