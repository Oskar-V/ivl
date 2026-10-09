/**
 * Core validation functions: run rule sets against single values (`getValueErrors*`), run
 * schemas against objects (`getSchemaErrors*`), and compile either into reusable validators
 * (`compileRules`, `compileSchema`).
 *
 * Shared semantics:
 * - a rule passes when it returns a truthy value and fails when it returns a falsy value,
 *   throws, or (on an async path) rejects - a failing rule never throws out of these functions
 * - errors are the keys of the failing rules, in the rule set's key order
 * - a rule is async only if it is declared with the `async` keyword; the plain `getValueErrors`
 *   / `getSchemaErrors` / `compile*` functions use that to pick the sync or async path
 * - any extra `overload` arguments are passed through to every rule after the value
 *
 * @module
 */
import type {
	RULE,
	RULES,
	RULES_SYNC,
	SCHEMA,
	SCHEMA_SYNC,
	SCHEMA_OPTIONS,
	RULES_OPTIONS,
	CHECKABLE_OBJECT,
	CHECKED_SCHEMA,
	CHECKED_SCHEMA_SYNC,
	RULES_KIND,
	SCHEMA_KIND,
	MAYBE_ASYNC,
	ANY_RULES,
	COMPILED_RULES,
	COMPILED_SCHEMA,
} from './types';

/** Options used when none are passed: unknown keys are ignored and every rule runs. */
const DEFAULT_SCHEMA_OPTIONS: SCHEMA_OPTIONS = {
	strict: false,
	break_early: false,
};

/**
 * Detect whether a value is a function declared with the `async` keyword.
 *
 * Only the declaration is inspected: a plain function that returns a promise is not async
 * by this definition. Works across realms, since it compares the constructor's name.
 *
 * @param {unknown} fn the value to inspect
 * @returns {boolean} `true` if `fn` is an `async` function, otherwise `false`
 */
export const isAsyncFunction = (fn: unknown): fn is (...args: never[]) => Promise<unknown> =>
	typeof fn === 'function' && fn.constructor.name === 'AsyncFunction'

/**
 * Detect whether any own enumerable rule in a single rule set is an `async` function.
 *
 * @param {object} rules the rule set to inspect
 * @returns {boolean} `true` if at least one rule is an `async` function
 */
const rulesHaveAsync = (rules: { [key: string]: unknown }): boolean => {
	const keys = Object.keys(rules);
	for (let i = 0; i < keys.length; i++) {
		if (isAsyncFunction(rules[keys[i]!])) return true;
	}
	return false;
}

/**
 * Detect whether a rule set, or any rule set in an array of alternatives, contains an
 * `async` rule. This is the check `getValueErrors`/`getSchemaErrors` use to choose a path.
 *
 * @param {RULES|RULES[]} rules a rule set, or an array of alternative rule sets
 * @returns {boolean} `true` if any rule is an `async` function, otherwise `false`
 */
export const hasAsyncFunction = (rules: { [key: string]: unknown } | { [key: string]: unknown }[]): boolean => {
	if (Array.isArray(rules)) {
		for (let i = 0; i < rules.length; i++) {
			if (rulesHaveAsync(rules[i]!)) return true;
		}
		return false;
	}
	return rulesHaveAsync(rules);
};

/**
 * Detect a promise-like value: any object or function with a callable `then`.
 *
 * @param {unknown} value the value to inspect
 * @returns {boolean} `true` if `value` is a thenable
 */
const isThenable = (value: unknown): value is PromiseLike<unknown> =>
	value !== null && (typeof value === 'object' || typeof value === 'function') && typeof (value as { then?: unknown }).then === 'function';

/**
 * Call a rule with the value and any overload arguments. Skips the argument spread when
 * there are no overloads, which is the common case and measurably cheaper.
 *
 * @param {RULE} rule the rule to call
 * @param {unknown} value the value being validated
 * @param {unknown[]} overload extra arguments for the rule
 * @returns {unknown} whatever the rule returned; exceptions propagate to the caller
 */
const callRule = (rule: RULE<never, unknown[]>, value: unknown, overload: unknown[]): unknown =>
	overload.length ? rule(value as never, ...overload) : rule(value as never);

