import * as tsTypes from "typescript";
import { IContext } from "./context";
import { IOptions } from "./ioptions";
export declare function parseTsConfig(tsconfig: string, context: IContext, pluginOptions: IOptions): tsTypes.ParsedCommandLine;
