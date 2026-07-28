// VITE_DISABLE_REACT_SCAN: the toolbar's overlay intercepts pointer events,
// which breaks automated (Playwright) runs against the dev server.
if (import.meta.env.DEV && !import.meta.env.VITE_DISABLE_REACT_SCAN) {
  const { scan, setOptions } = await import("react-scan")
  const desktopViewport = window.matchMedia("(min-width: 1024px)")
  scan({ enabled: false, log: false, showToolbar: desktopViewport.matches })
  desktopViewport.addEventListener("change", (event) => {
    setOptions({ showToolbar: event.matches })
  })
}
