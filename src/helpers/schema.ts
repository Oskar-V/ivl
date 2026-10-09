/**
 * Rule set helpers: wrap every rule in a rule set at once, typically for use as a schema
 * entry, e.g. `{ website: allowUndefined(URL_RULES) }`.
 *
 * @module
 */

import type { RULE, RULES } from '../types';
import { isAsyncFunction } from '../core';

/**
 * Re-declares each rule so that the value parameter of the returned rule is `V` instead of
 * the original rule's, while keeping its overload parameters and its return type (sync stays
 * sync, async stays async).
 *
 * @template R the original rule set
 * @template V the new value type
 */
type REWRAPPED<R extends RULES<never>, V> = {
	[K in keyof R]: R[K] extends (value: never, ...overload: infer O) => infer Ret
	? (value: V, ...overload: O) => Ret
	: never
};

/**
 * Rebuild a rule set with each rule wrapped by `wrap`, keeping `async` rules `async` and the
 * rest plain, so `getValueErrors`/`getSchemaErrors` still pick the correct execution path.
 * Every rule-set wrapper must go through this, so that invariant lives in one place.
 * Detection only sees the `async` keyword, so a plain rule returning a promise stays plain:
 * it fails on the sync path and is awaited on the async path, as it would unwrapped.
 *
 * @template OUT the type of the returned rule set
 * @param {RULES} rules the rule set to wrap; only own enumerable keys are kept
 * @param {Function} wrap called as `wrap(rule, value, overload)` in place of each rule
 * @returns {OUT} a new rule set with the same keys in the same order
 */
const wrapRules = <OUT>(rules: RULES<never>, wrap: (rule: RULE, value: unknown, overload: unknown[]) => boolean | Promise<boolean>): OUT =>
	Object.fromEntries(Object.entries(rules).map(([key, rule]) => [
		key,
		isAsyncFunction(rule)
			? async (i: unknown, ...overload: unknown[]) => wrap(rule as RULE, i, overload)
			: (i: unknown, ...overload: unknown[]) => wrap(rule as RULE, i, overload),
	])) as OUT;

/**
 * Wrap every rule in a rule set so that an `undefined` value passes without calling it,
 * making the field optional. Other values are validated as before.
 *
 * Sync rules stay sync and async rules stay async, so `getValueErrors`/`getSchemaErrors`
 * still pick the correct execution path.
 *
 * @template R the rule set type, preserved in the result
 * @param {R} rules the rule set to wrap; it is not modified
 * @returns {R} a new rule set with the same keys
 */
export const allowUndefined = <R extends RULES>(rules: R): R =>
	wrapRules<R>(rules, (rule, i, overload) => typeof i === 'undefined' ? true : rule(i, ...overload));

/**
 * Wrap every rule in a rule set so that a `null` value passes without calling it. Other
 * values (including `undefined`) are validated as before.
 *
 * Sync rules stay sync and async rules stay async, so `getValueErrors`/`getSchemaErrors`
 * still pick the correct execution path.
 *
 * @template R the rule set type, preserved in the result
 * @param {R} rules the rule set to wrap; it is not modified
 * @returns {R} a new rule set with the same keys
 */
export const allowNull = <R extends RULES>(rules: R): R =>
	wrapRules<R>(rules, (rule, i, overload) => i === null ? true : rule(i, ...overload));

/**
 * Wrap every rule in a rule set so that each rule validates `fn(value)` instead of the value,
 * e.g. to trim or parse it first. The original value is not changed.
 *
 * `fn` is called separately for each rule, so it should be cheap and free of side effects.
 * If it throws, every rule it was called for fails. The rules may be typed against the
 * *output* of `fn`; the returned rules accept `unknown`. Sync rules stay sync and async
 * rules stay async.
 *
 * @template V the type `fn` returns
 * @template R the rule set type
 * @param {Function} fn transforms the value before each rule sees it
 * @param {R} rules the rule set to wrap; it is not modified
 * @returns {REWRAPPED<R, unknown>} a new rule set with the same keys, accepting `unknown`
 */
export const preprocess = <V, R extends RULES<V>>(fn: (value: unknown) => V, rules: R): REWRAPPED<R, unknown> =>
	wrapRules<REWRAPPED<R, unknown>>(rules, (rule, i, overload) => rule(fn(i), ...overload));
