import { RuleDiagnosticPosition } from "../../src/rule";
import { TemplateFile } from "../../src/template-file";

/**
 * Helper for getting diagnostic positions of a specific part in an aurelia template file.
 */
export function getDiagnosticPositions(file: TemplateFile, part: string): RuleDiagnosticPosition[] {
	const positions: RuleDiagnosticPosition[] = [];
	const source = file.source;
	for (let index = source.indexOf(part); index >= 0; index = source.indexOf(part, index + part.length)) {
		positions.push([index, index + part.length]);
	}
	return positions;
}
