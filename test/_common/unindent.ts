
export function unindent(code: string): string {
	const indent = /^\n(\t+)(?:[^\t]|$)/m.exec(code);
	return indent
		? code.split(/\n/).map(line => {
			return line.startsWith(indent[1]!)
				? line.slice(indent[1]!.length)
				: line.replace(/^\s+/, "");
		}).join("\n").replace(/^\n+/, "").trim()
		: code.trim();
}