/**
 * Run a rule set synchronously. A rule that throws fails, and so does a rule that returns
 * a thenable, since it can't be awaited here.
 *
 * @param {unknown} value the value to validate
 * @param {RULES_SYNC} rules the rule set
 * @param {unknown[]} overload extra arguments passed to every rule
 * @param {string[]} keys the rule keys to run, in order; defaults to the rule set's own keys
 * @param {boolean} break_early stop at the first failing rule
 * @returns {string[]} the keys of the failing rules, in order (only the first with `break_early`)
 */
const valueErrorsSync = (value: unknown, rules: RULES_SYNC<never>, overload: unknown[], keys: string[] = Object.keys(rules), break_early = false): string[] => {
	const failed: string[] = [];
	for (let i = 0; i < keys.length; i++) {
		const key = keys[i]!;
		try {
			const result = callRule(rules[key]!, value, overload);
			// A thenable can't be resolved synchronously - fail closed instead of
			// treating the pending (truthy) promise as a pass
			if (!result || isThenable(result)) failed.push(key);
		} catch {
			failed.push(key);
		}
		if (break_early && failed.length) return failed;
	}
	return failed;
}

/**
 * Run a rule set, awaiting only what has to be awaited. Every rule is called inline; results
 * that are thenables (from `async` rules or plain rules returning promises) run concurrently
 * and are awaited together. A rule that throws or rejects fails. Never rejects itself.
 *
 * @param {unknown} value the value to validate
 * @param {RULES} rules the rule set
 * @param {unknown[]} overload extra arguments passed to every rule
 * @param {string[]} keys the rule keys to run, in order; defaults to the rule set's own keys
 * @param {boolean} break_early report only the first failure, as described in `firstErrorMaybeAsync`
 * @returns {string[]|Promise<string[]>} the keys of the failing rules in order - directly if
 * no rule returned a thenable, otherwise as a promise
 */
const valueErrorsMaybeAsync = (value: unknown, rules: RULES<never>, overload: unknown[], keys: string[] = Object.keys(rules), break_early = false): string[] | Promise<string[]> => {
	if (break_early) return firstErrorMaybeAsync(value, rules, overload, keys);
	const passed: boolean[] = new Array(keys.length);
	let pending: Promise<void>[] | undefined;
	const settle = (index: number, result: PromiseLike<unknown>): void => {
		passed[index] = false;
		(pending ??= []).push(Promise.resolve(result).then(
			(r) => { passed[index] = Boolean(r) },
			() => { passed[index] = false }));
	}

	for (let i = 0; i < keys.length; i++) {
		const rule = rules[keys[i]!]!;
		try {
			const result = callRule(rule, value, overload);
			if (isThenable(result)) settle(i, result);
			else passed[i] = Boolean(result);
		} catch {
			passed[i] = false;
		}
	}

	const collect = (): string[] => {
		const failed: string[] = [];
		for (let i = 0; i < keys.length; i++) {
			if (!passed[i]) failed.push(keys[i]!);
		}
		return failed;
	}
	return pending ? Promise.all(pending).then(collect) : collect();
}

/** Swallow a rejection from a promise whose result is no longer needed, so it isn't reported as unhandled. */
const ignore = (result: PromiseLike<unknown>): void => { Promise.resolve(result).then(undefined, () => { }) }

/**
 * `break_early` version of `valueErrorsMaybeAsync`. Rules not declared `async` run first, in
 * order, and the first one to fail is reported without starting any `async` rule. If they all
 * pass, the `async` rules run concurrently and the first failure in rule order is reported.
 * A plain rule returning a thenable is treated like an `async` rule, except that it has
 * already started. Never rejects.
 *
 * @param {unknown} value the value to validate
 * @param {RULES} rules the rule set
 * @param {unknown[]} overload extra arguments passed to every rule
 * @param {string[]} keys the rule keys to run, in order
 * @returns {string[]|Promise<string[]>} `[]` or the key of the first failing rule - directly if
 * nothing had to be awaited, otherwise as a promise
 */
