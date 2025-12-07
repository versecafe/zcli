function createMatrix(rows: number, cols: number): number[][] {
	const matrix: number[][] = [];
	for (let i = 0; i < rows; i++) {
		const row: number[] = [];
		for (let j = 0; j < cols; j++) {
			row.push(0);
		}
		matrix.push(row);
	}
	return matrix;
}

function levenshtein(a: string, b: string): number {
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;

	const rows = b.length + 1;
	const cols = a.length + 1;
	const matrix = createMatrix(rows, cols);

	for (let i = 0; i < rows; i++) {
		const row = matrix[i];
		if (row) row[0] = i;
	}

	for (let j = 0; j < cols; j++) {
		const firstRow = matrix[0];
		if (firstRow) firstRow[j] = j;
	}

	for (let i = 1; i < rows; i++) {
		for (let j = 1; j < cols; j++) {
			const cost = a[j - 1] === b[i - 1] ? 0 : 1;
			const currRow = matrix[i];
			const prevRow = matrix[i - 1];
			if (currRow && prevRow) {
				const del = (prevRow[j] ?? 0) + 1;
				const ins = (currRow[j - 1] ?? 0) + 1;
				const sub = (prevRow[j - 1] ?? 0) + cost;
				currRow[j] = Math.min(del, ins, sub);
			}
		}
	}

	return matrix[b.length]?.[a.length] ?? 0;
}

export function didYouMean(
	input: string,
	candidates: string[],
	options: { threshold?: number } = {},
): string | null {
	const { threshold = 3 } = options;

	if (candidates.length === 0) return null;

	let bestMatch: string | null = null;
	let bestDistance = Infinity;

	for (const candidate of candidates) {
		const distance = levenshtein(input.toLowerCase(), candidate.toLowerCase());

		if (distance < bestDistance && distance <= threshold) {
			bestDistance = distance;
			bestMatch = candidate;
		}
	}

	return bestMatch;
}

export function findSimilar(
	input: string,
	candidates: string[],
	options: { threshold?: number; limit?: number } = {},
): string[] {
	const { threshold = 3, limit = 3 } = options;

	const matches = candidates
		.map((candidate) => ({
			candidate,
			distance: levenshtein(input.toLowerCase(), candidate.toLowerCase()),
		}))
		.filter(({ distance }) => distance <= threshold)
		.sort((a, b) => a.distance - b.distance)
		.slice(0, limit)
		.map(({ candidate }) => candidate);

	return matches;
}
