// Extract LaTeX math from a Reddit post body and convert it to Unicode text.
// Ported from the r/LLMPhysics prototype (convert.py). Best effort: this is not
// a TeX engine, and 2D layout (big fractions, matrices) comes out linear.

// --- Reddit markdown unescape -------------------------------------------------

/**
 * Turn Reddit backslash-escapes into the characters the author meant.
 *
 * Posts written in the rich-text editor come back with every backslash
 * escaped (`\\(S\\^{3}\\)`), so a full unescape recovers the LaTeX. Posts
 * written in markdown mode keep single backslashes before commands (`\frac`),
 * which the rich-text editor never emits; for those only the markdown
 * punctuation escapes (`\_`, `\*`, `\^`, `\~`, `` \` ``) are undone so the
 * `\(` delimiters and commands survive.
 */
export function unescapeRedditMd(text: string): string {
  const markdownMode = /(^|[^\\])\\[A-Za-z]/.test(text);
  if (markdownMode) {
    return text.replace(/\\([_*^~`])/g, '$1');
  }
  let out = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\' && i + 1 < text.length) {
      out += text[i + 1];
      i++;
    } else {
      out += text[i];
    }
  }
  return out;
}

// --- Informal / broken-LaTeX repair ------------------------------------------

const REPAIR_PATTERNS: Array<[RegExp, string, string]> = [
  [/\*+\^/g, '^', 'asterisks (broken markdown bold) before a superscript'],
  [
    /\^\(\{(-?\d+)\},\\mathrm\{eV\}\/c2\)/g,
    String.raw`^{$1}\,\mathrm{eV}/c^{2}`,
    'unit 10^{exp} eV/c^2 written as ^({exp},\\mathrm{eV}/c2)',
  ],
  [
    /\^\(\{(-?\d+)\},\\mathrm\{m3,kg\{-1\},s\{-2\}\}\)/g,
    String.raw`^{$1}\,\mathrm{m}^{3}\,\mathrm{kg}^{-1}\,\mathrm{s}^{-2}`,
    'unit 10^{exp} m^3 kg^{-1} s^{-2} packed into the superscript',
  ],
  [
    /(\d+(?:\.\d+)?),\\mathrm\{([A-Za-z]+)\}/g,
    String.raw`$1\,\mathrm{$2}`,
    'comma before a \\mathrm unit written for a space',
  ],
  [/\^\(\{(.+?)\}\)/g, '^{$1}', 'caret-paren superscript ^({…})'],
  [/\^\(\{([^{}]+)\}\)/g, '^{$1}', 'caret-paren superscript ^({…})'],
  [/\\frac\{([^{}]*)\^\((-?\d+)\}\{/g, String.raw`\frac{$1^{$2}}{`, 'frac numerator broken as ^(n}'],
  [/\^\((-?\d+)\}\)/g, '^{$1}}', 'broken superscript ^(n}) missing closing braces'],
  [/\^\((-?\d+)\}/g, '^{$1}}', 'broken superscript ^(n} missing closing braces'],
  [/\\int\)/g, String.raw`\int `, "stray ')' after \\int from a broken frac"],
  [/\^\((?!\{)([^()]+)\)/g, '^{$1}', 'informal caret-paren superscript ^(…)'],
  [/\{12h2\}/g, '{12h^{2}}', '12h2 written for 12h^2'],
  [/S\^\{3,S3\}/g, 'S^{3}, S^{3}', 'S^(3,S3) written for S^3, S^3'],
  [/S\^\(3,S3\)/g, 'S^{3}, S^{3}', 'S^(3,S3) written for S^3, S^3'],
];

/** Apply conservative typography repairs. Returns the repaired source and reasons. */
export function repairLatex(src: string): { repaired: string; reasons: string[] } {
  const reasons: string[] = [];
  let out = src;
  for (const [pat, repl, reason] of REPAIR_PATTERNS) {
    const next = out.replace(pat, repl);
    if (next !== out) {
      out = next;
      reasons.push(reason);
    }
  }
  return { repaired: out, reasons };
}

// --- Symbol tables ------------------------------------------------------------

const GREEK: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', Gamma: 'Γ',
  delta: 'δ', Delta: 'Δ', epsilon: 'ε', varepsilon: 'ε',
  zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', Theta: 'Θ',
  iota: 'ι', kappa: 'κ', lambda: 'λ', Lambda: 'Λ',
  mu: 'μ', nu: 'ν', xi: 'ξ', Xi: 'Ξ',
  pi: 'π', Pi: 'Π', varpi: 'ϖ', rho: 'ρ', varrho: 'ϱ',
  sigma: 'σ', varsigma: 'ς', Sigma: 'Σ',
  tau: 'τ', upsilon: 'υ', Upsilon: 'Υ',
  phi: 'φ', varphi: 'φ', Phi: 'Φ',
  chi: 'χ', psi: 'ψ', Psi: 'Ψ',
  omega: 'ω', Omega: 'Ω',
};

const MATHBB: Record<string, string> = { Z: 'ℤ', R: 'ℝ', C: 'ℂ', N: 'ℕ', Q: 'ℚ', H: 'ℍ' };

const RELATIONS: Record<string, string> = {
  approx: '≈', neq: '≠', ne: '≠',
  leq: '≤', le: '≤', geq: '≥', ge: '≥',
  ll: '≪', gg: '≫', equiv: '≡', sim: '∼',
  simeq: '≃', cong: '≅', approxeq: '≊',
  in: '∈', notin: '∉',
  subset: '⊂', subseteq: '⊆', supset: '⊃', supseteq: '⊇',
  propto: '∝',
  to: '→', rightarrow: '→', leftarrow: '←',
  Rightarrow: '⇒', implies: '⇒', Leftarrow: '⇐',
  mid: '∣',
};
const RELATION_CHARS = new Set<string>([
  ...Object.values(RELATIONS),
  ...Array.from('=<>≠≤≥≈≪≫∈∉⊂⊆⊃⊇∝→←⇒⇐≡∼≃≅∣'),
]);

const COMMANDS: Record<string, string> = {
  nabla: '∇', partial: '∂', int: '∫', oint: '∮',
  sum: '∑', prod: '∏', infty: '∞', hbar: 'ℏ', ell: 'ℓ',
  times: '×', cdot: '·', otimes: '⊗', oplus: '⊕',
  pm: '±', mp: '∓',
  cup: '∪', cap: '∩', emptyset: '∅', varnothing: '∅',
  ldots: '…', cdots: '⋯', dots: '…', vdots: '⋮',
  forall: '∀', exists: '∃', neg: '¬', lnot: '¬',
  land: '∧', lor: '∨', wedge: '∧', vee: '∨',
  ast: '*', star: '★', circ: '∘',
  dagger: '†', ddagger: '‡',
  angle: '∠', perp: '⊥', parallel: '∥',
  backslash: '\\', vert: '|',
  langle: '⟨', rangle: '⟩',
  quad: ' ', qquad: '  ', ',': ' ', ';': ' ', ' ': ' ', '!': '',
  sin: 'sin', cos: 'cos', tan: 'tan', log: 'log',
  ln: 'ln', exp: 'exp', det: 'det', dim: 'dim',
  ker: 'ker', min: 'min', max: 'max', sup: 'sup', inf: 'inf',
  lim: 'lim', arg: 'arg',
  ...RELATIONS,
};

const SUPER: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵',
  '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ',
  g: 'ᵍ', h: 'ʰ', i: 'ⁱ', j: 'ʲ', k: 'ᵏ', l: 'ˡ',
  m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ', r: 'ʳ', s: 'ˢ',
  t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ',
  A: 'ᴬ', B: 'ᴮ', D: 'ᴰ', E: 'ᴱ', G: 'ᴳ', H: 'ᴴ',
  I: 'ᴵ', J: 'ᴶ', K: 'ᴷ', L: 'ᴸ', M: 'ᴹ', N: 'ᴺ',
  O: 'ᴼ', P: 'ᴾ', R: 'ᴿ', T: 'ᵀ', U: 'ᵁ', V: 'ⱽ', W: 'ᵂ',
};
const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅',
  '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '−': '₋', '=': '₌', '(': '₍', ')': '₎',
  a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ',
  l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ',
  s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
};

const STRIP_FONTS = new Set([
  'mathrm', 'mathbf', 'mathit', 'mathsf', 'mathtt', 'textrm',
  'textbf', 'textit', 'text', 'operatorname', 'mathcal',
]);

const has = (table: Record<string, string>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(table, key);

// --- Recursive converter ------------------------------------------------------

class Cursor {
  readonly s: string[];
  i = 0;
  constructor(s: string) {
    this.s = Array.from(s); // code points, so astral symbols are not split
  }
  eof(): boolean {
    return this.i >= this.s.length;
  }
  peek(): string {
    return this.s[this.i] ?? '';
  }
  get(): string {
    return this.s[this.i++] ?? '';
  }
  rest(): string {
    return this.s.slice(this.i).join('');
  }
  slice(start: number, end: number): string {
    return this.s.slice(start, end).join('');
  }
  skipWs(): void {
    while (!this.eof() && ' \t\n\r'.includes(this.s[this.i])) this.i++;
  }
}

function toScript(text: string, table: Record<string, string>): string | null {
  let out = '';
  for (const ch of Array.from(text)) {
    if (ch === ' ') continue;
    if (!has(table, ch)) return null;
    out += table[ch];
  }
  return out || null;
}

function isSimpleAtom(text: string): boolean {
  if (!text) return false;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return true;
  if (/^[A-Za-zΑ-Ωα-ωℤℝℂℕℚℍℏ][₀-₉₊₋₌ₐ-ₓᵥ]*[⁰-⁹⁺⁻⁼ⁿᵃ-ᶻᴬ-ᵂ]*$/u.test(text)) return true;
  if (/^[A-Za-zΑ-Ωα-ωℏ][A-Za-z0-9]*(?:_\(?[A-Za-z0-9α-ω]+\)?)?[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ]*$/u.test(text)) {
    return true;
  }
  return false;
}

function balanced(s: string): boolean {
  let depth = 0;
  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

function wrapFracTerm(text: string): string {
  if (isSimpleAtom(text)) return text;
  if (text.startsWith('(') && text.endsWith(')') && balanced(text.slice(1, -1))) return text;
  return `(${text})`;
}

const isLetter = (ch: string): boolean => /^\p{L}$/u.test(ch);

function readCommandName(c: Cursor): string {
  if (c.eof()) return '';
  if (!isLetter(c.peek())) return c.get();
  let name = '';
  while (!c.eof() && isLetter(c.peek())) name += c.get();
  return name;
}

function readBraceGroup(c: Cursor): string {
  c.get(); // '{'
  const inner = convertUntil(c, '}');
  if (!c.eof() && c.peek() === '}') c.get();
  return inner;
}

function readGroupOrAtom(c: Cursor): string {
  c.skipWs();
  if (c.eof()) return '';
  if (c.peek() === '{') return readBraceGroup(c);
  return convertAtom(c, false);
}

function rawGroup(c: Cursor): string {
  c.skipWs();
  if (c.eof()) return '';
  if (c.peek() !== '{') return c.get();
  c.get();
  const start = c.i;
  let depth = 1;
  while (!c.eof() && depth) {
    const ch = c.get();
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
  }
  return c.slice(start, c.i - (depth ? 0 : 1));
}

function formatScript(arg: string, sub: boolean): string {
  const mapped = toScript(arg, sub ? SUB : SUPER);
  if (mapped !== null) return mapped;
  return sub ? `_(${arg})` : `^(${arg})`;
}

function readScriptArg(c: Cursor): string {
  c.skipWs();
  if (c.eof()) return '';
  if (c.peek() === '(') {
    c.get();
    const inner = convertUntil(c, ')');
    if (c.peek() === ')') c.get();
    return inner;
  }
  return readGroupOrAtom(c);
}

function maybeScripts(c: Cursor, base: string): string {
  while (!c.eof() && (c.peek() === '_' || c.peek() === '^')) {
    const kind = c.get();
    const arg = readScriptArg(c);
    base += formatScript(arg, kind === '_');
  }
  return base;
}

function applyCommand(c: Cursor, name: string): string {
  if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
    const num = readGroupOrAtom(c);
    const den = readGroupOrAtom(c);
    return `${wrapFracTerm(num)}/${wrapFracTerm(den)}`;
  }
  if (name === 'sqrt') {
    if (c.peek() === '[') {
      c.get();
      const n = convertUntil(c, ']');
      if (c.peek() === ']') c.get();
      const body = readGroupOrAtom(c);
      return `√[${n}](${body})`;
    }
    return `√(${readGroupOrAtom(c)})`;
  }
  if (STRIP_FONTS.has(name)) return readGroupOrAtom(c);
  if (name === 'mathbb') {
    const inner = rawGroup(c);
    return has(MATHBB, inner) ? MATHBB[inner] : inner;
  }
  if (name === 'left' || name === 'right') {
    if (c.eof()) return '';
    const delim = c.get();
    if (delim === '\\') {
      const n2 = readCommandName(c);
      return has(COMMANDS, n2) ? COMMANDS[n2] : n2;
    }
    if (delim === '.') return '';
    return delim;
  }
  if (has(GREEK, name)) return GREEK[name];
  if (has(COMMANDS, name)) return COMMANDS[name];
  return name;
}

function convertAtom(c: Cursor, allowScripts = true): string {
  if (c.eof()) return '';
  const ch = c.peek();
  if (ch === '{') {
    const body = readBraceGroup(c);
    return allowScripts ? maybeScripts(c, body) : body;
  }
  if (ch === '\\') {
    c.get();
    const name = readCommandName(c);
    const converted = applyCommand(c, name);
    return allowScripts ? maybeScripts(c, converted) : converted;
  }
  if (ch === '(' || ch === '[') {
    const open = c.get();
    const close = open === '(' ? ')' : ']';
    const inner = convertUntil(c, close);
    if (!c.eof() && c.peek() === close) c.get();
    const body = open + inner + close;
    return allowScripts ? maybeScripts(c, body) : body;
  }
  let tok = c.get();
  if (tok === '-') tok = '−';
  return allowScripts ? maybeScripts(c, tok) : tok;
}

function convertUntil(c: Cursor, terminators = ''): string {
  const parts: string[] = [];
  while (!c.eof() && !terminators.includes(c.peek())) {
    parts.push(convertAtom(c, true));
  }
  return parts.join('');
}

const escapeClass = (ch: string): string => ch.replace(/[\\\]^-]/g, '\\$&');
const RELATION_RE = new RegExp(`[${Array.from(RELATION_CHARS).map(escapeClass).join('')}]`, 'gu');

function padRelations(text: string): string {
  text = text.replace(RELATION_RE, (op: string, offset: number, whole: string) => {
    const left = offset > 0 ? whole[offset - 1] : '';
    const right = offset + op.length < whole.length ? whole[offset + op.length] : '';
    const prefix = left && !' \n\t('.includes(left) ? ' ' : '';
    const suffix = right && !' \n\t),;:'.includes(right) ? ' ' : '';
    return `${prefix}${op}${suffix}`;
  });
  text = text.replace(/ {2,}/g, ' ');
  // A frac times a parenthetical: 3/4(A + u) -> 3/4 (A + u)
  text = text.replace(/\/(\d+)(\()/g, '/$1 $2');
  // Space before a large operator when the author omitted one: 1/(2π)∮
  text = text.replace(/(?<=\S)([∫∮∑∏])/gu, ' $1');
  // Space between adjacent scripted factors: F_(μν)F^(μν)
  text = text.replace(
    /([A-Za-zα-ωΑ-Ω](?:[_^(][^)]+\)|[₀-₉₊₋ₐ-ₓᵥ⁰-⁹⁺⁻ⁿᵃ-ᶻᴬ-ᵂ])+)([A-Za-zα-ωΑ-Ω])/gu,
    '$1 $2',
  );
  // Space after a fallback script before a following atom: ∪_(Σ)D₊
  text = text.replace(/([_^]\([^)]+\))(?=[A-Za-zΑ-Ωα-ω])/gu, '$1 ');
  // Glue a greek letter to a following single-letter variable: Δ u -> Δu
  text = text.replace(/([Α-Ωα-ωℏ∇∂]) ([A-Za-z])(?![A-Za-z])/gu, '$1$2');
  return text.trim();
}

/** Convert a LaTeX math fragment (no delimiters) to Unicode. */
export function convertLatex(src: string): string {
  const c = new Cursor(src);
  let text = convertUntil(c);
  // Keep any unparsed tail visible rather than silently dropping it.
  if (!c.eof()) {
    const rest = c.rest();
    if (rest.trim()) text += rest;
  }
  return padRelations(text);
}

// --- Extraction ---------------------------------------------------------------

const LATEX_MARK = /\\[A-Za-z]+|\\[^A-Za-z]|[_^]\{|[_^]\(|[_^][A-Za-z0-9+\-\\]/;
const LATEX_MARK_G = new RegExp(LATEX_MARK.source, 'g');

type DelimKind = '$$' | '$' | '\\[' | '\\(';
const DELIM_RES: Array<[DelimKind, RegExp]> = [
  ['$$', /\$\$(.+?)\$\$/gs],
  // Pandoc rule for single dollars, so "$5 and $10" is not math: the opening $
  // is followed by a non-space, the closing $ follows a non-space and is not
  // followed by a digit.
  ['$', /(?<!\$)\$(?![\s$])(.+?)(?<![\s$])\$(?![$\d])/gs],
  ['\\[', /\\\[(.+?)\\\]/gs],
  ['\\(', /\\\((.+?)\\\)/gs],
];

export type ChunkKind = DelimKind | 'bare' | 'cell';

export interface Chunk {
  /** Source as found (delimiters included for delimited math). */
  raw: string;
  /** Source with delimiters stripped, before repair. */
  inner: string;
  /** Source after repair, as fed to the converter. */
  repaired: string;
  unicode: string;
  repairs: string[];
  start: number;
  kind: ChunkKind;
  /** Notes on repairs or likely misses; empty when the conversion looks clean. */
  hard: string;
}

const DELIMITED = new Set<ChunkKind>(['\\(', '\\[', '$', '$$']);

function stripDelims(s: string): string {
  s = s.trim();
  for (const [a, b] of [
    ['$$', '$$'],
    ['$', '$'],
    ['\\[', '\\]'],
    ['\\(', '\\)'],
  ]) {
    if (s.startsWith(a) && s.endsWith(b) && s.length >= a.length + b.length) {
      return s.slice(a.length, s.length - b.length).trim();
    }
  }
  return s;
}

function normalizeKey(inner: string): string {
  let s = inner.trim().replace(/\s+/g, ' ');
  s = s.replace(/\^\(([^()]+)\)/g, '^{$1}');
  s = s.split('\\mathrm{').join('\\text{').split('\\text{').join('');
  return s.split('}').join('');
}

function stripChars(s: string, chars: string): string {
  let a = 0;
  let b = s.length;
  while (a < b && chars.includes(s[a])) a++;
  while (b > a && chars.includes(s[b - 1])) b--;
  return s.slice(a, b);
}

const count = (s: string, ch: string): number => s.split(ch).length - 1;

function stripWrappingParens(s: string): string {
  s = s.trim();
  if (s.startsWith('(') && count(s, '(') === count(s, ')') + 1) s = s.slice(1).trim();
  if (s.startsWith('(') && s.endsWith(')') && balanced(s.slice(1, -1))) s = s.slice(1, -1).trim();
  if (s.endsWith(')') && count(s, ')') === count(s, '(') + 1) s = s.slice(0, -1).trimEnd();
  return s;
}

function tidyRaw(raw: string, kind: ChunkKind): string {
  raw = raw.trim();
  raw = stripChars(raw, '|').trim();
  raw = raw.replace(/\*{2,}/g, '').trim();
  raw = raw.replace(/;+$/, '').trim();
  if (kind === 'cell' || kind === 'bare') raw = stripWrappingParens(raw);
  raw = raw.replace(/[;,]+$/, '').trim();
  return raw;
}

function judge(repaired: string, reasons: string[], uni: string): string {
  const notes: string[] = [];
  if (reasons.length) notes.push('repaired: ' + reasons.join('; '));
  if (/\\[A-Za-z]/.test(uni)) notes.push('converter left a TeX command in the output');
  if (count(uni, '{') !== count(uni, '}')) notes.push('unbalanced braces in output');
  if (count(repaired, '{') !== count(repaired, '}')) {
    notes.push('source still has unbalanced braces after repair');
  }
  return notes.join('; ');
}

function buildChunk(raw: string, start: number, kind: ChunkKind): Chunk | null {
  const delimited = DELIMITED.has(kind);
  let rawTidy: string;
  let inner: string;
  if (delimited) {
    rawTidy = raw.trim();
    inner = stripDelims(rawTidy);
  } else {
    rawTidy = tidyRaw(raw, kind);
    inner = rawTidy;
  }
  if (!rawTidy) return null;
  if (!delimited && !LATEX_MARK.test(rawTidy)) return null;
  const { repaired, reasons } = repairLatex(inner);
  const convSrc = delimited ? repaired : stripWrappingParens(repaired);
  let uni = convertLatex(convSrc);
  if (!delimited) uni = stripWrappingParens(uni);
  return {
    raw: rawTidy,
    inner,
    repaired: convSrc,
    unicode: uni,
    repairs: reasons,
    start,
    kind,
    hard: judge(convSrc, reasons, uni),
  };
}

function splitTable(text: string): { prose: string; table: string; tableStart: number } {
  const m = /^\s*\|/m.exec(text);
  if (!m) return { prose: text, table: '', tableStart: -1 };
  return { prose: text.slice(0, m.index), table: text.slice(m.index), tableStart: m.index };
}

function tableCells(table: string, tableStart: number): Array<[number, string]> {
  const cells: Array<[number, string]> = [];
  let offset = tableStart;
  for (const line of table.split(/(?<=\n)/)) {
    const stripped = line.trim();
    if (!stripped.startsWith('|') || /^\|[\s:|-]+\|$/.test(stripped)) {
      offset += line.length;
      continue;
    }
    let cursor = line.indexOf('|');
    while (cursor !== -1) {
      const next = line.indexOf('|', cursor + 1);
      if (next === -1) break;
      cells.push([offset + cursor + 1, line.slice(cursor + 1, next).trim()]);
      cursor = next;
    }
    offset += line.length;
  }
  return cells;
}

const PROSE_WORD = String.raw`[A-Za-z]{3,}(?:[/\\-][A-Za-z0-9]+)*`;
const PROSE_SHORT = '(?:on|in|of|to|at|by|or|as|an|a|the|and)';
const LEADING_PROSE = new RegExp(
  String.raw`^(?:${PROSE_WORD}\.?\s+|${PROSE_WORD}:\s*|[*<]+\s*|/\s*|${PROSE_SHORT}\s+)`,
  'i',
);

function stripLeadingProse(s: string): string {
  s = s.replace(/^\*{2,}/, '').trim();
  for (;;) {
    const next = s.replace(LEADING_PROSE, '');
    if (next === s) break;
    s = next;
  }
  return stripChars(s, ' :');
}

function splitAdjacentWrapped(s: string): string[] {
  const parts = s.trim().split(/,?\s*\)\s+\(/);
  if (parts.length <= 1) return [s];
  const n = parts.length;
  const out = parts.map((part, i) => {
    if (i === 0 && part.startsWith('(')) part = part.slice(1);
    else if (i === n - 1 && part.endsWith(')')) part = part.slice(0, -1);
    return part.trim().replace(/,+$/, '').trim();
  });
  return out.filter(Boolean);
}

const CELL_CONNECTORS =
  /\b(?:from|photon mass|mixing angle|stability|binding|experimental upper bound|codata 2022|exact to|ir limit|spectral decomposition on)\b/i;

function formulaUnits(cell: string): string[] {
  if (!LATEX_MARK.test(cell)) return [];
  cell = cell.replace(/\*\*[^*]+\*\*\s*(\([^)]*\))?$/, '').trim();
  cell = stripChars(cell, '|').trim();
  const units: string[] = [];
  for (const part of cell.split(/;|\*\*diff\*\*/)) {
    for (let sp of part.split(CELL_CONNECTORS)) {
      sp = sp.replace(/\*{2,}/g, '');
      sp = stripLeadingProse(sp.trim());
      sp = stripChars(sp, ' :').trim();
      if (!sp || !LATEX_MARK.test(sp)) continue;
      units.push(...splitAdjacentWrapped(sp));
    }
  }
  return units;
}

function findBareInProse(prose: string): Array<[number, number, string]> {
  const hits: Array<[number, number, string]> = [];
  for (const m of prose.matchAll(/⟨[^⟨⟩]{1,200}⟩/g)) {
    if (LATEX_MARK.test(m[0])) hits.push([m.index, m.index + m[0].length, m[0]]);
  }
  for (const m of prose.matchAll(/(?:∫|\\int|\\oint)_\{[^}]+\}(?:\s*[A-Za-z])?/g)) {
    hits.push([m.index, m.index + m[0].length, m[0]]);
  }
  const occupied = new Array<boolean>(prose.length).fill(false);
  for (const [start, end] of hits) {
    for (let i = start; i < Math.min(end, prose.length); i++) occupied[i] = true;
  }
  const stop = new Set(Array.from(' \t\n,;:!?—–"\''));
  for (const m of prose.matchAll(LATEX_MARK_G)) {
    if (occupied[m.index]) continue;
    let start = m.index;
    let end = m.index + m[0].length;
    while (start > 0 && !stop.has(prose[start - 1])) {
      if ('.)]'.includes(prose[start - 1]) && start - 1 > 0 && stop.has(prose[start - 2])) break;
      start--;
    }
    while (end < prose.length && !stop.has(prose[end])) end++;
    const span = prose.slice(start, end);
    const raw = span.trim();
    if (LATEX_MARK.test(raw)) hits.push([start, start + span.trimEnd().length, raw]);
  }
  hits.sort((a, b) => a[0] - b[0] || a[1] - b[1] || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0));
  return hits;
}

/** Find every math chunk in already-unescaped text, unique and in order of appearance. */
export function extractChunks(text: string): Chunk[] {
  const occupied = new Array<boolean>(text.length).fill(false);
  const found: Chunk[] = [];
  const anyOccupied = (start: number, end: number): boolean => {
    for (let i = Math.max(0, start); i < Math.min(end, occupied.length); i++) {
      if (occupied[i]) return true;
    }
    return false;
  };
  const accept = (start: number, end: number, raw: string, kind: ChunkKind): void => {
    const ch = buildChunk(raw, start, kind);
    if (!ch) return;
    const e = Math.max(start + 1, end);
    if (!anyOccupied(start, e)) {
      for (let i = Math.max(0, start); i < Math.min(e, occupied.length); i++) occupied[i] = true;
    }
    found.push(ch);
  };

  for (const [kind, re] of DELIM_RES) {
    for (const m of text.matchAll(re)) {
      if (anyOccupied(m.index, m.index + m[0].length)) continue;
      accept(m.index, m.index + m[0].length, m[0], kind);
    }
  }

  const { prose, table, tableStart } = splitTable(text);
  for (const [start, end, raw] of findBareInProse(prose)) {
    if (anyOccupied(start, end)) continue;
    accept(start, end, raw, 'bare');
  }
  if (table) {
    for (const [cellStart, cell] of tableCells(table, tableStart)) {
      for (const unit of formulaUnits(cell)) {
        const rel = cell.indexOf(unit);
        const start = cellStart + Math.max(0, rel);
        accept(start, start + unit.length, unit, 'cell');
      }
    }
  }

  found.sort((a, b) => a.start - b.start);

  const seen = new Set<string>();
  const seenUni = new Set<string>();
  const out: Chunk[] = [];
  for (const ch of found) {
    const key = normalizeKey(ch.repaired);
    if (seen.has(key)) continue;
    seen.add(key);
    const uniKey = ch.unicode.replace(/\s+/g, '');
    if (seenUni.has(uniKey)) continue;
    seenUni.add(uniKey);
    out.push(ch);
  }
  return out;
}

// --- Reply formatting ---------------------------------------------------------

export const REPLY_HEADER = "**Here's the math in readable form:**";
export const REPLY_FOOTER = "^(I'm a bot. Conversions are automatic and may be imperfect.)";
export const REPLY_MAX_CHARS = 10_000;

/** A lone letter or number (`u`, `G`, `2`) says nothing worth a line. */
export function isTrivial(ch: Chunk): boolean {
  return /^(?:[A-Za-z]|\d+(?:\.\d+)?)$/.test(ch.inner.trim());
}

/** Source shown on the left of a line: delimiters stripped, whitespace collapsed. */
export function displaySource(ch: Chunk): string {
  const src = DELIMITED.has(ch.kind) ? ch.inner : ch.raw;
  return src.replace(/\s+/g, ' ').trim();
}

/** Wrap text in a code span whose fence is longer than any backtick run inside it. */
export function codeSpan(text: string): string {
  const runs = text.match(/`+/g) ?? [];
  const longest = runs.reduce((n, r) => Math.max(n, r.length), 0);
  const fence = '`'.repeat(longest + 1);
  const pad = longest > 0 ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

/** Escape Reddit markdown so converted text renders literally (e.g. `^(cl)` is not a superscript). */
export function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_^~[\]]/g, '\\$&');
}

export function formatLine(ch: Chunk): string {
  const uni = ch.unicode.replace(/\s+/g, ' ').trim();
  return `- ${codeSpan(displaySource(ch))} → ${escapeMarkdown(uni)}`;
}

export interface MathReply {
  text: string;
  /** Lines included in the reply. */
  shown: number;
  /** Lines dropped to stay under the comment limit. */
  omitted: number;
}

/**
 * Build the reply for a post body (raw Reddit markdown). Returns null when the
 * post has no non-trivial math.
 */
export function buildMathReply(body: string, maxChars = REPLY_MAX_CHARS): MathReply | null {
  const chunks = extractChunks(unescapeRedditMd(body)).filter((ch) => !isTrivial(ch));
  if (chunks.length === 0) return null;
  const lines = chunks.map(formatLine);
  const assemble = (shown: string[], omitted: number): string => {
    const parts = [REPLY_HEADER, '', ...shown];
    if (omitted > 0) {
      parts.push('', `…and ${omitted} more ${omitted === 1 ? 'expression was' : 'expressions were'} omitted to fit Reddit's comment limit.`);
    }
    parts.push('', REPLY_FOOTER);
    return parts.join('\n');
  };
  const full = assemble(lines, 0);
  if (full.length < maxChars) return { text: full, shown: lines.length, omitted: 0 };
  let shown = lines.length;
  while (shown > 0 && assemble(lines.slice(0, shown), lines.length - shown).length >= maxChars) {
    shown--;
  }
  return { text: assemble(lines.slice(0, shown), lines.length - shown), shown, omitted: lines.length - shown };
}
