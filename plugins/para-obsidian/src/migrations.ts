import type {
	MigrationFn,
	MigrationHooks,
	MigrationResult,
} from "./frontmatter";

const noop: MigrationFn = (ctx) => ({
	attributes: ctx.attributes,
	body: ctx.body,
	changes: [],
});

const projectV1To2: MigrationFn = (ctx): MigrationResult => {
	const next = { ...ctx.attributes };
	if (next.status === "on-hold") {
		next.status = "paused";
		return {
			attributes: next,
			body: ctx.body,
			changes: ['status: "on-hold" → "paused"'],
		};
	}
	return { attributes: next, body: ctx.body, changes: [] };
};

export const MIGRATIONS: MigrationHooks = {
	project: {
		1: {
			2: projectV1To2,
		},
	},
	daily: {
		1: { 2: noop },
	},
};