const firstErrorMaybeAsync = (value: unknown, rules: RULES<never>, overload: unknown[], keys: string[]): string[] | Promise<string[]> => {
	let deferred: number[] | undefined;
	let started: [number, PromiseLike<unknown>][] | undefined;
	for (let i = 0; i < keys.length; i++) {
		const rule = rules[keys[i]!]!;
		if (isAsyncFunction(rule)) {
			(deferred ??= []).push(i);
			continue;
		}
		let result: unknown;
		try {
			result = callRule(rule, value, overload);
		} catch {
			result = false;
		}
		if (isThenable(result)) {
			(started ??= []).push([i, result]);
		} else if (!result) {
			if (started) started.forEach(([, pending]) => ignore(pending));
			return [keys[i]!];
		}
	}
	if (!deferred && !started) return [];

	const checks = started ?? [];
	if (deferred) {
		for (const i of deferred) checks.push([i, callRule(rules[keys[i]!]!, value, overload) as PromiseLike<unknown>]);
	}
	return Promise.all(checks.map(([i, pending]) => Promise.resolve(pending).then(
		(result) => result ? -1 : i,
		() => i,
	))).then((failed) => {
		let first = -1;
		for (const i of failed) {
			if (i !== -1 && (first === -1 || i < first)) first = i;
		}
		return first === -1 ? [] : [keys[first]!];
	});
}

/**
 * Combine the results of a schema entry's alternative rule sets: the entry passes if any
 * alternative passed.
 *
 * @param {string[][]} results the errors of each alternative, in order
 * @returns {string[]|string[][]} `[]` if any alternative had no errors, otherwise `results` unchanged
 */
const mergeAlternatives = (results: string[][]): string[] | string[][] => {
	for (let i = 0; i < results.length; i++) {
		if (!results[i]!.length) return [];
	}
	return results;
}

/**
 * Strict mode: add `['Key not allowed']` to `errors` for every own enumerable key of
 * `object` that is not an own key of `schema`.
 *
 * @param {object} errors the result object to add to; mutated in place
 * @param {CHECKABLE_OBJECT} object the object being validated
 * @param {SCHEMA} schema the schema (only its keys are used)
 */
const addDisallowedKeys = (errors: { [key: string]: unknown }, object: CHECKABLE_OBJECT, schema: SCHEMA): void => {
	const incoming_keys = Object.keys(object);
	for (let i = 0; i < incoming_keys.length; i++) {
		const key = incoming_keys[i]!;
		if (!Object.hasOwn(schema, key)) errors[key] = ['Key not allowed'];
	}
}

/**
 * Validate a value against a rule set, always asynchronously.
 *
 * Sync rules run inline and `async` rules run concurrently; a plain rule returning a promise
 * is awaited too. A rule that returns a falsy value, throws or rejects fails. The returned
 * promise never rejects.
 *
 * @template V type of the value being validated
 * @param {V} value the value to validate
 * @param {RULES<V>} rules the rule set; each key is the error reported when its rule fails
 * @param {...unknown} overload extra arguments passed to every rule after the value
 * @returns {Promise<string[]>} the keys of the failing rules, in rule order; empty if all passed
 */
export const getValueErrorsAsync = async <V>(
	value: V,
	rules: RULES<V>,
	...overload: unknown[]
): Promise<string[]> => valueErrorsMaybeAsync(value, rules as RULES<never>, overload);

/**
 * Validate an object against a schema, always asynchronously.
 *
 * Each schema key's rule set is run against `object_to_check[key]` (a missing key is
 * validated as `undefined`). An entry given as an array of alternative rule sets passes if
 * any alternative passes. Fields whose rules are all sync are filled in immediately; only
 * fields with pending promises are awaited, concurrently. The returned promise never rejects.
 *
 * @template S the schema type, used to infer the result's keys and shapes
 * @param {CHECKABLE_OBJECT} object_to_check the object to validate
 * @param {S} schema maps each key to a rule set, or to an array of alternative rule sets
 * @param {SCHEMA_OPTIONS} [options] `strict: true` also reports keys of the object that the schema doesn't
 * have; `break_early: true` reports only the first failing rule of each rule set
 * @param {...unknown} overload extra arguments passed to every rule after the value
 * @returns {CHECKED_SCHEMA<S>} an object with every schema key, in schema order: `string[]` of
 * failing rule keys for a rule set, or for alternatives `[]` if any passed and otherwise one
 * error list per alternative (`string[][]`). In strict mode, each unknown key follows with
 * `['Key not allowed']`.
 */
