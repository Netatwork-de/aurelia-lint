import { binarySearchIndex } from "./binary-search";

/**
 * Helper for converting between line/character positions and absolute offsets.
 */
export class SourcePositionConverter {
	private readonly _lineOffsets: readonly number[];
	private readonly _source: string;

	public constructor(source: string) {
		const lineOffsets: number[] = [0];
		let offset = -1;
		while ((offset = source.indexOf("\n", offset + 1)) !== -1) {
			lineOffsets.push(offset + 1);
		}
		this._lineOffsets = lineOffsets;
		this._source = source;
	}

	/**
	 * Convert from line/character position to an absolute offset.
	 * @returns the offset or undefined if the position does not exist in this source.
	 */
	public positionToOffset(position: Position): number | undefined {
		const { _lineOffsets, _source } = this;
		const { line, character } = position;
		if (line < 0 || character < 0 || line >= _lineOffsets.length) {
			return undefined;
		}
		const start = _lineOffsets[line];
		const lineLength = ((line + 1 < _lineOffsets.length) ? _lineOffsets[line + 1] : _source.length) - start;
		if (character >= lineLength) {
			return undefined;
		}
		return start + character;
	}

	/**
	 * Convert from an absolute offset to line/character position.
	 * @returns The position or undefined if the offset does not exist in this source.
	 */
	public offsetToPosition(offset: number): Position | undefined {
		const { _lineOffsets, _source } = this;
		const line = binarySearchIndex(_lineOffsets, (lineOffset, line) => {
			const end = (line + 1 < _lineOffsets.length) ? _lineOffsets[line + 1] : _source.length;
			return offset < lineOffset ? -1 : (offset >= end ? 1 : 0);
		});
		return line === undefined ? undefined : { line, character: 0 };
	}
}

export interface Position {
	line: number;
	character: number;
}
