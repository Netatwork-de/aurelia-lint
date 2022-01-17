import { bindingParser } from "../common/binding";
import { Rule, RuleContext } from "../rule";

export class NoInvalidBindings implements Rule {
	public evaluate(ctx: RuleContext): void {
		ctx.file.traverseBindings(binding => {
			try {
				bindingParser.parse(binding.expression);
			} catch {
				ctx.emit({
					message: "Binding contains invalid syntax",
					position: [binding.start, binding.end],
				});
			}
		});
	}
}

export default NoInvalidBindings;
