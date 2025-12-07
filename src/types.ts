import type { z } from "zod";
import type { CliMeta } from "./meta.ts";

export type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

export type UnionToIntersect<U> = (
	U extends unknown
		? (arg: U) => 0
		: never
) extends (arg: infer I) => 0
	? I
	: never;

declare const POS: unique symbol;

export type PosBrand<N extends number> = {
	readonly [POS]: { kind: "pos"; index: N };
};
export type NonPosBrand = { readonly [POS]: { kind: "none" } };

/**
 * Helper to create a positional input with proper type branding.
 * Use this instead of .meta({ positional: N }) to get compile-time validation.
 *
 * @example
 * ```ts
 * command("greet").inputs({
 *   name: positional(z.string(), 0),
 *   greeting: positional(z.string().default("Hello"), 1),
 * })
 * ```
 */
export function positional<T extends z.ZodType, N extends number>(
	schema: T,
	index: N,
	meta?: Omit<CliMeta, "positional">,
): T & PosBrand<N> {
	return schema.meta({ ...meta, positional: index }) as unknown as T &
		PosBrand<N>;
}

/**
 * Helper to create a flag input with proper type branding.
 *
 * @example
 * ```ts
 * command("serve").inputs({
 *   port: flag(z.coerce.number().default(3000), "port", { alias: "p" }),
 *   verbose: flag(z.boolean().default(false), "verbose"),
 * })
 * ```
 */
export function flag<T extends z.ZodType>(
	schema: T,
	name: string,
	meta?: Omit<CliMeta, "flag">,
): T & NonPosBrand {
	return schema.meta({ ...meta, flag: name }) as unknown as T & NonPosBrand;
}

/**
 * Helper to attach CLI metadata to a schema with proper type branding.
 * Use this instead of .meta() to get compile-time validation of positional indices.
 *
 * @example
 * ```ts
 * command("greet").inputs({
 *   name: cliMeta(z.string(), { positional: 0 }),
 *   greeting: cliMeta(z.string().default("Hello"), { positional: 1, description: "Greeting" }),
 *   verbose: cliMeta(z.boolean(), { flag: "verbose", alias: "v" }),
 * })
 * ```
 */
export function cliMeta<T extends z.ZodType, M extends CliMeta>(
	schema: T,
	meta: M,
): M extends { positional: infer N extends number }
	? T & PosBrand<N>
	: T & NonPosBrand {
	return schema.meta(meta) as unknown as M extends {
		positional: infer N extends number;
	}
		? T & PosBrand<N>
		: T & NonPosBrand;
}

export type GetPos<T> = T extends {
	readonly [POS]: { kind: "pos"; index: infer N extends number };
}
	? N
	: never;

export type GetPositionals<T extends Record<string, z.ZodType>> = {
	[K in keyof T]: GetPos<T[K]>;
}[keyof T];

type MaxOfImpl<T extends number> = 9 extends T
	? 9
	: 8 extends T
		? 8
		: 7 extends T
			? 7
			: 6 extends T
				? 6
				: 5 extends T
					? 5
					: 4 extends T
						? 4
						: 3 extends T
							? 3
							: 2 extends T
								? 2
								: 1 extends T
									? 1
									: 0 extends T
										? 0
										: -1;

export type MaxOf<T extends number> = MaxOfImpl<T>;

type ExpectedSeqMap = {
	[-1]: never;
	0: 0;
	1: 0 | 1;
	2: 0 | 1 | 2;
	3: 0 | 1 | 2 | 3;
	4: 0 | 1 | 2 | 3 | 4;
	5: 0 | 1 | 2 | 3 | 4 | 5;
	6: 0 | 1 | 2 | 3 | 4 | 5 | 6;
	7: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
	8: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
	9: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
};

export type ExpectedSeq<Max extends number> = Max extends keyof ExpectedSeqMap
	? ExpectedSeqMap[Max]
	: never;

export type Eq<A, B> = [A] extends [B]
	? [B] extends [A]
		? true
		: false
	: false;

export type IsSequential<T extends number> = [T] extends [never]
	? true
	: Eq<T, ExpectedSeq<MaxOf<T>>>;

type KeysWithPositional<
	T extends Record<string, z.ZodType>,
	N extends number,
> = {
	[K in keyof T]: [GetPos<T[K]>] extends [never]
		? never
		: GetPos<T[K]> extends N
			? K
			: never;
}[keyof T];

type IsUnion<U> = (U extends unknown ? (k: U) => void : never) extends (
	k: infer I,
) => void
	? [U] extends [I]
		? false
		: true
	: false;

type HasDupAtPos<
	T extends Record<string, z.ZodType>,
	N extends number,
> = IsUnion<KeysWithPositional<T, N>>;

export type HasDuplicatePositionals<T extends Record<string, z.ZodType>> =
	true extends
		| HasDupAtPos<T, 0>
		| HasDupAtPos<T, 1>
		| HasDupAtPos<T, 2>
		| HasDupAtPos<T, 3>
		| HasDupAtPos<T, 4>
		| HasDupAtPos<T, 5>
		| HasDupAtPos<T, 6>
		| HasDupAtPos<T, 7>
		| HasDupAtPos<T, 8>
		| HasDupAtPos<T, 9>
		? true
		: false;

