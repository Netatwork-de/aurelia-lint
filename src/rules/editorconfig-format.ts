import { join } from "node:path";

import { parse } from "editorconfig";

import { Config } from "../config";
import { Rule, RuleContext, RuleDiagnosticPosition } from "../rule";

const LINE_BREAK = /([\x20\t]*)(\r?\n)([\x20\t]*)/g;

const INDENT_TAB = /^\t*$/;
const INDENT_SPACE = /^\x20*$/;

export default class EditorconfigFormat implements Rule {
	private _verifyIndentation: VerifyIndentation | undefined = undefined;
	private _indentationLabel = "any";

	private _trimTrailingWhitespace = false;

	private _endOfLine: string | undefined = undefined;
	private _endOfLineLabel = "any";

	public async configure(_config: object, projectConfig: Config): Promise<void> {

		const props = await parse(join(projectConfig.srcRoot, "__aurelia-lint-source__.html"));

		switch (props.indent_style) {
			case "tab":
				this._verifyIndentation = indentation => INDENT_TAB.test(indentation);
				this._indentationLabel = "tabs";
				break;

			case "space":
				this._verifyIndentation = indentation => {
					if (!INDENT_SPACE.test(indentation)) {
						return false;
					}
					if (typeof props.indent_size === "number") {
						return (indentation.length % props.indent_size) === 0;
					}
					return true;
				};
				this._indentationLabel = typeof props.indent_size === "number"
					? `${props.indent_size} space(s)`
					: "spaces";
				break;
		}

		this._trimTrailingWhitespace = typeof props.trim_trailing_whitespace === "boolean" && props.trim_trailing_whitespace;

		switch (props.end_of_line) {
			case "lf":
				this._endOfLine = "\n";
				this._endOfLineLabel = "unix";
				break;

			case "crlf":
				this._endOfLine = "\r\n";
				this._endOfLineLabel = "windows";
				break;
		}
	}

	public evaluate(ctx: RuleContext): void {
		let invalidIndentation: RuleDiagnosticPosition | undefined = undefined;
		let invalidEndOfLine: RuleDiagnosticPosition | undefined = undefined;

		LINE_BREAK.lastIndex = 0;
		let match: RegExpExecArray | null = null;
		while (match = LINE_BREAK.exec(ctx.file.source)) {
			const [, trailingSpace, endOfLine, indentation] = match;
			if (invalidIndentation === undefined && this._verifyIndentation !== undefined && !this._verifyIndentation(indentation)) {
				const start = match.index + trailingSpace.length + endOfLine.length;
				invalidIndentation = [start, start + indentation.length];
			}
			if (invalidEndOfLine === undefined && this._endOfLine !== undefined && endOfLine !== this._endOfLine) {
				const start = match.index + trailingSpace.length;
				invalidEndOfLine = [start, start + endOfLine.length];
			}
			if (this._trimTrailingWhitespace && trailingSpace.length !== 0) {
				ctx.emit({
					message: `Unexpected trailing whitespace.`,
					position: [match.index, match.index + trailingSpace.length],
				});
			}
		}

		if (invalidIndentation !== undefined) {
			ctx.emit({
				message: `Invalid indentation. Expected indentation with ${this._indentationLabel}.`,
				position: invalidIndentation,
			});
		}
		if (invalidEndOfLine !== undefined) {
			ctx.emit({
				message: `Invalid end of line. Expected ${this._endOfLineLabel} line endings`,
				position: invalidEndOfLine,
			});
		}
	}
}

type VerifyIndentation = (indentation: string) => boolean;
