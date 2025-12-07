import type { z } from "zod";
import { InvalidPositionalError } from "../errors.ts";
import { mergeGlobalInputs } from "../execute.ts";
import { getMeta } from "../meta.ts";
import type {
	AnyCommandConfig,
	AnyTrait,
	CommandConfig,
	CommandMeta,
	InputSchema,
	TraitConfig,
} from "../types.ts";

export type InferInputs<T extends InputSchema> = {
	[K in keyof T]: z.infer<T[K]>;
};

export type AnyCommandBuilder = { _config: AnyCommandConfig };

/**
 * Shared logic for attaching a subcommand to a command config.
 * Used by both CommandBuilder and Cli.
 */
export function attachSubcommand(
	config: AnyCommandConfig,
	subcommand: AnyCommandBuilder,
): AnyCommandConfig {
	const subConfig = subcommand._config;
	const mergedGlobalInputSchema = {
		...config.globalInputSchema,
		...subConfig.globalInputSchema,
	};
	const newSubcommands = new Map(config.subcommands);
	newSubcommands.set(
		subConfig.name,
		mergeGlobalInputs(subConfig, mergedGlobalInputSchema, config.traits),
	);
	return {
		...config,
		subcommands: newSubcommands,
	};
}

/**
 * Shared logic for applying a trait to a command config.
 * Used by both CommandBuilder (adds to inputSchema) and Cli (adds to globalInputSchema).
 */
export function applyTrait(
	config: AnyCommandConfig,
	tr: AnyTrait,
	asGlobal: boolean,
): AnyCommandConfig | null {
	// Check for deduplication by name
	if (tr.name && config.traits.some((t) => t.name === tr.name)) {
		return null; // Already applied
	}

	const traitConfig: TraitConfig = {
		name: tr.name,
		inputSchema: tr.inputSchema,
		resolve: tr.resolve as TraitConfig["resolve"],
	};

	if (asGlobal) {
		return {
			...config,
			globalInputSchema: {
				...config.globalInputSchema,
				...tr.inputSchema,
			},
			traits: [...config.traits, traitConfig],
		};
	}

	return {
		...config,
		inputSchema: { ...config.inputSchema, ...tr.inputSchema },
		traits: [...config.traits, traitConfig],
	};
}

/**
 * Create an empty command config with the given name.
 */
export function createEmptyCommandConfig(
	name: string,
	globalInputSchema: InputSchema = {},
	meta: CommandMeta = {},
): CommandConfig<Record<string, unknown>, unknown, void> {
	return {
		name,
		meta,
		inputSchema: {},
		globalInputSchema,
		subcommands: new Map(),
		beforeHooks: [],
		afterHooks: [],
		traits: [],
	};
}

/**
 * Validate that positional indices in an input schema are valid:
 * - No duplicate indices
 * - Sequential starting from 0 (no gaps)
 *
 * This provides runtime validation for cases where type-level
 * validation isn't available (e.g., direct .meta() usage without helpers).
 */
export function validatePositionals(schema: InputSchema): void {
	const positionals: Array<{ key: string; index: number }> = [];

	for (const [key, zodSchema] of Object.entries(schema)) {
		const meta = getMeta(zodSchema);
		if (typeof meta.positional === "number") {
			positionals.push({ key, index: meta.positional });
		}
	}

	if (positionals.length === 0) {
		return;
	}

	// Check for duplicates
	const seen = new Map<number, string>();
	for (const { key, index } of positionals) {
		const existing = seen.get(index);
		if (existing !== undefined) {
			throw new InvalidPositionalError(
				`Duplicate positional index ${index}: both "${existing}" and "${key}" have positional: ${index}`,
			);
		}
		seen.set(index, key);
	}

	// Check for sequential indices starting from 0
	const indices = positionals.map((p) => p.index).sort((a, b) => a - b);
	for (let i = 0; i < indices.length; i++) {
		if (indices[i] !== i) {
			const missing: number[] = [];
			const lastIndex = indices[indices.length - 1];
			if (lastIndex !== undefined) {
				const indexSet = new Set(indices);
				for (let j = 0; j < lastIndex; j++) {
					if (!indexSet.has(j)) {
						missing.push(j);
					}
				}
			}
			if (indices[0] !== 0) {
				throw new InvalidPositionalError(
					`Positional indices must start at 0. Found indices: [${indices.join(", ")}]`,
				);
			}
			throw new InvalidPositionalError(
				`Positional indices must be sequential. Missing index(es): [${missing.join(", ")}]. Found: [${indices.join(", ")}]`,
			);
		}
	}
}
