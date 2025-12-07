import { readdir, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import type { z } from "zod";
import { getInternalDef } from "./internal/zod.ts";
import { getMeta } from "./meta.ts";
import type { AnyCommandConfig, InputSchema } from "./types.ts";
import { toKebabCase } from "./utils/case.ts";

type Shell = "bash" | "zsh" | "fish" | "powershell";

export interface CompletionItem {
	value: string;
	description?: string;
}

interface FlagInfo {
	name: string;
	alias?: string;
	description?: string;
	takesValue: boolean;
	completion?:
		| "file"
		| "directory"
		| string[]
		| ((partial: string) => string[] | Promise<string[]>);
}

function isBooleanType(schema: z.ZodType): boolean {
	const def = getInternalDef(schema);
	if (!def) return false;

	const type = def.type ?? def.typeName;

	if (type === "boolean" || type === "stringbool") {
		return true;
	}

	if (type === "optional" || type === "nullable" || type === "default") {
		if (def.innerType) return isBooleanType(def.innerType);
	}

	return false;
}

type CompletionType =
	| "file"
	| "directory"
	| string[]
	| ((partial: string) => string[] | Promise<string[]>);

interface PositionalCompletion {
	index: number;
	completion?: CompletionType;
}

interface ExtractedSchema {
	flags: FlagInfo[];
	positionals: PositionalCompletion[];
}

function extractSchema(schema: InputSchema): ExtractedSchema {
	const flags: FlagInfo[] = [];
	const positionals: PositionalCompletion[] = [];

	for (const [key, zodType] of Object.entries(schema)) {
		const meta = getMeta(zodType);

		if (typeof meta.positional === "number") {
			positionals.push({
				index: meta.positional,
				completion: meta.completion,
			});
		} else if (!meta.hidden) {
			const flagName = meta.flag ?? toKebabCase(key);
			const takesValue = !isBooleanType(zodType);

			flags.push({
				name: flagName,
				alias: meta.alias,
				description: meta.description,
				takesValue,
				completion: meta.completion,
			});
		}
	}

	positionals.sort((a, b) => a.index - b.index);

	return { flags, positionals };
}

async function completeFileOrDirectory(
	partial: string,
	type: "file" | "directory",
): Promise<string[]> {
	try {
		const resolvedPath = partial.startsWith("/")
			? partial
			: resolve(process.cwd(), partial);
		const dir = partial.endsWith("/") ? resolvedPath : dirname(resolvedPath);
		const prefix = partial.endsWith("/") ? "" : basename(partial);

		const entries = await readdir(dir);
		const matches: string[] = [];

		for (const entry of entries) {
			if (!entry.startsWith(prefix)) continue;

			const fullPath = join(dir, entry);
			try {
				const statResult = await stat(fullPath);
				const isDir = statResult.isDirectory();

				if (type === "directory" && !isDir) continue;

				const basePath = partial.endsWith("/")
					? partial + entry
					: partial.slice(0, partial.length - prefix.length) + entry;

				matches.push(isDir ? `${basePath}/` : basePath);
			} catch {
				// Skip entries we can't stat
			}
		}

		return matches;
	} catch {
		return [];
	}
}

async function getCompletionValues(
	completion:
		| "file"
		| "directory"
		| string[]
		| ((partial: string) => string[] | Promise<string[]>),
	partial: string,
): Promise<string[]> {
	if (completion === "file") {
		return await completeFileOrDirectory(partial, "file");
	}
	if (completion === "directory") {
		return await completeFileOrDirectory(partial, "directory");
	}
	if (Array.isArray(completion)) {
		return completion.filter((v) => v.startsWith(partial));
	}
	if (typeof completion === "function") {
		const result = completion(partial);
		return result instanceof Promise ? await result : result;
	}
	return [];
}

interface CompletionContext {
	words: string[];
	currentWord: string;
	currentIndex: number;
}

function findCurrentCommand(
	config: AnyCommandConfig,
	words: string[],
): { config: AnyCommandConfig; consumedWords: number } {
	let current = config;
	let consumed = 0;

	for (let i = 0; i < words.length; i++) {
		const word = words[i];
		if (!word || word.startsWith("-")) continue;

		const subcommand = current.subcommands.get(word);
		if (subcommand) {
			current = subcommand;
			consumed = i + 1;
		}
	}

	return { config: current, consumedWords: consumed };
}

function countPositionalsUsed(words: string[], startIndex: number): number {
	let count = 0;
	let expectingValue = false;

	for (let i = startIndex; i < words.length; i++) {
		const word = words[i];
		if (!word) continue;

		if (expectingValue) {
			expectingValue = false;
			continue;
		}

		if (word.startsWith("--") && word.includes("=")) {
			continue;
		}

		if (word.startsWith("-")) {
			expectingValue = true;
			continue;
		}

		count++;
	}

	return count;
}

export async function getCompletions(
	config: AnyCommandConfig,
	ctx: CompletionContext,
): Promise<CompletionItem[]> {
	const { words, currentWord, currentIndex } = ctx;

	// Find the current command context by looking at all words before current
	const { config: currentConfig, consumedWords } = findCurrentCommand(
		config,
		words.slice(0, currentIndex),
	);

	const allSchema = {
		...currentConfig.globalInputSchema,
		...currentConfig.inputSchema,
	};
	const { flags, positionals } = extractSchema(allSchema);

	const prevWord = currentIndex > 0 ? words[currentIndex - 1] : undefined;

	// Check if we're completing a flag value (previous word is a flag that takes a value)
	if (prevWord?.startsWith("-")) {
		const flagName = prevWord.startsWith("--")
			? prevWord.slice(2).split("=")[0]
			: prevWord.slice(1);

		const flag = flags.find((f) => f.name === flagName || f.alias === flagName);

		if (flag?.takesValue) {
			if (flag.completion) {
				const values = await getCompletionValues(flag.completion, currentWord);
				return values.map((v) => ({ value: v }));
			}
			// Flag takes value but no completion defined - return empty
			return [];
		}
	}

	// If current word starts with -, complete flags
	if (currentWord.startsWith("-")) {
		const items: CompletionItem[] = [];

		for (const flag of flags) {
			if (`--${flag.name}`.startsWith(currentWord)) {
				items.push({
					value: `--${flag.name}`,
					description: flag.description,
				});
			}
			if (flag.alias && `-${flag.alias}`.startsWith(currentWord)) {
				items.push({
					value: `-${flag.alias}`,
					description: flag.description,
				});
			}
		}

		return items;
	}

	// Complete subcommands if available and we haven't already matched one at this position
	const subcommandItems: CompletionItem[] = [];
	for (const [name, sub] of currentConfig.subcommands) {
		if (sub.meta.hidden) continue;
		if (name.startsWith(currentWord)) {
			subcommandItems.push({
				value: name,
				description: sub.meta.description,
			});
		}
	}

	if (subcommandItems.length > 0) {
		return subcommandItems;
	}

	// Complete positional arguments
	const usedPositionals = countPositionalsUsed(words.slice(consumedWords), 0);
	const currentPositional = positionals[usedPositionals];

	if (currentPositional?.completion) {
		const values = await getCompletionValues(
			currentPositional.completion,
			currentWord,
		);
		return values.map((v) => ({ value: v }));
	}

	return [];
}

export function parseCompletionArgs(args: string[]): CompletionContext | null {
	// Expected format: --get-completions <index> <...words>
	// Or for bash: COMP_WORDS and COMP_CWORD environment variables
	const indexArg = args[0];
	if (indexArg === undefined) return null;

	const currentIndex = parseInt(indexArg, 10);
	if (Number.isNaN(currentIndex)) return null;

	const words = args.slice(1);
	const currentWord = words[currentIndex] ?? "";

	return {
		words,
		currentWord,
		currentIndex,
	};
}

function generateBashCompletion(name: string): string {
	return `# Bash completion for ${name}
# Generated by @versecafe/zcli
#
# Installation: ${name} completion bash >> ~/.bashrc
#   or: ${name} completion bash > /etc/bash_completion.d/${name}

_${name}_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local completions

  completions="$("${name}" --get-completions "$COMP_CWORD" "\${COMP_WORDS[@]}" 2>/dev/null)"

  if [[ -n "$completions" ]]; then
    COMPREPLY=()
    while IFS= read -r line; do
      COMPREPLY+=("$line")
    done <<< "$completions"
  fi
}

complete -o default -o bashdefault -F _${name}_completions ${name}
`;
}

function generateZshCompletion(name: string): string {
	return `#compdef ${name}

# Zsh completion for ${name}
# Generated by @versecafe/zcli
#
# Installation: ${name} completion zsh > ~/.zsh/completions/_${name}
#   Then add: fpath=(~/.zsh/completions $fpath) to ~/.zshrc

_${name}() {
  local completions
  completions=("\${(@f)$("${name}" --get-completions "$((CURRENT - 1))" "\${words[@]}" 2>/dev/null)}")

  if (( \${#completions[@]} > 0 )); then
    _describe -t commands "${name}" completions
  fi
}

_${name}
`;
}

function generateFishCompletion(name: string): string {
	return `# Fish completion for ${name}
# Generated by @versecafe/zcli
#
# Installation: ${name} completion fish > ~/.config/fish/completions/${name}.fish

function __${name}_completions
  set -l tokens (commandline -opc)
  set -l current (commandline -ct)
  set -l index (count $tokens)

  ${name} --get-completions $index $tokens $current 2>/dev/null
end

complete -c ${name} -f -a "(__${name}_completions)"
`;
}

function generatePowerShellCompletion(name: string): string {
	return `# PowerShell completion for ${name}
# Generated by @versecafe/zcli
#
# Installation: ${name} completion powershell >> $PROFILE
#   Or save to a file and dot-source it: . ./completions.ps1

Register-ArgumentCompleter -Native -CommandName '${name}' -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)

    $tokens = $commandAst.CommandElements | ForEach-Object { $_.Extent.Text }
    $index = $commandAst.CommandElements.Count
    if ($wordToComplete) {
        $index--
    }

    $completions = & '${name}' --get-completions $index @tokens 2>$null

    if ($completions) {
        $completions -split '\\r?\\n' | ForEach-Object {
            if ($_) {
                [System.Management.Automation.CompletionResult]::new(
                    $_,
                    $_,
                    'ParameterValue',
                    $_
                )
            }
        }
    }
}
`;
}

export function generateCompletionScript(
	config: AnyCommandConfig,
	shell: Shell,
): string {
	const name = config.name;

	switch (shell) {
		case "bash":
			return generateBashCompletion(name);
		case "zsh":
			return generateZshCompletion(name);
		case "fish":
			return generateFishCompletion(name);
		case "powershell":
			return generatePowerShellCompletion(name);
	}
}

// Keep old name for backwards compatibility
export const generateCompletion = generateCompletionScript;
