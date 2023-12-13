import test from "ava";

import { TestProjectContext } from "../_common/context";
import NoInvalidBindings from "../../src/rules/no-invalid-bindings";
import { evaluateTestRule } from "../_common/rules";
import { getDiagnosticPositions } from "../_common/template-file";

test("evaluate", async t => {
	const file = await new TestProjectContext().createTestFile(`
		<template>
			<div value.bind="invalid."></div>
			<div value.bind="invalid & foo | bar"></div>
			<div value.bind="valid"></div>
			<div value.bind="valid & foo"></div>
			<div value.bind="valid | bar & foo"></div>
			\${invalid.}
		</template>
	`);
	const rule = new NoInvalidBindings();
	const diagnostics = evaluateTestRule(file, rule);
	const message = "Binding contains invalid syntax";

	t.deepEqual(diagnostics, [
		{
			message,
			position: getDiagnosticPositions(file, "invalid.")[0],
		},
		{
			message,
			position: getDiagnosticPositions(file, "invalid & foo | bar")[0],
		},
		{
			message,
			position: getDiagnosticPositions(file, "invalid.")[1],
		},
	]);
});
