
/**
 * Compare a value with the value that is searched.
 *
 * @returns A negative number if the searched value has a lower index,
 * a positive number if the searched value has a higher index or zero
 * if `value` is the searched value.
 */
export type BinarySearchComparator<T> = (value: T, index: number, array: readonly T[]) => number;

/**
 * Find the index of an element in a sorted array.
 */
export function binarySearchIndex<T>(array: readonly T[], comparator: BinarySearchComparator<T>): number | undefined {
	let start = 0;
	let end = array.length - 1;
	while (start <= end) {
		const mid = (start + end) >> 1;
		const comp = comparator(array[mid], mid, array);
		if (comp < 0) {
			end = mid - 1;
		} else if (comp > 0) {
			start = mid + 1;
		} else {
			return mid;
		}
	}
}
