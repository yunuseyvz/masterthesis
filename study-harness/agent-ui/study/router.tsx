import { Router, createRouter } from "@solidjs/router"
import { BASE } from "./base"

const source = () => ({
  value: (location.pathname.startsWith(BASE + "/") ? location.pathname.slice(BASE.length) : "/") + location.search + location.hash,
  state: history.state,
})

// Address bar with the app's path (see base.ts). No click handling: links are full loads.
export const StudyRouter: typeof Router = BASE
  ? (props) =>
      createRouter({
        get: source,
        set({ value, replace, state }) {
          if (replace) history.replaceState(state, "", BASE + value)
          else history.pushState(state, "", BASE + value)
        },
        init(notify) {
          const onPop = () => notify()
          window.addEventListener("popstate", onPop)
          return () => window.removeEventListener("popstate", onPop)
        },
        utils: {
          go: (delta) => history.go(delta),
          renderPath: (path) => BASE + path,
          parsePath: (path) => (path.startsWith(BASE + "/") ? path.slice(BASE.length) : path),
        },
      })(props)
  : Router
