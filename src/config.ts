import { readFile } from "fs/promises";
import { dirname, resolve } from "path";
import { parse } from "json5";
import { getRuleModule } from "./rule";
import { mergeSeverity, Severity } from "./severity";

export interface Config {
	readonly context: string;
	readonly srcRoot: string;
	readonly include: string[];
	readonly rules: Map<string, Config.RuleConfig>;
}

export class ConfigError extends Error {}
export class ConfigRuleMergeError extends ConfigError {
	public constructor(public readonly filename: string, public readonly ruleName: string, public readonly error: unknown) {
		super(`Rule ${JSON.stringify(ruleName)} (${JSON.stringify(filename)}) could not be merged: ${error instanceof Error ? error.message : error}`);
	}
}

export namespace Config {
	export interface Json {
		srcRoot?: string;
		extends?: string[];
		include?: string[];
		rules?: Readonly<Record<string, RuleConfigJson>>;
	}

	export type RuleConfigJson = Severity | [Severity, object] | object;

	export interface RuleConfig {
		severity: Severity | undefined;
		config: object;
	}

	export async function load(filename: string, isRoot = true): Promise<Config> {
		const context = dirname(filename);
		const json = parse(await readFile(filename, "utf-8")) as Json;

		const include = json.include ?? ["./src/**/*.html"];

		const rules = new Map<string, RuleConfig>();

		if (json.rules) {
			for (const name in json.rules) {
				let rule: RuleConfig;
				const ruleJson = json.rules[name];
				if (typeof ruleJson === "string") {
					rule = {
						severity: ruleJson,
						config: {},
					};
				} else if (Array.isArray(ruleJson)) {
					rule = {
						severity: ruleJson[0],
						config: ruleJson[1] ?? {},
					};
				} else {
					rule = {
						severity: undefined,
						config: ruleJson,
					};
				}
				rules.set(name, rule);
			}
		}

		const mergedRules = new Set<string>();
		if (json.extends) {
			const parentRuleMap = new Map<string, RuleConfig[]>();
			for (const path of json.extends) {
				const config = await load(resolve(context, path), false);
				config.rules.forEach((rule, name) => {
					const parentRules = parentRuleMap.get(name);
					if (parentRules === undefined) {
						parentRuleMap.set(name, [rule]);
					} else {
						parentRules.push(rule);
					}
				});
			}

			for (const [name, parentRules] of parentRuleMap) {
				mergedRules.add(name);
				const ruleModule = await getRuleModule(name);
				const ruleConfig = rules.get(name);
				try {
					rules.set(name, {
						severity: mergeSeverity(ruleConfig?.severity, parentRules.map(rule => rule.severity)),
						config: ruleModule.mergeConfig
							? ruleModule.mergeConfig({
								config: ruleConfig?.config ?? {},
								parents: parentRules.map(rule => rule.config),
								context,
								isRoot,
							})
							: (ruleConfig?.config ?? {}),
					});
				} catch (error) {
					throw new ConfigRuleMergeError(filename, name, error);
				}
			}
		}

		for (const [name, ruleConfig] of rules) {
			if (!mergedRules.has(name)) {
				const ruleModule = await getRuleModule(name);
				if (ruleModule.mergeConfig) {
					ruleConfig.config = ruleModule.mergeConfig({
						config: ruleConfig.config,
						parents: [],
						context,
						isRoot,
					});
				}
			}
		}

		return {
			context,
			srcRoot: resolve(context, json.srcRoot ?? "./src"),
			include,
			rules,
		};
	}
}
