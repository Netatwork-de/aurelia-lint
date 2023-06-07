import test from "ava";
import { TestProjectContext } from "../_common/context";
import RequireViewResources from "../../src/rules/require-view-resources";
import { evaluateTestRule } from "../_common/rules";
import { getDiagnosticPositions } from "../_common/template-file";

const context = new TestProjectContext({
	test: {
		"imported-element": "customElement",
		"importedValueConverter": "valueConverter",
		"importedBindingBehavior": "bindingBehavior",
	},
});

test("evaluate", async t => {
	const file = await context.createTestFile(`
		<template>
			<require from="test"></require>

			<unknown-element></unknown-element>

			<ignored-element value.bind="test | unknownValueConverter"></ignored-element>
			<ignored-element value.bind="test & unknownBindingBehavior"></ignored-element>

			<ignored-element value.bind="test | ignoredValueConverter"></ignored-element>
			<ignored-element value.bind="test & ignoredBindingBehavior"></ignored-element>

			<imported-element></imported-element>
			<imported-element value.bind="test | importedValueConverter"></imported-element>
			<imported-element value.bind="test & importedBindingBehavior"></imported-element>
		</template>
	`);

	const rule = new RequireViewResources();
	rule.configure({
		ignoreElements: [
			"ignored-element",
		],
		ignoreValueConverters: [
			"ignoredValueConverter",
		],
		ignoreBindingBehaviors: [
			"ignoredBindingBehavior",
		]
	});

	const diagnostics = evaluateTestRule(file, rule);
	t.deepEqual(diagnostics, [
		{
			message: `Missing require for value converter: "unknownValueConverter"`,
			position: getDiagnosticPositions(file, "test | unknownValueConverter")[0],
		},
		{
			message: `Missing require for binding behavior: "unknownBindingBehavior"`,
			position: getDiagnosticPositions(file, "test & unknownBindingBehavior")[0],
		},
		{
			message: `Element is not allowed or a <require> is missing: "unknown-element".`,
			position: getDiagnosticPositions(file, "<unknown-element>")[0],
		},
	]);
});