export const getSchemaErrorsAsync = async <S extends SCHEMA>(
	object_to_check: CHECKABLE_OBJECT,
	schema: S,
	options: SCHEMA_OPTIONS = DEFAULT_SCHEMA_OPTIONS,
	...overload: unknown[]
): CHECKED_SCHEMA<S> => {
	const errors: { [key: string]: string[] | string[][] } = {};
	// Only fields with something pending are awaited; the rest are filled in inline
	const pending: Promise<void>[] = [];
	const keys = Object.keys(schema);
	for (let i = 0; i < keys.length; i++) {
		const key = keys[i]!;
		const rules = schema[key]!;
		const value = object_to_check[key];
		if (Array.isArray(rules)) {
			const results = rules.map((rule_set) => valueErrorsMaybeAsync(value, rule_set as RULES<never>, overload, undefined, options.break_early));
			if (results.some(isThenable)) {
				// Placeholder keeps the result keys in schema order
				errors[key] = [];
				pending.push(Promise.all(results).then((resolved) => { errors[key] = mergeAlternatives(resolved) }));
			} else {
				errors[key] = mergeAlternatives(results as string[][]);
			}
		} else {
			const result = valueErrorsMaybeAsync(value, rules as RULES<never>, overload, undefined, options.break_early);
			if (isThenable(result)) {
				errors[key] = [];
				pending.push(result.then((resolved) => { errors[key] = resolved }));
			} else {
				errors[key] = result;
			}
		}
	}

	if (options.strict) addDisallowedKeys(errors, object_to_check, schema);

	if (pending.length) await Promise.all(pending);
	return errors as CHECKED_SCHEMA_SYNC<S>;
}

/**
 * Validate a value against a rule set synchronously.
 *
 * A rule that returns a falsy value or throws fails. A rule that returns a promise also
 * fails, because it can't be awaited here - use `getValueErrorsAsync` for those.
 *
 * @template V type of the value being validated
 * @param {V} value the value to validate
 * @param {RULES_SYNC<V>} rules the rule set; each key is the error reported when its rule fails
 * @param {...unknown} overload extra arguments passed to every rule after the value
 * @returns {string[]} the keys of the failing rules, in rule order; empty if all passed
 */
export const getValueErrorsSync = <V>(
	value: V,
	rules: RULES_SYNC<V>,
	...overload: unknown[]
): string[] => valueErrorsSync(value, rules as RULES_SYNC<never>, overload);

/**
 * Implementation of `getSchemaErrorsSync`, taking the overloads as one array so callers
 * don't re-spread them.
 *
 * @param {CHECKABLE_OBJECT} object the object to validate
 * @param {S} schema the schema
 * @param {SCHEMA_OPTIONS} options validation options
 * @param {unknown[]} overload extra arguments passed to every rule
 * @returns {CHECKED_SCHEMA_SYNC<S>} see `getSchemaErrorsSync`
 */
const schemaErrorsSync = <S extends SCHEMA_SYNC>(
	object: CHECKABLE_OBJECT,
	schema: S,
	options: SCHEMA_OPTIONS,
	overload: unknown[],
): CHECKED_SCHEMA_SYNC<S> => {
	const errors: { [key: string]: string[] | string[][] } = {};
	const keys = Object.keys(schema);
	for (let i = 0; i < keys.length; i++) {
		const key = keys[i]!;
		const rules = schema[key]!;
		if (Array.isArray(rules)) {
			const results: string[][] = new Array(rules.length);
			for (let j = 0; j < rules.length; j++) {
				results[j] = valueErrorsSync(object[key], rules[j] as RULES_SYNC<never>, overload, undefined, options.break_early);
			}
			errors[key] = mergeAlternatives(results);
		} else {
			errors[key] = valueErrorsSync(object[key], rules as RULES_SYNC<never>, overload, undefined, options.break_early);
		}
	}

	if (options.strict) addDisallowedKeys(errors, object, schema);

	return errors as CHECKED_SCHEMA_SYNC<S>;
}

