import { DocumentFragment, Element, Node, parseFragment } from "parse5";
import { getTemplateContent, isElementNode } from "parse5/lib/tree-adapters/default";
import { basename, dirname, normalize } from "path";
import { getAttr, isDocumentFragment, isTemplate } from "./common/parse5-tree";
import { parallel } from "./common/promises";
import { SourcePositionConverter } from "./common/source-position-converter";
import { Project } from "./project";
import { RuleContext } from "./rule";
import { ViewResourceNames } from "./view-resource-names";

export class TemplateFile {
	public readonly project: Project;
	public readonly filename: string;
	public readonly dirname: string;
	public readonly source: string;
	public readonly sourcePositions: SourcePositionConverter;
	public readonly tree: DocumentFragment;

	private _viewResourceNames: ViewResourceNames | null = null;

	public constructor(project: Project, filename: string, source: string) {
		this.project = project;
		this.filename = normalize(filename);
		this.dirname = dirname(filename);
		this.source = source;
		this.sourcePositions = new SourcePositionConverter(source);
		this.tree = parseFragment(source, { sourceCodeLocationInfo: true });
	}

	public async resolveViewResourceNames(ctx: RuleContext): Promise<void> {
		const names = new ViewResourceNames();

		const tasks: Promise<void>[] = [];

		tasks.push((async () => {
			let viewModel: string | null = null;
			try {
				viewModel = await this.project.resolveSourcePath(`./${basename(this.filename, ".html")}`, this.dirname);
			} catch {}
			if (viewModel !== null) {
				names.add(await this.project.getExportedViewResourceNames(viewModel));
			}
		})());

		this.traverseElements(element => {
			if (element.tagName === "require") {
				const request = getAttr(element, "from");
				if (request === undefined) {
					ctx.emit({
						message: `<require> element must have a "from" attribute`,
						position: [element.sourceCodeLocation!.startOffset, element.sourceCodeLocation!.endOffset],
					});
				} else {
					const location = element.sourceCodeLocation!.attrs!.from;
					tasks.push((async () => {
						const filename = await this.project.resolveSourcePath(request, this.dirname);
						if (filename === null) {
							ctx.emit({
								message: `path could not be resolved: ${JSON.stringify(request)}`,
								position: [location.startOffset, location.endOffset],
							});
						} else {
							names.add(await this.project.getExportedViewResourceNames(filename), {
								startOffset: location.startOffset,
								endOffset: location.endOffset,
							});
						}
					})());
				}
			}
		});

		await parallel(tasks);

		this._viewResourceNames = names;
	}

	public get viewResourceNames(): ViewResourceNames | null {
		return this._viewResourceNames;
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
}
