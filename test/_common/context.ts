import { join } from "path";
import { ProjectContext } from "../../src/project-context";
import { TemplateFile } from "../../src/template-file";
import { unindent } from "./unindent";
import { ViewResourceNamesTestData, createTestViewResourceNames } from "./view-resource-names";
import { ViewResourceNames } from "../../src/view-resource-names";

export class TestProjectContext extends ProjectContext {
	private readonly files = new Map<string, ViewResourceNames>();

	public constructor(files?: TestProjectContextTestData) {
		super({ srcRoot: join(__dirname, "../test_src") });
		for (const requestAndFilename in files) {
			this.files.set(requestAndFilename, createTestViewResourceNames(files[requestAndFilename]));
		}
	}

	public async resolveSourcePath(request: string, _dirname: string): Promise<string | null> {
		if (request.startsWith("./")) {
			request = request.slice(2);
		}
		return this.files.has(request) ? request : null;
	}

	public async getExportedViewResourceNames(filename: string): Promise<ViewResourceNames> {
		return this.files.get(filename) ?? new ViewResourceNames();
	}

	public createTestFile(source: string, name = "self"): Promise<TemplateFile> {
		const self = this.files.get(name);
		if (self) {
			self.addCustomElement(name);
		} else {
			this.files.set(name, createTestViewResourceNames({
				[name]: "customElement",
			}));
		}
		return TemplateFile.create(this, name, unindent(source));
	}
}

export type TestProjectContextTestData = Record<string, ViewResourceNamesTestData>;
