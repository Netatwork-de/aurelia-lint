import test from "ava";
import { TestProjectContext } from "../_common/context";
import AttributeUsage from "../../src/rules/attribute-usage";
import { evaluateTestRule } from "../_common/rules";
import { getDiagnosticPositions } from "../_common/template-file";

const context = new TestProjectContext();

test("evaluate", async t => {
	const file = await context.createTestFile(`
		<template>
			<test></test>

			<nested>
				<element title="foo"></element>
			</nested>

			<element title="bar"></element>
		</template>
	`);

	const rule = new AttributeUsage();
	rule.configure({
		elements: {
			"test": {
				require: ["title"],
			},
			"nested/element": {
				disallow: ["title"]
			},
		},
	});

	const diagnostics = evaluateTestRule(file, rule);
	t.deepEqual(diagnostics, [
		{
			message: `Attribute(s) "title" are missing.`,
			position: getDiagnosticPositions(file, "<test>")[0],
		},
		{
			message: `Attribute "title" is not allowed for this element.`,
			position: getDiagnosticPositions(file, `title="foo"`)[0],
		},
	]);
});
