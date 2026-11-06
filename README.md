# Haber

Ingresos, gastos de propiedades, inversiones y patrimonio familiar. Local-first PWA: los datos quedan en el
navegador (IndexedDB), sin cuentas ni servidores.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest)
npm run build      # → dist/
```

## Deploy (GitHub Pages)

The build is path-agnostic (`base: './'` + `HashRouter`), so `dist/` can be published as-is to
`https://<user>.github.io/<repo>/` — e.g. with the `actions/deploy-pages` workflow or by pushing `dist/` to a
`gh-pages` branch. No SPA 404 fallback needed.

Docs: `docs/STATUS.md` first, then `docs/01-decisions.md` and `docs/02-architecture.md`.
