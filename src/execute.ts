import { z } from "zod";
import {
	UnknownCommandError,
	UnknownFlagError,
	ValidationError,
} from "./errors.ts";
import { generateHelp } from "./help.ts";
import { getInternalDef } from "./internal/zod.ts";
import { getMeta } from "./meta.ts";
import type { ParsedArgv } from "./parser.ts";
import type {
	AfterHookFn,
	AnyCommandConfig,
	HookFn,
	InputSchema,
	TraitConfig,
} from "./types.ts";
import { toCamelCase, toKebabCase } from "./utils/case.ts";

export interface ExecuteOptions {
	strictFlags?: boolean;
	strictCommands?: boolean;
}

function getUnwrappedType(schema: z.ZodType): string | undefined {
	const def = getInternalDef(schema);
	if (!def) return undefined;

	const type = def.type ?? def.typeName;

	if (type === "optional" || type === "nullable" || type === "default") {
		if (def.innerType) return getUnwrappedType(def.innerType);
	}

	return type;
}

export function resolveInputs(
	parsed: ParsedArgv,
	inputSchema: InputSchema,
	env: Record<string, string | undefined>,
	options: { strictFlags?: boolean } = {},
): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	const positionalSchemas: Array<{
		key: string;
		schema: z.ZodType;
		index: number;
	}> = [];
	const flagSchemas: Map<string, { key: string; schema: z.ZodType }> =
		new Map();
	const aliasMap: Map<string, string> = new Map();

	for (const [key, schema] of Object.entries(inputSchema)) {
		const meta = getMeta(schema);

		if (typeof meta.positional === "number") {
			positionalSchemas.push({ key, schema, index: meta.positional });
		} else {
			const flagName = meta.flag ?? toKebabCase(key);
			flagSchemas.set(flagName, { key, schema });

			if (meta.alias) {
				aliasMap.set(meta.alias, flagName);
			}

			if (meta.negatable) {
				flagSchemas.set(`no-${flagName}`, { key, schema });
			}
		}
	}

	positionalSchemas.sort((a, b) => a.index - b.index);

	for (let i = 0; i < positionalSchemas.length; i++) {
		const posSchema = positionalSchemas[i];
		if (!posSchema) continue;
		const innerType = getUnwrappedType(posSchema.schema);

		if (innerType === "array" && i === positionalSchemas.length - 1) {
			result[posSchema.key] = parsed.positionals.slice(i);
		} else {
			result[posSchema.key] = parsed.positionals[i];
		}
	}

	const availableFlags = Array.from(flagSchemas.keys());

	for (const [flagKey, flagValue] of Object.entries(parsed.flags)) {
		let resolvedKey = flagKey;

		const aliasValue = aliasMap.get(flagKey);
		if (aliasValue !== undefined) {
			resolvedKey = aliasValue;
		}

		const camelKey = toCamelCase(resolvedKey);
		if (flagSchemas.has(camelKey)) {
			resolvedKey = camelKey;
		}

		const flagInfo = flagSchemas.get(resolvedKey);

		if (!flagInfo) {
			if (options.strictFlags) {
				throw new UnknownFlagError(flagKey, availableFlags);
			}
			continue;
		}

		const { key, schema } = flagInfo;
		const meta = getMeta(schema);

		if (resolvedKey.startsWith("no-") && meta.negatable) {
			result[key] = false;
		} else if (flagValue === true) {
			result[key] = true;
		} else if (flagValue === "false") {
			result[key] = false;
		} else if (flagValue === "true") {
			result[key] = true;
		} else {
			result[key] = flagValue;
		}
	}

	for (const [, { key, schema }] of flagSchemas) {
		if (result[key] !== undefined) continue;

		const meta = getMeta(schema);
		const envValue = meta.env ? env[meta.env] : undefined;
		if (envValue !== undefined) {
			const innerType = getUnwrappedType(schema);

			if (innerType === "boolean" || innerType === "stringbool") {
				result[key] =
					envValue === "true" || envValue === "1" || envValue === "yes";
			} else if (
				innerType === "number" ||
				innerType === "int32" ||
				innerType === "float64"
			) {
				result[key] = Number(envValue);
			} else {
				result[key] = envValue;
			}
		}
	}

	return result;
}

