// jsdom doesn't implement window.scrollTo, which TanStack Router's scroll
// restoration calls on every navigation — every routed test would otherwise
// log a "Not implemented" error for it.
window.scrollTo = () => {}
