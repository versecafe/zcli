import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { cli, command, testCli } from "../src/index.ts";

describe("command", () => {
	describe("basic parsing", () => {
		it("parses positional arguments", () => {
			const cmd = command("test").inputs({
				name: z.string().meta({ positional: 0 }),
			});

			const result = cmd.parse(["hello"]);
			expect(result.inputs.name).toBe("hello");
		});

		it("parses multiple positionals", () => {
			const cmd = command("test").inputs({
				first: z.string().meta({ positional: 0 }),
				second: z.string().meta({ positional: 1 }),
			});

			const result = cmd.parse(["one", "two"]);
			expect(result.inputs.first).toBe("one");
			expect(result.inputs.second).toBe("two");
		});

		it("parses flags", () => {
			const cmd = command("test").inputs({
				verbose: z
					.boolean()
					.default(false)
					.meta({ flag: "verbose", alias: "v" }),
				port: z.coerce
					.number()
					.default(3000)
					.meta({ flag: "port", alias: "p" }),
			});

			const result = cmd.parse(["--verbose", "-p", "8080"]);
			expect(result.inputs.verbose).toBe(true);
			expect(result.inputs.port).toBe(8080);
		});

		it("parses optional positionals", () => {
			const cmd = command("test").inputs({
				name: z.string().optional().meta({ positional: 0 }),
			});

			const result = cmd.parse([]);
			expect(result.inputs.name).toBeUndefined();
		});

		it("applies defaults", () => {
			const cmd = command("test").inputs({
				port: z.coerce.number().default(3000).meta({ flag: "port" }),
			});

			const result = cmd.parse([]);
			expect(result.inputs.port).toBe(3000);
		});

		it("parses variadic positionals", () => {
			const cmd = command("test").inputs({
				files: z.array(z.string()).meta({ positional: 0 }),
			});

			const result = cmd.parse(["a.txt", "b.txt", "c.txt"]);
			expect(result.inputs.files).toEqual(["a.txt", "b.txt", "c.txt"]);
		});

		it("captures passthrough args", () => {
			const cmd = command("test").inputs({
				name: z.string().meta({ positional: 0 }),
			});

			const result = cmd.parse(["hello", "--", "--extra", "args"]);
			expect(result.inputs.name).toBe("hello");
			expect(result.passthrough).toEqual(["--extra", "args"]);
		});
	});

	describe("actions", () => {
		it("runs action with parsed inputs", async () => {
			let capturedInputs: { name: string } | undefined;

			const cmd = command("test")
				.inputs({
					name: z.string().meta({ positional: 0 }),
				})
				.action(({ inputs }) => {
					capturedInputs = inputs;
					return "done";
				});

			const result = await cmd.run(["world"]);
			expect(capturedInputs?.name).toBe("world");
			expect(result).toBe("done");
		});

		it("provides passthrough in action context", async () => {
			let captured: string[] | undefined;

			const cmd = command("test")
				.inputs({})
				.action(({ passthrough }) => {
					captured = passthrough;
				});

			await cmd.run(["--", "--foo", "bar"]);
			expect(captured).toEqual(["--foo", "bar"]);
		});
	});

	describe("hooks", () => {
		it("runs before hooks", async () => {
			const order: string[] = [];

			const cmd = command("test")
				.inputs({})
				.before(() => {
					order.push("before");
				})
				.action(() => {
					order.push("action");
				});

			await cmd.run([]);
			expect(order).toEqual(["before", "action"]);
		});

		it("runs after hooks with result", async () => {
			let capturedResult: string | undefined;

			const cmd = command("test")
				.inputs({})
				.action(() => "hello")
				.after(({ result }) => {
					capturedResult = result;
				});

			await cmd.run([]);
			expect(capturedResult).toBe("hello");
		});
	});

	describe("context", () => {
		it("provides context to action", async () => {
			interface AppContext {
				db: string;
			}

			let captured: AppContext | undefined;

			const cmd = command("test")
				.context(() => ({ db: "postgres" }))
				.inputs({})
				.action(({ ctx }) => {
					captured = ctx;
				});

			await cmd.run([]);
			expect(captured?.db).toBe("postgres");
		});

		it("supports async context", async () => {
			const cmd = command("test")
				.context(async () => ({ value: 42 }))
				.inputs({})
				.action(({ ctx }) => ctx.value);

			const result = await cmd.run([]);
			expect(result).toBe(42);
		});
	});

	describe("subcommands", () => {
		it("routes to subcommand", async () => {
			let called = false;

			const sub = command("sub")
				.inputs({})
				.action(() => {
					called = true;
				});

			const root = command("root").use(sub);

			await root.run(["sub"]);
			expect(called).toBe(true);
		});

		it("inherits global inputs", async () => {
			let capturedVerbose: boolean | undefined;

			const sub = command("sub")
				.inputs({})
				.action(({ inputs }) => {
					// biome-ignore lint/suspicious/noExplicitAny: test flexibility for type assertions
					capturedVerbose = (inputs as any).verbose;
				});

			const root = command("root")
				.globalInputs({
					verbose: z.boolean().default(false).meta({ flag: "verbose" }),
				})
				.use(sub);

			await root.run(["sub", "--verbose"]);
			expect(capturedVerbose).toBe(true);
		});
	});
});

