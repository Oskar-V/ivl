/**
 * Types for rules, rule sets, schemas and validation results, plus the type-level machinery
 * that infers whether validation is sync or async from the rules' declared return types.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/**
 * A synchronous validation rule. It passes by returning `true` (any truthy value counts)
 * and fails by returning `false` or throwing.
 *
 * @template V type of the value being validated (defaults to `unknown`)
 * @template O tuple type of any extra "overload" arguments passed through by the caller
 */
export type RULE_SYNC<V = unknown, O extends unknown[] = unknown[]> =
	(value: V, ...overload: O) => boolean;

/**
 * An asynchronous validation rule. It passes by resolving to `true` (any truthy value counts)
 * and fails by resolving to `false` or rejecting.
 *
 * @template V type of the value being validated (defaults to `unknown`)
 * @template O tuple type of any extra "overload" arguments passed through by the caller
 */
export type RULE_ASYNC<V = unknown, O extends unknown[] = unknown[]> =
	(value: V, ...overload: O) => Promise<boolean>;

/**
 * A validation rule which may be either synchronous or asynchronous. Annotating a rule with
 * this type means its sync/async-ness can't be inferred, so results are typed as a union.
 *
 * @template V type of the value being validated (defaults to `unknown`)
 * @template O tuple type of any extra "overload" arguments passed through by the caller
 */
export type RULE<V = unknown, O extends unknown[] = unknown[]> =
	(value: V, ...overload: O) => boolean | Promise<boolean>;

/**
 * A set of synchronous rules. Each key is the error reported when its rule fails, and
 * errors are reported in key order.
 *
 * @template V type of the value being validated (defaults to `unknown`)
 * @template O tuple type of any extra "overload" arguments passed through by the caller
 */
export type RULES_SYNC<V = unknown, O extends unknown[] = unknown[]> = { [rule_name: string]: RULE_SYNC<V, O> };

/**
 * A set of rules, any of which may be asynchronous. Each key is the error reported when its
 * rule fails, and errors are reported in key order.
 *
 * @template V type of the value being validated (defaults to `unknown`)
 * @template O tuple type of any extra "overload" arguments passed through by the caller
 */
export type RULES<V = unknown, O extends unknown[] = unknown[]> = { [rule_name: string]: RULE<V, O> };

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * A schema whose rules are all synchronous. Maps each object key to a rule set, or to an
 * array of alternative rule sets (the value passes if it satisfies *any* of the alternatives).
 */
export type SCHEMA_SYNC = { [key: string]: RULES_SYNC | RULES_SYNC[] };

/**
 * A schema whose rules may be asynchronous. Maps each object key to a rule set, or to an
 * array of alternative rule sets (the value passes if it satisfies *any* of the alternatives).
 */
export type SCHEMA = { [key: string]: RULES | RULES[] };

/** Options for running a rule set. */
export type RULES_OPTIONS = {
	/**
	 * Stop at the first failing rule and report only that error, instead of running every rule
	 * and reporting all of them. Defaults to `false`.
	 *
	 * Sync rules run first, in rule order, stopping at the first failure. `async` rules only run
	 * if every sync rule passed; they then run concurrently, and the first failure in rule
	 * order is reported. This skips expensive checks (long regexes, database lookups) on input
	 * that has already failed a cheap one, so put cheap rules first. It doesn't change valid
	 * input, where every rule has to run anyway.
	 */
	break_early?: boolean
};

/**
 * Options for validating an object against a schema. `break_early` applies to each field
 * separately: every field is still validated, each reporting at most one error per rule set.
 */
export type SCHEMA_OPTIONS = RULES_OPTIONS & {
	/**
	 * Report keys of the object that the schema doesn't have, each with the error
	 * `['Key not allowed']`. Defaults to `false`, which ignores them.
	 */
	strict?: boolean
};

/** An object that can be validated against a schema: any string-keyed object. */
export type CHECKABLE_OBJECT = { [key: string]: unknown };

// ---------------------------------------------------------------------------
// Result shapes
// ---------------------------------------------------------------------------

