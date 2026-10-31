import assert from 'node:assert/strict';
import { resolveDoiUrl, zenodoRecordIdFromUrl } from './url-resolution.mjs';

async function run() {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url === 'https://doi.org/10.5281/zenodo.1234567') {
      return {
        status: 303,
        ok: false,
        headers: new Headers({ location: 'https://zenodo.org/record/1234567' }),
        url,
      };
    }
    if (url === 'https://zenodo.org/record/1234567') {
      return {
        status: 200,
        ok: true,
        headers: new Headers(),
        url: 'https://zenodo.org/records/1234567',
      };
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const resolved = await resolveDoiUrl('https://doi.org/10.5281/zenodo.1234567', fetchImpl);

  assert.equal(resolved, 'https://zenodo.org/records/1234567');
  assert.deepEqual(calls.map(c => c.url), [
    'https://doi.org/10.5281/zenodo.1234567',
    'https://zenodo.org/record/1234567',
  ]);
  assert.equal(calls[0].options.redirect, 'manual');
  assert.equal(calls[0].options.headers.Accept, 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8');

  assert.equal(zenodoRecordIdFromUrl('https://zenodo.org/records/1234567'), '1234567');
  assert.equal(zenodoRecordIdFromUrl('https://zenodo.org/record/1234567'), '1234567');
  assert.equal(zenodoRecordIdFromUrl('https://zenodo.org/api/records/1234567'), '1234567');
  assert.equal(zenodoRecordIdFromUrl('https://example.com/record/1234567'), null);

  const failedResolution = await resolveDoiUrl('https://doi.org/10.5555/bad-doi', async url => ({
    status: 500,
    ok: false,
    headers: new Headers(),
    url,
  }));
  assert.equal(failedResolution, null);
}

run()
  .then(() => console.log('All DOI URL resolution tests passed.'))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
