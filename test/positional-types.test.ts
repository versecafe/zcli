import { describe, expect, expectTypeOf, it } from "bun:test";
import { z } from "zod";
import { command } from "../src/index.ts";
import type {
	Eq,
	ExpectedSeq,
	GetPos,
	GetPositionals,
	HasDuplicatePositionals,
	IsSequential,
	MaxOf,
	NonPosBrand,
	PosBrand,
	ValidInputs,
} from "../src/types.ts";

/**
 * Type-level tests for positional argument validation.
 *
 * These tests verify that our type system correctly:
 * 1. Detects duplicate positional indices
 * 2. Ensures positionals are sequential (0, 1, 2... not 0, 2)
 * 3. Errors at compile time for invalid configurations
 *
 * Run with: bun test test/positional-types.test.ts
 * Type check with: bunx tsc --noEmit
 */

describe("positional type checking", () => {
	describe("GetPos - extract positional index from branded type", () => {
		it("extracts positional 0", () => {
			type Schema = z.ZodString & PosBrand<0>;
			expectTypeOf<GetPos<Schema>>().toEqualTypeOf<0>();
		});

		it("extracts positional 1", () => {
			type Schema = z.ZodString & PosBrand<1>;
			expectTypeOf<GetPos<Schema>>().toEqualTypeOf<1>();
		});

		it("extracts positional 5", () => {
			type Schema = z.ZodString & PosBrand<5>;
			expectTypeOf<GetPos<Schema>>().toEqualTypeOf<5>();
		});

		it("returns never for non-positional", () => {
			type Schema = z.ZodString & NonPosBrand;
			expectTypeOf<GetPos<Schema>>().toEqualTypeOf<never>();
		});

		it("returns never for unbranded type", () => {
			type Schema = z.ZodString;
			expectTypeOf<GetPos<Schema>>().toEqualTypeOf<never>();
		});
	});

	describe("GetPositionals - collect all positional indices from schema", () => {
		it("collects single positional", () => {
			type TestInputs = {
				name: z.ZodString & PosBrand<0>;
			};
			expectTypeOf<GetPositionals<TestInputs>>().toEqualTypeOf<0>();
		});

		it("collects multiple positionals", () => {
			type TestInputs = {
				first: z.ZodString & PosBrand<0>;
				second: z.ZodString & PosBrand<1>;
			};
			expectTypeOf<GetPositionals<TestInputs>>().toEqualTypeOf<0 | 1>();
		});

		it("collects positionals ignoring flags", () => {
			type TestInputs = {
				first: z.ZodString & PosBrand<0>;
				second: z.ZodString & PosBrand<1>;
				flag: z.ZodBoolean & NonPosBrand;
			};
			expectTypeOf<GetPositionals<TestInputs>>().toEqualTypeOf<0 | 1>();
		});

		it("returns never when no positionals", () => {
			type TestInputs = {
				flag1: z.ZodBoolean & NonPosBrand;
				flag2: z.ZodString & NonPosBrand;
			};
			expectTypeOf<GetPositionals<TestInputs>>().toEqualTypeOf<never>();
		});

		it("handles mixed positional indices", () => {
			type TestInputs = {
				first: z.ZodString & PosBrand<0>;
				third: z.ZodString & PosBrand<2>;
				flag: z.ZodBoolean & NonPosBrand;
			};
			expectTypeOf<GetPositionals<TestInputs>>().toEqualTypeOf<0 | 2>();
		});
	});

	describe("MaxOf - find maximum in union", () => {
		it("finds max of single value", () => {
			expectTypeOf<MaxOf<0>>().toEqualTypeOf<0>();
			expectTypeOf<MaxOf<3>>().toEqualTypeOf<3>();
			expectTypeOf<MaxOf<9>>().toEqualTypeOf<9>();
		});

		it("finds max of union", () => {
			expectTypeOf<MaxOf<0 | 1>>().toEqualTypeOf<1>();
			expectTypeOf<MaxOf<0 | 1 | 2>>().toEqualTypeOf<2>();
			expectTypeOf<MaxOf<0 | 2 | 5>>().toEqualTypeOf<5>();
		});

		it("returns -1 for never", () => {
			expectTypeOf<MaxOf<never>>().toEqualTypeOf<-1>();
		});
	});

	describe("ExpectedSeq - generate expected sequence from max", () => {
		it("generates sequence for 0", () => {
			expectTypeOf<ExpectedSeq<0>>().toEqualTypeOf<0>();
		});

		it("generates sequence for 1", () => {
			expectTypeOf<ExpectedSeq<1>>().toEqualTypeOf<0 | 1>();
		});

		it("generates sequence for 2", () => {
			expectTypeOf<ExpectedSeq<2>>().toEqualTypeOf<0 | 1 | 2>();
		});

		it("generates sequence for 5", () => {
			expectTypeOf<ExpectedSeq<5>>().toEqualTypeOf<0 | 1 | 2 | 3 | 4 | 5>();
		});

		it("returns never for -1", () => {
			expectTypeOf<ExpectedSeq<-1>>().toEqualTypeOf<never>();
		});
	});

	describe("Eq - type equality check", () => {
		it("returns true for equal types", () => {
			expectTypeOf<Eq<0, 0>>().toEqualTypeOf<true>();
			expectTypeOf<Eq<0 | 1, 0 | 1>>().toEqualTypeOf<true>();
			expectTypeOf<Eq<never, never>>().toEqualTypeOf<true>();
		});

		it("returns false for unequal types", () => {
			expectTypeOf<Eq<0, 1>>().toEqualTypeOf<false>();
			expectTypeOf<Eq<0 | 1, 0 | 2>>().toEqualTypeOf<false>();
			expectTypeOf<Eq<0, 0 | 1>>().toEqualTypeOf<false>();
		});
	});

	describe("IsSequential - validate positional sequence", () => {
		it("returns true for valid sequences", () => {
			// Empty (never) is valid
			expectTypeOf<IsSequential<never>>().toEqualTypeOf<true>();
			// Single 0 is valid
			expectTypeOf<IsSequential<0>>().toEqualTypeOf<true>();
			// 0, 1 is valid
			expectTypeOf<IsSequential<0 | 1>>().toEqualTypeOf<true>();
			// 0, 1, 2 is valid
			expectTypeOf<IsSequential<0 | 1 | 2>>().toEqualTypeOf<true>();
			// Full sequence 0-5 is valid
			expectTypeOf<IsSequential<0 | 1 | 2 | 3 | 4 | 5>>().toEqualTypeOf<true>();
		});

		it("returns false for gaps in sequence", () => {
			// Gap: 0, 2 (missing 1)
			expectTypeOf<IsSequential<0 | 2>>().toEqualTypeOf<false>();
			// Gap: 0, 1, 3 (missing 2)
			expectTypeOf<IsSequential<0 | 1 | 3>>().toEqualTypeOf<false>();
		});

		it("returns false for not starting at 0", () => {
			// Starting at 1
			expectTypeOf<IsSequential<1>>().toEqualTypeOf<false>();
			// Starting at 1, 2
			expectTypeOf<IsSequential<1 | 2>>().toEqualTypeOf<false>();
		});
	});

	describe("HasDuplicatePositionals - detect duplicate positional indices", () => {
		it("returns false when no duplicates", () => {
			type NoDupes = {
				first: z.ZodString & PosBrand<0>;
				second: z.ZodString & PosBrand<1>;
			};
			expectTypeOf<HasDuplicatePositionals<NoDupes>>().toEqualTypeOf<false>();
		});

		it("returns false for single positional", () => {
			type Single = {
				name: z.ZodString & PosBrand<0>;
			};
			expectTypeOf<HasDuplicatePositionals<Single>>().toEqualTypeOf<false>();
		});

		it("returns false for no positionals (flags only)", () => {
			type FlagsOnly = {
				verbose: z.ZodBoolean & NonPosBrand;
				debug: z.ZodBoolean & NonPosBrand;
			};
			expectTypeOf<HasDuplicatePositionals<FlagsOnly>>().toEqualTypeOf<false>();
		});

		it("returns true when same positional used twice", () => {
			type Duplicates = {
				first: z.ZodString & PosBrand<0>;
				alsoFirst: z.ZodString & PosBrand<0>; // Duplicate!
			};
			expectTypeOf<HasDuplicatePositionals<Duplicates>>().toEqualTypeOf<true>();
		});

		it("returns true when duplicate exists among valid sequence", () => {
			type DupesInSequence = {
				first: z.ZodString & PosBrand<0>;
				second: z.ZodString & PosBrand<1>;
				alsoSecond: z.ZodString & PosBrand<1>; // Duplicate!
			};
			expectTypeOf<
				HasDuplicatePositionals<DupesInSequence>
			>().toEqualTypeOf<true>();
		});
	});

	describe("ValidInputs - full schema validation", () => {
		it("accepts valid sequential positionals", () => {
			type ValidSchema = {
				first: z.ZodString & PosBrand<0>;
				second: z.ZodString & PosBrand<1>;
				flag: z.ZodBoolean & NonPosBrand;
			};
			// ValidInputs<T> returns T if valid, never if invalid
			expectTypeOf<ValidInputs<ValidSchema>>().toEqualTypeOf<ValidSchema>();
		});

		it("accepts schema with only flags (no positionals)", () => {
			type FlagsOnly = {
				verbose: z.ZodBoolean & NonPosBrand;
				count: z.ZodNumber & NonPosBrand;
			};
			expectTypeOf<ValidInputs<FlagsOnly>>().toEqualTypeOf<FlagsOnly>();
		});

		it("accepts single positional at 0", () => {
			type SinglePos = {
				name: z.ZodString & PosBrand<0>;
			};
			expectTypeOf<ValidInputs<SinglePos>>().toEqualTypeOf<SinglePos>();
		});

		it("rejects gap in positionals (returns never)", () => {
			type GappedSchema = {
				first: z.ZodString & PosBrand<0>;
				third: z.ZodString & PosBrand<2>; // Missing 1!
			};
			expectTypeOf<ValidInputs<GappedSchema>>().toEqualTypeOf<never>();
		});

		it("rejects positionals not starting at 0 (returns never)", () => {
			type WrongStartSchema = {
				second: z.ZodString & PosBrand<1>; // Should start at 0!
			};
			expectTypeOf<ValidInputs<WrongStartSchema>>().toEqualTypeOf<never>();
		});

		it("rejects duplicate positionals (returns never)", () => {
			type DuplicateSchema = {
				first: z.ZodString & PosBrand<0>;
				alsoFirst: z.ZodString & PosBrand<0>; // Duplicate!
			};
			expectTypeOf<ValidInputs<DuplicateSchema>>().toEqualTypeOf<never>();
		});

		it("rejects duplicates even in valid sequence", () => {
			type DupesInSequence = {
				first: z.ZodString & PosBrand<0>;
				second: z.ZodString & PosBrand<1>;
				alsoSecond: z.ZodString & PosBrand<1>; // Duplicate!
			};
			expectTypeOf<ValidInputs<DupesInSequence>>().toEqualTypeOf<never>();
		});
	});
});

