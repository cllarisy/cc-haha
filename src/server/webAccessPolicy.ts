/** Native-machine controls that an authenticated remote browser must never invoke. */
export function isRemoteWebCapabilityDenied(req: Request, url: URL): boolean {
  if (url.pathname.startsWith('/api/open-targets')) return true
  if (url.pathname.startsWith('/api/computer-use')) return true
  if (matchesPathOrChild(url.pathname, '/api/doctor/repair')) return true
  if (url.pathname.startsWith('/api/adapters') && req.method !== 'GET') return true
  if (matchesPathOrChild(url.pathname, '/api/desktop-ui/preferences/pet') && req.method !== 'GET') return true
  return false
}

function matchesPathOrChild(pathname: string, basePath: string): boolean {
  return pathname === basePath || pathname.startsWith(`${basePath}/`)
}

export function remoteWebCapabilityDeniedResponse(): Response {
  return Response.json({
    error: 'Forbidden',
    message: 'This native-machine capability is available only to the local desktop app.',
  }, { status: 403 })
}
