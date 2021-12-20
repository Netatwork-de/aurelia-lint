import decamelize from "decamelize";
import camelcase from "camelcase";

export class ViewResourceNames {
	public readonly customElements = new Map<string, ViewResourceNames.RequireInfo | undefined>();
	public readonly valueConverters = new Map<string, ViewResourceNames.RequireInfo | undefined>();
	public readonly bindingBehaviors = new Map<string, ViewResourceNames.RequireInfo | undefined>();

	public add(names: ViewResourceNames, overrideRequireInfo?: ViewResourceNames.RequireInfo) {
		names.customElements.forEach((requireInfo, n) => this.customElements.set(n, overrideRequireInfo ?? requireInfo));
		names.valueConverters.forEach((requireInfo, n) => this.valueConverters.set(n, overrideRequireInfo ?? requireInfo));
		names.bindingBehaviors.forEach((requireInfo, n) => this.bindingBehaviors.set(n, overrideRequireInfo ?? requireInfo));
	}

	public addCustomElement(name: string, requireInfo?: ViewResourceNames.RequireInfo) {
		this.customElements.set(decamelize(name, {
			preserveConsecutiveUppercase: true,
			separator: "-",
		}), requireInfo);
	}

	public addValueConverter(name: string, requireInfo?: ViewResourceNames.RequireInfo) {
		this.valueConverters.set(camelcase(name, {
			pascalCase: false,
			preserveConsecutiveUppercase: true,
		}), requireInfo);
	}

	public addBindingBehavior(name: string, requireInfo?: ViewResourceNames.RequireInfo) {
		this.bindingBehaviors.set(camelcase(name, {
			pascalCase: false,
			preserveConsecutiveUppercase: true,
		}), requireInfo);
	}

	public getRequires(): Map<number, ViewResourceNames.RequireInfo> {
		const map = new Map<number, ViewResourceNames.RequireInfo>();
		for (const source of [this.customElements, this.valueConverters, this.bindingBehaviors]) {
			for (const info of source.values()) {
				if (info !== undefined) {
					map.set(info.startOffset, info);
				}
			}
		}
		return map;
	}
}

export declare namespace ViewResourceNames {
	export interface RequireInfo {
		startOffset: number;
		endOffset: number;
	}
}
