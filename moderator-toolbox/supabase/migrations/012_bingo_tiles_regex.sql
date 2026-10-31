-- Extends bingo_tiles for regex-based tiles and author-scoped comment checks.
--
-- check_type = 'regex': pattern/flags drive a generic RegExp(pattern, flags).test()
--   evaluator in the app — lets compound AND/OR phrase logic (via lookaheads and
--   alternation) live as data instead of hand-written functions.
-- author_scope: trinary (NULL/'op'/'not_op'), orthogonal to check_type. Only
--   applies when comment_check is true — a post's author is unambiguously OP,
--   so it's a no-op for post_check. NULL = indifferent to who wrote the comment.

ALTER TABLE bingo_tiles DROP CONSTRAINT bingo_tiles_check_type_check;
ALTER TABLE bingo_tiles ADD CONSTRAINT bingo_tiles_check_type_check
  CHECK (check_type IN ('keyword', 'regex', 'custom'));

ALTER TABLE bingo_tiles ADD COLUMN pattern TEXT;
ALTER TABLE bingo_tiles ADD COLUMN flags TEXT NOT NULL DEFAULT 'is';
ALTER TABLE bingo_tiles ADD COLUMN author_scope TEXT CHECK (author_scope IN ('op', 'not_op'));