describe("cli", () => {
	it("shows version", async () => {
		const app = cli("myapp", { version: "1.0.0" });
		const result = await testCli(app, ["--version"]);
		expect(result.stdout).toBe("myapp 1.0.0");
		expect(result.exitCode).toBe(0);
	});

	it("shows help", async () => {
		const app = cli("myapp", { version: "1.0.0" })
			.meta({ description: "My application" })
			.globalInputs({
				verbose: z.boolean().default(false).meta({
					flag: "verbose",
					alias: "v",
					description: "Enable verbose output",
				}),
			});

		const result = await testCli(app, ["--help"]);
		expect(result.stdout).toContain("My application");
		expect(result.stdout).toContain("--verbose");
		expect(result.exitCode).toBe(0);
	});

	it("runs subcommands", async () => {
		let ranInit = false;
		let ranBuild = false;

		const app = cli("myapp")
			.use(
				command("init")
					.inputs({})
					.action(() => {
						ranInit = true;
					}),
			)
			.use(
				command("build")
					.inputs({})
					.action(() => {
						ranBuild = true;
					}),
			);

		await app.run(["init"]);
		expect(ranInit).toBe(true);
		expect(ranBuild).toBe(false);

		await app.run(["build"]);
		expect(ranBuild).toBe(true);
	});

	it("handles unknown command error", async () => {
		const app = cli("myapp", { strictCommands: true }).use(
			command("init")
				.inputs({})
				.action(() => {}),
		);

		const result = await testCli(app, ["unknown"]);
		expect(result.stderr).toContain("Unknown command");
		expect(result.exitCode).toBe(1);
	});
});

describe("testCli", () => {
	it("captures stdout", async () => {
		const cmd = command("test")
			.inputs({})
			.action(() => {
				console.log("Hello, World!");
			});

		const result = await testCli(cmd, []);
		expect(result.stdout).toBe("Hello, World!");
	});

	it("captures stderr", async () => {
		const cmd = command("test")
			.inputs({})
			.action(() => {
				console.error("Error occurred");
			});

		const result = await testCli(cmd, []);
		expect(result.stderr).toBe("Error occurred");
	});
});

