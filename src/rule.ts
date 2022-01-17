import { Config } from "./config";
import { TemplateFile } from "./template-file";

export interface RuleDiagnostic {
	message: string;
	position?: [start: number, end: number];
}

export interface RuleContext {
	readonly file: TemplateFile;

	emit(diagnostic: RuleDiagnostic): void;
}

export interface Rule {
	/**
	 * Called to configure this rule instance.
	 */
	configure?(config: object, projectConfig: Config): void | Promise<void>;

	/**
	 * Called to evaluate this rule on a given template file.
	 * @param ctx The rule evaluation context.
	 */
	evaluate(ctx: RuleContext): void;
}

export interface RuleConstructor {
	new(): Rule;
}

export interface RuleModule {
	default: RuleConstructor;

	/**
	 * Called to merge a config with one or more parent configs.
	 */
	mergeConfig?(config: object, parents: object[]): object;
}

const cache = new Map<string, Promise<RuleModule>>();

export function getRuleModule(name: string): Promise<RuleModule> {
	const cached = cache.get(name);
	if (cached !== undefined) {
		return cached;
	}

	const promise = (async () => {
		if (/^[a-z-]+$/.test(name)) {
			let module: RuleModule | null = null;
			try {
				module = await import(`./rules/${name}`) as RuleModule;
			} catch {}
			if (module === null || typeof module.default !== "function") {
				throw new Error(`Unable to load rule: ${name}`);
			}
			return module;
		}
		throw new TypeError(`Invalid rule name: ${name}`);
	})();

	cache.set(name, promise);
	return promise;
}
