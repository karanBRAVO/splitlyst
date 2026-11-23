/** The caller's IP as set by the proxy (Vercel overwrites x-forwarded-for), or "unknown". */
export function clientIp(req: { headers: Headers }): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    'unknown'
  );
}
