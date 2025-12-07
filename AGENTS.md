# Codebase Architecture

## Overview

**@versecafe/zcli** is a TypeScript CLI framework built on Zod 4 that uses Zod schemas to define commands, arguments, and flags with full type inference.

```
src/
  index.ts           → Public API exports
  builders/          → CLI and Command builder APIs
  types.ts           → Core types, input helpers (positional, flag, cliMeta)
  meta.ts            → CliMeta interface, Zod module augmentation
  parser.ts          → Argv parser (flags, commands, positionals, passthrough)
  execute.ts         → Command execution, input resolution/validation
  help.ts            → Help text generation
  completion.ts      → Shell completion (bash, zsh, fish, powershell)
  errors.ts          → Error hierarchy (CliError, ValidationError, etc.)
  trait.ts           → Trait system for shared inputs + context
  test-cli.ts        → Test helper for capturing stdout/stderr/exit
  internal/          → Zod internals access
  utils/             → Terminal, case conversion, fuzzy matching
```

## Core Concepts

### Builders

- **`cli(name)`** - Creates root CLI with global inputs, context, and commands
- **`command(name)`** - Creates standalone command or subcommand
- Both use immutable fluent API - each method returns a new instance

### Input System

Inputs are Zod schemas with CLI metadata attached via `.meta()`:

```ts
// Helpers apply metadata and type branding
positional(z.string(), 0); // Position 0 argument
flag(z.number().default(3000), "port", { alias: "p" }); // --port/-p flag

// Or use raw .meta():
z.string().meta({ positional: 0, description: "Name" });
z.boolean().meta({ flag: "verbose", alias: "v", env: "VERBOSE" });
```

Type branding (`PosBrand<N>`, `NonPosBrand`) enables compile-time validation:

- Positional indices must be sequential (0, 1, 2...)
- No duplicate positional indices allowed

### Traits

Traits package reusable inputs + context resolution:

```ts
const authTrait = trait({
  token: flag(z.string(), "token", { env: "TOKEN" }),
}).withResolve(({ inputs }) => ({
  auth: { token: inputs.token },
}));

// Apply to CLI (global) or command (local)
cli("app").use(authTrait);
command("serve").use(authTrait);
```

### Execution Flow

1. `parse(argv)` → `ParsedArgv` (commands, positionals, flags, passthrough)
2. `resolveInputs()` → Maps parsed args to schema keys, resolves env vars
3. `validateInputs()` → Zod validation, throws `ValidationError` on failure
4. Context provider called if defined
5. Trait resolvers called sequentially, merged into context
6. Before hooks → action → after hooks

### Help & Completion

- `--help`/`-h` automatically handled
- `--version`/`-V` if version set on CLI
- `generateCompletionScript(config, shell)` for bash/zsh/fish/powershell
- Runtime completion via `--get-completions`

## Key Files

| File                              | Purpose                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `src/builders/cli-builder.ts`     | `Cli` interface, `cli()` factory, `.run()` entrypoint                   |
| `src/builders/command-builder.ts` | `CommandBuilder` interface, `command()` factory                         |
| `src/builders/shared.ts`          | Shared logic: `attachSubcommand`, `applyTrait`, `validatePositionals`   |
| `src/types.ts`                    | `CommandConfig`, `CliConfig`, `Trait`, input helpers with type branding |
| `src/meta.ts`                     | `CliMeta` interface, Zod module augmentation for `.meta()`              |
| `src/execute.ts`                  | `executeCommand`, `resolveInputs`, `validateInputs`                     |
| `src/parser.ts`                   | `parse()` function for argv tokenization                                |
| `src/help.ts`                     | `generateHelp()`, `generateVersion()`                                   |
| `src/completion.ts`               | Shell completion scripts and runtime completion                         |
| `src/errors.ts`                   | `CliError` hierarchy, `formatError`, `getExitCode`                      |
| `src/trait.ts`                    | `trait()` factory, `TraitBuilder` interface                             |
| `src/test-cli.ts`                 | `testCli()` for testing CLI behavior                                    |

## Type System

### Config Types

- `CommandConfig<TInputs, TCtx, TResult>` - Full command configuration
- `CliConfig` - CLI-level settings (name, version, strict modes)
- `Trait<TTraitInputs, TRequireCtx, TProvideCtx>` - Trait type with context flow

### Input Validation Types

- `InputSchema` - `Record<string, z.ZodType>`
- `PositionalError<T>` - Compile-time error for invalid positional indices
- `ValidInputs<T>` - Only valid if positionals are sequential and unique

### Action Types

- `ActionContext<TInputs, TCtx>` - `{ inputs, passthrough, ctx, command }`
- `ActionFn`, `HookFn`, `AfterHookFn` - Handler signatures

## Commands

- **Test**: `bun test`
- **Lint**: `bun run lint`
- **Fix**: `bun run fix`
- **Typecheck**: `bun run typecheck`

## Code Quality

**Use tabs for indentation.** This project uses tabs throughout.

**Avoid `any` types** - use proper typing:

- Use `unknown` when type is unknown, then narrow with type guards
- Use Zod schemas for runtime type narrowing
- Define explicit interfaces for complex structures

**Avoid linter suppressions** unless truly necessary. The few existing suppressions (`AnyCommandConfig`, `AnyTrait`) are for type erasure at variance boundaries.

## Testing

Use `testCli()` helper to test CLI behavior:

```ts
import { testCli } from "@versecafe/zcli";

const result = await testCli(myCli, ["--help"]);
expect(result.exitCode).toBe(0);
expect(result.stdout).toContain("Usage:");
```
