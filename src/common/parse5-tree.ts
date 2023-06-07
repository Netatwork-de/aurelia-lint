import { Attribute, DocumentFragment, Element, ElementLocation, Location, Node, TextNode } from "parse5";
import { getAttrList, isElementNode, isTextNode } from "parse5/lib/tree-adapters/default";

export function isDocumentFragment(value: Node): value is DocumentFragment {
	return value.nodeName === "#document-fragment";
}

export function isTemplate(value: Node): value is Element {
	return value.nodeName === "template";
}

export function getAttr(value: Element, name: string): string | undefined {
	return getAttrList(value).find(attr => attr.name === name)?.value;
}

export function getAttrLocation(attrName: string, element: Element) {
	const location = element.sourceCodeLocation!;
	return location.attrs![attrName] ?? location.attrs![attrName.toLowerCase()] ?? location.startTag;
}

export function getParentElement(value: Element): Element | null {
	const parent = value.parentNode;
	return isElementNode(parent) ? parent : null;
}

export function getAttrValueOffset(attr: Attribute, location: Location): number {
	return location.endOffset - attr.value.length - 1;
}

export function isNonEmptyTextNode(node: Node): node is TextNode {
	return isTextNode(node) && /\S/.test(node.value);
}
