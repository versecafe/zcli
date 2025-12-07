export type { Cli, CommandBuilder } from "./builders/index.ts";
export { cli, command } from "./builders/index.ts";
export {
	type CompletionItem,
	generateCompletion,
	generateCompletionScript,
	getCompletions,
	parseCompletionArgs,
} from "./completion.ts";
export {
	CliError,
	formatError,
	getExitCode,
	MissingArgumentError,
	MissingFlagError,
	UnknownCommandError,
	UnknownFlagError,
	UserError,
	ValidationError,
} from "./errors.ts";
export { generateHelp, generateVersion } from "./help.ts";
export type { CliMeta } from "./meta.ts";
export { getEnvKey, getMeta, isFlag, isPositional } from "./meta.ts";
export type { ParsedArgv, ParserOptions } from "./parser.ts";
export { parse } from "./parser.ts";
export { type TestResult, testCli } from "./test-cli.ts";
export { type TraitBuilder, trait } from "./trait.ts";

export type {
	ActionContext,
	ActionFn,
	AfterHookFn,
	CliConfig,
	CommandConfig,
	CommandMeta,
	ErrorContext,
	ErrorHandler,
	ErrorHandlerResult,
	HookFn,
	InputSchema,
	NonPosBrand,
	ParsedInputs,
	PosBrand,
	Prettify,
	Trait,
	ValidInputs,
} from "./types.ts";

export { cliMeta, flag, positional } from "./types.ts";

export {
	toCamelCase,
	toConstantCase,
	toKebabCase,
} from "./utils/case.ts";

export { didYouMean, findSimilar } from "./utils/did-you-mean.ts";

export {
	fmt,
	getTerminalWidth,
	isTTY,
	supportsColor,
} from "./utils/terminal.ts";

import "./types.ts";
import "./meta.ts";
