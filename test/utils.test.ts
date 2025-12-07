import { describe, expect, it } from "bun:test";
import { toCamelCase, toConstantCase, toKebabCase } from "../src/utils/case.ts";
import { didYouMean, findSimilar } from "../src/utils/did-you-mean.ts";

describe("case utilities", () => {
	describe("toKebabCase", () => {
		it("converts camelCase to kebab-case", () => {
			expect(toKebabCase("fooBar")).toBe("foo-bar");
			expect(toKebabCase("fooBarBaz")).toBe("foo-bar-baz");
		});

		it("converts PascalCase to kebab-case", () => {
			expect(toKebabCase("FooBar")).toBe("foo-bar");
		});

		it("handles already kebab-case", () => {
			expect(toKebabCase("foo-bar")).toBe("foo-bar");
		});

		it("converts spaces to hyphens", () => {
			expect(toKebabCase("foo bar")).toBe("foo-bar");
		});

		it("converts underscores to hyphens", () => {
			expect(toKebabCase("foo_bar")).toBe("foo-bar");
		});
	});

	describe("toCamelCase", () => {
		it("converts kebab-case to camelCase", () => {
			expect(toCamelCase("foo-bar")).toBe("fooBar");
			expect(toCamelCase("foo-bar-baz")).toBe("fooBarBaz");
		});

		it("handles already camelCase", () => {
			expect(toCamelCase("fooBar")).toBe("fooBar");
		});
	});

	describe("toConstantCase", () => {
		it("converts camelCase to CONSTANT_CASE", () => {
			expect(toConstantCase("fooBar")).toBe("FOO_BAR");
		});

		it("converts kebab-case to CONSTANT_CASE", () => {
			expect(toConstantCase("foo-bar")).toBe("FOO_BAR");
		});
	});
});

describe("did-you-mean", () => {
	describe("didYouMean", () => {
		it("finds close matches", () => {
			const candidates = ["verbose", "version", "help"];
			expect(didYouMean("verbos", candidates)).toBe("verbose");
			expect(didYouMean("versoin", candidates)).toBe("version");
		});

		it("returns null for no close match", () => {
			const candidates = ["verbose", "version"];
			expect(didYouMean("xyz", candidates)).toBeNull();
		});

		it("returns null for empty candidates", () => {
			expect(didYouMean("test", [])).toBeNull();
		});

		it("respects threshold", () => {
			const candidates = ["verbose"];
			expect(didYouMean("verb", candidates, { threshold: 3 })).toBe("verbose");
			expect(didYouMean("verb", candidates, { threshold: 2 })).toBeNull();
		});
	});

	describe("findSimilar", () => {
		it("finds multiple similar matches", () => {
			const candidates = ["build", "built", "bold", "cold"];
			const result = findSimilar("bild", candidates);
			expect(result).toContain("build");
			expect(result).toContain("built");
		});

		it("respects limit", () => {
			const candidates = ["a", "b", "c", "d", "e"];
			const result = findSimilar("a", candidates, { limit: 2 });
			expect(result.length).toBeLessThanOrEqual(2);
		});
	});
});
