/**
 * Rule helpers: factories that build common rules, and combinators that modify or combine
 * existing rules. Every factory returns a new rule, so the result can be used directly as a
 * value in a rule set, e.g. `{ "Too long": maxLength(100) }`.
 *
 * @module
 */

import type { RULE, RULE_ASYNC, RULE_SYNC } from '../types';

/**
 * Detect a value with a numeric `length`: a string, or an object (arrays included) whose
 * `length` property is a number. Functions are excluded even though they have a `length`.
 *
 * @param {unknown} obj the value to inspect
 * @returns {boolean} `true` if `obj.length` can be compared as a number
 */
const hasLengthProperty = (obj: unknown): obj is { length: number } =>
	typeof obj === 'string' ||
	(obj !== null && typeof obj === 'object' && 'length' in obj && typeof (obj as { length: unknown }).length === 'number');

/** Every string the `typeof` operator can return. */
export type TYPEOF_RESULT = "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function";

/**
 * Rule: passes if `typeof value === type`. Note that `typeof null` is `'object'`, so
 * `isType('object')` passes `null`, and `typeof NaN` is `'number'`.
 *
 * @param {TYPEOF_RESULT} type the expected `typeof` result
 * @returns {RULE_SYNC} the rule
 */
export const isType =
	(type: TYPEOF_RESULT): RULE_SYNC =>
		(value: unknown) => typeof value === type

/**
 * Rule: passes if the value is a string that `regex` matches. Non-strings fail.
 *
 * The regex is used as given, so one with the `g` or `y` flag is stateful: `test` moves its
 * `lastIndex`, and repeated calls can alternate between passing and failing. Use regexes
 * without those flags.
 *
 * @param {RegExp} regex the pattern to test strings against
 * @returns {RULE_SYNC} the rule
 */
export const matchesRegex = (regex: RegExp): RULE_SYNC =>
	(value: unknown) =>
		typeof value === 'string' && regex.test(value)

/**
 * Rule: passes if the value is a number less than or equal to `max_value`. Non-numbers
 * (including bigints) and `NaN` fail.
 *
 * @param {number} [max_value=Infinity] the inclusive upper bound
 * @returns {RULE_SYNC} the rule
 */
export const max = (max_value: number = Infinity): RULE_SYNC =>
	(i: unknown) =>
		typeof i === 'number' && i <= max_value

/**
 * Rule: passes if the value is a number greater than or equal to `min_value`. Non-numbers
 * (including bigints) and `NaN` fail.
 *
 * @param {number} [min_value=-Infinity] the inclusive lower bound
 * @returns {RULE_SYNC} the rule
 */
export const min = (min_value: number = -Infinity): RULE_SYNC =>
	(i: unknown) =>
		typeof i === 'number' && i >= min_value

/**
 * Rule: passes if the value has a numeric `length` (a string, array, or object with a
 * numeric `length`) of at most `max_length`. Values without one fail.
 *
 * @param {number} [max_length=Infinity] the inclusive maximum length
 * @returns {RULE_SYNC} the rule
 */
export const maxLength = (max_length: number = Infinity): RULE_SYNC =>
	(i: unknown) =>
		hasLengthProperty(i) && i.length <= max_length

/**
 * Rule: passes if the value has a numeric `length` (a string, array, or object with a
 * numeric `length`) of at least `min_length`. Values without one fail, even with the
 * default of `0`.
 *
 * @param {number} [min_length=0] the inclusive minimum length
 * @returns {RULE_SYNC} the rule
 */
export const minLength = (min_length: number = 0): RULE_SYNC =>
	(i: unknown) =>
		hasLengthProperty(i) && i.length >= min_length

/**
 * Rule: passes if the value is a string whose length is between `min` and `max`, inclusive.
 * Note the argument order: the maximum comes first.
 *
 * @param {number} [max=Infinity] the inclusive maximum length
 * @param {number} [min=0] the inclusive minimum length
 * @returns {RULE_SYNC} the rule
 */
