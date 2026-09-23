// See https://svelte.dev/docs/kit/types#app.d.ts
import type { Db } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth';

declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		interface Locals {
			db: Db;
			user: SessionUser | null;
			/** Passed the 18+ gate (cookie) or signed in (confirmed at signup). */
			ageConfirmed: boolean;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
