# Aurelia Lint
This is a linter for aurelia template files to detect common mistakes.

## Configuration
```js
// aurelia-lint.json5
{
	// Array of file paths to extend from:
	extends: [
		"node_modules/some-packages/aurelia-lint.json5",
	],

	// The root directory of sources in this project:
	// (This is used to correctly resolve view resources)
	srcRoot: "./src",

	// Array of glob patterns for files to lint:
	// (See https://www.npmjs.com/package/picomatch)
	include: [
		"./src/**/*.html",
	],

	// An object with rules and configuration options:
	rules: {
		"rule-1": "error",
		"rule-2": "warn",
		"rule-3": "info",
		"rule-4": ["error", { ...options }],
		"rule-5": { ...options },
	},
}
```

## Usage
```bash
npx naw-aurelia-lint ...
```
+ `--config <filename>` - Specify a config filename. Default is `./aurelia-lint.json5`
+ `--watch` - Lint and watch for changes.
+ `--no-color` - Disable colored output.

<br>



# Builtin Rules

## `no-dead-templates`
Require `<template>` elements to have at least one of the following attributes: `"id", "if", "else", "repeat", "replace-part"`

```js
rules: {
	// This rule has no configuration options.
	"no-dead-templates": "error",
},
```

## `require-view-resources`
Ensure that all elements, binding behaviors and value converters are either global or have an associated `<require from="...">` element.

```js
rules: {
	"require-view-resources": {
		// An array of elements to ignore:
		// (Builtin aurelia elements are ignored automatically)
		ignoreElements: [
			"global-element",
			"div",
			"span",
			"button",

			// Slashes can be used to target specifically nested elements:
			"list/list-column",
			"list/list-column/header",

			...
		],

		// An array of value converters to ignore:
		ignoreValueConverters: [
			"globalValueConverter",
			...
		],

		// An array of binding behaviors to ignore:
		// (Builtin aurelia binding behaviors are ignored automatically)
		ignoreBindingBehaviors: [
			"globalBindingBehavior",
			...
		],
	},
},
```
