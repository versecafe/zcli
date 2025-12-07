import { executeCommand, resolveInputs, validateInputs } from "../execute.ts";
import { type ParsedArgv, parse as parseArgv } from "../parser.ts";
import type {
	ActionFn,
	AfterHookFn,
	AnyCommandConfig,
	AnyTrait,
	CommandConfig,
	CommandMeta,
	HookFn,
	InputSchema,
	ParsedInputs,
	PositionalError,
	Prettify,
	Trait,
} from "../types.ts";
import {
	type AnyCommandBuilder,
	applyTrait,
	attachSubcommand,
	createEmptyCommandConfig,
	type InferInputs,
	validatePositionals,
} from "./shared.ts";

export interface CommandBuilder<
	TInputs extends Record<string, unknown> = Record<string, unknown>,
	TGlobalInputs extends Record<string, unknown> = Record<string, unknown>,
	TCtx = unknown,
	TResult = void,
> {
	readonly _config: CommandConfig<TInputs & TGlobalInputs, TCtx, TResult>;
	readonly "~Inputs": TInputs;
	readonly "~GlobalInputs": TGlobalInputs;
	readonly "~Ctx": TCtx;
	readonly "~Result": TResult;

	meta(
		meta: CommandMeta,
	): CommandBuilder<TInputs, TGlobalInputs, TCtx, TResult>;

	inputs<T extends InputSchema>(
		schema: PositionalError<T> extends never ? T : PositionalError<T>,
	): CommandBuilder<
		Prettify<TInputs & InferInputs<T>>,
		TGlobalInputs,
		TCtx,
		TResult
	>;

	globalInputs<T extends InputSchema>(
		schema: PositionalError<T> extends never ? T : PositionalError<T>,
	): CommandBuilder<TInputs, TGlobalInputs & InferInputs<T>, TCtx, TResult>;

	context<NewCtx>(
		provider: () => NewCtx | Promise<NewCtx>,
	): CommandBuilder<TInputs, TGlobalInputs, NewCtx, TResult>;

	before(
		hook: HookFn<TCtx>,
	): CommandBuilder<TInputs, TGlobalInputs, TCtx, TResult>;

	after(
		hook: AfterHookFn<TCtx, TResult>,
	): CommandBuilder<TInputs, TGlobalInputs, TCtx, TResult>;

	action<R>(
		fn: ActionFn<TInputs & TGlobalInputs, TCtx, R>,
	): CommandBuilder<TInputs, TGlobalInputs, TCtx, R>;

	command(
		name: string,
	): CommandBuilder<
		Record<string, unknown>,
		TInputs & TGlobalInputs,
		TCtx,
		void
	>;

	commands(
		subcommands: AnyCommandBuilder[],
	): CommandBuilder<TInputs, TGlobalInputs, TCtx, TResult>;

	/**
	 * Apply a trait to this command, adding its inputs and context.
	 * If the trait requires a specific context (TRequireCtx), it must be
	 * satisfied by the current context.
	 */
	use<
		TTraitInputs extends Record<string, unknown>,
		TRequireCtx,
		TProvideCtx extends Record<string, unknown>,
	>(
		tr: TCtx extends TRequireCtx
			? Trait<TTraitInputs, TRequireCtx, TProvideCtx>
			: never,
	): CommandBuilder<
		Prettify<TInputs & TTraitInputs>,
		TGlobalInputs,
		Prettify<TCtx & TProvideCtx>,
		TResult
	>;

	/**
	 * Attach a subcommand to this command.
	 */
	use(
		cmd: AnyCommandBuilder,
	): CommandBuilder<TInputs, TGlobalInputs, TCtx, TResult>;

	parse(argv?: string[]): ParsedInputs<TInputs & TGlobalInputs>;

	run(argv?: string[]): Promise<TResult>;
}

export function createCommandBuilder<
	TInputs extends Record<string, unknown> = Record<string, unknown>,
	TGlobalInputs extends Record<string, unknown> = Record<string, unknown>,
	TCtx = unknown,
	TResult = void,
