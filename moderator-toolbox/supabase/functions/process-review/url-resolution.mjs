const DOI_HOST_RE = /^(?:dx\.)?doi\.org$/i;
const DOI_ACCEPT_HEADER = 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8';

function doiResolverUrlFromUrl(inputUrl) {
  let parsed;
  try {
    parsed = new URL(inputUrl);
  } catch {
    return null;
  }

  if (!DOI_HOST_RE.test(parsed.hostname)) return null;

  const doi = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (!doi.toLowerCase().startsWith('10.')) return null;

  return `https://doi.org/${doi}`;
}

export async function resolveDoiUrl(inputUrl, fetchImpl = fetch) {
  const startUrl = doiResolverUrlFromUrl(inputUrl);
  if (!startUrl) return null;

  let currentUrl = startUrl;
  for (let i = 0; i < 5; i++) {
    const res = await fetchImpl(currentUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: { Accept: DOI_ACCEPT_HEADER },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return res.url || currentUrl;
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!res.ok) return null;
    return res.url || currentUrl;
  }

  throw new Error(`DOI redirect chain exceeded 5 hops: ${startUrl}`);
}

export function zenodoRecordIdFromUrl(inputUrl) {
  let parsed;
  try {
    parsed = new URL(inputUrl);
  } catch {
    return null;
  }

  if (parsed.hostname.toLowerCase() !== 'zenodo.org') return null;

  const match = parsed.pathname.match(/^\/(?:api\/)?records?\/(\d+)(?:\/|$)/);
  return match?.[1] ?? null;
}
