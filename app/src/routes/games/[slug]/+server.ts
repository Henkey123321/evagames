import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Old static-site URLs (/games/2048/) keep working. */
export const GET: RequestHandler = ({ params }) =>
	redirect(301, `/play/${encodeURIComponent(params.slug)}`);
