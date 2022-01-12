import { DisposeWatcher, findFiles, watchFiles } from "./common/files";
import { Config } from "./config";
import { ProjectContext } from "./project-context";
import { getRuleModule, Rule, RuleDiagnostic } from "./rule";
import { Severity } from "./severity";
import { TemplateFile } from "./template-file";

interface RuleInstance {
	rule: Rule;
	severity: Severity;
}

export class Project {
	private readonly _config: Config;
	private readonly _context: ProjectContext;
	private readonly _rules: RuleInstance[];

	private constructor(config: Config, context: ProjectContext, rules: RuleInstance[]) {
		this._config = config;
		this._context = context;
		this._rules = rules;
	}

	public evaluateFile(file: TemplateFile): Project.Diagnostic[] {
		const diagnostics: Project.Diagnostic[] = [];
		this._rules.forEach(({ rule, severity }) => {
			rule.evaluate({
				file,
				emit(diagnostic) {
					diagnostics.push({ severity, ...diagnostic });
				}
			});
		});
		return diagnostics;
	}

	public async run(): Promise<Project.Diagnostics> {
		const diagnostics = new Map<TemplateFile, Project.Diagnostic[]>();
		for await (const filename of findFiles(this._config.context, this._config.include)) {
			const file = await TemplateFile.create(this._context, filename);
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
					const file = await TemplateFile.create(this._context, filename);
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
			rule.configure?.(ruleConfig.config);
			rules.push({
				rule,
				severity: ruleConfig.severity ?? "error",
			});
		}

		return new Project(config, context, rules);
	}
}

export declare namespace Project {
	export interface Diagnostic extends RuleDiagnostic {
		severity: Severity;
	}

	export type Diagnostics = Map<TemplateFile, Diagnostic[]>;

	export interface WatchOptions {
		onDiagnostics(diagnostics: Diagnostics): void | Promise<void>;
	}
}
