import type { z } from "zod";
import type { InputSchema, Prettify, Trait } from "./types.ts";

type InferInputs<T extends InputSchema> = {
	[K in keyof T]: z.infer<T[K]>;
};

export interface TraitBuilder<
	TTraitInputs extends Record<string, unknown> = Record<string, unknown>,
> extends Trait<TTraitInputs, unknown, Record<string, unknown>> {
	/**
	 * Add a resolve function that provides context.
	 * The resolve function receives the parsed inputs and current context,
	 * and returns additional context to be merged.
	 */
	withResolve<TProvideCtx extends Record<string, unknown>>(
		fn: (args: {
			inputs: Prettify<TTraitInputs>;
			ctx: unknown;
		}) => TProvideCtx | Promise<TProvideCtx>,
	): Trait<TTraitInputs, unknown, TProvideCtx>;

	/**
	 * Add a resolve function that requires a specific context type.
	 * Use this when your trait depends on context provided by other traits.
	 */
	withResolve<TProvideCtx extends Record<string, unknown>, TRequireCtx>(
		fn: (args: {
			inputs: Prettify<TTraitInputs>;
			ctx: TRequireCtx;
		}) => TProvideCtx | Promise<TProvideCtx>,
	): Trait<TTraitInputs, TRequireCtx, TProvideCtx>;
}

interface TraitOptions {
	name?: string;
}

export function trait<T extends InputSchema>(
	schema: T,
	options?: TraitOptions,
): TraitBuilder<InferInputs<T>> {
	type TTraitInputs = InferInputs<T>;

	return {
		get "~inputs"(): TTraitInputs {
			return undefined as unknown as TTraitInputs;
		},
		get "~requireCtx"(): unknown {
			return undefined as unknown;
		},
		get "~provideCtx"(): Record<string, unknown> {
			return undefined as unknown as Record<string, unknown>;
		},
		name: options?.name,
		inputSchema: schema,
		withResolve<
			TProvideCtx extends Record<string, unknown>,
			TRequireCtx = unknown,
		>(
			fn: (args: {
				inputs: Prettify<TTraitInputs>;
				ctx: TRequireCtx;
			}) => TProvideCtx | Promise<TProvideCtx>,
		): Trait<TTraitInputs, TRequireCtx, TProvideCtx> {
			return {
				get "~inputs"(): TTraitInputs {
					return undefined as unknown as TTraitInputs;
				},
				get "~requireCtx"(): TRequireCtx {
					return undefined as unknown as TRequireCtx;
				},
				get "~provideCtx"(): TProvideCtx {
					return undefined as unknown as TProvideCtx;
				},
				name: options?.name,
				inputSchema: schema,
				resolve: fn as Trait<TTraitInputs, TRequireCtx, TProvideCtx>["resolve"],
			};
		},
	};
}
