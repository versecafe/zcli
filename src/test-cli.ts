import { CliError, formatError, getExitCode } from "./errors.ts";

type AnyRunnable = { run(argv?: string[]): Promise<unknown> };

export interface TestResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

export async function testCli(
	cmd: AnyRunnable,
	argv: string[],
): Promise<TestResult> {
	let stdout = "";
	let stderr = "";
	let exitCode = 0;

	const originalLog = console.log;
	const originalError = console.error;
	const originalExit = process.exit;

	console.log = (...args: unknown[]) => {
		stdout += `${args.map(String).join(" ")}\n`;
	};
	console.error = (...args: unknown[]) => {
		stderr += `${args.map(String).join(" ")}\n`;
	};
	process.exit = ((code?: number) => {
		exitCode = code ?? 0;
		throw new Error("__TEST_EXIT__");
	}) as typeof process.exit;

	try {
		if ("run" in cmd) {
			await cmd.run(argv);
		}
	} catch (error) {
		if (error instanceof Error && error.message === "__TEST_EXIT__") {
		} else if (error instanceof CliError) {
			stderr += `${formatError(error)}\n`;
			exitCode = getExitCode(error);
		} else {
			throw error;
		}
	} finally {
		console.log = originalLog;
		console.error = originalError;
		process.exit = originalExit;
	}

	return {
		exitCode,
		stdout: stdout.trim(),
		stderr: stderr.trim(),
	};
}
