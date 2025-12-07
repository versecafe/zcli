import { z } from "zod";
import { didYouMean } from "./utils/did-you-mean.ts";

export class CliError extends Error {
	public readonly exitCode: number;
	public readonly showHelp: boolean;

	constructor(
		message: string,
		options: { exitCode?: number; showHelp?: boolean } = {},
	) {
		super(message);
		this.name = "CliError";
		this.exitCode = options.exitCode ?? 1;
		this.showHelp = options.showHelp ?? false;
	}
}

export class UserError extends CliError {
	constructor(message: string, options: { showHelp?: boolean } = {}) {
		super(message, { exitCode: 1, ...options });
		this.name = "UserError";
	}
}

export class ValidationError extends CliError {
	public readonly zodError: z.ZodError;

	constructor(zodError: z.ZodError) {
		const formatted = formatZodError(zodError);
		super(formatted, { exitCode: 1, showHelp: true });
		this.name = "ValidationError";
		this.zodError = zodError;
	}
}

export class UnknownFlagError extends UserError {
	constructor(flag: string, availableFlags: string[]) {
		const suggestion = didYouMean(flag, availableFlags);
		const message = suggestion
			? `Unknown flag: --${flag}. Did you mean --${suggestion}?`
			: `Unknown flag: --${flag}`;
		super(message, { showHelp: true });
		this.name = "UnknownFlagError";
	}
}

export class UnknownCommandError extends UserError {
	constructor(command: string, availableCommands: string[]) {
		const suggestion = didYouMean(command, availableCommands);
		const message = suggestion
			? `Unknown command: ${command}. Did you mean ${suggestion}?`
			: `Unknown command: ${command}`;
		super(message, { showHelp: true });
		this.name = "UnknownCommandError";
	}
}

export class MissingArgumentError extends UserError {
	constructor(argName: string) {
		super(`Missing required argument: <${argName}>`, { showHelp: true });
		this.name = "MissingArgumentError";
	}
}

export class MissingFlagError extends UserError {
	constructor(flagName: string) {
		super(`Missing required flag: --${flagName}`, { showHelp: true });
		this.name = "MissingFlagError";
	}
}

export class InvalidPositionalError extends CliError {
	constructor(message: string) {
		super(message, { exitCode: 1 });
		this.name = "InvalidPositionalError";
	}
}

export function formatZodError(error: z.ZodError): string {
	const issues = error.issues.map((issue) => {
		const path = issue.path.length > 0 ? issue.path.join(".") : "value";
		return `  ${path}: ${issue.message}`;
	});
	return `Validation error:\n${issues.join("\n")}`;
}

export function formatError(error: unknown): string {
	if (error instanceof CliError) {
		return error.message;
	}
	if (error instanceof z.ZodError) {
		return formatZodError(error);
	}
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

export function getExitCode(error: unknown): number {
	if (error instanceof CliError) {
		return error.exitCode;
	}
	return 1;
}
