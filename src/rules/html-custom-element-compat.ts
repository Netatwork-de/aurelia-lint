import { aureliaBuiltinElements } from "../common/aurelia-builtin-elements";
import { Config } from "../config";
import { Rule, RuleContext, RuleMergeConfigContext } from "../rule";

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

export function mergeConfig({ config, parents }: RuleMergeConfigContext<HtmlCustomElementCompat.Config>): HtmlCustomElementCompat.Config {
	const ignore = config.ignore ?? [];
	for (const parent of parents) {
		if (parent.ignore) {
			ignore.push(...parent.ignore);
		}
	}
	return {
		ignore,
	};
}

export class HtmlCustomElementCompat implements Rule {
	private _ignore = new Set<string>(aureliaBuiltinElements);

	public configure(config: HtmlCustomElementCompat.Config, _projectConfig: Config): void | Promise<void> {
		if (config.ignore) {
			for (const name of config.ignore) {
				this._ignore.add(name);
			}
		}
	}

	public evaluate(ctx: RuleContext): void {
		const customElements = ctx.file.viewResourceNames.customElements;
		ctx.file.traverseElements(element => {
			const tagName = element.tagName;
			if (!this._ignore.has(tagName) && customElements.has(tagName)) {
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

export declare namespace HtmlCustomElementCompat {
	export interface Config {
		ignore?: string[];
	}
}

export default HtmlCustomElementCompat;
