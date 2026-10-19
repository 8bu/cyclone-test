# Deployment

Back to [README.md](README.md). Related: [architecture.md](architecture.md).

The app is a static build deployed as a Cloudflare Worker with static assets, in single-page-application mode. There is no Worker script and no server code: the "backend" is MSW running in the browser ([architecture.md](architecture.md#why-msw-works-in-production-on-workers-static-assets)).

## Configuration: `wrangler.jsonc`

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "cyclone-portfolio",
  "compatibility_date": "2026-10-01",
  // Static assets only (no Worker script). SPA mode serves index.html for unknown paths.
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  },
  // Custom domain: Cloudflare creates the DNS record and certificate on deploy (zone 8bu.dev must be in this account).
  "routes": [{ "pattern": "cyclone.8bu.dev", "custom_domain": true }]
}
```

| Key | Meaning |
|---|---|
| `name` | Worker name. |
| `compatibility_date` | Workers runtime compatibility date. |
| `assets.directory` | The folder uploaded as static assets: the Vite build output `dist/`. |
| `assets.not_found_handling: "single-page-application"` | When a navigation request matches no asset, Cloudflare serves `index.html` instead of a 404. Without it, opening or refreshing a deep link would 404. The app has no client-side routes today, but the setting keeps any path working. |
| no `main` key | No Worker script runs. Cloudflare serves the assets directly. |
| `routes[].custom_domain: true` | Attaches the Worker to `cyclone.8bu.dev`. Wrangler creates the DNS record and TLS certificate on deploy. The zone `8bu.dev` must be in the same Cloudflare account. Setting `routes` turns off the default `workers.dev` URL, so the app is reachable only on the custom domain. |

There are no `vars`, secrets or bindings. The app has no environment variables.

### Why Workers static assets and not Pages

The project is deployed with `wrangler deploy` as a Worker with an `assets` directory. This gives one config file (`wrangler.jsonc`) and one command for deploy and for local preview (`wrangler dev`), and a script can be added later (for example a real API next to the assets) without changing the deployment model. Do not create a Pages project for this repository.

## Build and deploy

```sh
pnpm install
pnpm build     # tsc -b && vite build -> dist/
pnpm run deploy    # pnpm build && wrangler deploy
```

`pnpm run deploy` already runs the build, so it alone is enough. Use `run`: bare `pnpm deploy` is a built-in pnpm command and does not run this script. `wrangler` is a dev dependency; do not install it globally.

### Credentials

Credentials are never committed.

- Interactive: run `pnpm exec wrangler login` once on your machine. It opens a browser to authorize your Cloudflare account.
- CI or non-interactive: set the environment variable `CLOUDFLARE_API_TOKEN` (an API token with permission to edit Workers) in the CI secret store, and `CLOUDFLARE_ACCOUNT_ID` if the token can access more than one account. Then run `pnpm run deploy`.

After a successful deploy, Wrangler prints the custom domain (`cyclone.8bu.dev`).

## Local preview

```sh
pnpm preview:worker   # pnpm build && wrangler dev
```

This serves `dist/` through the Workers asset pipeline with the same `assets` config as production, so SPA fallback and the service worker file behave as they will when deployed. `pnpm preview` (`vite preview`) serves `dist/` with Vite's static server and is not a Workers check. `pnpm dev` runs the Vite dev server.

## The MSW service worker must ship in `dist`

The production app registers `/mockServiceWorker.js` at startup (`src/main.tsx`). The file lives in `public/`, and Vite copies everything in `public/` into `dist/` during `pnpm build`.

- Keep `public/mockServiceWorker.js` in the repository.
- After a build, `dist/mockServiceWorker.js` must exist. If it is missing, the worker cannot start, `/api/*` requests are not intercepted, and the app shows its "Could not load the portfolio" error state.
- `package.json` has `"msw": { "workerDirectory": ["public"] }`, which records where `msw init` writes the worker file. After upgrading `msw`, regenerate the file with `pnpm exec msw init public/` and commit it.
- The worker is served from the site root with the page's origin and scope `/`. No extra headers are configured for it.

## Checklist before deploy

1. `pnpm test`
2. `pnpm lint`
3. `pnpm build` (runs `tsc -b` first, then the Vite build)
4. Optionally `pnpm preview:worker` and open the local URL: the dashboard should load with the sample data.
5. `pnpm run deploy`