describe("command advanced features", () => {
	describe("environment variable fallback", () => {
		it("reads flag value from environment variable", async () => {
			const envName = "MY_TEST_TOKEN";
			const originalEnv = process.env[envName];
			process.env[envName] = "secret-key-123";

			try {
				const cmd = command("test").inputs({
					apiKey: z.string().optional().meta({ flag: "api-key", env: envName }),
				});

				const result = cmd.parse([]);
				expect(result.inputs.apiKey).toBe("secret-key-123");
			} finally {
				if (originalEnv === undefined) {
					delete process.env[envName];
				} else {
					process.env[envName] = originalEnv;
				}
			}
		});

		it("cli flag overrides environment variable", async () => {
			const envName = "MY_TEST_TOKEN2";
			const originalEnv = process.env[envName];
			process.env[envName] = "env-value";

			try {
				const cmd = command("test").inputs({
					apiKey: z.string().optional().meta({ flag: "api-key", env: envName }),
				});

				const result = cmd.parse(["--api-key", "cli-value"]);
				expect(result.inputs.apiKey).toBe("cli-value");
			} finally {
				if (originalEnv === undefined) {
					delete process.env[envName];
				} else {
					process.env[envName] = originalEnv;
				}
			}
		});

		it("converts env boolean strings correctly", async () => {
			const envName = "MY_TEST_VERBOSE";
			const originalEnv = process.env[envName];
			process.env[envName] = "true";

			try {
				const cmd = command("test").inputs({
					verbose: z
						.boolean()
						.default(false)
						.meta({ flag: "verbose", env: envName }),
				});

				const result = cmd.parse([]);
				expect(result.inputs.verbose).toBe(true);
			} finally {
				if (originalEnv === undefined) {
					delete process.env[envName];
				} else {
					process.env[envName] = originalEnv;
				}
			}
		});

		it("converts env number strings correctly", async () => {
			const envName = "MY_TEST_PORT";
			const originalEnv = process.env[envName];
			process.env[envName] = "8080";

			try {
				const cmd = command("test").inputs({
					port: z.coerce
						.number()
						.default(3000)
						.meta({ flag: "port", env: envName }),
				});

				const result = cmd.parse([]);
				expect(result.inputs.port).toBe(8080);
			} finally {
				if (originalEnv === undefined) {
					delete process.env[envName];
				} else {
					process.env[envName] = originalEnv;
				}
			}
		});
	});

	describe("negatable flags", () => {
		it("parses --no-cache as false", async () => {
			const cmd = command("test").inputs({
				cache: z
					.boolean()
					.default(true)
					.meta({ flag: "cache", negatable: true }),
			});

			const result = cmd.parse(["--no-cache"]);
			expect(result.inputs.cache).toBe(false);
		});

		it("parses --cache as true", async () => {
			const cmd = command("test").inputs({
				cache: z
					.boolean()
					.default(false)
					.meta({ flag: "cache", negatable: true }),
			});

			const result = cmd.parse(["--cache"]);
			expect(result.inputs.cache).toBe(true);
		});
	});

	describe("kebab-case flag conversion", () => {
		it("converts camelCase input key to kebab-case flag", async () => {
			const cmd = command("test").inputs({
				outputDir: z.string().default("./dist"),
			});

			const result = cmd.parse(["--output-dir", "/tmp/build"]);
			expect(result.inputs.outputDir).toBe("/tmp/build");
		});

		it("accepts explicit flag name over auto-converted", async () => {
			const cmd = command("test").inputs({
				outputDir: z.string().default("./dist").meta({ flag: "out" }),
			});

			const result = cmd.parse(["--out", "/tmp/build"]);
			expect(result.inputs.outputDir).toBe("/tmp/build");
		});
	});

	describe("nested subcommands", () => {
		it("routes to deeply nested subcommand", async () => {
			let called = false;
			let capturedCommand: string[] = [];

			const leaf = command("staging")
				.inputs({})
				.action(({ command }) => {
					called = true;
					capturedCommand = command;
				});

			const middle = command("deploy").use(leaf);
			const root = command("app").use(middle);

			await root.run(["deploy", "staging"]);
			expect(called).toBe(true);
			expect(capturedCommand).toEqual(["deploy", "staging"]);
		});

		it("shows help for middle subcommand", async () => {
			const leaf = command("staging")
				.meta({ description: "Deploy to staging" })
				.inputs({});

			const middle = command("deploy")
				.meta({ description: "Deployment commands" })
				.use(leaf);

			const root = command("app").use(middle);

			const result = await testCli(root, ["deploy", "--help"]);
			expect(result.stdout).toContain("Deploy");
			expect(result.stdout).toContain("staging");
		});

		it("supports 'mycli mcp list' style nested commands", async () => {
			let listCalled = false;
			let installCalled = false;

			const list = command("list")
				.meta({ description: "List available MCPs" })
				.action(() => {
					listCalled = true;
				});

			const install = command("install")
				.meta({ description: "Install an MCP" })
				.inputs({
					name: z.string().meta({ positional: 0, description: "MCP name" }),
				})
				.action(() => {
					installCalled = true;
				});

			const mcp = command("mcp")
				.meta({ description: "Manage MCPs" })
				.use(list)
				.use(install);

			const mycli = cli("mycli", { version: "1.0.0" }).use(mcp);

			// Test "mycli mcp list"
			await mycli.run(["mcp", "list"]);
			expect(listCalled).toBe(true);
			expect(installCalled).toBe(false);

			// Reset and test "mycli mcp install"
			listCalled = false;
			await mycli.run(["mcp", "install", "some-mcp"]);
			expect(installCalled).toBe(true);
			expect(listCalled).toBe(false);

			// Test help shows the nested structure
			const helpResult = await testCli(mycli, ["mcp", "--help"]);
			expect(helpResult.stdout).toContain("list");
			expect(helpResult.stdout).toContain("install");
		});
	});

	describe("globalInputs inheritance", () => {
		it("subcommand receives parent globalInputs", async () => {
			let capturedInputs: Record<string, unknown> = {};

			const sub = command("sub")
				.inputs({
					name: z.string().meta({ positional: 0 }),
				})
				.action(({ inputs }) => {
					capturedInputs = inputs as Record<string, unknown>;
				});

			const root = command("root")
				.globalInputs({
					debug: z.boolean().default(false).meta({ flag: "debug" }),
				})
				.use(sub);

			await root.run(["sub", "hello", "--debug"]);
			expect(capturedInputs.name).toBe("hello");
			expect(capturedInputs.debug).toBe(true);
		});

		it("subcommand can add its own globalInputs", async () => {
			let capturedInputs: Record<string, unknown> = {};

			const leaf = command("leaf")
				.inputs({})
				.action(({ inputs }) => {
					capturedInputs = inputs as Record<string, unknown>;
				});

			const middle = command("middle")
				.globalInputs({
					format: z.string().default("json").meta({ flag: "format" }),
				})
				.use(leaf);

			const root = command("root")
				.globalInputs({
					debug: z.boolean().default(false).meta({ flag: "debug" }),
				})
				.use(middle);

			await root.run(["middle", "leaf", "--debug", "--format", "yaml"]);
			expect(capturedInputs.debug).toBe(true);
			expect(capturedInputs.format).toBe("yaml");
		});
	});

	describe("multiple before/after hooks", () => {
		it("runs multiple before hooks in order", async () => {
			const order: string[] = [];

			const cmd = command("test")
				.inputs({})
				.before(() => {
					order.push("before1");
				})
				.before(() => {
					order.push("before2");
				})
				.action(() => {
					order.push("action");
				});

			await cmd.run([]);
			expect(order).toEqual(["before1", "before2", "action"]);
		});

		it("runs multiple after hooks in order", async () => {
			const order: string[] = [];

			const cmd = command("test")
				.inputs({})
				.action(() => {
					order.push("action");
					return "result";
				})
				.after(() => {
					order.push("after1");
				})
				.after(() => {
					order.push("after2");
				});

			await cmd.run([]);
			expect(order).toEqual(["action", "after1", "after2"]);
		});
	});

	describe("commands() bulk registration", () => {
		it("registers multiple subcommands at once", async () => {
			let initCalled = false;
			let buildCalled = false;

			const initCmd = command("init")
				.inputs({})
				.action(() => {
					initCalled = true;
				});

			const buildCmd = command("build")
				.inputs({})
				.action(() => {
					buildCalled = true;
				});

			const root = command("app").commands([initCmd, buildCmd]);

			await root.run(["init"]);
			expect(initCalled).toBe(true);

			await root.run(["build"]);
			expect(buildCalled).toBe(true);
		});
	});

	describe("boolean flag string values", () => {
		it("parses --flag=false as false", async () => {
			const cmd = command("test").inputs({
				verbose: z.boolean().default(true).meta({ flag: "verbose" }),
			});

			const result = cmd.parse(["--verbose=false"]);
			expect(result.inputs.verbose).toBe(false);
		});

		it("parses --flag=true as true", async () => {
			const cmd = command("test").inputs({
				verbose: z.boolean().default(false).meta({ flag: "verbose" }),
			});

			const result = cmd.parse(["--verbose=true"]);
			expect(result.inputs.verbose).toBe(true);
		});
	});

	describe("array inputs", () => {
		it("collects repeated flags into array", async () => {
			const cmd = command("test").inputs({
				include: z.array(z.string()).default([]).meta({ flag: "include" }),
			});

			const result = cmd.parse([
				"--include",
				"a",
				"--include",
				"b",
				"--include",
				"c",
			]);
			expect(result.inputs.include).toEqual(["a", "b", "c"]);
		});
	});

	describe("short flag alias", () => {
		it("accepts short alias for flag", async () => {
			const cmd = command("test").inputs({
				verbose: z
					.boolean()
					.default(false)
					.meta({ flag: "verbose", alias: "v" }),
			});

			const result = cmd.parse(["-v"]);
			expect(result.inputs.verbose).toBe(true);
		});

		it("accepts short alias with value", async () => {
			const cmd = command("test").inputs({
				port: z.coerce
					.number()
					.default(3000)
					.meta({ flag: "port", alias: "p" }),
			});

			const result = cmd.parse(["-p", "8080"]);
			expect(result.inputs.port).toBe(8080);
		});
	});
});
