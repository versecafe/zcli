import { describe, expect, it } from "bun:test";
import { z } from "zod";
import {
	generateCompletion,
	getCompletions,
	parseCompletionArgs,
} from "../src/completion.ts";
import { command } from "../src/index.ts";

describe("completion generation", () => {
	const app = command("myapp")
		.globalInputs({
			verbose: z.boolean().default(false).meta({
				flag: "verbose",
				alias: "v",
				description: "Enable verbose output",
			}),
			config: z.string().optional().meta({
				flag: "config",
				alias: "c",
				description: "Path to config file",
			}),
		})
		.use(
			command("init")
				.meta({ description: "Initialize a new project" })
				.inputs({
					name: z.string().optional().meta({ positional: 0 }),
					template: z
						.enum(["basic", "full"])
						.default("basic")
						.meta({
							flag: "template",
							alias: "t",
							description: "Project template",
							completion: ["basic", "full"],
						}),
				}),
		)
		.use(
			command("build")
				.meta({ description: "Build the project" })
				.inputs({
					watch: z.boolean().default(false).meta({
						flag: "watch",
						alias: "w",
						description: "Watch mode",
					}),
				}),
		);

	describe("bash", () => {
		it("generates bash completion script", () => {
			const script = generateCompletion(app._config, "bash");

			expect(script).toContain("# Bash completion for myapp");
			expect(script).toContain("_myapp_completions()");
			expect(script).toContain("--get-completions");
			expect(script).toContain(
				"complete -o default -o bashdefault -F _myapp_completions myapp",
			);
		});
	});

	describe("zsh", () => {
		it("generates zsh completion script", () => {
			const script = generateCompletion(app._config, "zsh");

			expect(script).toContain("#compdef myapp");
			expect(script).toContain("_myapp()");
			expect(script).toContain("--get-completions");
		});
	});

	describe("fish", () => {
		it("generates fish completion script", () => {
			const script = generateCompletion(app._config, "fish");

			expect(script).toContain("# Fish completion for myapp");
			expect(script).toContain("complete -c myapp");
			expect(script).toContain("--get-completions");
		});
	});
});

describe("getCompletions", () => {
	const app = command("myapp")
		.globalInputs({
			verbose: z.boolean().default(false).meta({
				flag: "verbose",
				alias: "v",
				description: "Enable verbose output",
			}),
			config: z.string().optional().meta({
				flag: "config",
				alias: "c",
				description: "Path to config file",
				completion: "file",
			}),
		})
		.use(
			command("init")
				.meta({ description: "Initialize a new project" })
				.inputs({
					name: z.string().optional().meta({ positional: 0 }),
					template: z
						.enum(["basic", "full"])
						.default("basic")
						.meta({
							flag: "template",
							alias: "t",
							description: "Project template",
							completion: ["basic", "full"],
						}),
				}),
		)
		.use(
			command("build")
				.meta({ description: "Build the project" })
				.inputs({
					watch: z.boolean().default(false).meta({
						flag: "watch",
						alias: "w",
						description: "Watch mode",
					}),
				}),
		);

	it("completes subcommands", async () => {
		const completions = await getCompletions(app._config, {
			words: ["myapp", ""],
			currentWord: "",
			currentIndex: 1,
		});

		expect(completions.map((c) => c.value)).toContain("init");
		expect(completions.map((c) => c.value)).toContain("build");
	});

	it("completes subcommands with partial match", async () => {
		const completions = await getCompletions(app._config, {
			words: ["myapp", "in"],
			currentWord: "in",
			currentIndex: 1,
		});

		expect(completions.map((c) => c.value)).toEqual(["init"]);
	});

	it("completes flags when starting with -", async () => {
		const completions = await getCompletions(app._config, {
			words: ["myapp", "--"],
			currentWord: "--",
			currentIndex: 1,
		});

		expect(completions.map((c) => c.value)).toContain("--verbose");
		expect(completions.map((c) => c.value)).toContain("--config");
	});

	it("completes flags with partial match", async () => {
		const completions = await getCompletions(app._config, {
			words: ["myapp", "--ver"],
			currentWord: "--ver",
			currentIndex: 1,
		});

		expect(completions.map((c) => c.value)).toEqual(["--verbose"]);
	});

	it("completes short flags", async () => {
		const completions = await getCompletions(app._config, {
			words: ["myapp", "-v"],
			currentWord: "-v",
			currentIndex: 1,
		});

		expect(completions.map((c) => c.value)).toContain("-v");
	});

	it("completes flag values from array", async () => {
		const completions = await getCompletions(app._config, {
			words: ["myapp", "init", "--template", ""],
			currentWord: "",
			currentIndex: 3,
		});

		expect(completions.map((c) => c.value)).toEqual(["basic", "full"]);
	});

	it("completes flag values with partial match", async () => {
		const completions = await getCompletions(app._config, {
			words: ["myapp", "init", "--template", "ba"],
			currentWord: "ba",
			currentIndex: 3,
		});

		expect(completions.map((c) => c.value)).toEqual(["basic"]);
	});

	it("completes subcommand-specific flags", async () => {
		const completions = await getCompletions(app._config, {
			words: ["myapp", "build", "--"],
			currentWord: "--",
			currentIndex: 2,
		});

		expect(completions.map((c) => c.value)).toContain("--watch");
		expect(completions.map((c) => c.value)).toContain("--verbose");
	});
});

describe("parseCompletionArgs", () => {
	it("parses completion args correctly", () => {
		const ctx = parseCompletionArgs(["2", "myapp", "init", ""]);

		expect(ctx).toEqual({
			words: ["myapp", "init", ""],
			currentWord: "",
			currentIndex: 2,
		});
	});

	it("returns null for invalid args", () => {
		expect(parseCompletionArgs([])).toBeNull();
		expect(parseCompletionArgs(["notanumber", "foo"])).toBeNull();
	});
});
