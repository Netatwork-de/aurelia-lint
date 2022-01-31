import { CommentNode, DocumentFragment, Element, Node, parseFragment, TextNode } from "parse5";
import { LineMap } from "@mpt/line-map";
import { getTemplateContent, isCommentNode, isElementNode, isTextNode } from "parse5/lib/tree-adapters/default";
import { basename, dirname as getDirname, normalize } from "path";
import { getAttr, getAttrLocation, getAttrValueOffset, isDocumentFragment, isTemplate } from "./common/parse5-tree";
import { parallel } from "./common/promises";
import { ProjectContext } from "./project-context";
import { ViewResourceNames } from "./view-resource-names";
import { Ranges } from "./ranges";
import { bindingSuffixes, parseAttributeName, parseInterpolation } from "./common/binding";
import { RuleDiagnostic } from "./rule";
import { formatObject } from "./common/formatting";

export class TemplateFile {
	public readonly viewResourceNames = new ViewResourceNames();
	public readonly lineMap: LineMap;
	public readonly tree: DocumentFragment;
	public readonly disabledRules: Ranges<string>;
	public readonly createErrors: RuleDiagnostic[] = [];
	public readonly unresolvedRequires: TemplateFile.UnresolvedRequire[] = [];

	private constructor(
		public readonly filename: string,
		public readonly dirname: string,
		public readonly source: string,
	) {
		this.lineMap = new LineMap(source);
		this.tree = parseFragment(source, { sourceCodeLocationInfo: true });
		this.disabledRules = new Ranges();
	}

	public traverseComments(visit: (comment: CommentNode) => void): void {
		(function traverse(node: Node) {
			if (isDocumentFragment(node)) {
				node.childNodes.forEach(traverse);
			} else if (isElementNode(node)) {
				if (isTemplate(node)) {
					traverse(getTemplateContent(node));
				} else {
					(node as Element).childNodes.forEach(traverse);
				}
			} else if (isCommentNode(node)) {
				visit(node);
			}
		})(this.tree);
	}

	public traverseElements(visit: (element: Element) => void | boolean, visitText?: (text: TextNode) => void): void {
		(function traverse(node: Node) {
			if (isDocumentFragment(node)) {
				node.childNodes.forEach(traverse);
			} else if (isElementNode(node) && (visit(node) ?? true)) {
				if (isTemplate(node)) {
					traverse(getTemplateContent(node));
				} else {
					(node as Element).childNodes.forEach(traverse);
				}
			} else if (visitText && isTextNode(node)) {
				visitText(node);
			}
		})(this.tree);
	}

	public traverseBindings(visit: (binding: TemplateFile.Binding) => void): void {
		this.traverseElements(elem => {
			elem.attrs.forEach(attr => {
				const { suffix } = parseAttributeName(attr.name);
				const location = getAttrLocation(attr.name, elem);
				const valueOffset = getAttrValueOffset(attr, location);
				if (suffix && bindingSuffixes.has(suffix)) {
					visit({
						type: "attributeBinding",
						attrName: attr.name,
						expression: attr.value,
						start: valueOffset,
						end: valueOffset + attr.value.length,
						elem,
					});
				} else {
					const bindings = parseInterpolation(attr.value);
					for (let i = 0; i < bindings.length; i++) {
						const binding = bindings[i];
						const bindingValueOffset = valueOffset + binding.offset;
						visit({
							type: "attributeInterpolation",
							attrName: attr.name,
							expression: binding.value,
							start: bindingValueOffset,
							end: bindingValueOffset + binding.value.length,
							elem,
						});
					}
				}
			});
		}, textNode => {
			const location = textNode.sourceCodeLocation!;
			const bindings = parseInterpolation(textNode.value);
			for (let i = 0; i < bindings.length; i++) {
				const binding = bindings[i];
				const bindingValueOffset = location.startOffset + binding.offset;
				visit({
					type: "interpolation",
					expression: binding.value,
					start: bindingValueOffset,
					end: bindingValueOffset + binding.value.length,
					textNode,
				});
			}
		});
	}

	public static async create(projectContext: ProjectContext, filename: string, source: string) {
		filename = normalize(filename);
		const dirname = getDirname(filename);

		const template = new TemplateFile(filename, dirname, source);

		try {
			const disabledRuleNames = new Map<string, number>();

			template.traverseComments(comment => {
				const ignoreRegExp = /\s*aurelia-lint-(disable|enable|disable-line)?\s(\S+)(?:\s+|$)/g;

				let ignore: RegExpExecArray | null;
				while (ignore = ignoreRegExp.exec(comment.data)) {
					const [, type, ruleName] = ignore;
					switch (type) {
						case "disable-line": {
							const line = template.lineMap.getPosition(comment.sourceCodeLocation!.endOffset)!.line + 1;
							const start = template.lineMap.getOffset({ line, character: 0 });
							if (start !== null) {
								template.disabledRules.add(
									start,
									template.lineMap.getOffset({ line: line + 1, character: 0 }) ?? source.length,
									ruleName
								);
							}
							break;
						}

						case "disable":
							disabledRuleNames.set(ruleName, comment.sourceCodeLocation!.endOffset);
							break;

						case "enable":
							const start = disabledRuleNames.get(ruleName);
							if (start !== undefined) {
								disabledRuleNames.delete(ruleName);
								template.disabledRules.add(start, comment.sourceCodeLocation!.startOffset, ruleName);
							}
							break;
					}
				}
			});

			disabledRuleNames.forEach((_, ruleName) => {
				template.disabledRules.add(0, source.length, ruleName);
			});

			const tasks: Promise<void>[] = [];
			tasks.push((async () => {
				let viewModel: string | null = null;
				try {
					viewModel = await projectContext.resolveSourcePath(`./${basename(filename, ".html")}`, dirname);
				} catch {}
				if (viewModel !== null) {
					template.viewResourceNames.add(await projectContext.getExportedViewResourceNames(viewModel));
				}
			})());
			template.traverseElements(element => {
				if (element.tagName === "require") {
					const request = getAttr(element, "from");
					if (request) {
						const location = getAttrLocation("from", element);
						tasks.push((async () => {
							const filename = await projectContext.resolveSourcePath(request, dirname);
							if (filename === null) {
								template.unresolvedRequires.push({
									start: location.startOffset,
									end: location.endOffset,
									from: request,
								});
							} else {
								template.viewResourceNames.add(await projectContext.getExportedViewResourceNames(filename), {
									startOffset: location.startOffset,
									endOffset: location.endOffset,
								});
							}
						})());
					}
				}
			});
			await parallel(tasks);
		} catch (error) {
			template.createErrors.push({
				message: `Failed to create template file.`,
				details: formatObject(error),
			});
		}

		return template;
	}
}

export declare namespace TemplateFile {
	export interface AttributeBinding extends BindingBase {
		type: "attributeBinding" | "attributeInterpolation";
		attrName: string;
		elem: Element;
	}

	export interface InterpolationBinding extends BindingBase {
		type: "interpolation";
		textNode: TextNode;
	}

	export interface BindingBase {
		expression: string;
		start: number;
		end: number;
	}

	export type Binding = AttributeBinding | InterpolationBinding;

	export interface UnresolvedRequire {
		start: number;
		end: number;
		from: string;
	}
}
