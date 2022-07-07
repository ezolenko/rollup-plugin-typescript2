// this file has no errors itself; it is used an entry file to test an error in a type-only import

export type { typeError } from "./type-only-import-with-error";

// some code so this file isn't empty
export function sum(a: number, b: number) {
  return a + b;
}
