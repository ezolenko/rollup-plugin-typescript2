export function sum(a: number, b: number) {
  return a + b;
}

import { difference } from "./some-import";
export const diff2 = difference; // add an alias so that this file has to change when the import does (to help test cache invalidation etc)

export { difference } from "./some-import"
export type { num, num2 } from "./type-only-import"

export { identity } from "./some-js-import"