/**
 * Validate an object against a schema synchronously.
 *
 * Each schema key's rule set is run against `object[key]` (a missing key is validated as
 * `undefined`), with the same rule semantics as `getValueErrorsSync`: a rule returning a
 * promise fails. An entry given as an array of alternative rule sets passes if any
 * alternative passes.
 *
 * @template S the schema type, used to infer the result's keys and shapes
 * @param {CHECKABLE_OBJECT} object the object to validate
 * @param {S} schema maps each key to a rule set, or to an array of alternative rule sets
 * @param {SCHEMA_OPTIONS} [options] `strict: true` also reports keys of the object that the schema doesn't
 * have; `break_early: true` reports only the first failing rule of each rule set
 * @param {...unknown} overload extra arguments passed to every rule after the value
 * @returns {CHECKED_SCHEMA_SYNC<S>} an object with every schema key, in schema order: `string[]`
 * of failing rule keys for a rule set, or for alternatives `[]` if any passed and otherwise
 * one error list per alternative (`string[][]`). In strict mode, each unknown key follows
 * with `['Key not allowed']`.
 */
export const getSchemaErrorsSync = <S extends SCHEMA_SYNC>(
	object: CHECKABLE_OBJECT,
	schema: S,
	options: SCHEMA_OPTIONS = DEFAULT_SCHEMA_OPTIONS,
	...overload: unknown[]
): CHECKED_SCHEMA_SYNC<S> => schemaErrorsSync(object, schema, options, overload);

/**
 * Validate a value against a rule set, synchronously if no rule is an `async` function and
 * asynchronously otherwise (see `getValueErrorsSync` / `getValueErrorsAsync`).
 *
 * The return type is inferred from the rules: all-sync rules give `string[]`, any `async`
 * rule gives `Promise<string[]>`, and rules typed as returning `boolean | Promise<boolean>`
 * (e.g. annotated as `RULE`) give the union. For a rule set used repeatedly,
 * `compileRules` is faster.
 *
 * @template V type of the value being validated
 * @template R the rule set type, used to infer sync or async
 * @param {V} value the value to validate
 * @param {R} rules the rule set; each key is the error reported when its rule fails
 * @param {...unknown} overload extra arguments passed to every rule after the value
 * @returns {string[]|Promise<string[]>} the keys of the failing rules, in rule order; empty if all passed
 */
export const getValueErrors = <V, R extends RULES<V>>(
	value: V,
	rules: R,
	...overload: unknown[]
): MAYBE_ASYNC<RULES_KIND<R>, string[]> => {
	// The runtime check decides sync vs async; the static type is derived from `R` above.
	const result = rulesHaveAsync(rules)
		? getValueErrorsAsync(value, rules, ...overload)
		: valueErrorsSync(value, rules as RULES_SYNC<never>, overload);
	return result as MAYBE_ASYNC<RULES_KIND<R>, string[]>;
}

/**
 * Detect whether any rule anywhere in a schema is an `async` function.
 *
 * @param {SCHEMA} schema the schema to inspect
 * @returns {boolean} `true` if the schema needs the async path
 */
const isAsyncSchema = (schema: SCHEMA): boolean => {
	const keys = Object.keys(schema);
	for (let i = 0; i < keys.length; i++) {
		if (hasAsyncFunction(schema[keys[i]!]!)) return true;
	}
	return false;
}

/**
 * Validate an object against a schema, synchronously if no rule in the schema is an
 * `async` function and asynchronously otherwise (see `getSchemaErrorsSync` /
 * `getSchemaErrorsAsync` for the details and result shape).
 *
 * The return type is inferred from the schema: all-sync rules give the result object
 * directly, any `async` rule gives a `Promise` of it, and rules typed as returning
 * `boolean | Promise<boolean>` (e.g. a schema annotated as `SCHEMA`) give the union. For a
 * schema used repeatedly, `compileSchema` is faster.
 *
 * @template S the schema type, used to infer sync or async and the result's keys and shapes
 * @param {CHECKABLE_OBJECT} object the object to validate
 * @param {S} schema maps each key to a rule set, or to an array of alternative rule sets
 * @param {SCHEMA_OPTIONS} [options] `strict: true` also reports keys of the object that the schema doesn't
 * have; `break_early: true` reports only the first failing rule of each rule set
 * @param {...unknown} overload extra arguments passed to every rule after the value
 * @returns {CHECKED_SCHEMA_SYNC<S>|CHECKED_SCHEMA<S>} the errors per key, or a promise of them
 */
