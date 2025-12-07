export function isTTY(): boolean {
	return Boolean(process.stdout.isTTY);
}

export function supportsColor(): boolean {
	if (process.env.NO_COLOR !== undefined) return false;
	if (process.env.FORCE_COLOR !== undefined) return true;
	if (!isTTY()) return false;

	const term = process.env.TERM ?? "";
	if (term === "dumb") return false;

	return true;
}

export function getTerminalWidth(): number {
	if (typeof process.stdout.columns === "number") {
		return process.stdout.columns;
	}
	return 80;
}

const colors = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	italic: "\x1b[3m",
	underline: "\x1b[4m",

	black: "\x1b[30m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	magenta: "\x1b[35m",
	cyan: "\x1b[36m",
	white: "\x1b[37m",

	bgRed: "\x1b[41m",
	bgGreen: "\x1b[42m",
	bgYellow: "\x1b[43m",
} as const;

type ColorName = keyof typeof colors;

function wrapColor(text: string, ...codes: ColorName[]): string {
	if (!supportsColor()) return text;
	const prefix = codes.map((c) => colors[c]).join("");
	return `${prefix}${text}${colors.reset}`;
}

export const fmt = {
	bold: (text: string) => wrapColor(text, "bold"),
	dim: (text: string) => wrapColor(text, "dim"),
	italic: (text: string) => wrapColor(text, "italic"),
	underline: (text: string) => wrapColor(text, "underline"),

	red: (text: string) => wrapColor(text, "red"),
	green: (text: string) => wrapColor(text, "green"),
	yellow: (text: string) => wrapColor(text, "yellow"),
	blue: (text: string) => wrapColor(text, "blue"),
	magenta: (text: string) => wrapColor(text, "magenta"),
	cyan: (text: string) => wrapColor(text, "cyan"),

	error: (text: string) => wrapColor(text, "red", "bold"),
	success: (text: string) => wrapColor(text, "green"),
	warning: (text: string) => wrapColor(text, "yellow"),
	info: (text: string) => wrapColor(text, "blue"),

	command: (text: string) => wrapColor(text, "cyan", "bold"),
	flag: (text: string) => wrapColor(text, "yellow"),
	arg: (text: string) => wrapColor(text, "green"),
};
