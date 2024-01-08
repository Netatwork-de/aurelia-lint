import { defaultTreeAdapter } from "parse5";

// import { parseAttributeName } from "../common/binding";
import { Rule, RuleContext } from "../rule";

const controlAttributes = new Set<string>([
	"id",
	"if",
	"else",
	"repeat",
	"replace-part",
	"replaceable",
]);

export class NoDeadTemplates implements Rule {
	public evaluate(ctx: RuleContext) {
		ctx.file.traverseElements(elem => {
			if (elem.tagName === "template" && !defaultTreeAdapter.getAttrList(elem).some(attr => {
				// const { name } = parseAttributeName(attr.name);
				// return controlAttributes.has(name);
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

export default NoDeadTemplates;
