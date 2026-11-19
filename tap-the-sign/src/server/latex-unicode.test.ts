import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  REPLY_FOOTER,
  REPLY_HEADER,
  buildMathReply,
  codeSpan,
  convertLatex,
  escapeMarkdown,
  extractChunks,
  repairLatex,
  unescapeRedditMd,
} from './latex-unicode';

const fixture = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), 'utf8');

describe('convertLatex', () => {
  const cases: Array<[string, string]> = [
    [String.raw`S^{3}`, 'S³'],
    [String.raw`\Sigma = T^2`, 'Σ = T²'],
    [String.raw`\psi_+, \psi_-`, 'ψ₊, ψ₋'],
    [String.raw`E \ll \sqrt{2\lambda}`, 'E ≪ √(2λ)'],
    [String.raw`\pi_1(S^1) = \mathbb{Z}`, 'π₁(S¹) = ℤ'],
    [String.raw`(n_+, n_-) = (1, -1)`, '(n₊, n₋) = (1, −1)'],
    [String.raw`\pi_1(\text{Maps}_1(S^3, S^3)) = \mathbb{Z}_2`, 'π₁(Maps₁(S³, S³)) = ℤ₂'],
    [String.raw`G \propto e^{-S_{\text{cl}}}`, 'G ∝ e^(−S_(cl))'],
    [String.raw`T^2 \subset S^3`, 'T² ⊂ S³'],
    [String.raw`\chi = \frac{\pi}{4}`, 'χ = π/4'],
    [String.raw`\frac{3}{4}(A + u)`, '3/4 (A + u)'],
    [String.raw`\frac{\hbar c}{m_e^{2}}`, '(ℏc)/(mₑ²)'],
    [String.raw`\frac{1}{2\pi}\oint_C d\theta = n \in \mathbb{Z}`, '1/(2π) ∮_(C) dθ = n ∈ ℤ'],
    [String.raw`R(2\pi) = -1`, 'R(2π) = −1'],
    [String.raw`\Delta u < \frac{g^{3}}{12h^{2}}`, 'Δu < g³/(12h²)'],
  ];
  it.each(cases)('%s', (src, expected) => {
    expect(convertLatex(src)).toBe(expected);
  });
});

describe('repairLatex + convertLatex', () => {
  const cases: Array<[string, string]> = [
    [String.raw`m_v^(2) = 2\lambda > 0`, 'mᵥ² = 2λ > 0'],
    [String.raw`m_\gamma < 10^({-18},\mathrm{eV}/c2)`, 'm_(γ) < 10⁻¹⁸ eV/c²'],
    [
      String.raw`G_{\mathrm{pred}} = \frac{\hbar c}{m_e^(2}) e^({-S_{\mathrm{cl}}})`,
      'G_(pred) = (ℏc)/(mₑ²) e^(−S_(cl))',
    ],
    [String.raw`3.97 \times 10^({-7})`, '3.97 × 10⁻⁷'],
    [
      String.raw`A = \pi + \pi^(2) + 4\pi^(3) - \frac{\gamma_E}{192\pi^(2}) \approx 137.03599878`,
      'A = π + π² + 4π³ − γ_(E)/(192π²) ≈ 137.03599878',
    ],
  ];
  it.each(cases)('%s', (src, expected) => {
    expect(convertLatex(repairLatex(src).repaired)).toBe(expected);
  });
});

describe('unescapeRedditMd', () => {
  it('fully unescapes rich-text-editor output', () => {
    expect(unescapeRedditMd(String.raw`\\(S\^{3}\\) and m\_e`)).toBe(String.raw`\(S^{3}\) and m_e`);
  });
  it('keeps LaTeX commands and delimiters in markdown-mode posts', () => {
    expect(unescapeRedditMd(String.raw`\(\frac{a}{b}\) and m\_e \* 2`)).toBe(
      String.raw`\(\frac{a}{b}\) and m_e * 2`,
    );
  });
});

describe('extractChunks', () => {
  it('reproduces the prototype on the Clifford-Seam post', () => {
    const expected = JSON.parse(fixture('clifford-seam.expected.json')) as Array<[string, string, string]>;
    const got = extractChunks(unescapeRedditMd(fixture('clifford-seam.md'))).map((c) => [
      c.kind,
      c.raw,
      c.unicode,
    ]);
    expect(got).toEqual(expected);
  });

  it('finds $$, $, \\[ and \\( math in order and dedupes', () => {
    const text = String.raw`Energy $$E = mc^2$$ then \(\alpha\) and \[\sqrt{x_1}\] and again \(\alpha\) and $\beta_2$.`;
    expect(extractChunks(text).map((c) => c.unicode)).toEqual(['E = mc²', 'α', '√(x₁)', 'β₂']);
  });

  it('does not treat prices as math', () => {
    expect(extractChunks('It costs $5 and $10 today.')).toEqual([]);
  });
});

describe('buildMathReply', () => {
  it('formats the agreed reply and skips trivial chunks', () => {
    const body = String.raw`Let \\(u\\) be \\(\\frac{a}{b}\\) where \\(G\\) is \\(x\_1\\).`;
    const reply = buildMathReply(body);
    expect(reply?.text).toBe(
      [
        REPLY_HEADER,
        '',
        '- `\\frac{a}{b}` → a/b',
        '- `x_1` → x₁',
        '',
        REPLY_FOOTER,
      ].join('\n'),
    );
    expect(reply?.omitted).toBe(0);
  });

  it('returns null when there is only trivial or no math', () => {
    expect(buildMathReply(String.raw`Let \\(u\\) and \\(G\\) be 2.`)).toBeNull();
    expect(buildMathReply('No math here at all.')).toBeNull();
  });

  it('escapes markdown in the converted text', () => {
    const reply = buildMathReply(String.raw`\(e^{-S_{\text{cl}}}\)`);
    expect(reply?.text).toContain('→ e\\^(−S\\_(cl))');
  });

  it('truncates and says how many were omitted', () => {
    const body = Array.from({ length: 400 }, (_, i) => String.raw`\(x_{${i}} = \alpha^{${i}} + \beta\)`).join(' ');
    const reply = buildMathReply(body);
    expect(reply).not.toBeNull();
    expect(reply!.text.length).toBeLessThan(10_000);
    expect(reply!.omitted).toBeGreaterThan(0);
    expect(reply!.shown + reply!.omitted).toBe(400);
    expect(reply!.text).toContain(`…and ${reply!.omitted} more expressions were omitted`);
    expect(reply!.text.endsWith(REPLY_FOOTER)).toBe(true);
  });

  it('builds the Clifford-Seam reply within the limit', () => {
    const reply = buildMathReply(fixture('clifford-seam.md'));
    expect(reply).not.toBeNull();
    expect(reply!.omitted).toBe(0);
    // 39 chunks minus the trivial u, v and G.
    expect(reply!.shown).toBe(36);
    expect(reply!.text).toContain('- `\\pi_1(S^1) = \\mathbb{Z}` → π₁(S¹) = ℤ');
  });
});

describe('helpers', () => {
  it('lengthens the code fence around backticks', () => {
    expect(codeSpan('a`b')).toBe('`` a`b ``');
    expect(codeSpan('ab')).toBe('`ab`');
  });
  it('escapes Reddit markdown specials', () => {
    expect(escapeMarkdown('a*b_c^d~e[f]\\`')).toBe('a\\*b\\_c\\^d\\~e\\[f\\]\\\\\\`');
  });
});