>(
	config: CommandConfig<TInputs & TGlobalInputs, TCtx, TResult>,
): CommandBuilder<TInputs, TGlobalInputs, TCtx, TResult> {
	const builder: CommandBuilder<TInputs, TGlobalInputs, TCtx, TResult> = {
		_config: config,
		get "~Inputs"(): TInputs {
			return undefined as unknown as TInputs;
		},
		get "~GlobalInputs"(): TGlobalInputs {
			return undefined as unknown as TGlobalInputs;
		},
		get "~Ctx"(): TCtx {
			return undefined as unknown as TCtx;
		},
		get "~Result"(): TResult {
			return undefined as unknown as TResult;
		},

		meta(meta: CommandMeta) {
			return createCommandBuilder({
				...config,
				meta: { ...config.meta, ...meta },
			});
		},

		inputs<T extends InputSchema>(
			schema: PositionalError<T> extends never ? T : PositionalError<T>,
		) {
			const merged = { ...config.inputSchema, ...(schema as T) };
			validatePositionals(merged);
			return createCommandBuilder({
				...config,
				inputSchema: merged,
			}) as unknown as CommandBuilder<
				Prettify<TInputs & InferInputs<T>>,
				TGlobalInputs,
				TCtx,
				TResult
			>;
		},

		globalInputs<T extends InputSchema>(
			schema: PositionalError<T> extends never ? T : PositionalError<T>,
		) {
			const merged = { ...config.globalInputSchema, ...(schema as T) };
			validatePositionals(merged);
			return createCommandBuilder({
				...config,
				globalInputSchema: merged,
			}) as unknown as CommandBuilder<
				TInputs,
				TGlobalInputs & InferInputs<T>,
				TCtx,
				TResult
			>;
		},

		context<NewCtx>(provider: () => NewCtx | Promise<NewCtx>) {
			return createCommandBuilder({
				...config,
				contextProvider: provider as unknown as () =>
					| unknown
					| Promise<unknown>,
			}) as unknown as CommandBuilder<TInputs, TGlobalInputs, NewCtx, TResult>;
		},

		before(hook: HookFn<TCtx>) {
			return createCommandBuilder({
				...config,
				beforeHooks: [...config.beforeHooks, hook as HookFn<unknown>],
			});
		},

		after(hook: AfterHookFn<TCtx, TResult>) {
			return createCommandBuilder({
				...config,
				afterHooks: [
					...config.afterHooks,
					hook as AfterHookFn<unknown, unknown>,
				],
			});
		},

		action<R>(fn: ActionFn<TInputs & TGlobalInputs, TCtx, R>) {
			return createCommandBuilder({
				...config,
				action: fn as unknown as ActionFn<
					TInputs & TGlobalInputs,
					TCtx,
					TResult
				>,
			}) as unknown as CommandBuilder<TInputs, TGlobalInputs, TCtx, R>;
		},

		command(name: string) {
			const subConfig = createEmptyCommandConfig(name, {
				...config.globalInputSchema,
				...config.inputSchema,
			});
			return createCommandBuilder<
				Record<string, unknown>,
				TInputs & TGlobalInputs,
				TCtx,
				void
			>(subConfig as CommandConfig<TInputs & TGlobalInputs, TCtx, void>);
		},

		commands(subcommands: AnyCommandBuilder[]) {
			let result: CommandBuilder<TInputs, TGlobalInputs, TCtx, TResult> =
				builder;
			for (const sub of subcommands) {
				result = result.use(sub);
			}
			return result;
		},

		use: ((item: AnyTrait | AnyCommandBuilder) => {
			// Check if it's a command (has _config with name)
			if ("_config" in item && item._config?.name) {
				const newConfig = attachSubcommand(config, item as AnyCommandBuilder);
				return createCommandBuilder(
					newConfig as CommandConfig<TInputs & TGlobalInputs, TCtx, TResult>,
				);
			}

			// It's a trait
			const tr = item as AnyTrait;
			const newConfig = applyTrait(config, tr, false);
			if (!newConfig) {
				return builder; // Trait already applied
			}
			return createCommandBuilder(
				newConfig as CommandConfig<TInputs & TGlobalInputs, TCtx, TResult>,
			);
		}) as CommandBuilder<TInputs, TGlobalInputs, TCtx, TResult>["use"],

		parse(argv?: string[]): ParsedInputs<TInputs & TGlobalInputs> {
			const args = argv ?? process.argv.slice(2);
			const parsed = parseArgv(args);

			const effectiveParsed: ParsedArgv = {
				commands: [],
				positionals: [...parsed.commands, ...parsed.positionals],
				flags: parsed.flags,
				passthrough: parsed.passthrough,
			};

			const allSchema = { ...config.globalInputSchema, ...config.inputSchema };
			const resolved = resolveInputs(
				effectiveParsed,
				allSchema,
				process.env as Record<string, string>,
			);
			const validated = validateInputs(resolved, allSchema);

			return {
				inputs: validated as TInputs & TGlobalInputs,
				passthrough: parsed.passthrough,
			};
		},

		async run(argv?: string[]): Promise<TResult> {
			const args = argv ?? process.argv.slice(2);
			const parsed = parseArgv(args);

			return executeCommand(
				config as AnyCommandConfig,
				parsed,
				[],
				process.env as Record<string, string>,
			) as Promise<TResult>;
		},
	};

	return builder;
}

export function command(
	name: string,
): CommandBuilder<
	Record<string, unknown>,
	Record<string, unknown>,
	unknown,
	void
> {
	const config = createEmptyCommandConfig(name);

	return createCommandBuilder(config) as CommandBuilder<
		Record<string, unknown>,
		Record<string, unknown>,
		unknown,
		void
	>;
}
