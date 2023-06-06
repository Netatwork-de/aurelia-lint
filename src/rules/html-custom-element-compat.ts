import { Rule, RuleContext } from "../rule";

// Note, that this is a simplified characterset that also disallows any unicode characters.
const potentialCustomElementName = /^[a-z][-.0-9_a-z]*-[-.0-9_a-z]*$/;

const invalidNames = new Set<string>([
	"annotation-xml",
	"color-profile",
	"font-face",
	"font-face-src",
	"font-face-uri",
	"font-face-format",
	"font-face-name",
	"missing-glyph",
]);

const details = `See https://html.spec.whatwg.org/#valid-custom-element-name`;

export class HtmlCustomElementCompat implements Rule {
	public evaluate(ctx: RuleContext): void {
		const customElements = ctx.file.viewResourceNames.customElements;
		ctx.file.traverseElements(element => {
			const tagName = element.tagName;
			if (customElements.has(tagName)) {
				const location = element.sourceCodeLocation!.startTag;
				if (!potentialCustomElementName.test(tagName)) {
					ctx.emit({
						message: `${JSON.stringify(tagName)} is not a valid html custom element name.`,
						details,
						position: [location.startOffset, location.endOffset],
					});
				} else if (invalidNames.has(tagName)) {
					ctx.emit({
						message: `${JSON.stringify(tagName)} is a reserved html custom element name.`,
						details,
						position: [location.startOffset, location.endOffset],
					});
				}
			}
		});
	}
}

export default HtmlCustomElementCompat;
