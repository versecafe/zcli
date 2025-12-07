import { getCompletions, parseCompletionArgs } from "../completion.ts";
import { CliError, formatError, getExitCode } from "../errors.ts";
import { type ExecuteOptions, executeCommand } from "../execute.ts";
import { generateHelp, generateVersion } from "../help.ts";
import { parse as parseArgv } from "../parser.ts";
import type {
	AnyCommandConfig,
	AnyTrait,
	CliConfig,
	CommandConfig,
	CommandMeta,
	ErrorContext,
	ErrorHandler,
	InputSchema,
	PositionalError,
	Prettify,
	Trait,
} from "../types.ts";
import {
	type CommandBuilder,
	createCommandBuilder,
} from "./command-builder.ts";
import {
	type AnyCommandBuilder,
	applyTrait,
	attachSubcommand,
	createEmptyCommandConfig,
	type InferInputs,
	validatePositionals,
} from "./shared.ts";

export interface Cli<
	TGlobalInputs extends Record<string, unknown> = Record<string, unknown>,
	TCtx = unknown,
> {
	readonly _config: AnyCommandConfig;
	readonly _cliConfig: CliConfig;
	readonly _errorHandler?: ErrorHandler;
	readonly "~GlobalInputs": TGlobalInputs;
	readonly "~Ctx": TCtx;

	meta(meta: CommandMeta): Cli<TGlobalInputs, TCtx>;

	globalInputs<T extends InputSchema>(
		schema: PositionalError<T> extends never ? T : PositionalError<T>,
	): Cli<TGlobalInputs & InferInputs<T>, TCtx>;

	context<NewCtx>(
		provider: () => NewCtx | Promise<NewCtx>,
	): Cli<TGlobalInputs, NewCtx>;

	command(
		name: string,
	): CommandBuilder<Record<string, unknown>, TGlobalInputs, TCtx, void>;

	commands(cmds: AnyCommandBuilder[]): Cli<TGlobalInputs, TCtx>;

	/**
	 * Apply a trait to this CLI, adding its inputs as global inputs and its context.
	 * Traits are deduplicated by name - if a trait with the same name is already applied, it won't be added again.
	 */
	use<
		TTraitInputs extends Record<string, unknown>,
		TRequireCtx,
		TProvideCtx extends Record<string, unknown>,
	>(
		tr: TCtx extends TRequireCtx
			? Trait<TTraitInputs, TRequireCtx, TProvideCtx>
			: never,
	): Cli<Prettify<TGlobalInputs & TTraitInputs>, Prettify<TCtx & TProvideCtx>>;

	/**
	 * Attach a command or command tree to this CLI.
	 * The command will inherit the CLI's global inputs and traits.
	 */
	use(cmd: AnyCommandBuilder): Cli<TGlobalInputs, TCtx>;

	/**
	 * Register an error handler for this CLI.
	 * The handler receives error context and can handle errors custom way.
	 * Return { handled: true } to prevent default error handling.
	 */
	onError(handler: ErrorHandler): Cli<TGlobalInputs, TCtx>;

	run(argv?: string[]): Promise<void>;
}

function createCli<
	TGlobalInputs extends Record<string, unknown> = Record<string, unknown>,
	TCtx = unknown,
