import { IRollupContext } from "./context";
import { IRollupCode } from "./tscache";
import { IRollupOptions } from "./irollup-options";
import { IOptions } from "./ioptions";
import { Partial } from "./partial";
export default function typescript(options?: Partial<IOptions>): {
    name: string;
    options(config: IRollupOptions): void;
    resolveId(importee: string, importer: string): string | null;
    load(id: string): string | undefined;
    transform(this: IRollupContext, code: string, id: string): IRollupCode | undefined;
    ongenerate(): void;
    onwrite({ dest, file }: IRollupOptions): void;
};
