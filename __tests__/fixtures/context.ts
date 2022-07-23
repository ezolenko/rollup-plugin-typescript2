import { jest } from "@jest/globals";
import { PluginContext } from "rollup";

import { IContext } from "../../src/context";

export function makeContext(): PluginContext & IContext {
	return {
		error: jest.fn(),
		warn: jest.fn(),
		info: jest.fn(),
		debug: jest.fn(),
	} as unknown as PluginContext & IContext;
};