export function validateInputs(
	inputs: Record<string, unknown>,
	inputSchema: InputSchema,
): Record<string, unknown> {
	const schemaShape: Record<string, z.ZodType> = {};

	for (const [key, schema] of Object.entries(inputSchema)) {
		schemaShape[key] = schema;
	}

	const fullSchema = z.object(schemaShape);
	const parseResult = fullSchema.safeParse(inputs);

	if (!parseResult.success) {
		throw new ValidationError(parseResult.error);
	}

	return parseResult.data as Record<string, unknown>;
}

export function mergeGlobalInputs(
	config: AnyCommandConfig,
	globalInputSchema: InputSchema,
	parentTraits: TraitConfig[] = [],
): AnyCommandConfig {
	const mergedTraits = [...parentTraits, ...config.traits];
	const newSubcommands = new Map<string, AnyCommandConfig>();
	for (const [name, sub] of config.subcommands) {
		const subMergedGlobals = {
			...globalInputSchema,
			...sub.globalInputSchema,
		};
		newSubcommands.set(
			name,
			mergeGlobalInputs(sub, subMergedGlobals, mergedTraits),
		);
	}
	return {
		...config,
		globalInputSchema,
		traits: mergedTraits,
		subcommands: newSubcommands,
	};
}

export async function executeCommand(
	config: AnyCommandConfig,
	parsed: ParsedArgv,
	commandPath: string[],
	env: Record<string, string | undefined>,
	parentCtx?: unknown,
	options: ExecuteOptions = {},
): Promise<unknown> {
	// Resolve context for current level (needed for passing to subcommands)
	const currentCtx: unknown = config.contextProvider
		? await config.contextProvider()
		: parentCtx;

	if (parsed.commands.length > 0 && config.subcommands.size > 0) {
		const subName = parsed.commands[0];
		if (subName === undefined) return;
		const subcommand = config.subcommands.get(subName);

		if (subcommand) {
			const remainingParsed: ParsedArgv = {
				commands: parsed.commands.slice(1),
				positionals: parsed.positionals,
				flags: parsed.flags,
				passthrough: parsed.passthrough,
			};

			return executeCommand(
				subcommand,
				remainingParsed,
				[...commandPath, subName],
				env,
				currentCtx,
				options,
			);
		}

		if (options.strictCommands !== false) {
			const availableCommands = Array.from(config.subcommands.keys());
			throw new UnknownCommandError(subName, availableCommands);
		}
	}

	if (parsed.flags.help === true || parsed.flags.h === true) {
		console.log(generateHelp(config, commandPath));
		return undefined;
	}

	const effectiveParsed: ParsedArgv = {
		commands: [],
		positionals: [...parsed.commands, ...parsed.positionals],
		flags: parsed.flags,
		passthrough: parsed.passthrough,
	};

	const allSchema = { ...config.globalInputSchema, ...config.inputSchema };
	const resolved = resolveInputs(effectiveParsed, allSchema, env, {
		strictFlags: options.strictFlags,
	});
	const validated = validateInputs(resolved, allSchema);

	// Use already-resolved context (from top of function)
	let ctx: unknown = currentCtx;

	for (const traitConfig of config.traits) {
		if (traitConfig.resolve) {
			const traitCtx = await traitConfig.resolve({
				inputs: validated,
				ctx,
			});
			ctx = { ...(ctx as object), ...traitCtx };
		}
	}

	for (const hook of config.beforeHooks as HookFn[]) {
		await hook({
			inputs: validated,
			ctx,
			command: commandPath,
		});
	}

	let result: unknown;

	if (config.action) {
		result = await config.action({
			inputs: validated,
			passthrough: parsed.passthrough,
			ctx,
			command: commandPath,
		});
	} else {
		console.log(generateHelp(config, commandPath));
		result = undefined;
	}

	for (const hook of config.afterHooks as AfterHookFn[]) {
		await hook({
			inputs: validated,
			ctx,
			command: commandPath,
			result,
		});
	}

	return result;
}
