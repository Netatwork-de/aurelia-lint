import { parseAttributeName } from "../common/binding";
import { getAttrLocation } from "../common/parse5-tree";
import { TagNameMap } from "../common/tag-name-map";
import { Rule, RuleContext, RuleMergeConfigContext } from "../rule";

export function mergeConfig({ config, parents }: RuleMergeConfigContext<AttributeUsage.Config>): AttributeUsage.Config {
	const elements: AttributeUsage.Config["elements"] = config.elements ?? {};
	for (const parent of parents) {
		if (parent.elements) {
			for (const selector in parent.elements) {
				const element = elements[selector] ?? (elements[selector] = {});

				const parentElement = parent.elements[selector];
				if (parentElement.require) {
					(element.require ?? (element.require = [])).push(...parentElement.require);
				}
				if (parentElement.disallow) {
					(element.disallow ?? (element.disallow = [])).push(...parentElement.disallow);
				}
			}
		}
	}
	return { elements };
}

export class AttributeUsage implements Rule {
	private readonly _elements = new TagNameMap<{
		disallow: Set<string>;
		require: Set<string>;
	}>();

	public configure(config: AttributeUsage.Config) {
		if (config.elements) {
			for (const selector in config.elements) {
				const element = config.elements[selector];
				this._elements.set(selector, {
					disallow: new Set(element.disallow),
					require: new Set(element.require),
				});
			}
		}
	}

	public evaluate(ctx: RuleContext): void {
		ctx.file.traverseElements(elem => {
			const config = this._elements.get(elem);

			const missing = new Set(config?.require);

			elem.attrs.forEach(attr => {
				const location = getAttrLocation(attr.name, elem);
				const { name } = parseAttributeName(attr.name);

				missing.delete(name);

				if (config?.disallow?.has(name)) {
					ctx.emit({
						message: `Attribute ${JSON.stringify(name)} is not allowed for this element.`,
						position: [location.startOffset, location.endOffset],
					});
				}
			});

			if (missing.size > 0) {
				const location = elem.sourceCodeLocation!.startTag;
				ctx.emit({
					message: `Attribute(s) ${Array.from(missing).map(name => JSON.stringify(name)).join(", ")} are missing.`,
					position: [location.startOffset, location.endOffset],
				});
			}
		});
	}
}

export default AttributeUsage;

export declare namespace AttributeUsage {
	export interface Config {
		elements?: Record<string, {
			disallow?: string[];
			require?: string[];
		}>;
	}
}
