import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	fmt,
	getTerminalWidth,
	isTTY,
	supportsColor,
} from "../src/utils/terminal.ts";

describe("terminal utilities", () => {
	describe("isTTY", () => {
		it("returns a boolean", () => {
			const result = isTTY();
			expect(typeof result).toBe("boolean");
		});
	});

	describe("supportsColor", () => {
		const originalEnv = { ...process.env };

		afterEach(() => {
			process.env.NO_COLOR = originalEnv.NO_COLOR;
			process.env.FORCE_COLOR = originalEnv.FORCE_COLOR;
			process.env.TERM = originalEnv.TERM;
		});

		it("returns false when NO_COLOR is set", () => {
			process.env.NO_COLOR = "1";
			delete process.env.FORCE_COLOR;
			expect(supportsColor()).toBe(false);
		});

		it("returns true when FORCE_COLOR is set", () => {
			delete process.env.NO_COLOR;
			process.env.FORCE_COLOR = "1";
			expect(supportsColor()).toBe(true);
		});

		it("returns false when TERM is dumb", () => {
			delete process.env.NO_COLOR;
			delete process.env.FORCE_COLOR;
			process.env.TERM = "dumb";
			if (!isTTY()) {
				expect(supportsColor()).toBe(false);
			}
		});
	});

	describe("getTerminalWidth", () => {
		it("returns a number", () => {
			const width = getTerminalWidth();
			expect(typeof width).toBe("number");
			expect(width).toBeGreaterThan(0);
		});

		it("returns at least 80 as default", () => {
			const width = getTerminalWidth();
			expect(width).toBeGreaterThanOrEqual(80);
		});
	});

	describe("fmt", () => {
		describe("without color support", () => {
			const originalEnv = process.env.NO_COLOR;

			beforeEach(() => {
				process.env.NO_COLOR = "1";
			});

			afterEach(() => {
				if (originalEnv === undefined) {
					delete process.env.NO_COLOR;
				} else {
					process.env.NO_COLOR = originalEnv;
				}
			});

			it("bold returns plain text", () => {
				expect(fmt.bold("test")).toBe("test");
			});

			it("dim returns plain text", () => {
				expect(fmt.dim("test")).toBe("test");
			});

			it("red returns plain text", () => {
				expect(fmt.red("test")).toBe("test");
			});

			it("green returns plain text", () => {
				expect(fmt.green("test")).toBe("test");
			});

			it("yellow returns plain text", () => {
				expect(fmt.yellow("test")).toBe("test");
			});

			it("blue returns plain text", () => {
				expect(fmt.blue("test")).toBe("test");
			});

			it("error returns plain text", () => {
				expect(fmt.error("test")).toBe("test");
			});

			it("success returns plain text", () => {
				expect(fmt.success("test")).toBe("test");
			});

			it("warning returns plain text", () => {
				expect(fmt.warning("test")).toBe("test");
			});

			it("info returns plain text", () => {
				expect(fmt.info("test")).toBe("test");
			});

			it("command returns plain text", () => {
				expect(fmt.command("test")).toBe("test");
			});

			it("flag returns plain text", () => {
				expect(fmt.flag("test")).toBe("test");
			});

			it("arg returns plain text", () => {
				expect(fmt.arg("test")).toBe("test");
			});
		});

		describe("with color support", () => {
			const originalEnv = {
				NO_COLOR: process.env.NO_COLOR,
				FORCE_COLOR: process.env.FORCE_COLOR,
			};

			beforeEach(() => {
				delete process.env.NO_COLOR;
				process.env.FORCE_COLOR = "1";
			});

			afterEach(() => {
				if (originalEnv.NO_COLOR === undefined) {
					delete process.env.NO_COLOR;
				} else {
					process.env.NO_COLOR = originalEnv.NO_COLOR;
				}
				if (originalEnv.FORCE_COLOR === undefined) {
					delete process.env.FORCE_COLOR;
				} else {
					process.env.FORCE_COLOR = originalEnv.FORCE_COLOR;
				}
			});

			it("bold wraps text with ANSI codes", () => {
				const result = fmt.bold("test");
				expect(result).toContain("\x1b[1m");
				expect(result).toContain("\x1b[0m");
				expect(result).toContain("test");
			});

			it("red wraps text with ANSI codes", () => {
				const result = fmt.red("test");
				expect(result).toContain("\x1b[31m");
				expect(result).toContain("\x1b[0m");
			});

			it("green wraps text with ANSI codes", () => {
				const result = fmt.green("test");
				expect(result).toContain("\x1b[32m");
			});

			it("yellow wraps text with ANSI codes", () => {
				const result = fmt.yellow("test");
				expect(result).toContain("\x1b[33m");
			});

			it("blue wraps text with ANSI codes", () => {
				const result = fmt.blue("test");
				expect(result).toContain("\x1b[34m");
			});

			it("error combines red and bold", () => {
				const result = fmt.error("test");
				expect(result).toContain("\x1b[31m");
				expect(result).toContain("\x1b[1m");
			});

			it("command combines cyan and bold", () => {
				const result = fmt.command("test");
				expect(result).toContain("\x1b[36m");
				expect(result).toContain("\x1b[1m");
			});
		});
	});
});
