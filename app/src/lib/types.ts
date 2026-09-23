/* Types shared between server and browser code. */

export type Role = 'player' | 'staff' | 'owner';

/** The subset of a user that is safe to hand to pages. */
export interface SessionUser {
	id: string;
	username: string;
	displayName: string;
	role: Role;
	permissions: string[];
}
