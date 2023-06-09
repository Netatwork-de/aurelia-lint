import { Rule, RuleContext } from "../rule";
import { TemplateFile } from "../template-file";

export class NoDuplicateRequires implements Rule {
	public evaluate(ctx: RuleContext): void {
		const requiresByFilename = new Map<string, TemplateFile.Require[]>();
		for (const require of ctx.file.requires) {
			if (require.resolvedFilename !== null) {
				const requires = requiresByFilename.get(require.resolvedFilename);
				if (requires) {
					requires.push(require);
				} else {
					requiresByFilename.set(require.resolvedFilename, [require]);
				}
			}
		}

		for (const requires of requiresByFilename.values()) {
			if (requires.length > 1) {
				for (const require of requires.slice(1)) {
					ctx.emit({
						message: `Duplicate require can be removed.`,
						position: [require.start, require.end],
					});
				}
			}
		}
	}
}

export default NoDuplicateRequires;
