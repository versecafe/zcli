import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { cli, command, trait } from "../src/index.ts";
import type {
	ExpectedSeq,
	GetPos,
	GetPositionals,
	IsSequential,
	MaxOf,
	NonPosBrand,
	PosBrand,
} from "../src/types.ts";

describe("type tests", () => {
	describe("command builder type inference", () => {
		it("infers input types correctly", () => {
			const cmd = command("test").inputs({
				name: z.string().meta({ positional: 0 }),
				count: z.coerce.number().default(1).meta({ flag: "count" }),
				verbose: z.boolean().default(false).meta({ flag: "verbose" }),
			});

			const result = cmd.parse(["hello", "--count", "5"]);

			expect<string>(result.inputs.name).toBe("hello");
			expect<number>(result.inputs.count).toBe(5);
			expect<boolean>(result.inputs.verbose).toBe(false);
		});

		it("infers optional types correctly", () => {
			const cmd = command("test").inputs({
				name: z.string().optional().meta({ positional: 0 }),
			});

			const result = cmd.parse([]);

			expect<string | undefined>(result.inputs.name).toBeUndefined();
		});

		it("infers globalInputs types correctly", () => {
			const cmd = command("test")
				.globalInputs({
					verbose: z.boolean().default(false).meta({ flag: "verbose" }),
				})
				.inputs({
					name: z.string().meta({ positional: 0 }),
				});

			const result = cmd.parse(["hello"]);

			expect<string>(result.inputs.name).toBe("hello");
			expect<boolean>(result.inputs.verbose).toBe(false);
		});

		it("infers context type correctly", async () => {
			interface AppContext {
				db: { query: (sql: string) => string[] };
			}

			let capturedCtx: AppContext | undefined;

			const cmd = command("test")
				.context(
					(): AppContext => ({
						db: { query: () => ["result"] },
					}),
				)
				.inputs({})
				.action(({ ctx }) => {
					capturedCtx = ctx;
					expect<{ query: (sql: string) => string[] }>(ctx.db).toBeDefined();
				});

			await cmd.run([]);
			expect(capturedCtx?.db.query("SELECT 1")).toEqual(["result"]);
		});

		it("infers action return type correctly", async () => {
			const cmd = command("test")
				.inputs({})
				.action(() => ({ success: true, count: 42 }));

			const result = await cmd.run([]);

			expect<{ success: boolean; count: number }>(result).toEqual({
				success: true,
				count: 42,
			});
		});

		it("chains action types correctly", async () => {
			const cmd = command("test")
				.inputs({})
				.action(() => "first")
				.action(() => 42);

			const result = await cmd.run([]);

			expect<number>(result).toBe(42);
		});
	});

	describe("positional brand types", () => {
		it("GetPos extracts positional index", () => {
			type Schema = z.ZodString & PosBrand<0>;
			type Pos = GetPos<Schema>;

			expect<Pos>(0 as Pos).toBe(0);
		});

		it("GetPos returns never for non-positional", () => {
			type Schema = z.ZodString & NonPosBrand;
			type Pos = GetPos<Schema>;

			const _check: Pos = undefined as never;
			expect(_check).toBeUndefined();
		});

		it("GetPositionals collects all positional indices", () => {
			type TestInputs = {
				first: z.ZodString & PosBrand<0>;
				second: z.ZodString & PosBrand<1>;
				flag: z.ZodBoolean & NonPosBrand;
			};

			type Positions = GetPositionals<TestInputs>;

			const validPositions: Positions[] = [0, 1];
			expect(validPositions).toEqual([0, 1]);
		});
	});

	describe("MaxOf type", () => {
		it("finds maximum of single number", () => {
			type Result = MaxOf<3>;
			expect<Result>(3 as Result).toBe(3);
		});

		it("finds maximum of union", () => {
			type Result = MaxOf<0 | 1 | 2 | 3>;
			expect<Result>(3 as Result).toBe(3);
		});

		it("handles 0", () => {
			type Result = MaxOf<0>;
			expect<Result>(0 as Result).toBe(0);
		});

		it("returns -1 for never", () => {
			type Result = MaxOf<never>;
			expect<Result>(-1 as Result).toBe(-1);
		});
	});

	describe("ExpectedSeq type", () => {
		it("generates 0 for max 0", () => {
			type Result = ExpectedSeq<0>;
			const valid: Result = 0;
			expect(valid).toBe(0);
		});

		it("generates 0|1|2 for max 2", () => {
			type Result = ExpectedSeq<2>;
			const valid: Result[] = [0, 1, 2];
			expect(valid).toEqual([0, 1, 2]);
		});

		it("generates never for -1", () => {
			type Result = ExpectedSeq<-1>;
			const _check: Result = undefined as never;
			expect(_check).toBeUndefined();
		});
	});

	describe("IsSequential type", () => {
		it("returns true for sequential positionals 0,1,2", () => {
			type Result = IsSequential<0 | 1 | 2>;
			expect<Result>(true as Result).toBe(true);
		});

		it("returns true for single positional 0", () => {
			type Result = IsSequential<0>;
			expect<Result>(true as Result).toBe(true);
		});

		it("returns true for no positionals (never)", () => {
			type Result = IsSequential<never>;
			expect<Result>(true as Result).toBe(true);
		});

		it("returns false for gap in sequence (0,2)", () => {
			type Result = IsSequential<0 | 2>;
			expect<Result>(false as Result).toBe(false);
		});

		it("returns false for not starting at 0", () => {
			type Result = IsSequential<1 | 2>;
			expect<Result>(false as Result).toBe(false);
		});
	});

	describe("type error tests using expectTypeOf", () => {
		it("properly types input properties", () => {
			const cmd = command("test").inputs({
				name: z.string().meta({ positional: 0 }),
			});

			const result = cmd.parse(["hello"]);

			expect(result.inputs.name).toBe("hello");
			expect<string>(result.inputs.name).toBe("hello");
		});

		it("errors when assigning wrong type to input", () => {
			const cmd = command("test").inputs({
				count: z.coerce.number().default(0).meta({ flag: "count" }),
			});

			const result = cmd.parse([]);

			// @ts-expect-error - count is number, not string
			const _wrong: string = result.inputs.count;
			expect(typeof result.inputs.count).toBe("number");
		});

		it("errors when context type mismatches", async () => {
			interface WrongContext {
				wrongField: string;
			}

			const cmd = command("test")
				.context(() => ({ db: "postgres" }))
				.inputs({})
				.action(({ ctx }) => {
					// @ts-expect-error - ctx does not have wrongField
					const _wrong: WrongContext = ctx;
					return ctx.db;
				});

			const result = await cmd.run([]);
			expect(result).toBe("postgres");
		});

		it("properly types action inputs", () => {
			let capturedInputs: { name: string } | undefined;

			command("test")
				.inputs({
					name: z.string().meta({ positional: 0 }),
				})
				.action(({ inputs }) => {
					capturedInputs = inputs;
					expect<string>(inputs.name).toBeDefined();
					return inputs.name;
				});

			expect(capturedInputs).toBeUndefined();
		});
	});

	describe("cli type inference", () => {
		it("infers globalInputs types for cli", async () => {
			let capturedVerbose: boolean | undefined;

			const app = cli("myapp")
				.globalInputs({
					verbose: z.boolean().default(false).meta({ flag: "verbose" }),
				})
				.use(
					command("test")
						.inputs({})
						.action(({ inputs }) => {
							// biome-ignore lint/suspicious/noExplicitAny: testing type access
							capturedVerbose = (inputs as any).verbose;
						}),
				);

			await app.run(["test", "--verbose"]);
			expect(capturedVerbose).toBe(true);
		});

		it("top-down: cli.use(name) inherits global inputs at type level", async () => {
			let capturedInputs: { verbose: boolean; file: string } | undefined;

			const app = cli("myapp").globalInputs({
				verbose: z.boolean().default(false).meta({ flag: "verbose" }),
			});

			const testCmd = app
				.command("test")
				.inputs({
					file: z.string().meta({ positional: 0 }),
				})
				.action(({ inputs }) => {
					expect<boolean>(inputs.verbose).toBeDefined();
					expect<string>(inputs.file).toBeDefined();
					capturedInputs = inputs;
				});

			await app.use(testCmd).run(["test", "myfile.txt", "--verbose"]);

			expect(capturedInputs?.verbose).toBe(true);
			expect(capturedInputs?.file).toBe("myfile.txt");
		});

		it("top-down: nested commands inherit parent globals", async () => {
			let capturedInputs:
				| { verbose: boolean; debug: boolean; id: string }
				| undefined;

			const app = cli("myapp").globalInputs({
				verbose: z.boolean().default(false).meta({ flag: "verbose" }),
			});

			const parentCmd = app.command("parent").globalInputs({
				debug: z.boolean().default(false).meta({ flag: "debug" }),
			});

			const childCmd = parentCmd
				.command("child")
				.inputs({
					id: z.string().meta({ positional: 0 }),
				})
				.action(({ inputs }) => {
					expect<boolean>(inputs.verbose).toBeDefined();
					expect<boolean>(inputs.debug).toBeDefined();
					expect<string>(inputs.id).toBeDefined();
					capturedInputs = inputs;
				});

			await app
				.use(parentCmd.use(childCmd))
				.run(["parent", "child", "123", "--verbose", "--debug"]);

			expect(capturedInputs?.verbose).toBe(true);
			expect(capturedInputs?.debug).toBe(true);
			expect(capturedInputs?.id).toBe("123");
		});

		it("top-down: type error when accessing non-existent global input", () => {
			const app = cli("myapp").globalInputs({
				verbose: z.boolean().default(false).meta({ flag: "verbose" }),
			});

			app.command("test").action(({ inputs }) => {
				expect<boolean>(inputs.verbose).toBeDefined();
				// @ts-expect-error - nonExistent is not a global input
				const _wrong: string = inputs.nonExistent;
				return _wrong;
			});
		});
	});

	describe("trait type inference", () => {
		it("trait inputs are typed in action", async () => {
			let capturedInputs: { verbose: boolean; file: string } | undefined;

			const verboseTrait = trait({
				verbose: z.boolean().default(false).meta({ flag: "verbose" }),
			});

			const cmd = command("test")
				.use(verboseTrait)
				.inputs({
					file: z.string().meta({ positional: 0 }),
				})
				.action(({ inputs }) => {
					expect<boolean>(inputs.verbose).toBeDefined();
					expect<string>(inputs.file).toBeDefined();
					capturedInputs = inputs;
				});

			await cmd.run(["myfile.txt", "--verbose"]);

			expect(capturedInputs?.verbose).toBe(true);
			expect(capturedInputs?.file).toBe("myfile.txt");
		});

		it("trait with resolve provides typed context", async () => {
			let capturedCtx: { log: (msg: string) => void } | undefined;

			const loggingTrait = trait({
				verbose: z.boolean().default(false).meta({ flag: "verbose" }),
			}).withResolve(({ inputs }) => ({
				log: inputs.verbose
					? (msg: string) => console.log(msg)
					: (_msg: string) => {},
			}));

			const cmd = command("test")
				.use(loggingTrait)
				.action(({ inputs, ctx }) => {
					expect<boolean>(inputs.verbose).toBeDefined();
					expect<(msg: string) => void>(ctx.log).toBeDefined();
					capturedCtx = ctx;
				});

			await cmd.run(["--verbose"]);

			expect(capturedCtx?.log).toBeDefined();
			expect(typeof capturedCtx?.log).toBe("function");
		});

		it("multiple traits can be composed", async () => {
			let capturedInputs:
				| { verbose: boolean; dryRun: boolean; file: string }
				| undefined;

			const verboseTrait = trait({
				verbose: z.boolean().default(false).meta({ flag: "verbose" }),
			});

			const dryRunTrait = trait({
				dryRun: z.boolean().default(false).meta({ flag: "dry-run" }),
			});

			const cmd = command("test")
				.use(verboseTrait)
				.use(dryRunTrait)
				.inputs({
					file: z.string().meta({ positional: 0 }),
				})
				.action(({ inputs }) => {
					expect<boolean>(inputs.verbose).toBeDefined();
					expect<boolean>(inputs.dryRun).toBeDefined();
					expect<string>(inputs.file).toBeDefined();
					capturedInputs = inputs;
				});

			await cmd.run(["test.txt", "--verbose", "--dry-run"]);

			expect(capturedInputs?.verbose).toBe(true);
			expect(capturedInputs?.dryRun).toBe(true);
			expect(capturedInputs?.file).toBe("test.txt");
		});

		it("trait resolve can access prior context with type safety", async () => {
			interface DbContext {
				db: { query: () => string[] };
			}

			let capturedCtx:
				| (DbContext & { cached: { query: () => string[] } })
				| undefined;

			// Using the generic to specify required context type
			const cacheTrait = trait({}).withResolve<
				{ cached: { query: () => string[] } },
				DbContext
			>(({ ctx }) => ({
				cached: {
					// ctx is now typed as DbContext, no cast needed!
					query: () => ctx.db.query(),
				},
			}));

			const cmd = command("test")
				.context(
					(): DbContext => ({
						db: { query: () => ["result"] },
					}),
				)
				.use(cacheTrait)
				.action(({ ctx }) => {
					expect<{ query: () => string[] }>(ctx.db).toBeDefined();
					expect<{ query: () => string[] }>(ctx.cached).toBeDefined();
					capturedCtx = ctx;
				});

			await cmd.run([]);

			expect(capturedCtx?.db.query()).toEqual(["result"]);
			expect(capturedCtx?.cached.query()).toEqual(["result"]);
		});

		it("type error when accessing non-existent trait input", () => {
			const verboseTrait = trait({
				verbose: z.boolean().default(false).meta({ flag: "verbose" }),
			});

			command("test")
				.use(verboseTrait)
				.action(({ inputs }) => {
					expect<boolean>(inputs.verbose).toBeDefined();
					// @ts-expect-error - nonExistent is not a trait input
					const _wrong: string = inputs.nonExistent;
					return _wrong;
				});
		});

		it("type error when using trait with unsatisfied context requirement", () => {
			interface DbContext {
				db: { query: () => string[] };
			}

			// This trait requires DbContext
			const cacheTrait = trait({}).withResolve<{ cached: boolean }, DbContext>(
				({ ctx }) => ({
					cached: ctx.db.query().length > 0,
				}),
			);

			// @ts-expect-error - cacheTrait requires DbContext but command has unknown context
			command("test").use(cacheTrait);

			// This should work - command has the required context
			command("test")
				.context((): DbContext => ({ db: { query: () => [] } }))
				.use(cacheTrait);
		});

		it("CLI-level trait applies to all commands", async () => {
			let capturedInputs: { verbose: boolean; file: string } | undefined;
			let capturedCtx: { log: (msg: string) => void } | undefined;

			const loggingTrait = trait({
				verbose: z.boolean().default(false).meta({ flag: "verbose" }),
			}).withResolve(({ inputs }) => ({
				log: inputs.verbose
					? (msg: string) => console.log(msg)
					: (_msg: string) => {},
			}));

			const app = cli("myapp").use(loggingTrait);

			const testCmd = app
				.command("test")
				.inputs({
					file: z.string().meta({ positional: 0 }),
				})
				.action(({ inputs, ctx }) => {
					expect<boolean>(inputs.verbose).toBeDefined();
					expect<string>(inputs.file).toBeDefined();
					expect<(msg: string) => void>(ctx.log).toBeDefined();
					capturedInputs = inputs;
					capturedCtx = ctx;
				});

			await app.use(testCmd).run(["test", "myfile.txt", "--verbose"]);

			expect(capturedInputs?.verbose).toBe(true);
			expect(capturedInputs?.file).toBe("myfile.txt");
			expect(typeof capturedCtx?.log).toBe("function");
		});

		it("trait deduplication by name", async () => {
			let resolveCallCount = 0;

			const namedTrait = trait(
				{
					verbose: z.boolean().default(false).meta({ flag: "verbose" }),
				},
				{ name: "logging" },
			).withResolve(({ inputs }) => {
				resolveCallCount++;
				return {
					log: inputs.verbose
						? (msg: string) => console.log(msg)
						: (_msg: string) => {},
				};
			});

			const cmd = command("test")
				.use(namedTrait)
				.use(namedTrait) // second use should be deduplicated
				.use(namedTrait) // third use should also be deduplicated
				.action(({ inputs, ctx }) => {
					expect<boolean>(inputs.verbose).toBeDefined();
					expect<(msg: string) => void>(ctx.log).toBeDefined();
				});

			await cmd.run(["--verbose"]);

			// resolve should only be called once due to deduplication
			expect(resolveCallCount).toBe(1);
		});

		it("traits without name are not deduplicated", async () => {
			let resolveCallCount = 0;

			const unnamedTrait = trait({}).withResolve(() => {
				resolveCallCount++;
				return { count: resolveCallCount };
			});

			const cmd = command("test")
				.use(unnamedTrait)
				.use(unnamedTrait) // should NOT be deduplicated
				.action(({ ctx }) => {
					// The last trait's resolve wins
					expect(ctx.count).toBe(2);
				});

			await cmd.run([]);

			// resolve should be called twice since traits have no name
			expect(resolveCallCount).toBe(2);
		});

		it("CLI-level trait deduplication", async () => {
			let resolveCallCount = 0;

			const namedTrait = trait(
				{
					debug: z.boolean().default(false).meta({ flag: "debug" }),
				},
				{ name: "debug-trait" },
			).withResolve(() => {
				resolveCallCount++;
				return { debugEnabled: true };
			});

			const app = cli("myapp").use(namedTrait).use(namedTrait); // should be deduplicated

			const testCmd = app.command("test").action(({ ctx }) => {
				expect(ctx.debugEnabled).toBe(true);
			});

			await app.use(testCmd).run(["test"]);

			expect(resolveCallCount).toBe(1);
		});
	});
});
