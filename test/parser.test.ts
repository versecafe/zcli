import { describe, expect, it } from "bun:test";
import { parse } from "../src/parser.ts";

describe("parser", () => {
	describe("commands", () => {
		it("parses single command", () => {
			const result = parse(["deploy"]);
			expect(result.commands).toEqual(["deploy"]);
			expect(result.positionals).toEqual([]);
		});

		it("parses nested commands", () => {
			const result = parse(["deploy", "staging"]);
			expect(result.commands).toEqual(["deploy", "staging"]);
		});

		it("stops parsing commands after first flag", () => {
			const result = parse(["deploy", "--verbose", "staging"]);
			expect(result.commands).toEqual(["deploy"]);
			expect(result.flags).toEqual({ verbose: "staging" });
		});
	});

	describe("positionals", () => {
		it("parses positionals after commands and flags with stopEarly", () => {
			const result = parse(["cmd", "pos1", "--flag", "value", "pos2"], {
				stopEarly: true,
			});
			expect(result.commands).toEqual(["cmd"]);
			expect(result.positionals).toEqual(["pos1", "--flag", "value", "pos2"]);
		});

		it("treats non-flag args after flags as flag values", () => {
			const result = parse(["cmd", "--flag", "value"]);
			expect(result.commands).toEqual(["cmd"]);
			expect(result.flags).toEqual({ flag: "value" });
		});
	});

	describe("long flags", () => {
		it("parses boolean flags", () => {
			const result = parse(["--verbose"]);
			expect(result.flags).toEqual({ verbose: true });
		});

		it("parses flags with values", () => {
			const result = parse(["--port", "3000"]);
			expect(result.flags).toEqual({ port: "3000" });
		});

		it("parses flags with = syntax", () => {
			const result = parse(["--port=3000"]);
			expect(result.flags).toEqual({ port: "3000" });
		});

		it("parses negated flags", () => {
			const result = parse(["--no-cache"]);
			expect(result.flags).toEqual({ cache: "false" });
		});

		it("parses multiple flags", () => {
			const result = parse(["--verbose", "--port", "3000", "--debug"]);
			expect(result.flags).toEqual({
				verbose: true,
				port: "3000",
				debug: true,
			});
		});

		it("collects duplicate flags into array", () => {
			const result = parse(["--include", "a", "--include", "b"]);
			expect(result.flags).toEqual({ include: ["a", "b"] });
		});
	});

	describe("short flags", () => {
		it("parses single short flag", () => {
			const result = parse(["-v"]);
			expect(result.flags).toEqual({ v: true });
		});

		it("parses short flag with value", () => {
			const result = parse(["-p", "3000"]);
			expect(result.flags).toEqual({ p: "3000" });
		});

		it("parses combined short flags", () => {
			const result = parse(["-abc"]);
			expect(result.flags).toEqual({ a: true, b: true, c: true });
		});

		it("parses combined short flags with value for last", () => {
			const result = parse(["-abc", "value"]);
			expect(result.flags).toEqual({ a: true, b: true, c: "value" });
		});
	});

	describe("passthrough", () => {
		it("captures args after --", () => {
			const result = parse(["--verbose", "--", "--extra", "arg"]);
			expect(result.flags).toEqual({ verbose: true });
			expect(result.passthrough).toEqual(["--extra", "arg"]);
		});

		it("handles empty passthrough", () => {
			const result = parse(["--verbose", "--"]);
			expect(result.passthrough).toEqual([]);
		});
	});

	describe("edge cases", () => {
		it("handles empty argv", () => {
			const result = parse([]);
			expect(result).toEqual({
				commands: [],
				positionals: [],
				flags: {},
				passthrough: [],
			});
		});

		it("handles single dash as positional", () => {
			const result = parse(["-"]);
			expect(result.commands).toEqual(["-"]);
		});

		it("handles double dash alone", () => {
			const result = parse(["--"]);
			expect(result.passthrough).toEqual([]);
		});

		it("treats negative numbers as values not flags", () => {
			const result = parse(["--port", "-1"]);
			expect(result.flags).toEqual({ port: "-1" });
		});

		it("treats negative numbers as positionals", () => {
			const result = parse(["cmd", "-42"]);
			expect(result.commands).toEqual(["cmd"]);
			expect(result.flags).toHaveProperty("4");
		});

		it("handles flag with empty string value", () => {
			const result = parse(["--name="]);
			expect(result.flags).toEqual({ name: "" });
		});

		it("handles multiple double dashes", () => {
			const result = parse(["cmd", "--", "arg1", "--", "arg2"]);
			expect(result.commands).toEqual(["cmd"]);
			expect(result.passthrough).toEqual(["arg1", "arg2"]);
		});
	});

	describe("negated flags with allowNegated option", () => {
		it("parses negated flags when allowNegated is true (default)", () => {
			const result = parse(["--no-color"]);
			expect(result.flags).toEqual({ color: "false" });
		});

		it("parses negated flags with = syntax", () => {
			const result = parse(["--no-cache=value"]);
			expect(result.flags).toEqual({ cache: "false" });
		});

		it("does not parse negated flags when allowNegated is false", () => {
			const result = parse(["--no-color"], { allowNegated: false });
			expect(result.flags).toEqual({ "no-color": true });
		});
	});

	describe("stopEarly option", () => {
		it("stops parsing flags after first positional when stopEarly is true", () => {
			const result = parse(["cmd", "arg", "--flag"], { stopEarly: true });
			expect(result.commands).toEqual(["cmd"]);
			expect(result.positionals).toEqual(["arg", "--flag"]);
			expect(result.flags).toEqual({});
		});

		it("continues parsing flags when stopEarly is false (default)", () => {
			const result = parse(["cmd", "arg", "--flag"]);
			expect(result.commands).toEqual(["cmd", "arg"]);
			expect(result.flags).toEqual({ flag: true });
		});
	});

	describe("complex flag values", () => {
		it("handles values containing equals sign", () => {
			const result = parse(["--config=key=value"]);
			expect(result.flags).toEqual({ config: "key=value" });
		});

		it("handles quoted values with spaces", () => {
			const result = parse(["--message", "hello world"]);
			expect(result.flags).toEqual({ message: "hello world" });
		});

		it("handles values starting with dash after equals", () => {
			const result = parse(["--format=-json"]);
			expect(result.flags).toEqual({ format: "-json" });
		});
	});

	describe("combined short flags edge cases", () => {
		it("handles single character flags repeated", () => {
			const result = parse(["-v", "-v", "-v"]);
			expect(result.flags).toEqual({ v: ["", "", ""] });
		});

		it("parses each character as a flag including equals", () => {
			const result = parse(["-abc=value"]);
			expect(result.flags.a).toBeDefined();
			expect(result.flags.b).toBe(true);
			expect(result.flags.c).toBe(true);
		});
	});
});
