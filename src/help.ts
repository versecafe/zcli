import type { z } from "zod";
import { getInternalDef } from "./internal/zod.ts";
import { getMeta } from "./meta.ts";
import type { AnyCommandConfig, InputSchema } from "./types.ts";
import { toKebabCase } from "./utils/case.ts";
import { fmt, getTerminalWidth } from "./utils/terminal.ts";

interface HelpOptions {
	maxWidth?: number;
	includeHidden?: boolean;
}

interface PositionalInfo {
	name: string;
	description?: string;
	required: boolean;
	variadic: boolean;
	index: number;
}

interface FlagInfo {
	name: string;
	alias?: string;
	description?: string;
	type: string;
	default?: unknown;
	required: boolean;
	env?: string;
	negatable?: boolean;
}

function getSchemaType(schema: z.ZodType): string {
	const def = getInternalDef(schema);
	if (!def) return "string";

	const type = def.type ?? def.typeName;

	switch (type) {
		case "string":
			return "string";
		case "number":
		case "int32":
		case "float64":
		case "bigint":
			return "number";
		case "boolean":
		case "stringbool":
			return "boolean";
		case "array":
			return "array";
		case "enum":
			if (def.entries) {
				if (Array.isArray(def.entries)) {
					return def.entries.map((e) => e[0]).join(" | ");
				}
				return Object.keys(def.entries).join(" | ");
			}
			if (def.values) {
				return def.values.join(" | ");
			}
			return "enum";
		case "optional":
		case "nullable":
		case "default":
			if (def.innerType) return getSchemaType(def.innerType);
			break;
	}

	return "string";
}

function isOptional(schema: z.ZodType): boolean {
	const def = getInternalDef(schema);
	if (!def) return false;

	const type = def.type ?? def.typeName;
	if (type === "optional" || type === "nullable" || type === "default") {
		return true;
	}

	return false;
}

function getDefault(schema: z.ZodType): unknown | undefined {
	const def = getInternalDef(schema);
	if (!def) return undefined;

	const type = def.type ?? def.typeName;
	if (type === "default") {
		return def.defaultValue;
	}

	return undefined;
}

interface ExtractedInputs {
	positionals: PositionalInfo[];
	flags: FlagInfo[];
}

function extractInputs(
	schema: InputSchema,
	includeHidden: boolean,
): ExtractedInputs {
	const positionals: PositionalInfo[] = [];
	const flags: FlagInfo[] = [];

	for (const [key, zodType] of Object.entries(schema)) {
		const meta = getMeta(zodType);
		if (meta.hidden && !includeHidden) continue;

		if (typeof meta.positional === "number") {
			positionals.push({
				name: key,
				description: meta.description,
				required: !isOptional(zodType),
				variadic: getSchemaType(zodType) === "array",
				index: meta.positional,
			});
		} else {
			const flagName = meta.flag ?? toKebabCase(key);
			const schemaType = getSchemaType(zodType);

			flags.push({
				name: flagName,
				alias: meta.alias,
				description: meta.description,
				type: schemaType,
				default: getDefault(zodType),
				required: !isOptional(zodType) && getDefault(zodType) === undefined,
				env: meta.env,
				negatable: meta.negatable,
			});
		}
	}

	positionals.sort((a, b) => a.index - b.index);
	flags.sort((a, b) => a.name.localeCompare(b.name));

	return { positionals, flags };
}

function formatPositional(pos: PositionalInfo): string {
	let name = pos.name;
	if (pos.variadic) name = `${name}...`;
	return pos.required ? `<${name}>` : `[${name}]`;
}

function formatFlag(flag: FlagInfo): string {
	let result = "";

	if (flag.alias) {
		result += fmt.flag(`-${flag.alias}, `);
	} else {
		result += "    ";
	}

	result += fmt.flag(`--${flag.name}`);

	if (flag.type !== "boolean") {
		result += ` <${flag.type}>`;
	}

	return result;
}

