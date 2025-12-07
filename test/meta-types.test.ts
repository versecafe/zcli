import { describe, expect, expectTypeOf, it } from "bun:test";
import { z } from "zod";

/**
 * Tests for Zod GlobalMeta augmentation.
 * These verify that our CliMeta fields are properly typed in .meta() calls.
 */

describe("GlobalMeta augmentation", () => {
	it("allows CliMeta fields in .meta() calls", () => {
		// All these should compile without errors
		const withPositional = z.string().meta({ positional: 0 });
		const withFlag = z.string().meta({ flag: "verbose" });
		const _withAlias = z.string().meta({ flag: "verbose", alias: "v" });
		const _withEnv = z.string().meta({ env: "MY_VAR" });
		const _withDescription = z.string().meta({ description: "A field" });
		const _withHidden = z.string().meta({ hidden: true });
		const _withNegatable = z
			.boolean()
			.meta({ flag: "verbose", negatable: true });
		const _withExample = z.string().meta({ example: "hello" });
		const _withCategory = z.string().meta({ category: "Input" });
		const _withCompletion = z.string().meta({ completion: "file" });
		const _withCompletionArray = z
			.string()
			.meta({ completion: ["a", "b", "c"] });
		const _withCompletionFn = z.string().meta({
			completion: (partial) => [`${partial}-1`, `${partial}-2`],
		});

		// Combined
		const combined = z.string().meta({
			positional: 0,
			description: "The input file",
			example: "./input.txt",
			completion: "file",
		});

		expect(withPositional.meta()?.positional).toBe(0);
		expect(withFlag.meta()?.flag).toBe("verbose");
		expect(combined.meta()?.positional).toBe(0);
	});

	it("retrieves meta correctly", () => {
		const schema = z.string().meta({
			positional: 0,
			description: "Test",
			hidden: false,
		});

		const meta = schema.meta();
		expect(meta?.positional).toBe(0);
		expect(meta?.description).toBe("Test");
		expect(meta?.hidden).toBe(false);
	});

	it("returns undefined for schema without meta", () => {
		const schema = z.string();
		const meta = schema.meta();
		expect(meta).toBeUndefined();
	});

	it("meta is associated with specific schema instance", () => {
		const base = z.string();
		const withMeta = base.meta({ positional: 0 });
		const derived = withMeta.optional();

		// Base has no meta
		expect(base.meta()).toBeUndefined();
		// withMeta has the positional
		expect(withMeta.meta()?.positional).toBe(0);
		// derived (optional) loses the meta in Zod 4
		// Note: This is Zod's behavior - .optional() creates new instance
		expect(derived.meta()).toBeUndefined();
	});

	it("type inference works for meta return type", () => {
		const schema = z.string().meta({ positional: 0, description: "test" });
		const meta = schema.meta();

		// TypeScript should infer these correctly
		if (meta) {
			expectTypeOf(meta.positional).toEqualTypeOf<number | undefined>();
			expectTypeOf(meta.description).toEqualTypeOf<string | undefined>();
			expectTypeOf(meta.flag).toEqualTypeOf<string | undefined>();
			expectTypeOf(meta.hidden).toEqualTypeOf<boolean | undefined>();
		}
	});
});

describe("using .meta() without helpers", () => {
	it("works with positional via .meta()", () => {
		const schema = z.string().meta({ positional: 0 });
		expect(schema.meta()?.positional).toBe(0);
	});

	it("works with flag via .meta()", () => {
		const schema = z
			.boolean()
			.default(false)
			.meta({ flag: "verbose", alias: "v" });
		const meta = schema.meta();
		expect(meta?.flag).toBe("verbose");
		expect(meta?.alias).toBe("v");
	});

	it("works with env via .meta()", () => {
		const schema = z.string().meta({ env: "API_KEY" });
		expect(schema.meta()?.env).toBe("API_KEY");
	});

	it("chaining .meta() merges metadata", () => {
		const schema = z
			.string()
			.meta({ description: "First" })
			.meta({ example: "test" });

		const meta = schema.meta();
		// In Zod 4, subsequent .meta() calls merge with previous
		expect(meta?.description).toBe("First");
		expect(meta?.example).toBe("test");
	});
});
