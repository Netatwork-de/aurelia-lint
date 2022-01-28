"use strict";

module.exports = {
	files: [
		"./test_out/test/**/*.js",
		"!**/_*/**"
	],
	ignoredByWatcher: [
		"./src/**/*",
		"./test/**/*",
	],
	concurrency: 4,
	verbose: true
}
