// should be filtered out by rpt2, but still bundled by Rollup itself (as this is ESM, no need for a plugin)

export function identity(a) {
  return a;
}
