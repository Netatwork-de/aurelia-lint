
export type Severity =
	"error" |
	"warn" |
	"info";

const severities: (Severity | undefined)[] = [undefined, "info", "warn", "error"];

export function mergeSeverity(severity: Severity | undefined, parents: (Severity | undefined)[]): Severity | undefined {
	return severity
		?? severities[Math.max(...parents.map(s => severities.indexOf(s)))];
}
