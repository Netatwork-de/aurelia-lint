import { Parser, ValueConverter, BindingBehavior } from "aurelia-binding";
import { Element } from "parse5";
import { getParentElement } from "../common/parse5-tree";
import { Rule, RuleContext } from "../rule";
import { ViewResourceNames } from "../view-resource-names";

const bindingSuffixes = new Set<string>([
	"bind",
	"one-time",
	"two-way",
	"from-view",
	"to-view",
]);

const aureliaElements = new Set<string>([
	"template",
	"require",
	"let",
	"slot",
	"compose",
]);

export function mergeConfig(config: RequireViewResources.Config, parents: RequireViewResources.Config[]): RequireViewResources.Config {
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
	private readonly _bindingParser = new Parser();

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

		function evaluateExpression(this: RequireViewResources, value: string, startOffset: number, endOffset: number) {
			let expression = this._bindingParser.parse(value);
			while (expression instanceof BindingBehavior) {
				if (names.bindingBehaviors.has(expression.name)) {
					useRequireInfo(names.bindingBehaviors.get(expression.name));
				} else if (!this._ignoreBindingBehaviors.has(expression.name)) {
					ctx.emit({
						message: `Missing require for binding behavior: ${JSON.stringify(expression.name)}`,
						position: [startOffset, endOffset],
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
						position: [startOffset, endOffset],
					});
				}
				expression = expression.expression;
			}
		}

		ctx.file.traverseElements(elem => {
			// TODO: Check for value converters in interpolation in attribute values.
			// TODO: Check for value converters in interpolation in node text.

			elem.attrs.forEach(attr => {
				const parts = attr.name.split(".");
				if (parts.length > 1 && bindingSuffixes.has(parts[parts.length - 1])) {
					const location = elem.sourceCodeLocation!.attrs![attr.name];
					evaluateExpression.call(this, attr.value, location.startOffset, location.endOffset);
				}
			});

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
