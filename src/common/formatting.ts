import { inspect } from "util";

export function formatObject(value: unknown) {
	return inspect(value, false, 99, false);
}

export function indentText(text: string, indent: string) {
	return text.split("\n")
		.map(line => indent + line)
		.join("\n");
}
