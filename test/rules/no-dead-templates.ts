import test from "ava";

import { TestProjectContext } from "../_common/context";
import NoDeadTemplates from "../../src/rules/no-dead-templates";
import { evaluateTestRule } from "../_common/rules";
import { getDiagnosticPositions } from "../_common/template-file";

test("evaluate", async t => {
	const file = await new TestProjectContext().createTestFile(`
		<template>
			<template>unused</template>
			<template if="test">used</template>
			<template if.bind="test">
				<template>nested unused</template>
				<div>
					<template>nested unused</template>
				</div>
			</template>
		</template>
	`);
	const rule = new NoDeadTemplates();
	const diagnostics = evaluateTestRule(file, rule);
	const message = `Template should have one of the following control attributes: id, if, else, repeat, replace-part, replaceable`;
	t.deepEqual(diagnostics, [
		{
			message,
			position: getDiagnosticPositions(file, "<template>")[1],
		},
		{
			message,
			position: getDiagnosticPositions(file, "<template>")[2],
		},
		{
			message,
			position: getDiagnosticPositions(file, "<template>")[3],
		},
	]);
});
