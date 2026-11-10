import { Router, createRouter } from "@solidjs/router"
import { BASE } from "./base"

const source = () => ({
  value: (location.pathname.startsWith(BASE + "/") ? location.pathname.slice(BASE.length) : "/") + location.search + location.hash,
  state: history.state,
})

/**
 * The address bar with the app's path (see base.ts); opencode's routes and route checks see paths from the root. It has
 * no click handling of its own: a link is a full load of the right address, and the study hides opencode's navigation.
 */
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
