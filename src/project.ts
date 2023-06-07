import { readFile } from "fs/promises";
import { formatObject } from "./common/formatting";
import { createFileMatcher, DisposeWatcher, FileMatcherFn, findFiles, watchFiles } from "./common/files";
import { Config } from "./config";
import { ProjectContext } from "./project-context";
import { getRuleModule, Rule, RuleDiagnostic } from "./rule";
import { Severity } from "./severity";
import { TemplateFile } from "./template-file";

interface RuleInstance {
	name: string;
	rule: Rule;
	severity: Severity;
}

export class Project {
	private readonly _config: Config;
	private readonly _context: ProjectContext;
	private readonly _rules: RuleInstance[];
	private readonly _fileMatcher: FileMatcherFn;

	private constructor(config: Config, context: ProjectContext, rules: RuleInstance[]) {
		this._config = config;
		this._context = context;
		this._rules = rules;
		this._fileMatcher = createFileMatcher(config.context, config.include);
	}

	public invalidateCache(filename: string) {
		this._context.invalidateCache(filename);
	}

	public includes(filename: string) {
		return this._fileMatcher(filename);
	}

	public async evaluate(filename: string, source?: string): Promise<[TemplateFile, Project.Diagnostic[]]> {
		const file = await this.createFile(filename, source);
		return [file, this.evaluateFile(file)];
	}

	private async createFile(filename: string, source?: string) {
		return TemplateFile.create(this._context, filename, source ?? await readFile(filename, "utf-8"));
	}

	private evaluateFile(file: TemplateFile): Project.Diagnostic[] {
		const diagnostics: Project.Diagnostic[] = [];
		if (file.createErrors.length > 0) {
			file.createErrors.forEach(diagnostic => {
				diagnostics.push({
					severity: "error",
					...diagnostic,
				});
			});
		} else {
			this._rules.forEach(({ name, rule, severity }) => {
				try {
					rule.evaluate({
						file,
						emit(diagnostic) {
							if (!file.disabledRules.has(name, diagnostic.position?.[0] ?? 0)) {
								diagnostics.push({
									rule: name,
									severity,
									...diagnostic,
								});
							}
						}
					});
				} catch (error) {
					diagnostics.push({
						rule: name,
						severity: "error",
						message: "Failed to evaluate rule.",
						details: formatObject(error),
					});
				}
			});
		}
		return diagnostics;
	}

	public async run(): Promise<Project.Diagnostics> {
		const diagnostics = new Map<TemplateFile, Project.Diagnostic[]>();
		for await (const filename of findFiles(this._config.context, this._config.include)) {
			const file = await this.createFile(filename);
			diagnostics.set(file, this.evaluateFile(file));
		}
		return diagnostics;
	}

	public watch(options: Project.WatchOptions): DisposeWatcher {
		return watchFiles({
			cwd: this._config.context,
			patterns: this._config.include,
			onChange: async changes => {
				changes.deleted.forEach(filename => this._context.invalidateCache(filename));
				const diagnostics = new Map<TemplateFile, Project.Diagnostic[]>();
				for (const filename of changes.updated) {
					const file = await this.createFile(filename);
					diagnostics.set(file, this.evaluateFile(file));
				}
				options.onDiagnostics(diagnostics);
			},
			onError: error => {
				console.error(error);
			}
		});
	}

	public static async create(config: Config): Promise<Project> {
		const context = new ProjectContext({ srcRoot: config.srcRoot });

		const rules: RuleInstance[] = [];
		for (const [name, ruleConfig] of config.rules) {
			const ruleModule = await getRuleModule(name);
			const rule = new ruleModule.default();
			await rule.configure?.(ruleConfig.config, config);
			rules.push({
				name,
				rule,
				severity: ruleConfig.severity ?? "error",
			});
		}

		return new Project(config, context, rules);
	}
}

export declare namespace Project {
	export interface Diagnostic extends RuleDiagnostic {
		rule?: string;
		severity: Severity;
	}

	export type Diagnostics = Map<TemplateFile, Diagnostic[]>;

	export interface WatchOptions {
		onDiagnostics(diagnostics: Diagnostics): void | Promise<void>;
	}
}
