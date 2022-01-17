import { Parser } from "aurelia-binding";

export const bindingSuffixes = new Set<string>([
	"bind",
	"one-time",
	"two-way",
	"from-view",
	"to-view",
]);

export const bindingParser = new Parser();

/**
 * This is an implementation of the same interpolation syntax that is used in aurelia v1 with
 * the difference, that this one does not parse expressions and reports source code offsets.
 *
 * Note that escaping curly braces inside javascript inside template strings inside interpolation
 * is intentionally not supported as this is also not supported by aurelia.
 *
 * See github/aurelia/templating-binding/src/binding-language.js
 */
export function parseInterpolation(text: string): InterpolationBinding[] {
	const bindings: InterpolationBinding[] = [];

	let pos = 0;
	while (pos < text.length) {
		pos = text.indexOf("${", pos);
		if (pos < 0) {
			break;
		}
		pos += 2;

		let quote: string | null = null;
		let open = 0;

		for (let i = pos; i < text.length; i++) {
			const char = text[i];
			if (char === "'" || char === '"') {
				if (quote === null) {
					quote = char;
				} else if (quote === char) {
					quote = null;
				}
			} else if (char === "\\") {
				i++;
			} else if (quote === null) {
				if (char === "{") {
					open++;
				} else if (char === "}") {
					if (open <= 0) {
						bindings.push({
							offset: pos,
							value: text.slice(pos, i),
						});
						pos = i + 1;
						break;
					} else {
						open--;
					}
				}
			}
		}
	}

	return bindings;
}

export interface InterpolationBinding {
	offset: number;
	value: string;
}