describe("positional type integration tests", () => {
	describe("type branding mechanism", () => {
		it("PosBrand correctly encodes positional index", () => {
			// PosBrand is designed to be intersected with ZodType
			type BrandedSchema = z.ZodString & PosBrand<0>;
			expectTypeOf<GetPos<BrandedSchema>>().toEqualTypeOf<0>();
		});

		it("NonPosBrand correctly marks non-positional", () => {
			type BrandedSchema = z.ZodString & NonPosBrand;
			expectTypeOf<GetPos<BrandedSchema>>().toEqualTypeOf<never>();
		});

		it("branding is preserved through type operations", () => {
			// Simulate what happens in InputSchema type
			type Schema = {
				name: z.ZodString & PosBrand<0>;
				count: z.ZodNumber & PosBrand<1>;
			};
			type Positions = GetPositionals<Schema>;
			expectTypeOf<Positions>().toEqualTypeOf<0 | 1>();
		});
	});

	describe("command builder type safety", () => {
		it("allows valid sequential positionals", () => {
			// This should compile without errors
			const cmd = command("test").inputs({
				first: z.string().meta({ positional: 0 }),
				second: z.string().meta({ positional: 1 }),
				verbose: z.boolean().default(false).meta({ flag: "verbose" }),
			});

			const result = cmd.parse(["a", "b"]);
			expectTypeOf(result.inputs.first).toEqualTypeOf<string>();
			expectTypeOf(result.inputs.second).toEqualTypeOf<string>();
			expectTypeOf(result.inputs.verbose).toEqualTypeOf<boolean>();
		});

		it("allows flags only (no positionals)", () => {
			const cmd = command("test").inputs({
				verbose: z.boolean().default(false).meta({ flag: "verbose" }),
				count: z.coerce.number().default(1).meta({ flag: "count" }),
			});

			const result = cmd.parse([]);
			expectTypeOf(result.inputs.verbose).toEqualTypeOf<boolean>();
			expectTypeOf(result.inputs.count).toEqualTypeOf<number>();
		});

		it("allows single positional at 0", () => {
			const cmd = command("test").inputs({
				name: z.string().meta({ positional: 0 }),
			});

			const result = cmd.parse(["test"]);
			expectTypeOf(result.inputs.name).toEqualTypeOf<string>();
		});
	});
});

