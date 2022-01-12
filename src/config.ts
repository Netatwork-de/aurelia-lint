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

	export async function load(filename: string): Promise<Config> {
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

		if (json.extends) {
			const parentRuleMap = new Map<string, RuleConfig[]>();
			for (const path of json.extends) {
				const config = await load(resolve(context, path));
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
				const ruleModule = await getRuleModule(name);
				const config = rules.get(name);
				rules.set(name, {
					severity: mergeSeverity(config?.severity, parentRules.map(rule => rule.severity)),
					config: ruleModule.mergeConfig ? ruleModule.mergeConfig(config?.config ?? {}, parentRules.map(rule => rule.config)) : {},
				});
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
