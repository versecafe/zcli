/**
 * Type-level positional validation demonstration.
 *
 * This file shows how to use the `positional()` and `flag()` helpers
 * to get compile-time validation of positional argument configurations.
 */

import { describe, expectTypeOf, it } from "bun:test";
import { z } from "zod";
import { command, flag, positional } from "../src/index.ts";
import type {
	NonPosBrand,
	PosBrand,
	PositionalError,
	ValidInputs,
} from "../src/types.ts";

describe("type-level positional validation", () => {
	describe("helper functions (recommended)", () => {
		it("allows valid sequential positionals using helpers", () => {
			const validCommand = command("copy").inputs({
				source: positional(z.string(), 0, { description: "Source file" }),
				dest: positional(z.string(), 1, { description: "Destination file" }),
				force: flag(z.boolean().default(false), "force", { alias: "f" }),
				verbose: flag(z.boolean().default(false), "verbose", { alias: "v" }),
			});

			// Can chain methods because it's valid
			validCommand.action(({ inputs }) => {
				expectTypeOf(inputs.source).toEqualTypeOf<string>();
				expectTypeOf(inputs.dest).toEqualTypeOf<string>();
			});
		});
	});

	describe("type-level validation with explicit brands", () => {
		it("validates valid sequential positionals", () => {
			type ValidSchema = {
				first: z.ZodString & PosBrand<0>;
				second: z.ZodString & PosBrand<1>;
				flag: z.ZodBoolean & NonPosBrand;
			};
			expectTypeOf<ValidInputs<ValidSchema>>().toEqualTypeOf<ValidSchema>();
			expectTypeOf<PositionalError<ValidSchema>>().toEqualTypeOf<never>();
		});

		it("rejects gap in positionals", () => {
			type GappedSchema = {
				first: z.ZodString & PosBrand<0>;
				third: z.ZodString & PosBrand<2>; // Missing 1!
			};
			expectTypeOf<ValidInputs<GappedSchema>>().toEqualTypeOf<never>();
			expectTypeOf<PositionalError<GappedSchema>>().toBeString();
		});

		it("rejects duplicate positionals", () => {
			type DuplicateSchema = {
				first: z.ZodString & PosBrand<0>;
				alsoFirst: z.ZodString & PosBrand<0>; // Duplicate!
			};
			expectTypeOf<ValidInputs<DuplicateSchema>>().toEqualTypeOf<never>();
			expectTypeOf<PositionalError<DuplicateSchema>>().toBeString();
		});

		it("rejects positionals not starting at 0", () => {
			type WrongStartSchema = {
				second: z.ZodString & PosBrand<1>; // Should start at 0!
			};
			expectTypeOf<ValidInputs<WrongStartSchema>>().toEqualTypeOf<never>();
			expectTypeOf<PositionalError<WrongStartSchema>>().toBeString();
		});
	});
});
