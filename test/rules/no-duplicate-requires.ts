import test from "ava";

import { TestProjectContext } from "../_common/context";
import NoDuplicateRequires from "../../src/rules/no-duplicate-requires";
import { evaluateTestRule } from "../_common/rules";
import { getDiagnosticPositions } from "../_common/template-file";

test("evaluate", async t => {
	const context = new TestProjectContext({
		"foo": {},
		"bar": {},
	});

	const file = await context.createTestFile(`
		<template>
			<!-- Exact same request: -->
			<require from="./foo"></require>
			<require from="./foo"></require>
			<require from="./foo"></require>

			<!-- Different requests, but same resolved files: -->
			<require from="./bar"></require>
			<require from="./bar/../bar"></require>

			<!-- Ignore unresolved files: -->
			<require from="./baz"></require>
		</template>
	`);

	const rule = new NoDuplicateRequires();
	const diagnostics = evaluateTestRule(file, rule);
	const message = "Duplicate require can be removed.";
	t.deepEqual(diagnostics, [
		{
			message,
			position: getDiagnosticPositions(file, `from="./foo"`)[1],
		},
		{
			message,
			position: getDiagnosticPositions(file, `from="./foo"`)[2],
		},
		{
			message,
			position: getDiagnosticPositions(file, `from="./bar/../bar"`)[0],
		},
	]);
});
