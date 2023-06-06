import { Rule, RuleDiagnostic } from "../../src/rule";
import { TemplateFile } from "../../src/template-file";

export function evaluateTestRule(file: TemplateFile, rule: Rule): RuleDiagnostic[] {
	const diagnostics: RuleDiagnostic[] = [];
	rule.evaluate({
		emit(diagnostic) {
			diagnostics.push(diagnostic);
		},
		file,
	});
	return diagnostics;
}
