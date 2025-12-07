import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { validatePositionals } from "./builders/shared.ts";
import { InvalidPositionalError } from "./errors.ts";
import { getMeta, isFlag, isPositional } from "./meta.ts";
import { flag, positional } from "./types.ts";

describe("Zod GlobalMeta extension", () => {
	describe("direct .meta() usage without helpers", () => {
		test("should support positional meta", () => {
			const schema = z.string().meta({ positional: 0 });
			const meta = getMeta(schema);

			expect(meta.positional).toBe(0);
			expect(isPositional(schema)).toBe(true);
			expect(isFlag(schema)).toBe(false);
		});

		test("should support flag meta", () => {
			const schema = z.string().meta({ flag: "output" });
			const meta = getMeta(schema);

			expect(meta.flag).toBe("output");
			expect(isPositional(schema)).toBe(false);
			expect(isFlag(schema)).toBe(true);
		});

		test("should support alias meta", () => {
			const schema = z.string().meta({ flag: "output", alias: "o" });
			const meta = getMeta(schema);

			expect(meta.alias).toBe("o");
		});

		test("should support env meta", () => {
			const schema = z.string().meta({ flag: "port", env: "PORT" });
			const meta = getMeta(schema);

			expect(meta.env).toBe("PORT");
		});

		test("should support negatable meta", () => {
			const schema = z.boolean().meta({ flag: "color", negatable: true });
			const meta = getMeta(schema);

			expect(meta.negatable).toBe(true);
		});

		test("should support description meta", () => {
			const schema = z.string().meta({
				flag: "name",
				description: "The name to use",
			});
			const meta = getMeta(schema);

			expect(meta.description).toBe("The name to use");
		});

		test("should support hidden meta", () => {
			const schema = z.string().meta({ flag: "secret", hidden: true });
			const meta = getMeta(schema);

			expect(meta.hidden).toBe(true);
		});

		test("should support example meta", () => {
			const schema = z.string().meta({ flag: "name", example: "John" });
			const meta = getMeta(schema);

			expect(meta.example).toBe("John");
		});

		test("should support since meta", () => {
			const schema = z.string().meta({ flag: "new-flag", since: "v2.0.0" });
			const meta = getMeta(schema);

			expect(meta.since).toBe("v2.0.0");
		});

		test("should support category meta", () => {
			const schema = z.string().meta({ flag: "config", category: "Advanced" });
			const meta = getMeta(schema);

			expect(meta.category).toBe("Advanced");
		});

		test("should support completion with string literal", () => {
			const schema = z.string().meta({ flag: "path", completion: "file" });
			const meta = getMeta(schema);

			expect(meta.completion).toBe("file");
		});

		test("should support completion with array", () => {
			const schema = z.string().meta({
				flag: "level",
				completion: ["debug", "info", "warn", "error"],
			});
			const meta = getMeta(schema);

			expect(meta.completion).toEqual(["debug", "info", "warn", "error"]);
		});

		test("should support completion with function", () => {
			const completionFn = (_partial: string) => ["option1", "option2"];
			const schema = z
				.string()
				.meta({ flag: "custom", completion: completionFn });
			const meta = getMeta(schema);

			expect(typeof meta.completion).toBe("function");
		});

		test("should support combining multiple meta properties", () => {
			const schema = z.string().meta({
				positional: 0,
				description: "Input file",
				completion: "file",
				example: "./input.txt",
			});
			const meta = getMeta(schema);

			expect(meta.positional).toBe(0);
			expect(meta.description).toBe("Input file");
			expect(meta.completion).toBe("file");
			expect(meta.example).toBe("./input.txt");
		});
	});

	describe("helper functions", () => {
		test("positional() helper should work", () => {
			const schema = positional(z.string(), 0);
			const meta = getMeta(schema);

			expect(meta.positional).toBe(0);
			expect(isPositional(schema)).toBe(true);
		});

		test("positional() helper with additional meta", () => {
			const schema = positional(z.string(), 1, {
				description: "Output file",
				completion: "file",
			});
			const meta = getMeta(schema);

			expect(meta.positional).toBe(1);
			expect(meta.description).toBe("Output file");
			expect(meta.completion).toBe("file");
		});

		test("flag() helper should work", () => {
			const schema = flag(z.string(), "verbose");
			const meta = getMeta(schema);

			expect(meta.flag).toBe("verbose");
			expect(isFlag(schema)).toBe(true);
			expect(isPositional(schema)).toBe(false);
		});

		test("flag() helper with additional meta", () => {
			const schema = flag(z.coerce.number().default(3000), "port", {
				alias: "p",
				env: "PORT",
				description: "Port to listen on",
			});
			const meta = getMeta(schema);

			expect(meta.flag).toBe("port");
			expect(meta.alias).toBe("p");
			expect(meta.env).toBe("PORT");
			expect(meta.description).toBe("Port to listen on");
		});
	});

	describe("edge cases", () => {
		test("should return empty object for schema without meta", () => {
			const schema = z.string();
			const meta = getMeta(schema);

			expect(meta).toEqual({});
		});

		test("should handle schema with empty meta", () => {
			const schema = z.string().meta({});
			const meta = getMeta(schema);

			expect(meta).toEqual({});
		});

		test("isPositional should return false for flag", () => {
			const schema = z.string().meta({ flag: "name" });

			expect(isPositional(schema)).toBe(false);
		});

		test("isFlag should return false for positional", () => {
			const schema = z.string().meta({ positional: 0 });

			expect(isFlag(schema)).toBe(false);
		});

		test("positional index 0 should be treated as positional", () => {
			const schema = z.string().meta({ positional: 0 });

			expect(isPositional(schema)).toBe(true);
		});
	});

	describe("runtime validation of positionals", () => {
		test("should pass for valid sequential positionals", () => {
			const schema = {
				first: z.string().meta({ positional: 0 }),
				second: z.string().meta({ positional: 1 }),
				flag: z.boolean().meta({ flag: "verbose" }),
			};

			expect(() => validatePositionals(schema)).not.toThrow();
		});

		test("should pass for schema with only flags", () => {
			const schema = {
				verbose: z.boolean().meta({ flag: "verbose" }),
				output: z.string().meta({ flag: "output" }),
			};

			expect(() => validatePositionals(schema)).not.toThrow();
		});

		test("should pass for single positional at 0", () => {
			const schema = {
				input: z.string().meta({ positional: 0 }),
			};

			expect(() => validatePositionals(schema)).not.toThrow();
		});

		test("should throw for duplicate positional indices", () => {
			const schema = {
				one: z.string().meta({ positional: 1 }),
				two: z.string().meta({ positional: 1 }),
			};

			expect(() => validatePositionals(schema)).toThrow(InvalidPositionalError);
			expect(() => validatePositionals(schema)).toThrow(
				/Duplicate positional index 1/,
			);
		});

		test("should throw for gap in positional indices", () => {
			const schema = {
				first: z.string().meta({ positional: 0 }),
				third: z.string().meta({ positional: 2 }),
			};

			expect(() => validatePositionals(schema)).toThrow(InvalidPositionalError);
			expect(() => validatePositionals(schema)).toThrow(/Missing index/);
		});

		test("should throw for positionals not starting at 0", () => {
			const schema = {
				second: z.string().meta({ positional: 1 }),
			};

			expect(() => validatePositionals(schema)).toThrow(InvalidPositionalError);
			expect(() => validatePositionals(schema)).toThrow(/must start at 0/);
		});

		test("should work with mixed helpers and direct meta", () => {
			const schema = {
				first: positional(z.string(), 0),
				second: z.string().meta({ positional: 1 }),
				verbose: flag(z.boolean(), "verbose"),
			};

			expect(() => validatePositionals(schema)).not.toThrow();
		});
	});
});
