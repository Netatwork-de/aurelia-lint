import test from "ava";
import { TestProjectContext } from "../_common/context";
import ElementNesting from "../../src/rules/element-nesting";
import { evaluateTestRule } from "../_common/rules";
import { getDiagnosticPositions } from "../_common/template-file";

test("evaluate", async t => {
	const file = await new TestProjectContext().createTestFile(`
		<template>
			<block></block>
			<inline></inline>

			<allow-specific>
				text
				<block></block>
				<inline></inline>
				<let></let>
				<ignored></ignored>
				<disallowed></disallowed>
			</allow-specific>

			<allow-category>
				text
				<block></block>
				<inline></inline>
				<let></let>
				<ignored></ignored>
				<disallowed></disallowed>
			</allow-category>

			<disallow-text>
				text
			</disallow-text>

			<disallow-specific>
				text
				<block></block>
				<inline></inline>
				<let></let>
				<ignored></ignored>
				<disallowed></disallowed>
			</disallow-specific>

			<disallow-category>
				text
				<block></block>
				<inline></inline>
				<let></let>
				<ignored></ignored>
				<disallowed></disallowed>
			</disallow-category>
		</template>
	`);

	const rule = new ElementNesting();
	rule.configure({
		elements: {
			"block": {
				categories: ["test"],
			},
			"inline": {
				categories: ["test"],
			},
			"allow-specific": {
				allow: ["block"],
			},
			"allow-category": {
				allow: ["@test"],
			},
			"disallow-text": {
				allowText: false,
			},
			"disallow-specific": {
				disallow: ["block"],
			},
			"disallow-category": {
				disallow: ["@test"],
			},
		},
		ignore: ["ignored"]
	});

	const diagnostics = evaluateTestRule(file, rule);
	t.deepEqual(diagnostics, [
		{
			message: `"inline" element is not allowed in "allow-specific".`,
			position: getDiagnosticPositions(file, "<inline>")[1],
		},
		{
			message: `"disallowed" element is not allowed in "allow-specific".`,
			position: getDiagnosticPositions(file, "<disallowed>")[0],
		},
		{
			message: `"disallowed" element is not allowed in "allow-category".`,
			position: getDiagnosticPositions(file, "<disallowed>")[1],
		},
		{
			message: `Text content is not allowed in this element.`,
			position: getDiagnosticPositions(file, "\n\t\ttext\n\t")[2],
		},
		{
			message: `"block" element is not allowed in "disallow-specific".`,
			position: getDiagnosticPositions(file, "<block>")[3],
		},
		{
			message: `"block" element is not allowed in "disallow-category".`,
			position: getDiagnosticPositions(file, "<block>")[4],
		},
		{
			message: `"inline" element is not allowed in "disallow-category".`,
			position: getDiagnosticPositions(file, "<inline>")[4],
		},
	]);
});
