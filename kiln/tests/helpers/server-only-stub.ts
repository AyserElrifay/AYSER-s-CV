// vitest resolves the `server-only` package to its client entry, which throws by
// design. Tests exercise these modules in Node, where the guard is meaningless.
export {};
