import type { z } from "zod";

export interface CliMeta {
	positional?: number;
	flag?: string;
	alias?: string;
	env?: string;
	negatable?: boolean;
	description?: string;
	hidden?: boolean;
	example?: string;
	since?: string;
	category?: string;
	completion?:
		| "file"
		| "directory"
		| string[]
		| ((partial: string) => string[]);
	[k: string]: unknown;
}

declare module "zod" {
	interface GlobalMeta extends CliMeta {}
}

export function getMeta(schema: z.ZodType): CliMeta {
	if (typeof schema.meta === "function") {
		return schema.meta() ?? {};
	}
	return {};
}

export function isPositional(schema: z.ZodType): boolean {
	return typeof getMeta(schema).positional === "number";
}

export function isFlag(schema: z.ZodType): boolean {
	const meta = getMeta(schema);
	return !isPositional(schema) && meta.flag !== undefined;
}

export function getEnvKey(schema: z.ZodType): string | undefined {
	return getMeta(schema).env;
}
