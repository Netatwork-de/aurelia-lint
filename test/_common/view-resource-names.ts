import { ViewResourceNames } from "../../src/view-resource-names";

export type ViewResourceNameTestDataType
	= "customElement"
	| "valueConverter"
	| "bindingBehavior"
	| "customAttribute";

export type ViewResourceNamesTestData = Record<string, ViewResourceNameTestDataType>;

export function createTestViewResourceNames(testData: ViewResourceNamesTestData): ViewResourceNames {
	const names = new ViewResourceNames();
	for (const name in testData) {
		const type = testData[name];
		switch (type) {
			case "customElement":
				names.addCustomElement(name);
				break;

			case "valueConverter":
				names.addValueConverter(name);
				break;

			case "bindingBehavior":
				names.addBindingBehavior(name);
				break;

			case "customAttribute":
				names.addCustomAttribute(name);
				break;
		}
	}
	return names;
}
