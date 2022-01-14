
interface Range {
	start: number;
	end: number;
}

export class Ranges<T> {
	private readonly _ranges = new Map<T, Range[]>();

	public add(start: number, end: number, value: T) {
		const ranges = this._ranges.get(value);
		if (ranges === undefined) {
			this._ranges.set(value, [{ start, end }]);
		} else {
			ranges.push({ start, end });
		}
	}

	public has(value: T, offset: number) {
		const ranges = this._ranges.get(value);
		if (ranges !== undefined) {
			return ranges.some(r => r.start <= offset && offset < r.end);
		}
		return false;
	}
}
