import dns from 'node:dns';
import net from 'node:net';

const dnsPromises = dns.promises;
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'instance-data',
]);

const publicUrlError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const stripIpv6Brackets = (hostname) => hostname.replace(/^\[|\]$/g, '');
const isPublicIpv4 = (address) => {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = octets;
  return !(
    a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0 && c === 0)
    || (a === 192 && b === 0 && c === 2)
    || (a === 192 && b === 88 && c === 99)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113)
    || a >= 224
  );
};

const parseIpv6 = (address) => {
  let normalized = address.toLowerCase().split('%')[0];
  if (normalized.includes('.')) {
    const lastColon = normalized.lastIndexOf(':');
    const ipv4 = normalized.slice(lastColon + 1);
    if (net.isIP(ipv4) !== 4) throw new Error('Invalid embedded IPv4 address');
    const parts = ipv4.split('.').map(Number);
    normalized = `${normalized.slice(0, lastColon)}:${((parts[0] << 8) | parts[1]).toString(16)}:${((parts[2] << 8) | parts[3]).toString(16)}`;
  }
  const halves = normalized.split('::');
  if (halves.length > 2) throw new Error('Invalid IPv6 address');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) throw new Error('Invalid IPv6 address');
  const groups = [...left, ...Array(Math.max(missing, 0)).fill('0'), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[\da-f]{1,4}$/.test(group))) throw new Error('Invalid IPv6 address');
  return groups.reduce((result, group) => (result << 16n) | BigInt(`0x${group}`), 0n);
};

const hasIpv6Prefix = (value, prefix, bits) => {
  const shift = 128n - BigInt(bits);
  return (value >> shift) === (prefix >> shift);
};

const IPV6_PREFIXES = {
  globalUnicast: parseIpv6('2000::'),
  mappedIpv4: parseIpv6('::ffff:0:0'),
  teredo: parseIpv6('2001::'),
  orchid: parseIpv6('2001:10::'),
  orchidV2: parseIpv6('2001:20::'),
  documentation: parseIpv6('2001:db8::'),
  sixToFour: parseIpv6('2002::'),
  documentationV2: parseIpv6('3fff::'),
};

export const isPublicIpAddress = (address) => {
  try {
    const normalized = stripIpv6Brackets(String(address || '').trim());
    const family = net.isIP(normalized);
    if (family === 4) return isPublicIpv4(normalized);
    if (family !== 6) return false;
    const parsed = parseIpv6(normalized);
    if (hasIpv6Prefix(parsed, IPV6_PREFIXES.mappedIpv4, 96)) {
      const ipv4Value = Number(parsed & 0xffffffffn);
      return isPublicIpv4([
        (ipv4Value >>> 24) & 255,
        (ipv4Value >>> 16) & 255,
        (ipv4Value >>> 8) & 255,
        ipv4Value & 255,
      ].join('.'));
    }
    if (!hasIpv6Prefix(parsed, IPV6_PREFIXES.globalUnicast, 3)) return false;
    return !(
      hasIpv6Prefix(parsed, IPV6_PREFIXES.teredo, 32)
      || hasIpv6Prefix(parsed, IPV6_PREFIXES.orchid, 28)
      || hasIpv6Prefix(parsed, IPV6_PREFIXES.orchidV2, 28)
      || hasIpv6Prefix(parsed, IPV6_PREFIXES.documentation, 32)
      || hasIpv6Prefix(parsed, IPV6_PREFIXES.sixToFour, 16)
      || hasIpv6Prefix(parsed, IPV6_PREFIXES.documentationV2, 20)
    );
  } catch {
    return false;
  }
};

const isBlockedHostname = (hostname) => {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  return BLOCKED_HOSTNAMES.has(normalized)
    || normalized.endsWith('.localhost')
    || normalized.endsWith('.local')
    || normalized.endsWith('.internal');
};

export const normalizeWebsiteUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) throw publicUrlError('Website URL is required');
  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw publicUrlError('Enter a valid website URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw publicUrlError('Only HTTP and HTTPS website URLs are allowed');
  }
  if (parsed.username || parsed.password) {
    throw publicUrlError('Website URLs containing credentials are not allowed');
  }
  if (!parsed.hostname || isBlockedHostname(parsed.hostname)) {
    throw publicUrlError('This website host is not allowed');
  }
  parsed.hash = '';
  return parsed;
};

export const validatePublicUrl = async (value) => {
  const parsed = value instanceof URL ? normalizeWebsiteUrl(value.href) : normalizeWebsiteUrl(value);
  const hostname = stripIpv6Brackets(parsed.hostname);
  if (net.isIP(hostname)) {
    if (!isPublicIpAddress(hostname)) throw publicUrlError('Private or reserved network addresses are not allowed');
    return parsed;
  }

  let addresses;
  try {
    addresses = await dnsPromises.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw publicUrlError('The website hostname could not be resolved');
  }
  if (!addresses.length || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw publicUrlError('The website resolves to a private or reserved network address');
  }
  return parsed;
};

export const normalizeDomain = (value) => {
  const parsed = normalizeWebsiteUrl(value);
  return parsed.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
};

// Validate the address used by Node at connection time as well as during the
// initial URL check. This closes the usual DNS-rebinding gap for Axios calls.
export const safeDnsLookup = (hostname, options, callback) => {
  const requested = typeof options === 'object' ? options : {};
  dns.lookup(hostname, {
    family: requested.family || 0,
    all: true,
    verbatim: true,
  }, (error, addresses) => {
    if (error) return callback(error);
    if (!addresses?.length || addresses.some(({ address }) => !isPublicIpAddress(address))) {
      return callback(publicUrlError('Blocked private or reserved network destination'));
    }
    if (requested.all) return callback(null, addresses);
    return callback(null, addresses[0].address, addresses[0].family);
  });
};
