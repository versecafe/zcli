import { describe, expect, it } from "bun:test";
import { z } from "zod";
import {
	CliError,
	formatError,
	getExitCode,
	MissingArgumentError,
	MissingFlagError,
	UnknownCommandError,
	UnknownFlagError,
	UserError,
	ValidationError,
} from "../src/errors.ts";

describe("errors", () => {
	describe("CliError", () => {
		it("has default exit code of 1", () => {
			const err = new CliError("test");
			expect(err.exitCode).toBe(1);
		});

		it("accepts custom exit code", () => {
			const err = new CliError("test", { exitCode: 2 });
			expect(err.exitCode).toBe(2);
		});

		it("has showHelp flag", () => {
			const err = new CliError("test", { showHelp: true });
			expect(err.showHelp).toBe(true);
		});
	});

	describe("UserError", () => {
		it("extends CliError", () => {
			const err = new UserError("test");
			expect(err).toBeInstanceOf(CliError);
			expect(err.exitCode).toBe(1);
		});
	});

	describe("ValidationError", () => {
		it("formats Zod errors", () => {
			const schema = z.object({
				name: z.string(),
				age: z.number(),
			});

			const result = schema.safeParse({ name: 123, age: "bad" });

			if (!result.success) {
				const err = new ValidationError(result.error);
				expect(err.message).toContain("Validation error");
				expect(err.exitCode).toBe(1);
			}
		});
	});

	describe("UnknownFlagError", () => {
		it("includes suggestion when available", () => {
			const err = new UnknownFlagError("verbos", ["verbose", "version"]);
			expect(err.message).toContain("Did you mean --verbose");
		});

		it("works without suggestion", () => {
			const err = new UnknownFlagError("xyz", ["verbose"]);
			expect(err.message).toContain("Unknown flag: --xyz");
			expect(err.message).not.toContain("Did you mean");
		});
	});

	describe("UnknownCommandError", () => {
		it("includes suggestion when available", () => {
			const err = new UnknownCommandError("buld", ["build", "bundle"]);
			expect(err.message).toContain("Did you mean build");
		});
	});

	describe("MissingArgumentError", () => {
		it("formats nicely", () => {
			const err = new MissingArgumentError("filename");
			expect(err.message).toContain("<filename>");
		});
	});

	describe("formatError", () => {
		it("formats CliError", () => {
			const err = new CliError("test message");
			expect(formatError(err)).toBe("test message");
		});

		it("formats regular Error", () => {
			const err = new Error("test");
			expect(formatError(err)).toBe("test");
		});

		it("formats non-Error", () => {
			expect(formatError("string error")).toBe("string error");
		});
	});

	describe("getExitCode", () => {
		it("returns exitCode from CliError", () => {
			const err = new CliError("test", { exitCode: 42 });
			expect(getExitCode(err)).toBe(42);
		});

		it("returns 1 for non-CliError", () => {
			expect(getExitCode(new Error("test"))).toBe(1);
			expect(getExitCode("string")).toBe(1);
		});
	});

	describe("MissingFlagError", () => {
		it("formats flag name correctly", () => {
			const err = new MissingFlagError("api-key");
			expect(err.message).toContain("--api-key");
			expect(err.message).toContain("required");
		});

		it("extends UserError", () => {
			const err = new MissingFlagError("config");
			expect(err).toBeInstanceOf(UserError);
			expect(err).toBeInstanceOf(CliError);
		});

		it("has showHelp enabled", () => {
			const err = new MissingFlagError("test");
			expect(err.showHelp).toBe(true);
		});
	});

	describe("error inheritance chain", () => {
		it("UserError is instanceof CliError", () => {
			const err = new UserError("test");
			expect(err instanceof CliError).toBe(true);
		});

		it("ValidationError is instanceof CliError", () => {
			const schema = z.object({ name: z.string() });
			const result = schema.safeParse({});
			if (!result.success) {
				const err = new ValidationError(result.error);
				expect(err instanceof CliError).toBe(true);
			}
		});

		it("UnknownFlagError is instanceof UserError", () => {
			const err = new UnknownFlagError("test", []);
			expect(err instanceof UserError).toBe(true);
			expect(err instanceof CliError).toBe(true);
		});

		it("UnknownCommandError is instanceof UserError", () => {
			const err = new UnknownCommandError("test", []);
			expect(err instanceof UserError).toBe(true);
		});

		it("MissingArgumentError is instanceof UserError", () => {
			const err = new MissingArgumentError("test");
			expect(err instanceof UserError).toBe(true);
		});
	});

	describe("error names", () => {
		it("has correct error names", () => {
			expect(new CliError("test").name).toBe("CliError");
			expect(new UserError("test").name).toBe("UserError");
			expect(new UnknownFlagError("test", []).name).toBe("UnknownFlagError");
			expect(new UnknownCommandError("test", []).name).toBe(
				"UnknownCommandError",
			);
			expect(new MissingArgumentError("test").name).toBe(
				"MissingArgumentError",
			);
			expect(new MissingFlagError("test").name).toBe("MissingFlagError");
		});
	});

	describe("ValidationError details", () => {
		it("includes all field errors", () => {
			const schema = z.object({
				name: z.string(),
				age: z.number(),
				email: z.string().email(),
			});

			const result = schema.safeParse({
				name: 123,
				age: "bad",
				email: "notanemail",
			});

			if (!result.success) {
				const err = new ValidationError(result.error);
				expect(err.message).toContain("name");
				expect(err.message).toContain("age");
				expect(err.message).toContain("email");
			}
		});

		it("exposes original ZodError", () => {
			const schema = z.object({ name: z.string() });
			const result = schema.safeParse({ name: 123 });

			if (!result.success) {
				const err = new ValidationError(result.error);
				expect(err.zodError).toBe(result.error);
				expect(err.zodError.issues.length).toBeGreaterThan(0);
			}
		});
	});

	describe("formatError edge cases", () => {
		it("formats null", () => {
			expect(formatError(null)).toBe("null");
		});

		it("formats undefined", () => {
			expect(formatError(undefined)).toBe("undefined");
		});

		it("formats number", () => {
			expect(formatError(42)).toBe("42");
		});

		it("formats object", () => {
			expect(formatError({ error: true })).toBe("[object Object]");
		});
	});
});
