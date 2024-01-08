import { Element, getParentElement } from "./parse5-tree";

export class TagNameMap<T> {
	private readonly _selectorEndings = new Set<string>();
	private readonly _selectors = new Map<string, T>();

	public set(selector: string, value: T) {
		const parts = selector.split("/");
		for (let i = 1; i < parts.length; i++) {
			this._selectorEndings.add(parts.slice(i).join("/"));
		}
		this._selectors.set(selector, value);
	}

	public setAll(selectors: Iterable<string>, value: T) {
		for (const selector of selectors) {
			this.set(selector, value);
		}
	}

	public get(element: Element): T | undefined {
		const tagName = element.tagName;

		const value = this._selectors.get(tagName);
		if (value !== undefined) {
			return value;
		}

		let path = tagName;
		let node: Element | null = element;
		while (node && this._selectorEndings.has(path)) {
			node = getParentElement(node);
			if (node) {
				path = node.tagName + "/" + path;
			}
			const value = this._selectors.get(path);
			if (value !== undefined) {
				return value;
			}
		}
		return undefined;
	}

	public static getTagName(selector: string): string {
		return selector.split("/").pop()!;
	}
}
