export interface ParsedArgv {
	commands: string[];
	positionals: string[];
	flags: Record<string, string | string[] | true>;
	passthrough: string[];
}

export interface ParserOptions {
	stopEarly?: boolean;
	allowNegated?: boolean;
}

function isFlag(arg: string): boolean {
	return (
		arg.startsWith("-") && arg !== "-" && arg !== "--" && !/^-\d+$/.test(arg)
	);
}

function isLongFlag(arg: string): boolean {
	return arg.startsWith("--");
}

function isShortFlag(arg: string): boolean {
	return arg.startsWith("-") && !arg.startsWith("--") && arg !== "-";
}

function parseValue(
	flags: Record<string, string | string[] | true>,
	key: string,
	value: string | true,
): void {
	const existing = flags[key];
	if (existing === undefined) {
		flags[key] = value;
	} else if (Array.isArray(existing)) {
		existing.push(value === true ? "" : value);
	} else {
		flags[key] = [
			existing === true ? "" : existing,
			value === true ? "" : value,
		];
	}
}

export function parse(argv: string[], options: ParserOptions = {}): ParsedArgv {
	const { stopEarly = false, allowNegated = true } = options;

	const commands: string[] = [];
	const positionals: string[] = [];
	const flags: Record<string, string | string[] | true> = {};
	const passthrough: string[] = [];

	let i = 0;
	let foundNonCommand = false;
	let inPassthrough = false;

	while (i < argv.length) {
		const arg = argv[i];
		if (arg === undefined) continue;

		if (arg === "--") {
			inPassthrough = true;
			i++;
			continue;
		}

		if (inPassthrough) {
			passthrough.push(arg);
			i++;
			continue;
		}

		if (stopEarly && foundNonCommand) {
			positionals.push(arg);
			i++;
			continue;
		}

		if (isLongFlag(arg)) {
			foundNonCommand = true;
			const eqIndex = arg.indexOf("=");

			if (eqIndex !== -1) {
				const key = arg.slice(2, eqIndex);
				const value = arg.slice(eqIndex + 1);

				if (allowNegated && key.startsWith("no-")) {
					parseValue(flags, key.slice(3), "false");
				} else {
					parseValue(flags, key, value);
				}
			} else {
				const key = arg.slice(2);
				const nextArg = argv[i + 1];

				if (allowNegated && key.startsWith("no-")) {
					parseValue(flags, key.slice(3), "false");
					i++;
					continue;
				}

				if (nextArg !== undefined && !isFlag(nextArg) && nextArg !== "--") {
					parseValue(flags, key, nextArg);
					i += 2;
					continue;
				}

				parseValue(flags, key, true);
			}

			i++;
			continue;
		}

		if (isShortFlag(arg)) {
			foundNonCommand = true;
			const chars = arg.slice(1);

			if (chars.length === 1) {
				const key = chars;
				const nextArg = argv[i + 1];

				if (nextArg !== undefined && !isFlag(nextArg) && nextArg !== "--") {
					parseValue(flags, key, nextArg);
					i += 2;
					continue;
				}

				parseValue(flags, key, true);
			} else {
				for (let j = 0; j < chars.length; j++) {
					const key = chars[j];
					if (key === undefined) continue;
					if (j === chars.length - 1) {
						const nextArg = argv[i + 1];
						if (nextArg !== undefined && !isFlag(nextArg) && nextArg !== "--") {
							parseValue(flags, key, nextArg);
							i++;
							break;
						}
					}
					parseValue(flags, key, true);
				}
			}

			i++;
			continue;
		}

		if (stopEarly) {
			if (!foundNonCommand) {
				commands.push(arg);
				foundNonCommand = true;
			} else {
				positionals.push(arg);
			}
		} else if (!foundNonCommand) {
			commands.push(arg);
		} else {
			positionals.push(arg);
		}

		i++;
	}

	return { commands, positionals, flags, passthrough };
}
