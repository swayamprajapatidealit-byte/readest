# Web source maps

There is currently no active Sentry crash-symbolication pipeline in this
web-only fork: no `SENTRY_DSN` is configured in `.env`/`.env.web`, no Sentry
SDK is initialized anywhere in `src/`, and `next.config.mjs` does not set
`productionBrowserSourceMaps`. `scripts/upload-sourcemaps.mjs`, which used to
run `sentry-cli sourcemaps inject`/`upload` after the Tauri export build, has
been deleted along with the rest of the Tauri build. `@sentry/cli` is still
listed in `package.json`'s devDependencies but nothing in the repo invokes it
— it's an unused leftover.

## What actually happens to source maps today

The Cloudflare deploy path (`pnpm deploy`, and `pnpm upload`) builds with
`opennextjs-cloudflare build`, which can emit `.js.map` files into
`.open-next/assets`. Before deploying, `pnpm strip-web-sourcemaps` runs:

```
strip-web-sourcemaps: find .open-next/assets -name '*.js.map' -type f -delete
```

This exists to keep source maps out of the publicly served bundle (size and
source-privacy reasons), not to feed them to Sentry. There is no upload step
— maps that get generated are deleted, not shipped anywhere.

## If Sentry symbolication is reintroduced

Re-adding real crash symbolication for the web build would need, at minimum:

- an actual Sentry SDK initialized for the browser (e.g. `@sentry/nextjs`) so
  errors are reported with a release identifier in the first place,
- `productionBrowserSourceMaps: true` in `next.config.mjs` (or equivalent) so
  `next build` emits `.js.map` files to upload,
- a build step that runs `sentry-cli sourcemaps inject` + `upload` against
  those maps *before* `strip-web-sourcemaps` deletes them, tagged with a
  release matching whatever the app reports at runtime,
- `SENTRY_AUTH_TOKEN` (org auth token, scope `project:releases` + `org:read`)
  as a deploy-time secret.

None of this is wired up currently — treat the above as a starting point, not
a description of existing behavior.
