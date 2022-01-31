import test from "ava";
import { join } from "path";
import { ProjectContext } from "../src/project-context";

import { TemplateFile } from "../src/template-file";
import { ViewResourceNames } from "../src/view-resource-names";
import { unindent } from "./_common/unindent";

const context = new class extends ProjectContext {
	public constructor() {
		super({ srcRoot: join(__dirname, "test_src") });
	}

	public async resolveSourcePath(_request: string, _dirname: string): Promise<string | null> {
		return null;
	}

	public async getExportedViewResourceNames(_filename: string): Promise<ViewResourceNames> {
		return new ViewResourceNames();
	}
}

function createFile(source: string) {
	return TemplateFile.create(context, "", unindent(source));
}

test("disable comment types", async t => {
	const file = await createFile(`
		<!-- aurelia-lint-disable global  -->

		<!-- aurelia-lint-disable-line foo -->

		<!-- aurelia-lint-disable bar -->
		Hello
		World!
		<!-- aurelia-lint-enable bar -->
	`);

	t.true(file.disabledRules.has("global", 0));
	t.true(file.disabledRules.has("global", file.source.length - 1));

	t.false(file.disabledRules.has("foo", file.lineMap.getOffset({ line: 2, character: 0 })!));
	t.true(file.disabledRules.has("foo", file.lineMap.getOffset({ line: 3, character: 0 })!));
	t.false(file.disabledRules.has("foo", file.lineMap.getOffset({ line: 4, character: 0 })!));

	t.false(file.disabledRules.has("bar", file.lineMap.getOffset({ line: 4, character: 0 })!));
	t.true(file.disabledRules.has("bar", file.lineMap.getOffset({ line: 5, character: 0 })!));
	t.true(file.disabledRules.has("bar", file.lineMap.getOffset({ line: 6, character: 0 })!));
	t.false(file.disabledRules.has("bar", file.lineMap.getOffset({ line: 7, character: 0 })!));
});

test("disable comments with single line text", async t => {
	const file = await createFile(`
		foo
		<!-- aurelia-lint-disable-line foo Hello World! -->
		bar
		baz
	`);
	t.true(file.disabledRules.has("foo", file.lineMap.getOffset({ line: 2, character: 0 })!));
	t.false(file.disabledRules.has("foo", file.lineMap.getOffset({ line: 3, character: 0 })!));
});

test("disable comments with multi line text", async t => {
	const file = await createFile(`
		foo
		<!-- aurelia-lint-disable-line foo Hello
		World! -->
		bar
		baz
	`);
	t.true(file.disabledRules.has("foo", file.lineMap.getOffset({ line: 3, character: 0 })!));
	t.false(file.disabledRules.has("foo", file.lineMap.getOffset({ line: 4, character: 0 })!));
});

test("disable comments with multiple instructions", async t => {
	const file = await createFile(`
		foo
		<!--
			aurelia-lint-disable bar
			aurelia-lint-disable-line foo
			Hello World!
			aurelia-lint-disable baz
		-->
		bar
		baz
	`);
	t.true(file.disabledRules.has("bar", 0));
	t.true(file.disabledRules.has("baz", 0));
	t.true(file.disabledRules.has("foo", file.lineMap.getOffset({ line: 7, character: 0 })!));
	t.false(file.disabledRules.has("foo", file.lineMap.getOffset({ line: 8, character: 0 })!));
});