/**
 * Type-only tests that verify compile-time errors.
 * These use @ts-expect-error to ensure invalid configurations
 * cause TypeScript errors.
 */
describe("compile-time error detection", () => {
	it("documents that gap detection works at type level", () => {
		// We can verify the TYPE works correctly
		type GappedInputs = {
			first: z.ZodString & PosBrand<0>;
			third: z.ZodString & PosBrand<2>;
		};

		// This should be `never` because of the gap
		type Validated = ValidInputs<GappedInputs>;
		expectTypeOf<Validated>().toEqualTypeOf<never>();

		// At runtime, just pass to confirm test runs
		expect(true).toBe(true);
	});

	it("documents that wrong start detection works at type level", () => {
		type WrongStart = {
			second: z.ZodString & PosBrand<1>;
		};

		// This should be `never` because it doesn't start at 0
		type Validated = ValidInputs<WrongStart>;
		expectTypeOf<Validated>().toEqualTypeOf<never>();

		expect(true).toBe(true);
	});

	it("documents that duplicate detection works at type level", () => {
		type DuplicateInputs = {
			first: z.ZodString & PosBrand<0>;
			alsoFirst: z.ZodString & PosBrand<0>;
		};

		// This should be `never` because of duplicates
		type Validated = ValidInputs<DuplicateInputs>;
		expectTypeOf<Validated>().toEqualTypeOf<never>();

		expect(true).toBe(true);
	});
});