export const stringBetween = (max = Infinity, min = 0): RULE_SYNC =>
	(s: unknown) =>
		typeof s === 'string' && s.length >= min && s.length <= max

/**
 * Rule: passes if the value is a number between `min` and `max`, inclusive. Non-numbers
 * and `NaN` fail. Note the argument order: the maximum comes first.
 *
 * @param {number} [max=Infinity] the inclusive upper bound
 * @param {number} [min=-Infinity] the inclusive lower bound
 * @returns {RULE_SYNC} the rule
 */
export const numberBetween = (max = Infinity, min = -Infinity): RULE_SYNC =>
	(i: unknown) =>
		typeof i === 'number' && i >= min && i <= max

/**
 * Rule: passes if the value equals `expected` under SameValueZero semantics (`===`, except
 * `NaN` equals `NaN`) - the same comparison `isOneOf` uses. Objects compare by reference.
 *
 * @param {unknown} expected the value to compare against
 * @returns {RULE_SYNC} the rule
 */
export const equals = (expected: unknown): RULE_SYNC =>
	(i: unknown) => i === expected || (Number.isNaN(expected as number) && Number.isNaN(i as number))

/**
 * Rule: passes if the value is one of `allowed_values`, using SameValueZero semantics - the
 * same comparison `equals` uses. The values are copied into a `Set` when the rule is created,
 * so later changes to the array have no effect.
 *
 * @param {unknown[]} [allowed_values=[]] the accepted values; with none, every value fails
 * @returns {RULE_SYNC} the rule
 */
export const isOneOf = (allowed_values: unknown[] = []): RULE_SYNC => {
	const allowed = new Set(allowed_values);
	return (i: unknown) => allowed.has(i);
}

/**
 * Rule: passes if the value is a number with no fractional part (`Number.isInteger`).
 * Bigints, numeric strings, `NaN` and `Infinity` fail.
 *
 * @returns {RULE_SYNC} the rule
 */
export const isInteger = (): RULE_SYNC =>
	(i: unknown) => Number.isInteger(i)

/**
 * Rule: passes if the value is an array (`Array.isArray`).
 *
 * @returns {RULE_SYNC} the rule
 */
export const isArray = (): RULE_SYNC =>
	(i: unknown) => Array.isArray(i)

/**
 * Rule: passes if `value instanceof constructor`. Like `instanceof`, this checks the
 * prototype chain, so it fails for objects from another realm (e.g. an iframe).
 *
 * @param {Function} constructor the class or constructor function to check against
 * @returns {RULE_SYNC} the rule
 */
export const isInstanceOf = (constructor: abstract new (...args: never[]) => unknown): RULE_SYNC =>
	(i: unknown) => i instanceof constructor

/**
 * Combinator: inverts a synchronous rule. A throwing rule counts as failed, so its negation
 * passes. The rule must be synchronous: a returned promise is truthy, so the negation fails.
 *
 * @template V type of the value being validated
 * @template O tuple type of the overload arguments, passed through to `rule`
 * @param {RULE_SYNC<V, O>} rule the rule to invert
 * @returns {RULE_SYNC<V, O>} the inverted rule
 */
export const notSync = <V = unknown, O extends unknown[] = unknown[]>(rule: RULE_SYNC<V, O>): RULE_SYNC<V, O> =>
	(i: V, ...overload: O) => {
		try {
			return !rule(i, ...overload);
		} catch {
			return true;
		}
	}

/**
 * Combinator: inverts a sync or async rule. A throwing or rejecting rule counts as failed, so
 * its negation passes. Always async - a single async rule switches the whole rule set onto the
 * async execution path, so prefer `notSync` unless the wrapped rule is genuinely async.
 *
 * @template V type of the value being validated
 * @template O tuple type of the overload arguments, passed through to `rule`
 * @param {RULE<V, O>} rule the rule to invert
 * @returns {RULE_ASYNC<V, O>} the inverted rule
 */
