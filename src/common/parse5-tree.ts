import { DocumentFragment, Element, Node } from "parse5";
import { getAttrList, isElementNode } from "parse5/lib/tree-adapters/default";

export function isDocumentFragment(value: Node): value is DocumentFragment {
	return value.nodeName === "#document-fragment";
}

export function isTemplate(value: Node): value is Element {
	return value.nodeName === "template";
}

export function getAttr(value: Element, name: string): string | undefined {
	return getAttrList(value).find(attr => attr.name === name)?.value;
}

export function getParentElement(value: Element): Element | null {
	const parent = value.parentNode;
	return isElementNode(parent) ? parent : null;
}
