import { jest } from "@jest/globals";
import { PluginContext } from "rollup";

import { IContext } from "../../src/context";

// if given a function, make sure to call it (for code coverage etc)
function returnText (message: string | (() => string)) {
	if (typeof message === "string")
		return message;

	return message();
}

export function makeContext(): PluginContext & IContext {
	return {
		error: jest.fn(returnText),
		warn: jest.fn(returnText),
		info: jest.fn(returnText),
		debug: jest.fn(returnText),
	} as unknown as PluginContext & IContext;
};
