import createLimit from "p-limit";
import { basename } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { TextDocument } from "vscode-languageserver-textdocument";
import { createConnection, ProposedFeatures, TextDocuments, TextDocumentSyncKind, WorkspaceFolder, DiagnosticSeverity, Diagnostic, FileChangeType } from "vscode-languageserver/node";
import { findFiles } from "../common/files";
import { Config } from "../config";
import { Project } from "../project";
import { Severity } from "../severity";
import { TemplateFile } from "../template-file";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

const queueTask = createLimit(1);
const projects = new Map<string, Project>();

const configFilenames = [
	"aurelia-lint.json5",
];

let initialWorkspaces: WorkspaceFolder[];

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
	for (const workspace of initialWorkspaces) {
		await addWorkspace(workspace);
	}

	connection.workspace.onDidChangeWorkspaceFolders(async ({ removed, added }) => {
		for (const workspace of removed) {
			removeWorkspace(workspace);
		}
		for (const workspace of added) {
			await addWorkspace(workspace);
		}
	});
});

connection.onDidChangeWatchedFiles(({ changes }) => {
	for (const { type, uri } of changes) {
		const filename = fileURLToPath(uri);
		if (configFilenames.includes(basename(filename))) {
			if (type === FileChangeType.Deleted || type === FileChangeType.Changed) {
				unloadProject(filename);
			}
			if (type === FileChangeType.Created || type === FileChangeType.Changed) {
				loadProject(filename);
			}
		}
	}
});

documents.onDidOpen(({ document }) => updateDocument(document));
documents.onDidChangeContent(({ document }) => updateDocument(document));

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
	for await (const configFile of findFiles(root, configFilenames.map(n => `**/${n}`))) {
		loadProject(configFile);
	}
}

function removeWorkspace(workspace: WorkspaceFolder) {
	// TODO: Unload projects where this was the only remaining workspace.
}
//
function loadProject(configFilename: string) {
	if (!/[\\/]node_modules[\\/]/.test(configFilename)) {
		queueTask(async () => {
			if (!projects.has(configFilename)) {
				console.log("Loading project:", configFilename);

				const config = await Config.load(configFilename);
				const project = await Project.create(config);

				projects.set(configFilename, project);

				for (const [file, fileDiagnostics] of await project.run()) {
					emitDiagnostics(file, fileDiagnostics);
				}
			}
		});
	}
}

function unloadProject(configFilename: string) {
	queueTask(() => {
		console.log("Unloading project:", configFilename);
		projects.delete(configFilename);
	});
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
				message: diagnostic.message,
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
