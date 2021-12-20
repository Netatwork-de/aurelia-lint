import { join, relative, sep } from "path";
import { readdir } from "fs/promises";

/*
	Note that picomatch is used to provide compatibility
	with chokidar in vscode, so that vscode's native file
	system watch can be used when needed.
*/
import match from "picomatch";

export interface FilePattern {
	pattern: string;
	context: string;
}

interface FileMatcher {
	context: string;
	matcher: match.Matcher;
}

function isOrContains(parent: string, nested: string): boolean {
	return parent === nested || (nested.startsWith(parent) && nested[parent.length] === sep);
}

export async function * findFiles(patterns: FilePattern[]) {
	const matchers: FileMatcher[] = [];
	let regions: string[] = [];

	for (const pattern of patterns) {
		matchers.push({
			context: pattern.context,
			matcher: match(pattern.pattern),
		});
		const region = join(pattern.context, match.scan(pattern.pattern).base);
		if (!regions.some(r => isOrContains(r, region))) {
			regions = regions.filter(r => !isOrContains(region, r));
			regions.push(region);
		}
	}

	for (const region of regions) {
		yield * (async function * traverse(filename: string): AsyncGenerator<string> {
			const names = await readdir(filename).catch(error => {
				if (error?.code !== "ENOTDIR") {
					throw error;
				}
			});
			if (names === undefined) {
				if (matchers.some(({ matcher, context }) => matcher(relative(context, filename)))) {
					yield filename;
				}
			} else {
				for (const name of names) {
					yield * traverse(join(filename, name));
				}
			}
		})(region);
	}
}
