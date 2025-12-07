export function toKebabCase(str: string): string {
	return str
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.replace(/[\s_]+/g, "-")
		.toLowerCase();
}

export function toCamelCase(str: string): string {
	return str.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

export function toConstantCase(str: string): string {
	return str
		.replace(/([a-z])([A-Z])/g, "$1_$2")
		.replace(/[\s-]+/g, "_")
		.toUpperCase();
}
