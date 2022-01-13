import { DocumentFragment, Element, Node, parseFragment } from "parse5";
import { LineMap } from "@mpt/line-map";
import { getTemplateContent, isElementNode } from "parse5/lib/tree-adapters/default";
import { basename, dirname as getDirname, normalize } from "path";
import { getAttr, isDocumentFragment, isTemplate } from "./common/parse5-tree";
import { parallel } from "./common/promises";
import { ProjectContext } from "./project-context";
import { ViewResourceNames } from "./view-resource-names";

export class TemplateFile {
	public readonly viewResourceNames = new ViewResourceNames();
	public readonly lineMap: LineMap;
	public readonly tree: DocumentFragment;

	private constructor(
		public readonly filename: string,
		public readonly dirname: string,
		public readonly source: string,
	) {
		this.lineMap = new LineMap(source);
		this.tree = parseFragment(source, { sourceCodeLocationInfo: true });
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
