/**
 * Type-level tests for Zod GlobalMeta extension.
 * This file validates compile-time type behavior.
 * If this file compiles without errors, the types are working correctly.
 */
import { z } from "zod";
import { flag, positional } from "./types.ts";

// Test: Direct .meta() usage should accept all CliMeta properties
const _withPositional = z.string().meta({ positional: 0 });
const _withFlag = z.string().meta({ flag: "output" });
const _withAlias = z.string().meta({ flag: "out", alias: "o" });
const _withEnv = z.string().meta({ flag: "port", env: "PORT" });
const _withNegatable = z.boolean().meta({ flag: "color", negatable: true });
const _withDescription = z.string().meta({ description: "A description" });
const _withHidden = z.string().meta({ hidden: true });
const _withExample = z.string().meta({ example: "example value" });
const _withSince = z.string().meta({ since: "v1.0.0" });
const _withCategory = z.string().meta({ category: "Advanced" });
const _withCompletionFile = z.string().meta({ completion: "file" });
const _withCompletionDir = z.string().meta({ completion: "directory" });
const _withCompletionArray = z.string().meta({
	completion: ["opt1", "opt2"],
});
const _withCompletionFn = z.string().meta({
	completion: (_partial: string) => ["opt1", "opt2"],
});

// Test: Combined properties
const _combined = z.string().meta({
	positional: 0,
	description: "Input file path",
	completion: "file",
	example: "./input.txt",
});

// Test: Helper functions with type inference
const _posHelper = positional(z.string(), 0);
const _posHelperWithMeta = positional(z.string(), 1, {
	description: "Output file",
	completion: "file",
});

const _flagHelper = flag(z.string(), "verbose");
const _flagHelperWithMeta = flag(z.coerce.number().default(3000), "port", {
	alias: "p",
	env: "PORT",
	description: "Port number",
});

// Test: Type narrowing - accessing meta() result should give CliMeta-compatible type
function _checkMeta(schema: z.ZodType): void {
	if (typeof schema.meta === "function") {
		const meta = schema.meta();
		// These should all be valid property accesses based on GlobalMeta extension
		const _pos: number | undefined = meta?.positional;
		const _flag: string | undefined = meta?.flag;
		const _alias: string | undefined = meta?.alias;
		const _env: string | undefined = meta?.env;
		const _negatable: boolean | undefined = meta?.negatable;
		const _desc: string | undefined = meta?.description;
		const _hidden: boolean | undefined = meta?.hidden;
		const _example: string | undefined = meta?.example;
		const _since: string | undefined = meta?.since;
		const _category: string | undefined = meta?.category;
	}
}

// Test: Ensure meta can be chained
const _chained = z
	.string()
	.default("default")
	.meta({ flag: "name", description: "Name to use" });

// Test: Meta with optional/nullable wrappers
const _optional = z.string().optional().meta({ flag: "optional-flag" });
const _nullable = z.string().nullable().meta({ flag: "nullable-flag" });
const _nullish = z.string().nullish().meta({ flag: "nullish-flag" });

console.log("Type tests passed - file compiled successfully");
