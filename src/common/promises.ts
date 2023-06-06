
export async function parallel(tasks: Iterable<Promise<unknown>>) {
	const results = await Promise.allSettled(tasks);
	const error = results.find(result => result.status === "rejected") as PromiseRejectedResult;
	if (error) {
		throw error.reason;
	}
}
