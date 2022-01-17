#!/usr/bin/env node

import colors from "ansi-colors";
import parseArgv from "yargs-parser";

import { Config } from "./config";
import { Severity } from "./severity";
import { Project } from "./project";
import { Position } from "@mpt/line-map";
import { relative, resolve } from "path";

interface Args extends parseArgv.Arguments {
	config?: string;
	watch?: boolean;
	color?: boolean;
}

(async () => {
	const cwd = process.cwd();
	const args = parseArgv(process.argv.slice(2), {
		string: ["config"],
		boolean: ["watch", "color"],
	}) as Args;

	const watch = args.watch ?? false;

	if (args.color !== undefined) {
		colors.enabled = args.color;
	}

	function handleDiagnostics(diagnostics: Project.Diagnostics) {
		function formatPosition(position: Position) {
			return `${position.line + 1}:${position.character + 1}`;
		}

		function ellipsis(text: string) {
			const width = process.stdout.columns;
			return text.length > width
				? text.slice(0, width - 3) + "..."
				: text;
		}

		function formatCount(count: number, label: string, color: colors.StyleFunction) {
			const text = `${count} ${label}`;
			return count > 0 ? color(text) : text;
		}

		function formatSeverity(severity: Severity) {
			return ({
				error: colors.redBright,
				warn: colors.yellowBright,
				info: colors.cyanBright,
			} as Record<Severity, colors.StyleFunction>)[severity](severity);
		}

		let fileCount = 0;
		const counts: Record<Severity, number> = { info: 0, warn: 0, error: 0 };

		for (const [file, fileDiagnostics] of diagnostics) {
			if (fileDiagnostics.length > 0) {
				console.log(colors.cyan(`${relative(cwd, file.filename)}:`));
			}

			fileCount++;
			for (const { rule, severity, message, position } of fileDiagnostics) {
				counts[severity]++;

				console.log(`  ${
					formatSeverity(severity)
				}${
					position ? ` (${formatPosition(file.lineMap.getPosition(position[0])!)})` : ""
				}: ${message} ${
					colors.gray(`(${rule})`)
				}`);

				if (position) {
					console.log(colors.gray(ellipsis(`    ${file.source.slice(position[0], position[1])}`)));
				}
				console.log();
			}
		}

		console.log(`Linted ${fileCount} file(s): ${
			formatCount(counts.error, "error(s)", colors.redBright)
		}, ${
			formatCount(counts.warn, "warning(s)", colors.yellowBright)
		}, ${
			formatCount(counts.info, "hint(s)", colors.cyanBright)
		}`);
		process.exitCode = counts.error > 0 ? 1 : 0;
	}

	const configFilename = resolve(args.config ?? "./aurelia-lint.json5");
	const config = await Config.load(configFilename);

	const project = await Project.create(config);

	if (watch) {
		project.watch({
			onDiagnostics: handleDiagnostics,
		});
	} else {
		handleDiagnostics(await project.run());
	}
})().catch(error => {
	console.error(error);
	process.exit(1);
});