export const getSchemaErrors = <S extends SCHEMA>(
	object: CHECKABLE_OBJECT,
	schema: S,
	options: SCHEMA_OPTIONS = DEFAULT_SCHEMA_OPTIONS,
	...overload: unknown[]
): MAYBE_ASYNC<SCHEMA_KIND<S>, CHECKED_SCHEMA_SYNC<S>> => {
	// The runtime check decides sync vs async; the static type is derived from `S` above.
	const result = isAsyncSchema(schema)
		? getSchemaErrorsAsync(object, schema, options, ...overload)
		: schemaErrorsSync(object, schema as SCHEMA_SYNC, options, overload);
	return result as MAYBE_ASYNC<SCHEMA_KIND<S>, CHECKED_SCHEMA_SYNC<S>>;
}

// ---------------------------------------------------------------------------
// Compiled validators
// ---------------------------------------------------------------------------

/**
 * A rule set prepared at compile time: a private copy of the rules plus their keys and
 * functions as parallel arrays, so validation can index instead of looking up by key.
 */
type COMPILED_SET = { keys: string[], rules: RULES<never>, fns: RULE<never, unknown[]>[] };

/**
 * `valueErrorsSync` for a compiled rule set: same semantics, indexed over the arrays.
 *
 * @param {unknown} value the value to validate
 * @param {COMPILED_SET} set the compiled rule set
 * @param {unknown[]} overload extra arguments passed to every rule
 * @param {boolean} break_early stop at the first failing rule
 * @returns {string[]} the keys of the failing rules, in order (only the first with `break_early`)
 */
const compiledErrorsSync = (value: unknown, set: COMPILED_SET, overload: unknown[], break_early: boolean): string[] => {
	const failed: string[] = [];
	const { keys, fns } = set;
	for (let i = 0; i < fns.length; i++) {
		try {
			const result = callRule(fns[i]!, value, overload);
			if (!result || isThenable(result)) failed.push(keys[i]!);
		} catch {
			failed.push(keys[i]!);
		}
		if (break_early && failed.length) return failed;
	}
	return failed;
}
/** A compiled schema entry: exactly one of `set` (a rule set) or `alternatives` is defined. */
type COMPILED_ENTRY = { key: string, set: COMPILED_SET | undefined, alternatives: COMPILED_SET[] | undefined };

/**
 * Copy a rule set into a `COMPILED_SET`, so later changes to the original have no effect.
 *
 * @param {object} rules the rule set to compile
 * @returns {COMPILED_SET} the prepared copy
 */
const compileSet = (rules: object): COMPILED_SET => {
	const copy = { ...rules } as RULES<never>;
	const keys = Object.keys(copy);
	return { keys, rules: copy, fns: keys.map((key) => copy[key]!) };
}

/**
 * Compile a rule set into a reusable validator that gives the same results as
 * `getValueErrors(value, rules, ...overload)`, but does the key lookup and the sync/async
 * check once here instead of on every call.
 *
 * The rule set is copied, so changes made to `rules` after compiling have no effect on the
 * returned validator.
 *
 * @template R the rule set type; the validator's value parameter and sync/async return type come from it
 * @param {R} rules the rule set; each key is the error reported when its rule fails
 * @param {RULES_OPTIONS} [options] `break_early: true` reports only the first failing rule
 * @returns {COMPILED_RULES<R>} `(value, ...overload) => string[]` if every rule is sync, otherwise
 * an async function returning `Promise<string[]>`
 */
