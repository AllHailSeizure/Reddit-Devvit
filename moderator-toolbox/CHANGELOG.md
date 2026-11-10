# Changelog

All notable changes to moderator-toolbox. Format: `module(<scope>): description`.

---

## [Unreleased]

- `module(predatory-journal-watch)`: Warn, without removing or reporting, when a post or comment links a watchlisted predatory or hijacked journal domain or a DOI that resolves to one. One combined comment per item, at most once per publisher per post. Allowlist defaults to MDPI and Frontiers. Watchlist is synced to Supabase from the Retraction Watch hijacked-URL column and Beall's List.
- `module(nonresponder-check)`: Warn nonresponding authors on post submit after the latest 2 qualifying posts with 3+ surviving other-user comments and no OP responses. Exclude OP, app authors, missing/deleted authors, and removed/deleted/spam comments. `nonresponderSkipLockedComments` (true) excludes locked comments and replies to locked parents; locking OP’s reply does not invalidate it. Unlocked mod comments count normally. `nonresponderRunOnMods` (false) takes precedence over `nonresponderRunOnApprovedUsers` (true). Skip app-account posters; other bots/apps are checked normally with no username list. Bounded scans, duplicate protection, configurable warning, and repeat reporting (`nonresponderReportRepeat=true`; warnings tracked for 180 days with comment fallback).
- Engineering standards baseline: ESLint, Prettier, MODULE descriptor, structured logging standard, settings naming convention, Redis key convention, hierarchical CLAUDE.md files
- `module(flair-transfer)`: transfer qualifying post flair milestones into user flair awards with retry scheduling — pending verification

---

## [2.11.0] — Previously published (Adversarial LLM Reviewer)

- `module(adversarial-reviewer)`: PDF paper review pipeline with LLM critique; mod-menu triggered; Supabase review_jobs table

## [2.9.1] — Previously published

- `fix(length-moderator)`: Module toggle bugfix; trigger on flair change

## [2.9.0] — Previously published

- Flood Moderator, Depth Cap, Self-Response, Length Moderator, Chain Mop, Saved Responses, Define Command — initial verified versions

---

_Versions prior to 2.9.0 not reconstructed. Future entries added by `/module-promote`._
