# TheoryForge

AI research workspace for unconventional scientific and engineering hypotheses.

## Local setup

```bash
npm install
cp .env.example .env
# set DATABASE_URL
npx prisma db push
npm run db:seed
npm run dev
```

Open `/en` or `/ru`.

## Railway deploy

1. Push this repo to GitHub.
2. Create Railway service from repo.
3. Add PostgreSQL plugin.
4. Set env var `DATABASE_URL` from Railway PostgreSQL.
5. Build command: `npm run build`
6. Start command: `npm run railway:start`

Real OpenAI integration is intentionally not enabled yet. Mock AI services live in `src/lib/ai` and are designed to be replaced later.
