import { promisify } from "util";
import resolveCallback from "resolve";
import createLimit from "p-limit";
import { basename, join, normalize } from "path";
import * as ts from "typescript";
import { readFile } from "fs/promises";
import { ViewResourceNames } from "./view-resource-names";

const resolve = promisify(resolveCallback) as unknown as (path: string, options: resolveCallback.AsyncOpts) => Promise<string>;

const CUSTOM_ELEMENT_SUFFIX = "CustomElement";
const VALUE_CONVERTER_SUFFIX = "ValueConverter";
const BINDING_BEHAVIOR_SUFFIX = "BindingBehavior";

export class Project {
	private readonly _srcRoot?: string;
	private readonly _limit: createLimit.Limit;

	private readonly _declarationPathCache = new Map<string, Promise<string>>();
	private readonly _exportedNamesCache = new Map<string, Promise<ViewResourceNames>>();

	public constructor(options: ProjectOptions) {
		this._srcRoot = options.srcRoot;
		this._limit = options.ioLimit;
	}

	public invalidateCache(filename: string) {
		this._exportedNamesCache.delete(normalize(filename));
	}

	/**
	 * Resolve an aurelia <require> path to either the file that is being required
	 * or the typescript declaration if the original source is not available.
	 * @param request The raw required path
	 * @param dirname The directory in which the path is resolved
	 * @returns The normalized filename of the source file or it's declaration or null if resolution failed.
	 */
	public resolveSourcePath(request: string, dirname: string): Promise<string | null> {
		if (!request.startsWith(".")) {
			const cached = this._declarationPathCache.get(request);
			if (cached !== undefined) {
				return cached;
			}
		}

		const promise = this._limit(async () => {
			const resolveOptions: resolveCallback.AsyncOpts = {
				basedir: dirname,
				extensions: [".ts", ".d.ts"],
				includeCoreModules: false,
			};

			let filename = await (async () => {
				try {
					return await resolve(request, resolveOptions);
				} catch (error) {
					if ((error as any).code === "MODULE_NOT_FOUND") {
						try {
							const regularPackage = /^([^\@][^\/]*)(\/.+)?$/.exec(request);
							if (regularPackage) {
								return await resolve(regularPackage[1] + "/src" + regularPackage[2], resolveOptions);
							}
						} catch {}

						try {
							const scopedPackage = /^(\@[^\/]+\/[^\/]+)(\/.+)?$/.exec(request);
							if (scopedPackage) {
								return await resolve(scopedPackage[1] + "/src" + scopedPackage[2], resolveOptions);
							}
						} catch {}

						try {
							if (this._srcRoot && /^[^\.]/.test(request)) {
								return await resolve(join(this._srcRoot, request), resolveOptions);
							}
						} catch {}
					}
					throw error;
				}
			})();

			return filename;
		});

		this._declarationPathCache.set(request, promise);
		return promise;
	}

	public getExportedViewResourceNames(filename: string): Promise<ViewResourceNames> {
		const cached = this._exportedNamesCache.get(filename);
		if (cached !== undefined) {
			return cached;
		}
		const promise = this._limit(async () => {
			const names = new ViewResourceNames();
			if (/\.html$/.test(filename)) {
				names.addCustomElement(basename(filename, ".html"));
			} else {
				const source = await readFile(filename, "utf-8");
				const sourceFile = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, false);
				(function traverse(node: ts.Node) {
					if (ts.isClassDeclaration(node)) {
						if (node.name?.escapedText && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {

							if (node.name.escapedText.endsWith(CUSTOM_ELEMENT_SUFFIX)) {
								names.addCustomElement(node.name.escapedText.slice(0, -CUSTOM_ELEMENT_SUFFIX.length));
							} else if (node.name.escapedText.endsWith(VALUE_CONVERTER_SUFFIX)) {
								names.addValueConverter(node.name.escapedText.slice(0, -VALUE_CONVERTER_SUFFIX.length));
							} else if (node.name.escapedText.endsWith(BINDING_BEHAVIOR_SUFFIX)) {
								names.addBindingBehavior(node.name.escapedText.slice(0, -BINDING_BEHAVIOR_SUFFIX.length));
							} else {
								names.addCustomElement(node.name.escapedText);
							}

							if (node.decorators) {
								node.decorators.forEach(decorator => {
									if (ts.isCallExpression(decorator.expression) && ts.isIdentifier(decorator.expression.expression)) {
										const arg = decorator.expression.arguments[0];
										if (arg && ts.isStringLiteral(arg)) {
											switch (decorator.expression.expression.escapedText) {
												case "customElement":
													names.addCustomElement(arg.text);
													break;

												// TODO: Support decorators for value converters & binding behaviors.
											}
										}
									}
								});
							}

						}
					} else {
						ts.forEachChild(node, traverse);
					}
				})(sourceFile);
			}
			return names;
		});

		this._exportedNamesCache.set(filename, promise);
		return promise;
	}
}

export interface ProjectOptions {
	srcRoot?: string;
	ioLimit: createLimit.Limit;
}
