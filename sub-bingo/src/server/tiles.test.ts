import { describe, it, expect } from 'vitest';
import { TILE_VALIDATORS } from './tiles';

const tile = (key: string) => {
  const t = TILE_VALIDATORS.find((t) => t.valueKey === key);
  if (!t) throw new Error(`Tile not found: ${key}`);
  return t;
};

describe('TILE_VALIDATORS structure', () => {
  it('every tile has a validate function', () => {
    for (const t of TILE_VALIDATORS) {
      expect(typeof t.validate, `${t.valueKey} missing validate`).toBe('function');
    }
  });

  it('every tile has a valueKey, label', () => {
    for (const t of TILE_VALIDATORS) {
      expect(t.valueKey, `valueKey missing`).toBeTruthy();
      expect(t.label, `${t.valueKey} missing label`).toBeTruthy();
    }
  });

  it('no tile has postFilter, description, examples, edgeCaseGuidelines, or relevantTypes', () => {
    for (const t of TILE_VALIDATORS) {
      expect((t as any).postFilter, `${t.valueKey} has postFilter`).toBeUndefined();
      expect((t as any).description, `${t.valueKey} has description`).toBeUndefined();
      expect((t as any).examples, `${t.valueKey} has examples`).toBeUndefined();
      expect((t as any).edgeCaseGuidelines, `${t.valueKey} has edgeCaseGuidelines`).toBeUndefined();
      expect((t as any).relevantTypes, `${t.valueKey} has relevantTypes`).toBeUndefined();
    }
  });
});

describe('OP-identity tiles use validate (OP-awareness baked in)', () => {
  function makeThread(opAuthor: string, commentAuthor: string, body: string) {
    return {
      postId: 't3_test',
      opAuthor,
      title: '',
      body: '',
      comments: [{ author: commentAuthor, body }],
      modRemovals: 0,
      depthCapReports: 0,
    };
  }

  describe('op-cant-do-math', () => {
    const t = tile('op-cant-do-math');
    it('triggers when OP admits they cannot do the math', () => {
      expect(t.validate(makeThread('alice', 'alice', "I can't do the math myself but the idea is right"))).toBe(true);
    });
    it('does not trigger when a non-OP says the same', () => {
      expect(t.validate(makeThread('alice', 'bob', "I can't do the math myself but the idea is right"))).toBe(false);
    });
  });

  describe('did-you-read-my-post', () => {
    const t = tile('did-you-read-my-post');
    it('triggers when OP asks "did you read my post"', () => {
      expect(t.validate(makeThread('alice', 'alice', 'did you actually read my post?'))).toBe(true);
    });
    it('does not trigger when a non-OP asks', () => {
      expect(t.validate(makeThread('alice', 'bob', 'did you actually read my post?'))).toBe(false);
    });
  });

  describe('did-you-read-your-post', () => {
    const t = tile('did-you-read-your-post');
    it('triggers when a non-OP asks "did you read your post"', () => {
      expect(t.validate(makeThread('alice', 'bob', 'did you read this before posting?'))).toBe(true);
    });
    it('does not trigger when OP asks', () => {
      expect(t.validate(makeThread('alice', 'alice', 'did you read this before posting?'))).toBe(false);
    });
  });

  describe('is-op-qualified', () => {
    const t = tile('is-op-qualified');
    it('triggers when a non-OP asks about physics background', () => {
      expect(t.validate(makeThread('alice', 'bob', 'what is your physics background?'))).toBe(true);
    });
    it('does not trigger when OP asks about their own background', () => {
      expect(t.validate(makeThread('alice', 'alice', 'what is your physics background?'))).toBe(false);
    });
  });
});
