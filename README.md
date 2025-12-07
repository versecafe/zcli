<div align="center">
  <h1>@versecafe/zcli</h1>
  <p>Zod-first CLI framework with static type inference</p>
</div>

## What is @versecafe/zcli?

@versecafe/zcli is a TypeScript-first CLI framework built on [Zod 4](https://zod.dev). Define your CLI arguments and flags as Zod schemas, and get fully typed, validated inputs automatically.

```ts
import { z } from "zod";
import { cli, command, positional, flag } from "@versecafe/zcli";

const greet = command("greet")
  .meta({ description: "Greet someone" })
  .inputs({
    name: positional(z.string(), 0),
    loud: flag(z.boolean().default(false), "loud", { alias: "l" }),
  })
  .action(({ inputs }) => {
    const greeting = `Hello, ${inputs.name}!`;
    console.log(inputs.loud ? greeting.toUpperCase() : greeting);
  });

cli("hello", { version: "1.0.0" }).use(greet).run();
```

```bash
$ hello greet World --loud
HELLO, WORLD!
```

## Features

- **Zero external dependencies** – only Zod as a peer dependency
- **Full type inference** – inputs are fully typed from your Zod schemas
- **Compile-time validation** – catch positional index errors at build time
- **Automatic help** – generated from your schema metadata
- **Shell completions** – bash, zsh, fish, and PowerShell
- **Environment variables** – bind flags to env vars with automatic coercion
- **Traits** – reusable input + context bundles
- **Testing utilities** – capture stdout/stderr/exit code

## Installation

```bash
bun install @versecafe/zcli zod
```

> **Requirements:** @versecafe/zcli requires Zod v4 and TypeScript 5+.

## Basic usage

### Defining a command

```ts
import { z } from "zod";
import { command, positional, flag } from "@versecafe/zcli";

const serve = command("serve")
  .meta({ description: "Start the server" })
  .inputs({
    port: flag(z.coerce.number().default(3000), "port", {
      alias: "p",
      description: "Port to listen on",
      env: "PORT",
    }),
    host: flag(z.string().default("localhost"), "host", {
      description: "Host to bind to",
    }),
  })
  .action(({ inputs }) => {
    console.log(`Server running at http://${inputs.host}:${inputs.port}`);
  });
```

### Building a CLI

```ts
import { cli } from "@versecafe/zcli";

const app = cli("myapp", {
  version: "1.0.0",
  description: "My awesome CLI",
})
  .use(serve)
  .use(otherCommand);

app.run();
```

### Subcommands

```ts
const db = command("db")
  .meta({ description: "Database operations" })
  .command("migrate")
  .meta({ description: "Run migrations" })
  .action(() => {
    /* ... */
  })
  .command("seed")
  .meta({ description: "Seed the database" })
  .action(() => {
    /* ... */
  });

// Creates: myapp db migrate, myapp db seed
```

## Input helpers

### `positional(schema, index, meta?)`

Define a positional argument at a specific index:

```ts
import { positional } from "@versecafe/zcli";

command("copy").inputs({
  source: positional(z.string(), 0, { description: "Source file" }),
  dest: positional(z.string(), 1, { description: "Destination" }),
});
```

```bash
$ myapp copy src/file.ts dist/file.ts
```

### `flag(schema, name, meta?)`

Define a named flag:

```ts
import { flag } from "@versecafe/zcli";

command("build").inputs({
  watch: flag(z.boolean().default(false), "watch", { alias: "w" }),
  outDir: flag(z.string().default("dist"), "out-dir", { alias: "o" }),
});
```

```bash
$ myapp build --watch --out-dir=build
$ myapp build -w -o build
```

### Flag metadata

```ts
flag(z.string(), "token", {
  alias: "t", // Short flag: -t
  description: "API token", // Shown in help
  env: "API_TOKEN", // Read from environment
  hidden: true, // Hide from help
});
```

### Variadic arguments

The last positional can be an array to capture remaining arguments:

```ts
command("run").inputs({
  script: positional(z.string(), 0),
  args: positional(z.array(z.string()).default([]), 1),
});
```

```bash
$ myapp run build.ts --flag value extra args
# script = "build.ts", args = ["extra", "args"]
# flags after -- are passed through
```

### Negatable flags

Boolean flags can be negated with `--no-` prefix:

```ts
flag(z.boolean().default(true), "color", { negatable: true });
```

```bash
$ myapp --no-color  # color = false
```

## Enums and choices

Zod enums work seamlessly:

```ts
const LogLevel = z.enum(["debug", "info", "warn", "error"]);

command("serve").inputs({
  logLevel: flag(LogLevel.default("info"), "log-level"),
});
```

Help output shows available choices:

```
--log-level <debug | info | warn | error>  (default: "info")
```

## Context

Pass typed context to your actions:

```ts
interface AppContext {
  config: Config;
  logger: Logger;
}

cli("myapp")
  .context(async () => ({
    config: await loadConfig(),
    logger: createLogger(),
  }))
  .use(
    command("serve").action(({ ctx }) => {
      ctx.logger.info("Starting server...");
    }),
  );
```

## Traits

Traits bundle reusable inputs and context:

```ts
import { trait, flag } from "@versecafe/zcli";

const verboseTrait = trait({
  verbose: flag(z.boolean().default(false), "verbose", { alias: "v" }),
});

const authTrait = trait({
  token: flag(z.string(), "token", { env: "API_TOKEN" }),
}).withResolve(({ inputs }) => ({
  api: createApiClient(inputs.token),
}));