/**
 * The result of checking a single schema entry.
 * A plain rule set yields `string[]`; an array of alternative rule sets yields `string[][]`
 * (one error list per alternative, or `[]` if any alternative passed).
 */
export type CHECKED_RULES<R> = R extends readonly unknown[] ? string[][] : string[];

/**
 * The result of checking a schema: one entry per schema key, with a shape that
 * depends on that key's rule set. When `strict: true` is used, keys not present in
 * the schema may also appear with the value `['Key not allowed']`.
 */
export type CHECKED_SCHEMA_SYNC<S extends SCHEMA = SCHEMA> =
	{ [K in keyof S]: CHECKED_RULES<S[K]> } & { [extra_key: string]: string[] | string[][] };

export type CHECKED_SCHEMA<S extends SCHEMA = SCHEMA> = Promise<CHECKED_SCHEMA_SYNC<S>>;

// ---------------------------------------------------------------------------
// Sync / async inference
// ---------------------------------------------------------------------------

/**
 * Classifies a rule by its declared return type:
 * - `'sync'`   – returns `boolean`
 * - `'async'`  – returns `Promise<boolean>`
 * - `'either'` – declared as returning `boolean | Promise<boolean>` (e.g. annotated as `RULE`),
 *                so it can't be determined statically
 */
export type RULE_KIND<R> =
	R extends (...args: never[]) => infer Ret
	? [Ret] extends [boolean] ? 'sync'
	: [Ret] extends [Promise<boolean>] ? 'async'
	: 'either'
	: never;

/** Union of the `RULE_KIND`s of every rule in a rule set (or in an array of rule sets). */
export type RULES_KIND<R> =
	R extends readonly (infer E)[] ? RULES_KIND<E>
	: R extends object ? RULE_KIND<R[keyof R]>
	: never;

/** Union of the `RULE_KIND`s of every rule in a schema. */
export type SCHEMA_KIND<S> = RULES_KIND<S[keyof S]>;

/**
 * Wraps a result type according to the kinds found in a rule set / schema:
 * any definitely-async rule => `Promise<X>`; all sync => `X`; otherwise `X | Promise<X>`.
 *
 * @template K union of rule kinds, from `RULES_KIND` or `SCHEMA_KIND`
 * @template X the result type to wrap
 */
export type MAYBE_ASYNC<K, X> =
	'async' extends K ? Promise<X>
	: 'either' extends K ? X | Promise<X>
	: X;

// ---------------------------------------------------------------------------
// Compiled validators
// ---------------------------------------------------------------------------

/**
 * Any rule set, whatever value and overload types its rules accept. Used as the constraint
 * for `compileRules`, so rules with narrowed parameter types can be compiled.
 */
export type ANY_RULES = { [rule_name: string]: (value: never, ...overload: never[]) => boolean | Promise<boolean> };

/**
 * The value type a rule set accepts: the intersection of what each of its rules accepts,
 * e.g. `string` for a set mixing `(value: unknown)` and `(value: string)` rules.
 */
export type RULES_VALUE<R> =
	R[keyof R] extends (value: infer V, ...overload: never[]) => unknown ? V : unknown;

/**
 * A validator returned by `compileRules`. Returns the keys of the failing rules, as
 * `string[]` when every rule is sync and `Promise<string[]>` when any is async.
 *
 * @template R the compiled rule set's type
 */
export type COMPILED_RULES<R> =
	(value: RULES_VALUE<R>, ...overload: unknown[]) => MAYBE_ASYNC<RULES_KIND<R>, string[]>;

/**
 * A validator returned by `compileSchema`. Returns the same result as `getSchemaErrors`,
 * directly when every rule is sync and as a promise when any is async.
 *
 * @template S the compiled schema's type
 */
export type COMPILED_SCHEMA<S extends SCHEMA> =
	(object: CHECKABLE_OBJECT, ...overload: unknown[]) => MAYBE_ASYNC<SCHEMA_KIND<S>, CHECKED_SCHEMA_SYNC<S>>;
