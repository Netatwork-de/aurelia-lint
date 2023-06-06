import test from "ava";
import { TestProjectContext } from "../_common/context";
import HtmlCustomElementCompat from "../../src/rules/html-custom-element-compat";
import { evaluateTestRule } from "../_common/rules";
import { getDiagnosticPositions } from "../_common/template-file";

const context = new TestProjectContext({
	elements: {
		"details": "customElement",
		"valid-name": "customElement",
		"annotation-xml": "customElement",
	},
});

const details = `See https://html.spec.whatwg.org/#valid-custom-element-name`;

test("evaluate", async t => {
	const file = await context.createTestFile(`
		<template>
			<require from="elements"></require>
			<!-- Invalid custom element:  -->
			<details></details>

			<!-- Valid regular element: -->
			<button></button>

			<!-- Valid custom element: -->
			<valid-name></valid-name>

			<!-- Reserved custom element: -->
			<annotation-xml></annotation-xml>
		</template>
	`);
	const rule = new HtmlCustomElementCompat();
	const diagnostics = evaluateTestRule(file, rule);

	t.deepEqual(diagnostics, [
		{
			message: `"details" is not a valid html custom element name.`,
			details,
			position: getDiagnosticPositions(file, "<details>")[0],
		},
		{
			message: `"annotation-xml" is a reserved html custom element name.`,
			details,
			position: getDiagnosticPositions(file, "<annotation-xml>")[0],
		},
	]);
});
