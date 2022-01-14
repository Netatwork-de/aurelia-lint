import { CommentNode, DocumentFragment, Element, Node, parseFragment } from "parse5";
import { LineMap } from "@mpt/line-map";
import { getTemplateContent, isCommentNode, isElementNode } from "parse5/lib/tree-adapters/default";
import { basename, dirname as getDirname, normalize } from "path";
import { getAttr, isDocumentFragment, isTemplate } from "./common/parse5-tree";
import { parallel } from "./common/promises";
import { ProjectContext } from "./project-context";
import { ViewResourceNames } from "./view-resource-names";
import { Ranges } from "./ranges";

export class TemplateFile {
	public readonly viewResourceNames = new ViewResourceNames();
	public readonly lineMap: LineMap;
	public readonly tree: DocumentFragment;
	public readonly disabledRules: Ranges<string>;

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

	public traverseElements(visit: (element: Element) => void | boolean): void {
		(function traverse(node: Node) {
			if (isDocumentFragment(node)) {
				node.childNodes.forEach(traverse);
			} else if (isElementNode(node) && (visit(node) ?? true)) {
				if (isTemplate(node)) {
					traverse(getTemplateContent(node));
				} else {
					(node as Element).childNodes.forEach(traverse);
				}
			}
		})(this.tree);
	}

	public static async create(projectContext: ProjectContext, filename: string, source: string) {
		filename = normalize(filename);
		const dirname = getDirname(filename);

		const template = new TemplateFile(filename, dirname, source);

		const disabledRuleNames = new Map<string, number>();

		template.traverseComments(comment => {
			const ignore = /\s*aurelia-lint-(disable|enable|disable-line)?\s(\S+)(?:\s+|$)/.exec(comment.data);
			if (ignore) {
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
					const location = element.sourceCodeLocation!.attrs!.from;
					tasks.push((async () => {
						const filename = await projectContext.resolveSourcePath(request, dirname);
						if (filename !== null) {
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

		return template;
	}
}
