import dns from 'node:dns/promises';
import net from 'node:net';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata.tencentyun.com',
  '169.254.169.254',
  '0.0.0.0',
]);

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inCidr4(ipInt: number, base: string, prefixLen: number): boolean {
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  return (ipInt & mask) === (ipv4ToInt(base) & mask);
}

export function isPrivateOrReservedIp(rawIp: string): boolean {
  const ip = rawIp.trim().toLowerCase().split('%')[0];
  const version = net.isIP(ip);

  if (version === 4) {
    const n = ipv4ToInt(ip);
    return (
      inCidr4(n, '0.0.0.0', 8) ||       // "this" network
      inCidr4(n, '10.0.0.0', 8) ||      // RFC1918
      inCidr4(n, '100.64.0.0', 10) ||   // CGNAT
      inCidr4(n, '127.0.0.0', 8) ||     // Loopback
      inCidr4(n, '169.254.0.0', 16) ||  // Link-local / Cloud metadata
      inCidr4(n, '172.16.0.0', 12) ||   // RFC1918
      inCidr4(n, '192.0.0.0', 24) ||    // IETF protocol
      inCidr4(n, '192.0.2.0', 24) ||    // TEST-NET-1
      inCidr4(n, '192.168.0.0', 16) ||  // RFC1918
      inCidr4(n, '198.18.0.0', 15) ||   // Benchmarking / Clash fake-ip
      inCidr4(n, '198.51.100.0', 24) || // TEST-NET-2
      inCidr4(n, '203.0.113.0', 24) ||  // TEST-NET-3
      inCidr4(n, '224.0.0.0', 4) ||     // Multicast
      inCidr4(n, '240.0.0.0', 4)        // Reserved / broadcast
    );
  }

  if (version === 6) {
    if (ip === '::' || ip === '::1') return true;
    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
    if (ip.startsWith('::ffff:')) {
      const mapped = ip.slice(7);
      if (net.isIP(mapped) === 4) {
        return isPrivateOrReservedIp(mapped);
      }
      const hexParts = mapped.split(':');
      if (hexParts.length === 2) {
        const hi = parseInt(hexParts[0], 16);
        const lo = parseInt(hexParts[1], 16);
        if (!Number.isNaN(hi) && !Number.isNaN(lo)) {
          const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
          return isPrivateOrReservedIp(ipv4);
        }
      }
      return true;
    }
    // Unique local (fc00::/7) and link-local (fe80::/10)
    const firstHextet = parseInt(ip.split(':')[0] || '0', 16);
    if ((firstHextet & 0xfe00) === 0xfc00) return true;
    if ((firstHextet & 0xffc0) === 0xfe80) return true;
    if ((firstHextet & 0xff00) === 0xff00) return true; // Multicast
    return false;
  }

  return true;
}

export async function validateMonitorTargetUrl(
  rawUrl: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: '无效的 URL 格式' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: '仅支持 http:// 或 https:// 协议端点' };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: '安全拦截：禁止在监控 URL 中携带认证凭据' };
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname) {
    return { ok: false, error: '无效的目标主机名' };
  }

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return { ok: false, error: `安全拦截：禁止探测内网或保留主机 (${hostname})` };
  }

  if (net.isIP(hostname) !== 0) {
    if (isPrivateOrReservedIp(hostname)) {
      return { ok: false, error: `安全拦截：禁止探测内网、回环或云元数据 IP (${hostname})` };
    }
    return { ok: true, url: parsed.toString() };
  }

  try {
    const records = await dns.lookup(hostname, { all: true });
    if (!records || records.length === 0) {
      return { ok: false, error: `目标域名解析失败 (${hostname})` };
    }
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        return {
          ok: false,
          error: `安全拦截：目标域名解析到受限内网地址 (${rec.address})`,
        };
      }
    }
  } catch {
    return { ok: false, error: `目标域名 DNS 解析失败 (${hostname})` };
  }

  return { ok: true, url: parsed.toString() };
}
