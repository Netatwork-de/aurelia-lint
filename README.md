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

## Disabling Rules
Rules can be temporarily disabled via html comments:

Disable for the next line:
```html
<!-- aurelia-lint-disable-line example-rule -->
```

Disable for a range of lines:
```html
<!-- aurelia-lint-disable example-rule -->
...
<!-- aurelia-lint-enable example-rule -->
```
Or for the entire file:
```html
<!-- aurelia-lint-disable example-rule -->
...
...
```

Optionally, disable comments can have multiple lines with an explanation why the rule is disabled:
```html
<!--
	aurelia-lint-disable example-rule
	Example rule is disabled because...
-->
```

<br>



# Builtin Rules

## `attribute-usage`
Require or disallow attributes on specific elements. This rule automatically ignores suffixes like `.bind`.

```js
rules: {
	"attribute-usage": {
		elements: {
			"example-element": {
				// Disallow the use of specific attributes:
				disallow: ["id", "title"],

				// Require specific attributes to be present:
				require: ["value"],
			},

			// Slashes can be used to target specifically nested elements:
			"list/list-column": { ... },
		}
	}
}
```

## `editorconfig-format`
Ensure that all template files are correctly formatted according to the respective `.editorconfig` file. This rule validates indentation, line endings and trailing whitespace.

## `element-nesting`
Allow or disallow specific element children.

```js
rules: {
	"element-nesting": {
		elements: {
			"text-block": {
				categories: ["block"],

				// Either allow only specific elements:
				allow: [
					// Allows <example-element>:
					"example-element",

					// Allows all elements that have the "inline" category:
					"@inline"
				],
				// or disallow specific elements:
				disallow: [...]

				// Disallow text content:
				// - Text content is allowed by default.
				// - Whitespace is always ignored.
				allowText: false,
			},

			"span": {
				categories: ["inline"],
			},
			"b": {
				categories: ["inline"],
			},

			// Slashes can be used to target specifically nested elements:
			"list/list-column": { ... }
		}
	},
}
```

## `no-dead-templates`
Require `<template>` elements to have at least one of the following attributes: `"id", "if", "else", "repeat", "replace-part"`

## `no-invalid-bindings`
Ensure that there are no bindings with syntax that can not be parsed by aurelia.

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

<br>



# Changelog

## 1.2
+ Add `attribute-usage` rule.
+ Add `editorconfig-format` rule.
+ Add `element-nesting` rule.
+ Add `no-invalid-bindings` rule.

## 1.1
+ Add support for disable comments.
