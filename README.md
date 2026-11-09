# Haber — "Nuestros ingresos"

The app is shown to its user as **Nuestros ingresos** (her choice); the project, repo, package and
IndexedDB name stay **Haber** so existing data keeps working. See `docs/04-functional-set-2.md`.

Ingresos, gastos de propiedades, inversiones y patrimonio familiar. Local-first PWA: los datos quedan en el
navegador (IndexedDB), sin cuentas ni servidores.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest)
npm run build      # → dist/
```

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` runs tests, builds and publishes `dist/` on every push to `main` (or by hand from
the Actions tab). One-time setup in the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

The build is path-agnostic (`base: './'` + `HashRouter`), so it works at `https://<user>.github.io/<repo>/`
with no SPA 404 fallback.

Docs: `docs/STATUS.md` first, then `docs/01-decisions.md` and `docs/02-architecture.md`.