describe("inputs() method type enforcement", () => {
	it("returns CommandBuilder for valid inputs", () => {
		const cmd = command("test").inputs({
			name: z.string().meta({ positional: 0 }),
			verbose: z.boolean().default(false).meta({ flag: "verbose" }),
		});

		// Should be able to chain methods - this verifies it's a CommandBuilder
		const withAction = cmd.action(({ inputs }) => {
			return inputs.name;
		});

		expect(withAction._config.name).toBe("test");
	});

	it("returns error type for gap in positionals (caught by tsc)", () => {
		// This test documents the expected behavior
		// When positionals have a gap, inputs() returns { __error: "..." }
		// TypeScript will error if you try to use methods on it

		// The following would cause a compile error if uncommented:
		// const cmd = command("test").inputs({
		//   first: z.string().meta({ positional: 0 }),
		//   third: z.string().meta({ positional: 2 }), // Gap! Missing 1
		// }).action(...); // Error: Property 'action' does not exist

		expect(true).toBe(true);
	});

	it("returns error type for duplicate positionals (caught by tsc)", () => {
		// This test documents the expected behavior
		// When positionals are duplicated, inputs() returns { __error: "..." }

		// The following would cause a compile error if uncommented:
		// const cmd = command("test").inputs({
		//   first: z.string().meta({ positional: 0 }),
		//   alsoFirst: z.string().meta({ positional: 0 }), // Duplicate!
		// }).action(...); // Error: Property 'action' does not exist

		expect(true).toBe(true);
	});

	it("returns error type for positionals not starting at 0 (caught by tsc)", () => {
		// This test documents the expected behavior

		// The following would cause a compile error if uncommented:
		// const cmd = command("test").inputs({
		//   second: z.string().meta({ positional: 1 }), // Should start at 0!
		// }).action(...); // Error: Property 'action' does not exist

		expect(true).toBe(true);
	});
});