export const compileRules = <R extends ANY_RULES>(rules: R, options: RULES_OPTIONS = DEFAULT_SCHEMA_OPTIONS): COMPILED_RULES<R> => {
	const set = compileSet(rules);
	const break_early = Boolean(options.break_early);
	if (rulesHaveAsync(set.rules)) {
		return (async (value: unknown, ...overload: unknown[]) =>
			valueErrorsMaybeAsync(value, set.rules, overload, set.keys, break_early)) as COMPILED_RULES<R>;
	}
	return ((value: unknown, ...overload: unknown[]) =>
		compiledErrorsSync(value, set, overload, break_early)) as COMPILED_RULES<R>;
}

/**
 * Compile a schema into a reusable validator that gives the same results as
 * `getSchemaErrors(object, schema, options, ...overload)`, but does the key lookups and the
 * sync/async check once here instead of on every call.
 *
 * The schema, its rule sets and the options are copied, so changes made to them after
 * compiling have no effect on the returned validator.
 *
 * @template S the schema type; the validator's sync/async return type and result shape come from it
 * @param {S} schema maps each key to a rule set, or to an array of alternative rule sets
 * @param {SCHEMA_OPTIONS} [options] `strict: true` also reports keys of the object that the schema doesn't
 * have; `break_early: true` reports only the first failing rule of each rule set
 * @returns {COMPILED_SCHEMA<S>} `(object, ...overload) => errors` if every rule is sync, otherwise
 * an async function returning a promise of them; see `getSchemaErrorsSync` for the result shape
 */
export const compileSchema = <S extends SCHEMA>(schema: S, options: SCHEMA_OPTIONS = DEFAULT_SCHEMA_OPTIONS): COMPILED_SCHEMA<S> => {
	const entries: COMPILED_ENTRY[] = Object.keys(schema).map((key) => {
		const rules = schema[key]!;
		return Array.isArray(rules)
			? { key, set: undefined, alternatives: rules.map(compileSet) }
			: { key, set: compileSet(rules), alternatives: undefined };
	});
	// Only the keys matter for the strict check, so a shallow copy is enough
	const allowed_keys: SCHEMA | undefined = options.strict ? { ...schema } : undefined;
	const break_early = Boolean(options.break_early);

	if (!isAsyncSchema(schema)) {
		return ((object: CHECKABLE_OBJECT, ...overload: unknown[]) => {
			const errors: { [key: string]: string[] | string[][] } = {};
			for (let i = 0; i < entries.length; i++) {
				const { key, set, alternatives } = entries[i]!;
				if (set) {
					errors[key] = compiledErrorsSync(object[key], set, overload, break_early);
				} else {
					const results: string[][] = new Array(alternatives!.length);
					for (let j = 0; j < alternatives!.length; j++) {
						results[j] = compiledErrorsSync(object[key], alternatives![j]!, overload, break_early);
					}
					errors[key] = mergeAlternatives(results);
				}
			}
			if (allowed_keys) addDisallowedKeys(errors, object, allowed_keys);
			return errors;
		}) as COMPILED_SCHEMA<S>;
	}

	return (async (object: CHECKABLE_OBJECT, ...overload: unknown[]) => {
		const errors: { [key: string]: string[] | string[][] } = {};
		const pending: Promise<void>[] = [];
		for (let i = 0; i < entries.length; i++) {
			const { key, set, alternatives } = entries[i]!;
			if (set) {
				const result = valueErrorsMaybeAsync(object[key], set.rules, overload, set.keys, break_early);
				if (isThenable(result)) {
					errors[key] = [];
					pending.push(result.then((resolved) => { errors[key] = resolved }));
				} else {
					errors[key] = result;
				}
			} else {
				const results = alternatives!.map((alternative) => valueErrorsMaybeAsync(object[key], alternative.rules, overload, alternative.keys, break_early));
				if (results.some(isThenable)) {
					errors[key] = [];
					pending.push(Promise.all(results).then((resolved) => { errors[key] = mergeAlternatives(resolved) }));
				} else {
					errors[key] = mergeAlternatives(results as string[][]);
				}
			}
		}
		if (allowed_keys) addDisallowedKeys(errors, object, allowed_keys);
		if (pending.length) await Promise.all(pending);
		return errors;
	}) as COMPILED_SCHEMA<S>;
}
