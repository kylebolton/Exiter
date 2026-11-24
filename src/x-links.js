const X_HOSTS = new Set(['x.com', 'www.x.com', 'mobile.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com']);

function xLinkDestination(value) {
  if (typeof value !== 'string' || value.length > 20_000) return null;
  let url;
  try {
    url = new URL(value);
    if (url.protocol === 'exiter:') {
      if (url.host !== 'open' || (url.pathname && url.pathname !== '/') || url.hash || url.username || url.password) return null;
      const targets = url.searchParams.getAll('url');
      if (targets.length !== 1) return null;
      url = new URL(targets[0]);
    }
  } catch {
    return null;
  }
  if (!['https:', 'http:'].includes(url.protocol) || !X_HOSTS.has(url.hostname) ||
      url.username || url.password || url.port) return null;
  url.protocol = 'https:';
  url.hostname = 'x.com';
  return url.href;
}

function xLinkFromArguments(args) {
  for (const arg of [...args].reverse()) {
    if (!arg.startsWith('exiter:')) continue;
    const destination = xLinkDestination(arg);
    if (destination) return destination;
  }
  return null;
}

module.exports = { xLinkDestination, xLinkFromArguments };
