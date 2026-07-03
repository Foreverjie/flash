// VITE_DISABLE_REACT_SCAN: the toolbar's overlay intercepts pointer events,
// which breaks automated (Playwright) runs against the dev server.
if (import.meta.env.DEV && !import.meta.env.VITE_DISABLE_REACT_SCAN) {
  const { scan } = await import("react-scan")
  scan({ enabled: false, log: false, showToolbar: true })
}
