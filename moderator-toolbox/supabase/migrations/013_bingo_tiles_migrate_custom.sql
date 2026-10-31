-- Moves 9 tiles off check_type='custom' now that regex/author_scope cover them.
-- unrendered-latex and the 4 numeric-threshold tiles are intentionally left as
-- 'custom' — they need real preprocessing/counting the schema doesn't express.

-- Flat OR-list + author_scope (were compound author-checks, actually simple lists).
UPDATE bingo_tiles SET
  check_type = 'keyword', comment_check = true, author_scope = 'not_op',
  triggers = ARRAY['did you read', 'have you read', 'did you even read', 'did you actually read', 'did you look at this']
WHERE value_key = 'did-you-read-your-post';

UPDATE bingo_tiles SET
  check_type = 'keyword', comment_check = true, author_scope = 'op',
  triggers = ARRAY['did you read', 'have you read', 'did you even read', 'did you actually read']
WHERE value_key = 'did-you-read-my-post';

-- Regex tiles: lookahead-AND for multi-term conditions, alternation for OR.
UPDATE bingo_tiles SET
  check_type = 'regex', comment_check = true,
  pattern = '^\s*where math[.?]?\s*$', flags = 'i'
WHERE value_key = 'where-math';

UPDATE bingo_tiles SET
  check_type = 'regex', comment_check = true, author_scope = 'op',
  pattern = '(?=.*(can''t do|cannot do|don''t understand|not great with))(?=.*math)|can''t formalize|someone who knows the math'
WHERE value_key = 'op-cant-do-math';

UPDATE bingo_tiles SET
  check_type = 'regex', comment_check = true, author_scope = 'not_op',
  pattern = '(?=.*physics)(?=.*(background|degree|education|credentials|studied))|are you a physicist|your physics'
WHERE value_key = 'is-op-qualified';

UPDATE bingo_tiles SET
  check_type = 'regex', comment_check = true,
  pattern = 'quarantine|containment|(?=.*keep)(?=.*llm)(?=.*(off|out))|(?=.*banned)(?=.*(r/physics|other subs))'
WHERE value_key = 'quarantine-discourse';

UPDATE bingo_tiles SET
  check_type = 'regex', comment_check = true,
  pattern = '(?=.*(can''t do math|cannot do math|can''t do mathematics))(?=.*(llm|chatgpt|gpt))'
WHERE value_key = 'llms-cant-do-math';

UPDATE bingo_tiles SET
  check_type = 'regex', comment_check = true,
  pattern = '(?=.*without)(?=.*(llm|chatgpt|an ai|using ai))|own words'
WHERE value_key = 'explain-without-llm';

-- Minor semantic widening vs. the original startsWith cross-product: also allows
-- "thats a really X question" (only "that's a"/"that is a" had the "really" variant
-- before). Harmless for a flavor tile.
UPDATE bingo_tiles SET
  check_type = 'regex', comment_check = true,
  pattern = '^(that''s a|that is a|thats a)( really)? (great|sharp|valuable|excellent|interesting|wonderful|fantastic|brilliant|insightful|important) question'
WHERE value_key = 'thats-a-great-question';
