import { ChildNode } from "parse5";
import { getTemplateContent, isElementNode } from "parse5/lib/tree-adapters/default";
import { isNonEmptyTextNode, isTemplate } from "../common/parse5-tree";
import { TagNameMap } from "../common/tag-name-map";
import { Rule, RuleContext, RuleMergeConfigContext } from "../rule";

export function mergeConfig({ config, parents }: RuleMergeConfigContext<ElementNesting.Config>): ElementNesting.Config {
	const elements = config.elements ?? {};
	const ignore = config.ignore ?? [];
	for (const parent of parents) {
		if (parent.elements) {
			for (const selector in parent.elements) {
				const element = elements[selector] ?? (elements[selector] = {});
				const parentElement = parent.elements[selector];

				if (parentElement.categories) {
					(element.categories ?? (element.categories = [])).push(...parentElement.categories);
				}
				if (parentElement.allow) {
					(element.allow ?? (element.allow = [])).push(...parentElement.allow);
				}
				if (element.allowText === undefined && parentElement.allowText !== undefined) {
					element.allowText = parentElement.allowText;
				}
				if (parentElement.disallow) {
					(element.disallow ?? (element.disallow = [])).push(...parentElement.disallow);
				}
			}
		}
		if (parent.ignore) {
			ignore.push(...parent.ignore);
		}
	}
	return {
		elements,
		ignore,
	};
}

export class ElementNesting implements Rule {
	private readonly _elements = new TagNameMap<{
		allow?: Set<string>;
		allowText: boolean;
		disallow?: Set<string>;
	}>();
	private readonly _ignore = new TagNameMap<boolean>();

	public configure(config: ElementNesting.Config): void {
		if (config.elements) {
			const categories = new Map<string, string[]>();

			for (const selector in config.elements) {
				const element = config.elements[selector];
				if (element.categories) {
					const tagName = TagNameMap.getTagName(selector);
					element.categories.forEach(category => {
						const tagNames = categories.get(category);
						if (tagNames) {
							tagNames.push(tagName);
						} else {
							categories.set(category, [tagName]);
						}
					});
				}
			}

			function getTagNames(namesOrCategories: string[] | undefined) {
				if (!namesOrCategories) {
					return undefined;
				}
				const set = new Set<string>();
				for (let i = 0; i < namesOrCategories.length; i++) {
					const name = namesOrCategories[i];
					if (name.startsWith("@")) {
						categories.get(name.slice(1))?.forEach(name => set.add(name));
					} else {
						set.add(name);
					}
				}
				return set;
			}

			for (const selector in config.elements) {
				const element = config.elements[selector];
				this._elements.set(selector, {
					allow: getTagNames(element.allow),
					allowText: element.allowText ?? true,
					disallow: getTagNames(element.disallow),
				});
			}
		}

		this._ignore.set("let", true);
		if (config.ignore) {
			this._ignore.setAll(config.ignore, true);
		}
	}

	public evaluate(ctx: RuleContext): void {
		ctx.file.traverseElements(elem => {
			const config = this._elements.get(elem);
			if (config) {
				const handleNode = (child: ChildNode) => {
					if (isTemplate(child)) {
						getTemplateContent(child).childNodes.forEach(handleNode);
					} else if (isElementNode(child)) {
						if (!this._ignore.get(child)) {
							const tagName = child.tagName;
							if (tagName === "slot") {
								child.childNodes.forEach(handleNode);
							} else {
								if (config!.allow ? !config!.allow.has(tagName) : config!.disallow?.has(tagName)) {
									const location = child.sourceCodeLocation!.startTag;
									ctx.emit({
										message: `${JSON.stringify(tagName)} element is not allowed in ${JSON.stringify(elem.tagName)}.`,
										position: [location.startOffset, location.endOffset],
									});
								}
							}
						}
					} else if (isNonEmptyTextNode(child) && !config!.allowText) {
						const location = child.sourceCodeLocation!;
						ctx.emit({
							message: "Text content is not allowed in this element.",
							position: [location.startOffset, location.endOffset],
						});
					}
				}
				elem.childNodes.forEach(handleNode);
			}
		});
	}
}

export default ElementNesting;

export declare namespace ElementNesting {
	export interface Config {
		elements?: Record<string, ElementConfig>;
		ignore?: string[];
	}

	export interface ElementConfig {
		categories?: string[];
		allow?: string[];
		disallow?: string[];
		allowText?: boolean;
	}
}
