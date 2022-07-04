// TS needs a declaration in order to understand the import
// but this is ambient, and so should not be directly imported into rpt2, just found by TS

export function identity(a: any): any;