export const notAsync = <V = unknown, O extends unknown[] = unknown[]>(rule: RULE<V, O>): RULE_ASYNC<V, O> =>
	async (i: V, ...overload: O) => {
		try {
			return !(await rule(i, ...overload));
		} catch {
			return true;
		}
	}

/**
 * Combinator: passes if the value is an array and every element (holes included, as
 * `undefined`) passes `rule`. Stops at the first failing element; an empty array passes.
 * A throwing element rule makes the whole rule fail. The rule must be synchronous: a
 * returned promise is truthy, so that element passes.
 *
 * @template E type of the array elements the rule accepts
 * @template O tuple type of the overload arguments, passed through to `rule`
 * @param {RULE_SYNC<E, O>} rule the rule every element must pass
 * @returns {RULE_SYNC<unknown, O>} the array rule
 */
export const everyElementSync = <E = unknown, O extends unknown[] = unknown[]>(rule: RULE_SYNC<E, O>): RULE_SYNC<unknown, O> =>
	(i: unknown, ...overload: O) => {
		if (!Array.isArray(i)) return false;
		// Indexed loop instead of .every so sparse-array holes are validated as undefined
		for (let index = 0; index < i.length; index++) {
			if (!rule(i[index] as E, ...overload)) return false;
		}
		return true;
	}

/**
 * Combinator: passes if the value is an array and every element (holes included, as
 * `undefined`) passes `rule`, which may be sync or async; an empty array passes. Elements are
 * checked one at a time, stopping at the first failure, so an early invalid element in an
 * attacker-sized array doesn't fan out rule calls for the rest of it. A throwing or rejecting
 * element rule makes the whole rule fail.
 * Always async - a single async rule switches the whole rule set onto the async execution
 * path, so prefer `everyElementSync` unless the element rule is genuinely async.
 *
 * @template E type of the array elements the rule accepts
 * @template O tuple type of the overload arguments, passed through to `rule`
 * @param {RULE<E, O>} rule the rule every element must pass
 * @returns {RULE_ASYNC<unknown, O>} the array rule
 */
export const everyElementAsync = <E = unknown, O extends unknown[] = unknown[]>(rule: RULE<E, O>): RULE_ASYNC<unknown, O> =>
	async (i: unknown, ...overload: O) => {
		if (!Array.isArray(i)) return false;
		for (let index = 0; index < i.length; index++) {
			if (!(await rule(i[index] as E, ...overload))) return false;
		}
		return true;
	}

/**
 * Combinator: passes if *any* of the given rules passes. All rules run concurrently and every
 * one is awaited, even after one has passed. If any rule throws or rejects, the combined rule
 * fails, even when another rule passed. With no rules, it fails. Always async.
 *
 * @template V type of the value being validated
 * @template O tuple type of the overload arguments, passed through to every rule
 * @param {RULE<V, O>[]} [rules=[]] the alternatives, sync or async
 * @returns {RULE_ASYNC<V, O>} the combined rule
 */
export const acceptAnyAsync = <V = unknown, O extends unknown[] = unknown[]>(rules: RULE<V, O>[] = []): RULE_ASYNC<V, O> =>
	async (i: V, ...overload: O) =>
		(await Promise.all(rules.map(rule => rule(i, ...overload)))).some(e => e)

/**
 * Combinator: passes if *any* of the given rules passes. Every rule runs, even after one has
 * passed. If any rule throws, the combined rule fails, even when another rule passed. With no
 * rules, it fails. All rules must be synchronous: a returned promise is truthy, so it counts
 * as passing.
 *
 * @template V type of the value being validated
 * @template O tuple type of the overload arguments, passed through to every rule
 * @param {RULE_SYNC<V, O>[]} [rules=[]] the alternatives
 * @returns {RULE_SYNC<V, O>} the combined rule
 */
export const acceptAnySync = <V = unknown, O extends unknown[] = unknown[]>(rules: RULE_SYNC<V, O>[] = []): RULE_SYNC<V, O> =>
	(i: V, ...overload: O) =>
		rules.map((rule) => rule(i, ...overload)).some(e => e)
