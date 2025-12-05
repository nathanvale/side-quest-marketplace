/**
 * Lightweight filesystem helpers using Bun primitives.
 *
 * These helpers avoid Node's fs module and lean on Bun.file/Bun.write
 * so other packages can share async file access without reimplementing
 * existence checks or JSON handling.
 */

export async function pathExists(path: string): Promise<boolean> {
	const file = Bun.file(path);
	return await file.exists();
}

export async function readTextFile(path: string): Promise<string> {
	const file = Bun.file(path);
	if (!(await file.exists())) {
		throw new Error(`File not found: ${path}`);
	}
	return file.text();
}

export async function readJsonFile<T>(path: string): Promise<T> {
	const text = await readTextFile(path);
	return JSON.parse(text) as T;
}

export async function writeTextFile(
	path: string,
	contents: string,
): Promise<void> {
	await Bun.write(path, contents);
}

export async function writeJsonFile(
	path: string,
	value: unknown,
	space = 2,
): Promise<void> {
	await writeTextFile(path, `${JSON.stringify(value, null, space)}\n`);
}
