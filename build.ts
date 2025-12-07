import { rm } from "node:fs/promises";

const outdir = "./dist";

await rm(outdir, { recursive: true, force: true });

const result = await Bun.build({
	entrypoints: ["./src/index.ts"],
	outdir,
	target: "node",
	format: "esm",
	sourcemap: "external",
	external: ["zod"],
});

if (!result.success) {
	for (const log of result.logs) {
		console.error(log);
	}
	process.exit(1);
}

// Generate bundled TypeScript declarations
const dts =
	await Bun.$`bunx dts-bundle-generator -o dist/index.d.ts src/index.ts --no-banner`.quiet();

if (dts.exitCode !== 0) {
	console.error("Declaration generation failed:");
	console.error(dts.stderr.toString());
	process.exit(1);
}
