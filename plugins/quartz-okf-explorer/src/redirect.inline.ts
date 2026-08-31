import { legacyRedirect } from "../lib/url-state.ts"

// The standalone explorer page of 002/003 lives on in links: it forwards to the in-page one.
location.replace(legacyRedirect(location.search))
