// Behind a study platform the app lives under /study/<study>/<user>/, but opencode assumes the origin root: prefix
// its requests here. Imported first, before anything keeps a reference to fetch or WebSocket.

export const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

const SERVER_PATH = /^\/(api|auth|_study)(\/|$)/

export function withBase(url: string) {
  const u = new URL(url, location.href)
  if (u.host !== location.host || !SERVER_PATH.test(u.pathname)) return url
  u.pathname = BASE + u.pathname
  return u.href
}

// The body is read first: passing the request's own makes it a stream, which browsers refuse over HTTP/1.1.
async function moved(request: Request, url: string) {
  const { method, headers, signal, credentials, redirect, keepalive } = request
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer()
  return new Request(url, { method, headers, body, signal, credentials, redirect, keepalive })
}

if (BASE) {
  const nativeFetch = window.fetch.bind(window)
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!(input instanceof Request)) return nativeFetch(withBase(String(input)), init)
    const url = withBase(input.url)
    return nativeFetch(url === input.url ? input : await moved(input, url), init)
  }) as typeof fetch
  const NativeSocket = window.WebSocket
  window.WebSocket = class extends NativeSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(withBase(String(url)), protocols)
    }
  } as typeof WebSocket
}