>(
	cliConfig: CliConfig,
	commandConfig: AnyCommandConfig,
	errorHandler?: ErrorHandler,
): Cli<TGlobalInputs, TCtx> {
	const cliObj: Cli<TGlobalInputs, TCtx> = {
		_config: commandConfig,
		_cliConfig: cliConfig,
		_errorHandler: errorHandler,
		get "~GlobalInputs"(): TGlobalInputs {
			return undefined as unknown as TGlobalInputs;
		},
		get "~Ctx"(): TCtx {
			return undefined as unknown as TCtx;
		},

		meta(meta: CommandMeta) {
			return createCli(
				cliConfig,
				{
					...commandConfig,
					meta: { ...commandConfig.meta, ...meta },
				},
				errorHandler,
			);
		},

		globalInputs<T extends InputSchema>(
			schema: PositionalError<T> extends never ? T : PositionalError<T>,
		) {
			const merged = { ...commandConfig.globalInputSchema, ...(schema as T) };
			validatePositionals(merged);
			return createCli(
				cliConfig,
				{
					...commandConfig,
					globalInputSchema: merged,
				},
				errorHandler,
			) as unknown as Cli<TGlobalInputs & InferInputs<T>, TCtx>;
		},

		context<NewCtx>(provider: () => NewCtx | Promise<NewCtx>) {
			return createCli(
				cliConfig,
				{
					...commandConfig,
					contextProvider: provider,
				},
				errorHandler,
			) as unknown as Cli<TGlobalInputs, NewCtx>;
		},

		command(name: string) {
			const subConfig = createEmptyCommandConfig(name, {
				...commandConfig.globalInputSchema,
			});
			return createCommandBuilder<
				Record<string, unknown>,
				TGlobalInputs,
				TCtx,
				void
			>(subConfig as CommandConfig<TGlobalInputs, TCtx, void>);
		},

		commands(cmds: AnyCommandBuilder[]) {
			let result: Cli<TGlobalInputs, TCtx> = cliObj;
			for (const cmd of cmds) {
				result = result.use(cmd);
			}
			return result;
		},

		use: ((item: AnyTrait | AnyCommandBuilder) => {
			// Check if it's a command (has _config with name)
			if ("_config" in item && item._config?.name) {
				const newConfig = attachSubcommand(
					commandConfig,
					item as AnyCommandBuilder,
				);
				return createCli<TGlobalInputs, TCtx>(
					cliConfig,
					newConfig,
					errorHandler,
				);
			}

			// It's a trait - apply as global inputs
			const tr = item as AnyTrait;
			const newConfig = applyTrait(commandConfig, tr, true);
			if (!newConfig) {
				return cliObj; // Trait already applied
			}
			return createCli(cliConfig, newConfig, errorHandler);
		}) as Cli<TGlobalInputs, TCtx>["use"],

		onError(handler: ErrorHandler) {
			return createCli<TGlobalInputs, TCtx>(cliConfig, commandConfig, handler);
		},

		async run(argv?: string[]) {
			const args = argv ?? process.argv.slice(2);
			const parsed = parseArgv(args);

			if (parsed.flags.version === true || parsed.flags.V === true) {
				if (cliConfig.version) {
					console.log(generateVersion(cliConfig.name, cliConfig.version));
					return;
				}
			}

			// Handle --get-completions for runtime tab completion
			if (parsed.flags["get-completions"] !== undefined) {
				const completionArgs = [
					...(Array.isArray(parsed.flags["get-completions"])
						? parsed.flags["get-completions"]
						: typeof parsed.flags["get-completions"] === "string"
							? [parsed.flags["get-completions"]]
							: []),
					...parsed.positionals,
				];

				const ctx = parseCompletionArgs(completionArgs);
				if (ctx) {
					const completions = await getCompletions(commandConfig, ctx);
					for (const item of completions) {
						console.log(item.value);
					}
				}
				return;
			}

			// Build execution options from CLI config
			const executeOptions: ExecuteOptions = {
				strictFlags: cliConfig.strictFlags,
				strictCommands: cliConfig.strictCommands,
			};

			let commandPath: string[] = [];
			try {
				await executeCommand(
					commandConfig,
					parsed,
					[],
					process.env as Record<string, string | undefined>,
					undefined,
					executeOptions,
				);
			} catch (error) {
				commandPath = parsed.commands;

				// Call custom error handler if provided
				if (errorHandler && error instanceof Error) {
					const ctx: ErrorContext = { error, command: commandPath };
					const result = await errorHandler(ctx);
					if (result?.handled) {
						return;
					}
				}

				if (error instanceof CliError) {
					console.error(formatError(error));
					if (error.showHelp) {
						console.error("");
						console.error(generateHelp(commandConfig, commandPath));
					}
					process.exit(getExitCode(error));
				}
				throw error;
			}
		},
	};

	return cliObj;
}

export function cli(
	name: string,
	options: Omit<CliConfig, "name"> = {},
): Cli<Record<string, unknown>, unknown> {
	const cliConfig: CliConfig = {
		name,
		...options,
	};

	const commandConfig = createEmptyCommandConfig(
		name,
		{},
		{ description: options.description },
	);

	return createCli(cliConfig, commandConfig);
}
