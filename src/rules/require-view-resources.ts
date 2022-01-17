import { ValueConverter, BindingBehavior, Expression } from "aurelia-binding";
import { Element } from "parse5";
import { getParentElement } from "../common/parse5-tree";
import { bindingParser } from "../common/binding";
import { Rule, RuleContext, RuleMergeConfigContext } from "../rule";
import { ViewResourceNames } from "../view-resource-names";

const aureliaElements = new Set<string>([
	"template",
	"require",
	"let",
	"slot",
	"compose",
]);

export function mergeConfig({ config, parents }: RuleMergeConfigContext<RequireViewResources.Config>): RequireViewResources.Config {
	const ignoreElements = [...config.ignoreElements ?? []];
	const ignoreValueConverters = [...config.ignoreValueConverters ?? []];
	const ignoreBindingBehaviors = [...config.ignoreBindingBehaviors ?? []];
	parents.forEach(parent => {
		ignoreElements.push(...parent.ignoreElements ?? []);
		ignoreValueConverters.push(...parent.ignoreValueConverters ?? []);
		ignoreBindingBehaviors.push(...parent.ignoreBindingBehaviors ?? []);
	});
	return {
		ignoreElements,
		ignoreValueConverters,
		ignoreBindingBehaviors,
	};
}

export class RequireViewResources implements Rule {
	private readonly _ignoreElements = new Set(aureliaElements);
	private readonly _ignoreElementEndings = new Set();

	private readonly _ignoreValueConverters = new Set<string>();
	private readonly _ignoreBindingBehaviors = new Set<string>([
		"throttle",
		"debounce",
		"updateTrigger",
		"signal",
		"oneTime",
		"self",
	]);

	public configure(config: RequireViewResources.Config) {
		config.ignoreElements?.forEach(selector => {
			const parts = selector.split("/");
			for (let i = 1; i < parts.length; i++) {
				this._ignoreElementEndings.add(parts.slice(i).join("/"));
			}
			this._ignoreElements.add(selector);
		});

		config.ignoreValueConverters?.forEach(n => this._ignoreValueConverters.add(n));
		config.ignoreBindingBehaviors?.forEach(n => this._ignoreBindingBehaviors.add(n));
	}

	public evaluate(ctx: RuleContext): void {
		const names = ctx.file.viewResourceNames!;
		const unusedRequires = names.getRequires();

		function useRequireInfo(info: ViewResourceNames.RequireInfo | undefined) {
			if (info) {
				unusedRequires.delete(info.startOffset);
			}
		}

		ctx.file.traverseBindings(binding => {
			let expression: Expression | undefined = undefined;
			try { expression = bindingParser.parse(binding.expression); } catch {}
			while (expression instanceof BindingBehavior) {
				if (names.bindingBehaviors.has(expression.name)) {
					useRequireInfo(names.bindingBehaviors.get(expression.name));
				} else if (!this._ignoreBindingBehaviors.has(expression.name)) {
					ctx.emit({
						message: `Missing require for binding behavior: ${JSON.stringify(expression.name)}`,
						position: [binding.start, binding.end],
					});
				}
				expression = expression.expression;
			}
			while (expression instanceof ValueConverter) {
				if (names.valueConverters.has(expression.name)) {
					useRequireInfo(names.valueConverters.get(expression.name));
				} else if (!this._ignoreValueConverters.has(expression.name)) {
					ctx.emit({
						message: `Missing require for value converter: ${JSON.stringify(expression.name)}`,
						position: [binding.start, binding.end],
					});
				}
				expression = expression.expression;
			}
		});

		ctx.file.traverseElements(elem => {
			const tagName = elem.tagName;
			if (this._ignoreElements.has(tagName)) {
				return;
			}
			let path = tagName;
			let node: Element | null = elem;
			while (node && this._ignoreElementEndings.has(path)) {
				node = getParentElement(node);
				if (node) {
					path = node.tagName + "/" + path;
				}
				if (this._ignoreElements.has(path)) {
					return;
				}
			}

			if (names.customElements.has(tagName)) {
				useRequireInfo(names.customElements.get(tagName));
			} else {
				const location = elem.sourceCodeLocation!.startTag ?? elem.sourceCodeLocation!;
				ctx.emit({
					message: `Element is not allowed or a <require> is missing: ${JSON.stringify(tagName)}.`,
					position: [location.startOffset, location.endOffset],
				});
			}
		});

		unusedRequires.forEach(info => {
			ctx.emit({
				message: `Unused <require> element`,
				position: [info.startOffset, info.endOffset],
			});
		});
	}
}

export default RequireViewResources;

export declare namespace RequireViewResources {
	export interface Config {
		ignoreElements?: string[];
		ignoreValueConverters?: string[];
		ignoreBindingBehaviors?: string[];
	}
}
