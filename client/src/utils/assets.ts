/**
 * Builds a URL for a file in `public/`, respecting the deploy base path.
 *
 * A hardcoded absolute path like `/assets/logo.png` only works when the site is
 * served from the domain root. GitHub Pages serves this project from
 * `/CGJTWC/`, so absolute paths would 404 there. Vite exposes the configured
 * base as `import.meta.env.BASE_URL`, which is '/' for a root deployment and
 * '/CGJTWC/' for Pages, so routing every public asset through this helper keeps
 * one build working in both places.
 */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}
