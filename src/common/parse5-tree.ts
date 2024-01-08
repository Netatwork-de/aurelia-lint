import { DefaultTreeAdapterMap, defaultTreeAdapter } from "parse5";

type Tree = DefaultTreeAdapterMap;
export type Node = Tree["node"];
export type ParentNode = Tree["parentNode"];
export type ChildNode = Tree["childNode"];
export type Document = Tree["document"];
export type DocumentFragment = Tree["documentFragment"];
export type Element = Tree["element"];
export type CommentNode = Tree["commentNode"];
export type TextNode = Tree["textNode"];
export type Template = Tree["template"];
export type DocumentType = Tree["documentType"];

export type Attribute = typeof defaultTreeAdapter.getAttrList extends (e: Element) => (infer R)[] ? R : never;

export interface Location {
	startOffset: number;
	endOffset: number;
}

export function isDocumentFragment(value: Node): value is DocumentFragment {
	return value.nodeName === "#document-fragment";
}

export function isTemplate(value: Node): value is Element {
	return value.nodeName === "template";
}

export function getAttr(value: Element, name: string): string | undefined {
	return defaultTreeAdapter.getAttrList(value).find(attr => attr.name === name)?.value;
}

export function getAttrLocation(attrName: string, element: Element): Location {
	const location = element.sourceCodeLocation!;
	return location.attrs![attrName] ?? location.attrs![attrName.toLowerCase()] ?? location.startTag;
}

export function getParentElement(value: Element): Element | null {
	const parent = value.parentNode;
	return parent && defaultTreeAdapter.isElementNode(parent) ? parent : null;
}

export function getAttrValueOffset(attr: Attribute, location: Location): number {
	return location.endOffset - attr.value.length - 1;
}

export function isNonEmptyTextNode(node: Node): node is TextNode {
	return defaultTreeAdapter.isTextNode(node) && /\S/.test(node.value);
}