type PositionalErrorBrand = { readonly __brand: unique symbol };

export type PositionalError<T extends Record<string, z.ZodType>> =
	HasDuplicatePositionals<T> extends true
		? PositionalErrorBrand &
				"Error: Duplicate positional indices detected. Each positional must have a unique index."
		: IsSequential<GetPositionals<T>> extends true
			? never
			: PositionalErrorBrand &
					"Error: Positional indices must be sequential starting from 0. (e.g., 0, 1, 2 - not 0, 2)";

export type ValidInputs<T extends Record<string, z.ZodType>> =
	HasDuplicatePositionals<T> extends true
		? never
		: IsSequential<GetPositionals<T>> extends true
			? T
			: never;

export type AssertValidInputs<T extends Record<string, z.ZodType>> =
	PositionalError<T> extends never ? T : PositionalError<T>;

export interface CommandMeta {
	description?: string;
	examples?: string[];
	hidden?: boolean;
	deprecated?: string;
	aliases?: string[];
	category?: string;
}

export interface ParsedInputs<T = Record<string, unknown>> {
	inputs: T;
	passthrough: string[];
}

export interface ActionContext<
	TInputs = Record<string, unknown>,
	TCtx = unknown,
> {
	inputs: TInputs;
	passthrough: string[];
	ctx: TCtx;
	command: string[];
}

export type ActionFn<TInputs, TCtx, TResult> = (
	context: ActionContext<TInputs, TCtx>,
) => TResult | Promise<TResult>;

export type HookFn<TCtx = unknown> = (context: {
	inputs: Record<string, unknown>;
	ctx: TCtx;
	command: string[];
}) => void | Promise<void>;

export type AfterHookFn<TCtx = unknown, TResult = unknown> = (context: {
	inputs: Record<string, unknown>;
	ctx: TCtx;
	command: string[];
	result: TResult;
}) => void | Promise<void>;

export interface InputSchema {
	[key: string]: z.ZodType;
}

export interface CommandConfig<
	TInputs extends Record<string, unknown> = Record<string, unknown>,
	TCtx = unknown,
	TResult = unknown,
> {
	name: string;
	meta: CommandMeta;
	inputSchema: InputSchema;
	globalInputSchema: InputSchema;
	action?: ActionFn<TInputs, TCtx, TResult>;
	subcommands: Map<string, AnyCommandConfig>;
	beforeHooks: HookFn<TCtx>[];
	afterHooks: AfterHookFn<TCtx, TResult>[];
	traits: TraitConfig[];
	contextProvider?:
		| (() => TCtx | Promise<TCtx>)
		| (() => unknown | Promise<unknown>);
}

export interface ErrorContext {
	error: Error;
	command: string[];
}

// Note: void is intentionally included to allow handlers that don't return anything
// biome-ignore lint/suspicious/noConfusingVoidType: void is needed for functions that don't explicitly return
export type ErrorHandlerResult = void | undefined | { handled: true };

export type ErrorHandler = (
	context: ErrorContext,
) => ErrorHandlerResult | Promise<ErrorHandlerResult>;

export interface CliConfig {
	name: string;
	version?: string;
	description?: string;
	strictFlags?: boolean;
	strictCommands?: boolean;
}

// Type-erased command config that accepts any command regardless of result type.
// Using structural typing with unknown[] for hook arrays avoids variance issues
// when commands have `never` as result type (e.g., actions that only throw).
export interface AnyCommandConfig {
	name: string;
	meta: CommandMeta;
	inputSchema: InputSchema;
	globalInputSchema: InputSchema;
	// biome-ignore lint/suspicious/noExplicitAny: type erasure needed - actions have heterogeneous types
	action?: ActionFn<any, any, any>;
	subcommands: Map<string, AnyCommandConfig>;
	beforeHooks: unknown[];
	afterHooks: unknown[];
	traits: TraitConfig[];
	contextProvider?: (() => unknown | Promise<unknown>) | undefined;
}

export interface Trait<
	TTraitInputs extends Record<string, unknown> = Record<string, unknown>,
	TRequireCtx = unknown,
	TProvideCtx extends Record<string, unknown> = Record<string, unknown>,
> {
	readonly "~inputs": TTraitInputs;
	readonly "~requireCtx": TRequireCtx;
	readonly "~provideCtx": TProvideCtx;
	readonly name?: string;
	readonly inputSchema: InputSchema;
	readonly resolve?: (args: {
		inputs: TTraitInputs;
		ctx: TRequireCtx;
	}) => TProvideCtx | Promise<TProvideCtx>;
}

// biome-ignore lint/suspicious/noExplicitAny: type erasure needed
export type AnyTrait = Trait<any, any, any>;

export interface TraitConfig {
	name?: string;
	inputSchema: InputSchema;
	resolve?: (args: {
		inputs: Record<string, unknown>;
		ctx: unknown;
	}) => Record<string, unknown> | Promise<Record<string, unknown>>;
}
