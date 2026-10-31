-- One-time seed of the 33 tiles that exist in sub-bingo today, derived
-- directly from sub-bingo/src/server/tiles.ts and deterministic-tiles.ts.
-- 'keyword' rows carry the generic post_check/comment_check/triggers schema;
-- 'custom' rows keep their labels for display but are evaluated by the app's
-- hardcoded CUSTOM_VALIDATOR_REGISTRY instead of these columns.

INSERT INTO bingo_tiles (value_key, check_type, display_name, label, game_description, post_check, comment_check, triggers) VALUES
('tear-me-apart', 'keyword', 'Tear Me Apart', 'Tear My Theory Apart', 'Tear me apart, fam. Wait - are you actually gonna do it?', true, false, ARRAY['tear me apart']),
('coherence-drop', 'keyword', 'Coherence', '"Coherence" in a Post', 'Do 99% of posts referencing this realize what this means in physics?', true, false, ARRAY['coher']),
('resonance-drop', 'keyword', 'Resonance', '"Resonance" in a Post', 'I considered making this the free square.', true, false, ARRAY['resonan']),
('ontology-drop', 'keyword', 'Ontology', '"Ontology" in a Post', 'Why on earth are we so obsessed with this word.', true, false, ARRAY['ontol', 'ontic']),
('unrendered-latex', 'custom', 'Unrendered LaTeX', 'Unrendered LaTeX in Post', 'Reddit is MD only.', false, false, ARRAY[]::TEXT[]),
('consciousness-drop', 'keyword', 'Consciousness', '"Consciousness" in a Post', 'Surely my awareness is what influences the outside world.', true, false, ARRAY['consciousness']),
('framework-drop', 'keyword', 'Framework', '"Framework" in a Post', 'Every hypothesis can be elevated to a framework if you try hard enough.', true, false, ARRAY['framework']),
('cosmological-constant-drop', 'keyword', 'Cosmological Constant', '"Cosmological Constant" in Post', 'It sounds too fancy to not engage with it, right?', true, false, ARRAY['cosmological constant']),
('hubble-tension-drop', 'keyword', 'Hubble Tension', '"Hubble Tension" in a Post', 'Hubble Tension: the gift that keeps on giving for LLM theories.', true, false, ARRAY['hubble tension']),
('toroidal-drop', 'keyword', 'Toroidal', '"Toroidal" in a Post', 'This sub loves bagels.', true, false, ARRAY['toroid']),
('fully-falsifiable-drop', 'keyword', 'Falsifiable', '"Falsifiable" in a Post', 'Need legitimacy? It''s the go to word.', true, false, ARRAY['falsif']),
('emergent-drop', 'keyword', 'Emergent', '"Emergent" in a Post', 'Everything''s gotta come from somewhere I guess.', true, false, ARRAY['emerg']),
('quarantine-discourse', 'custom', 'Quarantine', 'Sub Is LLM Paper Quarantine', 'Ah, a fresh user, time to explain the entire purpose of the sub.', false, false, ARRAY[]::TEXT[]),
('explain-without-llm', 'custom', 'Don''t use an LLM..', '"Explain Without an LLM"', 'Use your own words. Please. I''m so sick of moderating LLM comment reports.', false, false, ARRAY[]::TEXT[]),
('thats-a-great-question', 'custom', 'That''s a great question..', '"That''s a Great Question"', 'Would you like me to explain the interesting history behind this tile?', false, false, ARRAY[]::TEXT[]),
('dunning-kruger-mention', 'keyword', 'Dunning-Kruger', 'Dunning-Kruger in Comments', 'We love psychology on this sub.', false, true, ARRAY['dunning', 'cognitive bias', 'path of ruin']),
('not-even-wrong', 'keyword', 'Not Even Wrong.', '"Not Even Wrong" Comment', 'It''s not wrong. It''s not right. It''s something else entirely.', false, true, ARRAY['not even wrong']),
('citation-needed', 'keyword', '[citation needed]', '"Citation Needed" Comment', '[citation needed]', false, true, ARRAY['citation needed']),
('where-math', 'custom', '"Where Math"', 'The "Where Math" Comment', 'Do I need to spell it out for you.', false, false, ARRAY[]::TEXT[]),
('op-cant-do-math', 'custom', 'OP Can''t Do the Math', 'OP Admits They Can''t Do the Math', 'Can I do the math? No... but I know the idea is right.', false, false, ARRAY[]::TEXT[]),
('llms-cant-do-math', 'custom', 'LLMs Can''t Do Math', '"LLMs Can''t Do Math" Comment', 'The anthem of the sub: ''LLMs can''t do math!''', false, false, ARRAY[]::TEXT[]),
('lean4-proof', 'keyword', 'Lean 4 Proof', 'Lean 4 Proof as Evidence', 'This can''t be wrong, I verified it in Lean 4..', true, false, ARRAY['lean 4', 'lean4']),
('two-person-war', 'custom', 'Comment War', 'Two-Person Comment War', 'One post. 50+ comments. 75% by OP and one other user.', false, false, ARRAY[]::TEXT[]),
('em-dash-epidemic', 'custom', 'Em-Dash Epidemic', '40 Em-Dashes in One Post', 'A cruel twist of fate leads to a thread with more than 40 em-dashes over the course of its lifetime.', false, false, ARRAY[]::TEXT[]),
('unfinished-work-disclaimer', 'keyword', 'This Isn''t Complete..', 'Explicitly Incomplete Work', 'Now, this theory isn''t complete, but..', true, false, ARRAY['incomplete', 'unfinished', 'rough draft', 'not fully developed', 'isn''t finished', 'is not finished', 'not a finished']),
('did-you-read-your-post', 'custom', 'Did You Read Your Post?', '"Did You Read Your Post?"', 'Did you even read this before posting? Sigh.', false, false, ARRAY[]::TEXT[]),
('did-you-read-my-post', 'custom', 'Did You Read My Post?', '"Did You Read MY Post?"', 'I can tell by your criticism you didn''t even read my post, did you?', false, false, ARRAY[]::TEXT[]),
('comment-purge', 'custom', 'Moderation Rampage', '7+ Comments Removed in Post', 'A post is subjected to a purge from the tyrant oppressors of the sub, who delete 7 or more comments in their crusade of censorship.', false, false, ARRAY[]::TEXT[]),
('scalar-field-drop', 'keyword', 'Scalar Field', '"Scalar Field" in a Post', 'A less legit sounding tensor field..', true, false, ARRAY['scalar field']),
('tensor-drop', 'keyword', 'Tensor', '"Tensor" in a Post', 'A more legit sounding scalar field.', true, false, ARRAY['tensor']),
('comment-explosion', 'custom', '120 Comments', '120+ Comments on a Post', 'WTF guys?', false, false, ARRAY[]::TEXT[]),
('xkcd-3155', 'keyword', 'XKCD 3155', 'Someone Cites XKCD 3155', 'The citation you will see 1000 times.', false, true, ARRAY['3155']),
('is-op-qualified', 'custom', 'OP = Physicist?', 'OP = Physicist?', 'The gatekeeper''s go-to weapon.', false, false, ARRAY[]::TEXT[])
ON CONFLICT (value_key) DO NOTHING;
