---
name: next16-quirks
description: Encoded knowledge about this repo's non-standard Next.js 16 conventions — read before touching any Next.js code, routing, middleware, Prisma generation, or the Dockerfile. Prevents re-discovering the same gotchas every session.
---

# Next.js 16 quirks in Dark Horse

This repo pins Next.js **16.2.2** and React **19.2.4**. The project `AGENTS.md` file starts with:

> This is NOT the Next.js you know — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

**Treat this as a hard rule.** Before writing or editing any route, layout, server action, middleware, config file, or API handler, read the relevant doc under `node_modules/next/dist/docs/` first.

## Concrete gotchas in this repo

### Middleware is `proxy.ts`, not `middleware.ts`
- The project's middleware lives at `proxy.ts` at the repo root.
- It exports a named `proxy` function (not a default export).
- Commit `b0e613f` renamed `middleware.ts` → `proxy.ts` to avoid a Next.js 16 conflict.
- **Dark Horse plan:** once IAP is live, `proxy.ts` is optional — recommendation is to delete it entirely (IAP injects `X-Goog-Authenticated-User-Email` and `X-Goog-IAP-JWT-Assertion` headers, and audit logging can be added later as a thin header reader).

### Prisma client output path
- `prisma/schema.prisma` declares `output = "../app/generated/prisma"`.
- The generated client lives at `app/generated/prisma/` and is **gitignored**.
- The Dockerfile `deps` stage runs `npx prisma generate` and the `build` stage copies `/app/app/generated` across from `deps` because `COPY . .` wouldn't pick up the gitignored directory.
- Import the generated client via `@/app/generated/prisma` (path alias configured in `tsconfig.json`).

### `next.config.ts` uses standalone output
- `output: "standalone"` is set so Cloud Run can copy `.next/standalone` + `.next/static` into the runner stage.
- The Dockerfile's `runner` stage copies `server.js` from `.next/standalone` and runs `node server.js`.
- Don't add any config that breaks standalone output.

### `/data` folder is Dockerfile-copied
- The Dockerfile's `runner` stage includes `COPY --from=build /app/data ./data`.
- Any static files in `/data` are shipped into the container. Legacy had `voice.md` here for AI voice guide; Dark Horse will add `jurisdictions.json`, `posts.json` seed data.

### App Router only
- All routes live under `app/`. No `pages/` directory.
- Route groups use `(protected)` notation (not currently used but available).
- API routes are `app/api/<name>/route.ts`.

### No server actions yet
- The codebase has no `'use server'` directives. Use API routes for mutations until there's a reason to switch.

## Workflow rule

Whenever you modify something under `app/`, `proxy.ts` (if it still exists), `next.config.ts`, the Dockerfile, or anything touching Prisma generation:

1. `ls node_modules/next/dist/docs/` to see what docs are available for 16.x.
2. `Read` the relevant doc file(s).
3. Only then make the change.

Skipping this step is how you end up with code that looks right but breaks in ways your training-data intuition can't predict.
