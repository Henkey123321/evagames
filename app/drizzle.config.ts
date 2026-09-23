import { defineConfig } from 'drizzle-kit';

// Only used to generate SQL migrations into ./migrations.
// Migrations are applied with wrangler: `npm run db:migrate:local` / `db:migrate:remote`.
export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './migrations',
	dialect: 'sqlite',
	verbose: true,
	strict: true
});
