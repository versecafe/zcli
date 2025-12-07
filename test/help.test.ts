import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { generateHelp } from "../src/help.ts";
import { command } from "../src/index.ts";

describe("help generation", () => {
	it("generates basic help", () => {
		const cmd = command("myapp")
			.meta({ description: "A test application" })
			.inputs({
				name: z.string().meta({ positional: 0, description: "The name" }),
				verbose: z
					.boolean()
					.default(false)
					.meta({ flag: "verbose", alias: "v" }),
			});

		const help = generateHelp(cmd._config);

		expect(help).toContain("A test application");
		expect(help).toContain("Usage:");
		expect(help).toContain("myapp");
		expect(help).toContain("<name>");
		expect(help).toContain("--verbose");
		expect(help).toContain("-v");
	});

	it("shows optional positionals with brackets", () => {
		const cmd = command("myapp").inputs({
			name: z.string().optional().meta({ positional: 0 }),
		});

		const help = generateHelp(cmd._config);
		expect(help).toContain("[name]");
	});

	it("shows required positionals with angle brackets", () => {
		const cmd = command("myapp").inputs({
			name: z.string().meta({ positional: 0 }),
		});

		const help = generateHelp(cmd._config);
		expect(help).toContain("<name>");
	});

	it("shows flag defaults", () => {
		const cmd = command("myapp").inputs({
			port: z.coerce
				.number()
				.default(3000)
				.meta({ flag: "port", description: "Port number" }),
		});

		const help = generateHelp(cmd._config);
		expect(help).toContain("(default: 3000)");
	});

	it("shows env var hints", () => {
		const cmd = command("myapp").inputs({
			apiKey: z.string().optional().meta({ flag: "api-key", env: "API_KEY" }),
		});

		const help = generateHelp(cmd._config);
		expect(help).toContain("(env: API_KEY)");
	});

	it("shows subcommands", () => {
		const sub1 = command("init")
			.meta({ description: "Initialize project" })
			.inputs({});
		const sub2 = command("build")
			.meta({ description: "Build project" })
			.inputs({});

		const root = command("myapp").use(sub1).use(sub2);

		const help = generateHelp(root._config);
		expect(help).toContain("Commands:");
		expect(help).toContain("init");
		expect(help).toContain("Initialize project");
		expect(help).toContain("build");
		expect(help).toContain("Build project");
	});

	it("shows examples", () => {
		const cmd = command("myapp")
			.meta({
				description: "Test app",
				examples: ["myapp init my-project", "myapp build --watch"],
			})
			.inputs({});

		const help = generateHelp(cmd._config);
		expect(help).toContain("Examples:");
		expect(help).toContain("$ myapp init my-project");
		expect(help).toContain("$ myapp build --watch");
	});

	it("hides hidden flags", () => {
		const cmd = command("myapp").inputs({
			visible: z.string().optional().meta({ flag: "visible" }),
			secret: z.string().optional().meta({ flag: "secret", hidden: true }),
		});

		const help = generateHelp(cmd._config);
		expect(help).toContain("--visible");
		expect(help).not.toContain("--secret");
	});

	it("shows hidden flags when includeHidden is true", () => {
		const cmd = command("myapp").inputs({
			secret: z.string().optional().meta({ flag: "secret", hidden: true }),
		});

		const help = generateHelp(cmd._config, [], { includeHidden: true });
		expect(help).toContain("--secret");
	});

	it("shows negatable flags correctly", () => {
		const cmd = command("myapp").inputs({
			cache: z.boolean().default(true).meta({
				flag: "cache",
				negatable: true,
				description: "Enable caching",
			}),
		});

		const help = generateHelp(cmd._config);
		expect(help).toContain("--cache");
	});

	it("shows command path in usage", () => {
		const sub = command("deploy")
			.meta({ description: "Deploy the application" })
			.inputs({
				env: z.string().meta({ positional: 0 }),
			});

		const help = generateHelp(sub._config, ["myapp", "deploy"]);
		expect(help).toContain("myapp deploy");
		expect(help).toContain("<env>");
	});

	it("shows deprecated flags", () => {
		const cmd = command("myapp").inputs({
			oldFlag: z.string().optional().meta({
				flag: "old-flag",
				description: "Deprecated: use --new-flag instead",
			}),
		});

		const help = generateHelp(cmd._config);
		expect(help).toContain("--old-flag");
		expect(help).toContain("Deprecated");
	});

	it("shows variadic positionals with ellipsis", () => {
		const cmd = command("myapp").inputs({
			files: z
				.array(z.string())
				.meta({ positional: 0, description: "Files to process" }),
		});

		const help = generateHelp(cmd._config);
		expect(help).toContain("<files...>");
	});

	it("shows required flag indicator", () => {
		const cmd = command("myapp").inputs({
			apiKey: z.string().meta({ flag: "api-key", description: "Your API key" }),
		});

		const help = generateHelp(cmd._config);
		expect(help).toContain("(required)");
	});

	it("hides hidden subcommands", () => {
		const visible = command("visible")
			.meta({ description: "Visible command" })
			.inputs({});
		const hidden = command("hidden")
			.meta({ description: "Hidden command", hidden: true })
			.inputs({});

		const root = command("myapp").use(visible).use(hidden);

		const help = generateHelp(root._config);
		expect(help).toContain("visible");
		expect(help).not.toContain("hidden");
	});

	it("shows hidden subcommands when includeHidden is true", () => {
		const hidden = command("secret")
			.meta({ description: "Secret command", hidden: true })
			.inputs({});

		const root = command("myapp").use(hidden);

		const help = generateHelp(root._config, [], { includeHidden: true });
		expect(help).toContain("secret");
	});

	it("shows enum type values in flag description", () => {
		const cmd = command("myapp").inputs({
			format: z.enum(["json", "yaml", "toml"]).default("json").meta({
				flag: "format",
				description: "Output format",
			}),
		});

		const help = generateHelp(cmd._config);
		expect(help).toContain("json");
		expect(help).toContain("yaml");
		expect(help).toContain("toml");
	});

	it("shows boolean flags without type annotation", () => {
		const cmd = command("myapp").inputs({
			verbose: z.boolean().default(false).meta({
				flag: "verbose",
				description: "Enable verbose mode",
			}),
		});

		const help = generateHelp(cmd._config);
		expect(help).toContain("--verbose");
		expect(help).not.toContain("<boolean>");
	});

	it("handles command with no inputs", () => {
		const cmd = command("myapp")
			.meta({ description: "A simple command" })
			.inputs({});

		const help = generateHelp(cmd._config);
		expect(help).toContain("A simple command");
		expect(help).toContain("Usage:");
	});

	it("shows both local and global inputs", () => {
		const cmd = command("myapp")
			.globalInputs({
				debug: z.boolean().default(false).meta({ flag: "debug" }),
			})
			.inputs({
				file: z.string().meta({ positional: 0 }),
			});

		const help = generateHelp(cmd._config);
		expect(help).toContain("--debug");
		expect(help).toContain("<file>");
	});
});
