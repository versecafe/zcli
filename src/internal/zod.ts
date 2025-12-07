import type { z } from "zod";

export interface InternalZodDef {
	type?: string;
	typeName?: string;
	entries?: [string, unknown][];
	values?: string[];
	innerType?: z.ZodType;
	defaultValue?: unknown;
}

interface ZodWithInternalDef {
	_zod?: {
		def?: InternalZodDef;
	};
}

export function getInternalDef(schema: z.ZodType): InternalZodDef | undefined {
	return (schema as unknown as ZodWithInternalDef)._zod?.def;
}
