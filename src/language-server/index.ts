import createLimit from "p-limit";
import { basename } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { TextDocument } from "vscode-languageserver-textdocument";
import createMatcher, { Matcher } from "picomatch";
import { createConnection, ProposedFeatures, TextDocuments, TextDocumentSyncKind, WorkspaceFolder, DiagnosticSeverity, Diagnostic, FileChangeType } from "vscode-languageserver/node";
import { findFiles } from "../common/files";
import { Config } from "../config";
import { Project } from "../project";
import { Severity } from "../severity";
import { TemplateFile } from "../template-file";
import { Settings } from "./settings";
import { formatObject } from "../common/formatting";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

const queueTask = createLimit(1);
const projects = new Map<string, Project>();

const configFilenames = [
	"aurelia-lint.json5",
];

let initialWorkspaces: WorkspaceFolder[];
let onlyCurrentFiles: boolean;
let ignorePaths: string[];
let ignorePathMatchers: Matcher[] = [];

connection.onInitialize(params => {
	if (!params.workspaceFolders || !params.capabilities.workspace?.workspaceFolders) {
		throw new Error("workspace folders must be supported");
	}
	initialWorkspaces = params.workspaceFolders;

	return {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			workspace: {
				workspaceFolders: {
					supported: true,
					changeNotifications: true,
				},
			},
		},
	};
});

connection.onInitialized(async () => {
	const settings: Settings = (await connection.workspace.getConfiguration("nawAureliaLint")) ?? {};

	onlyCurrentFiles = settings.onlyCurrentFiles ?? false;
	ignorePaths = settings.ignorePaths?.split("|").map(s => s.trim()) ?? ["**/node_modules"];
	ignorePathMatchers = ignorePaths.map(path => {
		return createMatcher(path.endsWith("/**") ? path : path + "/**");
	});

	console.log("Using settings", {
		onlyCurrentFiles,
		ignorePaths,
	});

	for (const workspace of initialWorkspaces) {
		await addWorkspace(workspace);
	}

	connection.workspace.onDidChangeWorkspaceFolders(async ({ removed, added }) => {
		for (const workspace of added) {
			await addWorkspace(workspace);
		}
	});

	connection.onDidChangeWatchedFiles(({ changes }) => {
		changes.forEach(change => {
			const filename = fileURLToPath(change.uri);
			if (configFilenames.includes(basename(filename))) {
				projects.delete(filename);
				if (change.type !== FileChangeType.Deleted) {
					loadProject(filename);
				}
			} else {
				projects.forEach(project => {
					project.invalidateCache(filename);
				});
			}
		});
	});
});

documents.onDidOpen(({ document }) => updateDocument(document));
documents.onDidChangeContent(({ document }) => updateDocument(document));

documents.onDidClose(({ document }) => {
	if (onlyCurrentFiles) {
		connection.sendDiagnostics({
			uri: document.uri,
			diagnostics: [],
		});
	}
});

async function updateDocument(document: TextDocument) {
	try {
		const filename = fileURLToPath(document.uri);
		for (const project of projects.values()) {
			if (project.includes(filename)) {
				const [file, diagnostics] = await project.evaluate(filename, document.getText());
				emitDiagnostics(file, diagnostics);
				return;
			}
		}
	} catch (error) {
		console.error(error);
	}
}

async function addWorkspace(workspace: WorkspaceFolder) {
	const root = fileURLToPath(workspace.uri);
	console.log("Looking for projects in", root);
	for await (const configFile of findFiles(root, configFilenames.map(n => `**/${n}`), ignorePaths)) {
		loadProject(configFile);
	}
	console.log("Done.");
}

function loadProject(configFilename: string) {
	if (!ignorePathMatchers.some(m => m(configFilename))) {
		queueTask(async () => {
			try {
				if (!projects.has(configFilename)) {
					console.log("Loading project:", configFilename);

					const config = await Config.load(configFilename);
					console.log("Config for project:", configFilename, formatObject(config));

					const project = await Project.create(config);

					projects.set(configFilename, project);

					if (!onlyCurrentFiles) {
						for (const [file, fileDiagnostics] of await project.run()) {
							emitDiagnostics(file, fileDiagnostics);
						}
					}
				}
			} catch (error) {
				console.error("Unable to load project:", configFilename, error);
			}
		});
	}
}

function emitDiagnostics(file: TemplateFile, diagnostics: Project.Diagnostic[]) {
	function toLspSeverity(severity: Severity): DiagnosticSeverity {
		switch (severity) {
			case "info": return DiagnosticSeverity.Hint;
			case "warn": return DiagnosticSeverity.Warning;
			case "error": return DiagnosticSeverity.Error;
		}
	}

	connection.sendDiagnostics({
		uri: pathToFileURL(file.filename).toString(),
		diagnostics: diagnostics.map<Diagnostic>(diagnostic => {
			return {
				message: diagnostic.details ? `${diagnostic.message}\n${diagnostic.details}` : diagnostic.message,
				source: `aurelia-lint`,
				code: diagnostic.rule,
				severity: toLspSeverity(diagnostic.severity),
				range: diagnostic.position
					? {
						start: file.lineMap.getPosition(diagnostic.position[0]) ?? { line: 0, character: 0 },
						end: file.lineMap.getPosition(diagnostic.position[1]) ?? { line: 0, character: 0 },
					}
					: {
						start: { line: 0, character: 0 },
						end: { line: 0, character: 0 },
					},
			};
		}),
	});
}

documents.listen(connection);
connection.listen();
