import { describe, expect, it } from 'vitest';
import { mergeRows, parsePage } from '../../../supabase/functions/sync-predatory-watchlist/parse.mjs';
import { SOURCE_GROUPS, assertAllowedSource } from '../../../supabase/functions/sync-predatory-watchlist/sources.mjs';

const RETRACTION_FIXTURE = `
"First created: May 30, 2022",,,,
,Hijacked Journal Title,URL (Hijacked),ISSN (Hijacked),Original journal,ISSN (Original), URL (Original Journal)
1,Adalya,http://www.adalyajournal.com/,1301-2746,Adalya,1301-2746,https://real-adalya.example/
2,"Quoted, Title","https://hijack.example/a,b",1234-5678,Legit Journal,9999-9999,https://legit.example/journal
3,No URL,,0000-0000,Somewhere,0000-0000,https://issn-trap.example/
4,Public suffix,https://co.uk/,1111-1111,Nope,1111-1111,https://original.example/
`.trim();

const PUBLISHER_FIXTURE = `
<ul id="menu-main"><li><a href="https://menu-trap.example/">Publishers</a></li></ul>
<div class="entry-content">
<ul>
<li><a href="http://www.omicsonline.org/">OMICS Publishing Group</a></li>
<li><a href="http://predatory.example/">Predatory Press</a> (see <a href="https://doaj.org/abc">DOAJ</a>, also <a href="http://alt.predatory.example/">here</a>)</li>
<li><a href="https://en.wikipedia.org/wiki/Jeffrey_Beall">Wikipedia</a></li>
<li>Name only, no site</li>
</ul>
<footer id="colophon">
<a href="https://footer-trap.example/">footer</a>
`;

const STANDALONE_FIXTURE = `
<div class="entry-content">
<ul>
<li><a href="http://www.colopos.mx/">Agrociencia</a> &#8211; hijacker of the legitimate journal <a href="https://agrociencia-colpos.mx/index.php/agrociencia">Agrociencia</a></li>
<li><a href="http://anncaserep.com/">Annals of Clinical Case Reports</a> (also <a href="http://mirror.example/">here</a>)</li>
</ul>
<footer>
`;

const HIJACKED_FIXTURE = `
<div class="entry-content">
<table>
<tr><td><strong>Hijacker/Predatory Journal</strong></td><td><strong>Authentic Journal</strong></td></tr>
<tr>
  <td><a href="http://adalyajournal.com/">Adalya Journal</a> also <a href="http://adalya-alt.example/">here</a></td>
  <td><a href="https://real-adalya.example/journal">Adalya</a></td>
</tr>
<tr>
  <td><a href="https://beallslist.weebly.com/u">Placeholder</a></td>
  <td><a href="https://authentic.example/">Authentic</a></td>
</tr>
</table>
<footer>
`;

describe('predatory watchlist parsers', () => {
  it('reads only the hijacked URL column from the Retraction Watch sheet', () => {
    const rows = parsePage('retraction-watch-csv', 'hijacked', RETRACTION_FIXTURE);
    expect(rows).toEqual([
      { domain: 'adalyajournal.com', name: 'Adalya', listType: 'hijacked' },
      { domain: 'hijack.example', name: 'Quoted, Title', listType: 'hijacked' },
    ]);
    expect(JSON.stringify(rows)).not.toContain('real-adalya');
    expect(JSON.stringify(rows)).not.toContain('legit.example');
    expect(JSON.stringify(rows)).not.toContain('issn-trap');
    expect(JSON.stringify(rows)).not.toContain('1301-2746');
  });

  it('parses Beall publisher and standalone names, keeping alternate links and dropping reference or legitimate-journal links', () => {
    const publishers = parsePage('bealls-list', 'publisher', PUBLISHER_FIXTURE);
    expect(publishers.map((row: { domain: string }) => row.domain)).toEqual([
      'omicsonline.org',
      'predatory.example',
      'alt.predatory.example',
    ]);
    expect(publishers[0]).toMatchObject({ name: 'OMICS Publishing Group', listType: 'publisher' });

    const standalone = parsePage('bealls-list', 'standalone', STANDALONE_FIXTURE);
    expect(standalone.map((row: { domain: string }) => row.domain)).toEqual([
      'colopos.mx',
      'anncaserep.com',
      'mirror.example',
    ]);
    expect(JSON.stringify(standalone)).not.toContain('agrociencia-colpos');
  });

  it('reads only the hijacker column of Beall hijacked-journal tables', () => {
    const rows = parsePage('bealls-hijacked', 'hijacked', HIJACKED_FIXTURE);
    expect(rows.map((row: { domain: string }) => row.domain)).toEqual([
      'adalyajournal.com',
      'adalya-alt.example',
    ]);
    expect(JSON.stringify(rows)).not.toContain('real-adalya');
    expect(JSON.stringify(rows)).not.toContain('authentic.example');
  });

  it('prefers a hijacked row when the same domain is also listed as a publisher', () => {
    const merged = mergeRows([
      { domain: 'adalya.example', name: 'Some Press', listType: 'publisher' },
      { domain: 'adalya.example', name: 'Adalya', listType: 'hijacked' },
    ]);
    expect(merged).toEqual([{ domain: 'adalya.example', name: 'Adalya', listType: 'hijacked' }]);
  });
});

describe('watchlist source registry', () => {
  it('ships Retraction Watch and Beall pages only, and refuses blocked lists', () => {
    const urls = SOURCE_GROUPS.flatMap((group: { pages: Array<{ url: string }>; sourceUrl: string }) => [
      group.sourceUrl,
      ...group.pages.map((page) => page.url),
    ]);
    expect(urls).toContain('https://docs.google.com/spreadsheets/d/1ak985WGOgGbJRJbZFanoktAN_UFeExpE/export?format=csv');
    expect(urls).toContain('https://beallslist.net/');
    expect(urls).toContain('https://beallslist.net/standalone-journals/');
    expect(urls).toContain('https://beallslist.net/hijacked-journals/');
    expect(urls.join(' ')).not.toMatch(/kscien|predatoryjournals\.org|predatoryreports\.org/i);
    for (const url of urls) expect(() => assertAllowedSource(url)).not.toThrow();
    expect(() => assertAllowedSource('https://predatoryjournals.org/list')).toThrow(/blocked/i);
    expect(() => parsePage('kscien', 'publisher', '')).toThrow(/unknown/i);
  });
});
