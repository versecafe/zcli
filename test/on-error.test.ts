import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { CliError, UserError, ValidationError } from "../src/errors.ts";
import { cli, command, testCli } from "../src/index.ts";

describe("onError hook", () => {
	it("receives error context when command throws", async () => {
		let capturedError: Error | undefined;
		let capturedCommand: string[] | undefined;

		const app = cli("test")
			.onError(({ error, command }) => {
				capturedError = error;
				capturedCommand = command;
				return { handled: true };
			})
			.use(
				command("fail").action(() => {
					throw new UserError("Something went wrong");
				}),
			);

		await app.run(["fail"]);

		expect(capturedError).toBeInstanceOf(UserError);
		expect(capturedError?.message).toBe("Something went wrong");
		expect(capturedCommand).toEqual(["fail"]);
	});

	it("receives validation errors", async () => {
		let capturedError: Error | undefined;

		const app = cli("test")
			.onError(({ error }) => {
				capturedError = error;
				return { handled: true };
			})
			.use(
				command("greet")
					.inputs({
						name: z.string().meta({ positional: 0 }),
					})
					.action(({ inputs }) => {
						console.log(`Hello, ${inputs.name}`);
					}),
			);

		// Missing required positional
		await app.run(["greet"]);

		expect(capturedError).toBeInstanceOf(ValidationError);
	});

	it("allows default handling when not returning handled: true", async () => {
		let handlerCalled = false;

		const app = cli("test")
			.onError(() => {
				handlerCalled = true;
				// Not returning { handled: true } - should continue to default handling
			})
			.use(
				command("fail").action(() => {
					throw new UserError("Test error");
				}),
			);

		const result = await testCli(app, ["fail"]);

		expect(handlerCalled).toBe(true);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("Test error");
	});

	it("prevents default handling when returning handled: true", async () => {
		const app = cli("test")
			.onError(() => {
				console.log("Custom error handling");
				return { handled: true };
			})
			.use(
				command("fail").action(() => {
					throw new UserError("Test error");
				}),
			);

		const result = await testCli(app, ["fail"]);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Custom error handling");
		expect(result.stderr).not.toContain("Test error");
	});

	it("can log custom error messages", async () => {
		const app = cli("test")
			.onError(({ error }) => {
				console.error(`[CUSTOM] ${error.message}`);
				return { handled: true };
			})
			.use(
				command("fail").action(() => {
					throw new Error("Boom!");
				}),
			);

		const result = await testCli(app, ["fail"]);

		expect(result.stderr).toContain("[CUSTOM] Boom!");
	});

	it("works with async error handlers", async () => {
		let asyncWorkDone = false;

		const app = cli("test")
			.onError(async ({ error }) => {
				// Simulate async work like logging to external service
				await new Promise((resolve) => setTimeout(resolve, 10));
				asyncWorkDone = true;
				console.error(`Logged: ${error.message}`);
				return { handled: true };
			})
			.use(
				command("fail").action(() => {
					throw new UserError("Async test");
				}),
			);

		const result = await testCli(app, ["fail"]);

		expect(asyncWorkDone).toBe(true);
		expect(result.stderr).toContain("Logged: Async test");
	});

	it("preserves error handler through method chaining", async () => {
		let handlerCalled = false;

		const app = cli("test")
			.onError(() => {
				handlerCalled = true;
				return { handled: true };
			})
			.meta({ description: "Test CLI" })
			.globalInputs({
				verbose: z.boolean().default(false).meta({ flag: "verbose" }),
			})
			.use(
				command("fail").action(() => {
					throw new UserError("Chain test");
				}),
			);

		await app.run(["fail"]);

		expect(handlerCalled).toBe(true);
	});

	it("can differentiate error types", async () => {
		let errorType: string | undefined;

		const app = cli("test")
			.onError(({ error }) => {
				if (error instanceof ValidationError) {
					errorType = "validation";
				} else if (error instanceof UserError) {
					errorType = "user";
				} else if (error instanceof CliError) {
					errorType = "cli";
				} else {
					errorType = "unknown";
				}
				return { handled: true };
			})
			.use(
				command("user-error").action(() => {
					throw new UserError("User error");
				}),
			)
			.use(
				command("generic-error").action(() => {
					throw new Error("Generic error");
				}),
			);

		await app.run(["user-error"]);
		expect(errorType).toBe("user");

		await app.run(["generic-error"]);
		expect(errorType).toBe("unknown");
	});

	it("rethrows non-Error objects by default", async () => {
		const app = cli("test")
			.onError(() => {
				// Handler should not be called for non-Error throws
				return { handled: true };
			})
			.use(
				command("throw-string").action(() => {
					throw "string error";
				}),
			);

		// This should throw because string errors aren't handled by onError
		await expect(app.run(["throw-string"])).rejects.toBe("string error");
	});

	it("can be overwritten by calling onError again", async () => {
		let firstHandlerCalled = false;
		let secondHandlerCalled = false;

		const app = cli("test")
			.onError(() => {
				firstHandlerCalled = true;
				return { handled: true };
			})
			.onError(() => {
				secondHandlerCalled = true;
				return { handled: true };
			})
			.use(
				command("fail").action(() => {
					throw new UserError("Test");
				}),
			);

		await app.run(["fail"]);

		expect(firstHandlerCalled).toBe(false);
		expect(secondHandlerCalled).toBe(true);
	});

	it("works with subcommands", async () => {
		let capturedCommand: string[] | undefined;

		const app = cli("test")
			.onError(({ command }) => {
				capturedCommand = command;
				return { handled: true };
			})
			.use(
				command("parent").use(
					command("child").action(() => {
						throw new UserError("Nested error");
					}),
				),
			);

		await app.run(["parent", "child"]);

		expect(capturedCommand).toEqual(["parent", "child"]);
	});
});
