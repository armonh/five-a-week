# FIVE/WEEK

A shared weekly challenge tracker for Armon and Victor. Each person completes
five meaningful assignments per week, limited to one per day. The first person
to miss five while the other completes the week breaks the streak and buys
dinner.

## Stack

- React 19 and vinext
- Cloudflare Workers
- Cloudflare D1 with Drizzle migrations

## Local development

Requires Node.js 22.13 or newer.

```bash
pnpm install
pnpm dev
```

The local D1 database is managed by Wrangler. Assignment logs contain structured
text fields only: player, date, category, title, and optional notes.

## Deploy from GitHub

1. Create a D1 database:

   ```bash
   pnpm wrangler d1 create five-a-week
   ```

2. Copy the returned database ID into `wrangler.jsonc`.
3. Apply the schema:

   ```bash
   pnpm db:migrate
   ```

4. In Cloudflare, open **Workers & Pages**, choose **Import a repository**, and
   select `armonh/five-a-week`.
5. Use `pnpm install --frozen-lockfile && pnpm build` as the build command and
   `pnpm wrangler deploy` as the deploy command.

Cloudflare creates the public `workers.dev` address after the first successful
deployment. Future pushes to `main` deploy automatically.

## Commands

```bash
pnpm test
pnpm lint
pnpm build
pnpm deploy
pnpm db:generate
pnpm db:migrate
```
