import { describe, expect, it } from 'vitest';
import { isPrivateOrReservedIp, validateMonitorTargetUrl } from '../src/ssrf';

describe('SSRF protection (isPrivateOrReservedIp & validateMonitorTargetUrl)', () => {
  it('detects private, loopback, CGNAT, link-local, and IPv4-mapped IPv6 addresses', () => {
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('10.0.0.5')).toBe(true);
    expect(isPrivateOrReservedIp('172.16.10.1')).toBe(true);
    expect(isPrivateOrReservedIp('192.168.1.100')).toBe(true);
    expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true);
    expect(isPrivateOrReservedIp('100.64.1.1')).toBe(true);
    expect(isPrivateOrReservedIp('::1')).toBe(true);
    expect(isPrivateOrReservedIp('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('fe80::1')).toBe(true);
    expect(isPrivateOrReservedIp('223.5.5.5')).toBe(false);
    expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false);
  });

  it('rejects non-http protocols, embedded credentials, localhost, and metadata IPs', async () => {
    expect((await validateMonitorTargetUrl('file:///etc/passwd')).ok).toBe(false);
    expect((await validateMonitorTargetUrl('https://user:pass@example.com')).ok).toBe(false);
    expect((await validateMonitorTargetUrl('http://localhost:8082/api/health')).ok).toBe(false);
    expect((await validateMonitorTargetUrl('http://127.0.0.1:8082/api/health')).ok).toBe(false);
    expect((await validateMonitorTargetUrl('http://169.254.169.254/latest/meta-data/')).ok).toBe(false);
    expect((await validateMonitorTargetUrl('http://metadata.tencentyun.com/latest/')).ok).toBe(false);
  });

  it('allows public IPv4 HTTPS endpoint', async () => {
    const res = await validateMonitorTargetUrl('https://1.1.1.1/');
    expect(res.ok).toBe(true);
  });
});