// Apply to all commands
cli("myapp")
  .use(verboseTrait)
  .use(authTrait)
  .use(
    command("deploy").action(({ inputs, ctx }) => {
      if (inputs.verbose) console.log("Deploying...");
      ctx.api.deploy();
    }),
  );
```

Traits are deduplicated by name – applying the same trait twice has no effect.

## Lifecycle hooks

Run code before and after actions:

```ts
command("deploy")
  .before(({ inputs, ctx }) => {
    console.log("Starting deployment...");
  })
  .action(({ inputs }) => {
    // deploy
  })
  .after(({ inputs, ctx, result }) => {
    console.log("Deployment complete!");
  });
```

## Error handling

```ts
import { CliError, UserError } from "@versecafe/zcli";

// Throw user-facing errors
throw new UserError("Invalid configuration file");

// Custom error handling
cli("myapp").onError(({ error, command }) => {
  if (error instanceof NetworkError) {
    console.error("Network error:", error.message);
    return { handled: true };
  }
  // Return nothing to use default handling
});
```

### Error types

| Error                  | Description                 |
| ---------------------- | --------------------------- |
| `CliError`             | Base error class            |
| `UserError`            | User-facing error           |
| `ValidationError`      | Zod validation failed       |
| `UnknownFlagError`     | Unknown flag provided       |
| `UnknownCommandError`  | Unknown command provided    |
| `MissingArgumentError` | Required positional missing |
| `MissingFlagError`     | Required flag missing       |

## Help generation

Help is automatically generated from your schema:

```bash
$ myapp --help
My awesome CLI

Usage: myapp <command> [options]

Commands:
  serve     Start the server
  build     Build the project

Options:
  -v, --verbose   Enable verbose output
  -h, --help      Show help
  -V, --version   Show version
```

```bash
$ myapp serve --help
Start the server

Usage: myapp serve [options]

Options:
  -p, --port <number>   Port to listen on (default: 3000) (env: PORT)
      --host <string>   Host to bind to (default: "localhost")
```

## Shell completions

Generate shell completion scripts:

```ts
import { generateCompletionScript } from "@versecafe/zcli";

// In your CLI
command("completion")
  .inputs({
    shell: positional(z.enum(["bash", "zsh", "fish", "powershell"]), 0),
  })
  .action(({ inputs }) => {
    console.log(generateCompletionScript(app._config, inputs.shell));
  });
```

```bash
# Install completions
$ myapp completion bash >> ~/.bashrc
$ myapp completion zsh > ~/.zsh/completions/_myapp
$ myapp completion fish > ~/.config/fish/completions/myapp.fish
```

Custom completions for arguments:

```ts
flag(z.string(), "config", {
  completion: "file", // File path completion
});

positional(z.string(), 0, {
  completion: "directory", // Directory completion
});

flag(z.enum(["dev", "prod"]), "env", {
  completion: ["development", "staging", "production"],
});

flag(z.string(), "branch", {
  completion: (partial) => execSync("git branch").toString().split("\n"),
});
```

## Testing

Test your CLI without running a subprocess:

```ts
import { testCli } from "@versecafe/zcli";

test("greet command", async () => {
  const result = await testCli(app, ["greet", "World"]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe("Hello, World!");
  expect(result.stderr).toBe("");
});

test("shows help", async () => {
  const result = await testCli(app, ["--help"]);

  expect(result.stdout).toContain("Usage:");
});
```

## Strict mode

Enable strict mode to catch unknown flags and commands:

```ts
cli("myapp", {
  strictFlags: true, // Error on unknown flags
  strictCommands: true, // Error on unknown commands
});
```

## Passthrough arguments

Arguments after `--` are passed through without parsing:

```ts
command("run")
  .inputs({ script: positional(z.string(), 0) })
  .action(({ inputs, passthrough }) => {
    // myapp run build.ts -- --extra --flags
    // passthrough = ["--extra", "--flags"]
    spawn("node", [inputs.script, ...passthrough]);
  });
```

## API Reference

### Builders

| Function              | Description           |
| --------------------- | --------------------- |
| `cli(name, options?)` | Create a CLI instance |
| `command(name)`       | Create a command      |

### Input Helpers

| Function                           | Description                   |
| ---------------------------------- | ----------------------------- |
| `positional(schema, index, meta?)` | Define a positional argument  |
| `flag(schema, name, meta?)`        | Define a flag                 |
| `cliMeta(schema, meta)`            | Attach metadata to any schema |

### Utilities

| Function                                  | Description                       |
| ----------------------------------------- | --------------------------------- |
| `generateHelp(config, path?)`             | Generate help text                |
| `generateCompletionScript(config, shell)` | Generate shell completion script  |
| `testCli(cmd, argv)`                      | Test CLI capturing output         |
| `parse(argv, options?)`                   | Parse argv into structured result |
| `formatError(error)`                      | Format error for display          |
| `getExitCode(error)`                      | Get exit code for error           |

### Types

| Type             | Description                                  |
| ---------------- | -------------------------------------------- |
| `Cli`            | CLI instance type                            |
| `CommandBuilder` | Command builder type                         |
| `CliConfig`      | CLI configuration                            |
| `CommandConfig`  | Command configuration                        |
| `CliMeta`        | Input metadata (positional, flag, env, etc.) |
| `ActionContext`  | Context passed to actions                    |
| `Trait`          | Trait type                                   |

## License

MIT
