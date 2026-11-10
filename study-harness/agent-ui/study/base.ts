/**
 * Behind a study platform the app lives under a path of its own (/study/<study>/<user>/), but opencode assumes the root
 * of its origin: its API paths, its server key and its route checks all do. So opencode goes on thinking it is at the
 * root, and requests to the server get the path here; `router.tsx` does the same for the address bar. Imported first,
 * before anything can keep a reference to fetch or WebSocket.
 */

/** The app's path without the trailing slash; empty at the root. The server sets it when it starts (setBasePath). */
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

const SERVER_PATH = /^\/(api|auth|_study)(\/|$)/

/** A URL of the study server, with the app's path; anything else as it is. */
export function withBase(url: string) {
  const u = new URL(url, location.href)
  if (u.host !== location.host || !SERVER_PATH.test(u.pathname)) return url
  u.pathname = BASE + u.pathname
  return u.href
}

/**
 * The same request at another URL. The body is read first: passing the request's own would make it a stream, and
 * browsers refuse to upload a stream over HTTP/1.1.
 */
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