function wrapText(text: string, width: number, indent: number): string {
	const words = text.split(" ");
	const lines: string[] = [];
	let currentLine = "";
	const indentStr = " ".repeat(indent);

	for (const word of words) {
		if (currentLine.length + word.length + 1 <= width - indent) {
			currentLine += (currentLine ? " " : "") + word;
		} else {
			if (currentLine) lines.push(currentLine);
			currentLine = word;
		}
	}

	if (currentLine) lines.push(currentLine);

	return lines.map((line, i) => (i === 0 ? line : indentStr + line)).join("\n");
}

export function generateHelp(
	config: AnyCommandConfig,
	commandPath: string[] = [],
	options: HelpOptions = {},
): string {
	const { maxWidth = getTerminalWidth(), includeHidden = false } = options;

	const lines: string[] = [];
	const meta = config.meta;

	const fullCommand =
		commandPath.length > 0 ? commandPath.join(" ") : config.name;

	if (meta.description) {
		lines.push(meta.description);
		lines.push("");
	}

	const allInputs = { ...config.globalInputSchema, ...config.inputSchema };
	const { positionals, flags } = extractInputs(allInputs, includeHidden);
	const subcommands = Array.from(config.subcommands.entries()).filter(
		([, cmd]) => includeHidden || !cmd.meta.hidden,
	);

	let usage = `${fmt.bold("Usage:")} ${fullCommand}`;

	if (subcommands.length > 0) {
		usage += " <command>";
	}

	for (const pos of positionals) {
		usage += ` ${formatPositional(pos)}`;
	}

	if (flags.length > 0) {
		usage += " [options]";
	}

	lines.push(usage);
	lines.push("");

	if (subcommands.length > 0) {
		lines.push(fmt.bold("Commands:"));

		const maxNameLen = subcommands.reduce(
			(max, [name]) => Math.max(max, name.length),
			0,
		);

		for (const [name, cmd] of subcommands) {
			const padding = " ".repeat(maxNameLen - name.length + 2);
			const desc = cmd.meta.description ?? "";
			lines.push(`  ${fmt.command(name)}${padding}${desc}`);
		}

		lines.push("");
	}

	if (positionals.length > 0) {
		lines.push(fmt.bold("Arguments:"));

		const maxNameLen = positionals.reduce(
			(max, p) => Math.max(max, formatPositional(p).length),
			0,
		);

		for (const pos of positionals) {
			const formatted = formatPositional(pos);
			const padding = " ".repeat(maxNameLen - formatted.length + 2);
			const desc = pos.description ?? "";
			lines.push(`  ${fmt.arg(formatted)}${padding}${desc}`);
		}

		lines.push("");
	}

	if (flags.length > 0) {
		lines.push(fmt.bold("Options:"));

		const formattedFlags = flags.map((f) => ({
			formatted: formatFlag(f),
			flag: f,
		}));

		const rawLengths = flags.map((f) => {
			let len = f.name.length + 2;
			if (f.alias) len += 4;
			if (f.type !== "boolean") len += f.type.length + 3;
			return len;
		});
		const maxFlagLen = rawLengths.reduce((max, len) => Math.max(max, len), 0);

		for (let i = 0; i < formattedFlags.length; i++) {
			const formattedFlag = formattedFlags[i];
			const rawLen = rawLengths[i];
			if (!formattedFlag || rawLen === undefined) continue;
			const { formatted, flag } = formattedFlag;
			const padding = " ".repeat(maxFlagLen - rawLen + 2);

			let line = `  ${formatted}${padding}`;

			const details: string[] = [];

			if (flag.description) {
				details.push(flag.description);
			}

			if (flag.default !== undefined) {
				details.push(`(default: ${JSON.stringify(flag.default)})`);
			}

			if (flag.env) {
				details.push(`(env: ${flag.env})`);
			}

			if (flag.required) {
				details.push("(required)");
			}

			line += wrapText(details.join(" "), maxWidth, maxFlagLen + 4);

			lines.push(line);
		}

		lines.push("");
	}

	if (meta.examples && meta.examples.length > 0) {
		lines.push(fmt.bold("Examples:"));
		for (const example of meta.examples) {
			lines.push(`  $ ${example}`);
		}
		lines.push("");
	}

	return lines.join("\n").trimEnd();
}

export function generateVersion(name: string, version: string): string {
	return `${name} ${version}`;
}
