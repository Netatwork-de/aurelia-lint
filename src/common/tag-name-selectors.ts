import { Element } from "parse5";
import { getParentElement } from "./parse5-tree";

export class TagNameSelectors {
	private readonly _selectorEndings = new Set<string>();
	private readonly _selectors = new Set<string>();

	public add(selector: string) {
		const parts = selector.split("/");
		for (let i = 1; i < parts.length; i++) {
			this._selectorEndings.add(parts.slice(i).join("/"));
		}
		this._selectors.add(selector);
	}

	public addAll(selectors: Iterable<string>) {
		for (const selector of selectors) {
			this.add(selector);
		}
	}

	public test(element: Element) {
		const tagName = element.tagName;
		if (this._selectors.has(tagName)) {
			return true;
		}

		let path = tagName;
		let node: Element | null = element;
		while (node && this._selectorEndings.has(path)) {
			node = getParentElement(node);
			if (node) {
				path = node.tagName + "/" + path;
			}
			if (this._selectors.has(path)) {
				return true;
			}
		}
		return false;
	}
}
