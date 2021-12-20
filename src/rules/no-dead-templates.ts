import { isDocumentFragment } from "../common/parse5-tree";
import { Rule, RuleContext, RuleStage } from "../rule";

const controlAttributes = new Set<string>([
	"id",
	"if",
	"else",
	"repeat",
	"replace-part",
	"else",
]);

export default class NoDeadTemplates implements Rule {
	public readonly stage = RuleStage.Tree;

	public evaluate(ctx: RuleContext) {
		ctx.file.traverseElements(elem => {
			if (elem.tagName === "template" && !isDocumentFragment(elem.parentNode) && !elem.attrs.some(attr => {
				const parts = attr.name.split(".");
				return controlAttributes.has(parts[0]);
			})) {
				const location = elem.sourceCodeLocation!.startTag ?? elem.sourceCodeLocation!;
				ctx.emit({
					message: `Template should have one of the following control attributes: ${Array.from(controlAttributes).join(", ")}`,
					position: [location.startOffset, location.endOffset]
				});
			}
		});
	}
}
