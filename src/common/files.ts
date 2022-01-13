import { join, relative, sep } from "path";
import { readdir } from "fs/promises";

/*
	Note that picomatch is used to provide compatibility
	with chokidar in vscode, so that vscode's native file
	system watch can be used when needed.
*/
import match from "picomatch";
import { watch } from "chokidar";
import { clearTimeout, setTimeout } from "timers";

interface FileMatcher {
	cwd: string;
	matcher: match.Matcher;
}

function isOrContains(parent: string, nested: string): boolean {
	return parent === nested || (nested.startsWith(parent) && nested[parent.length] === sep);
}

export function createFileMatcher(cwd: string, patterns: string[]): FileMatcherFn {
	const matchers = patterns.map(pattern => match(pattern));
	return filename => {
		const rel = relative(cwd, filename);
		return matchers.some(matcher => matcher(rel));
	};
}

export type FileMatcherFn = (filename: string) => boolean;

export async function * findFiles(cwd: string, patterns: string[]) {
	const matchers: FileMatcher[] = [];
	let regions: string[] = [];

	for (const pattern of patterns) {
		matchers.push({
			cwd,
			matcher: match(pattern),
		});
		const region = join(cwd, match.scan(pattern).base);
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
				if (matchers.some(({ matcher, cwd: context }) => matcher(relative(context, filename)))) {
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

const WATCH_FILES_DELAY = 100;

export function watchFiles(options: WatchOptions): DisposeWatcher {
	const watcher = watch(options.patterns, { cwd: options.cwd });

	let ready = false;
	let handling = false;

	const updated = new Set<string>();
	const deleted = new Set<string>();

	let handleChangesTimer: NodeJS.Timer | null = null;
	function handleChanges() {
		if (!ready) {
			return;
		}
		if (handleChangesTimer !== null) {
			clearTimeout(handleChangesTimer);
		}
		handleChangesTimer = setTimeout(() => {
			if (!handling) {
				handling = true;
				void (async () => {
					while (updated.size > 0 || deleted.size > 0) {
						try {
							const changes: FileChanges = {
								updated: Array.from(updated),
								deleted: Array.from(deleted),
							};
							updated.clear();
							deleted.clear();
							await options.onChange(changes);
						} catch (error) {
							options.onError(error);
						}
					}
					handling = false;
				})();
			}
		}, WATCH_FILES_DELAY);
	}

	watcher.on("add", name => {
		const filename = join(options.cwd, name);
		updated.add(filename);
		deleted.delete(filename);
		handleChanges();
	});

	watcher.on("change", name => {
		const filename = join(options.cwd, name);
		updated.add(filename);
		deleted.delete(filename);
		handleChanges();
	});

	watcher.on("unlink", name => {
		const filename = join(options.cwd, name);
		updated.delete(filename);
		deleted.add(filename);
		handleChanges();
	});

	watcher.on("ready", () => {
		ready = true;
		handleChanges();
	});

	return async () => {
		await watcher.close();
		if (handleChangesTimer !== null) {
			clearTimeout(handleChangesTimer);
		}
	};
}

export interface WatchOptions {
	cwd: string;
	patterns: string[];
	onChange(changes: FileChanges): void | Promise<void>;
	onError(error: unknown): void;
}

export type DisposeWatcher = () => Promise<void>;

export interface FileChanges {
	readonly updated: string[];
	readonly deleted: string[];
}
