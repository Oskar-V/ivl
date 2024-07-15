import { RULE, RULES } from './types'

// Individual rule helpers
export const type =
	(type: "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function"): RULE =>
		(value: unknown) => typeof value === type

export const matchesRegex = (regex: RegExp): RULE =>
	(value: unknown) =>
		typeof value === 'string' && regex.test(value)

export const stringBetween = (max = 100, min = 0) =>
	(s: unknown) =>
		typeof s === 'string' && s.length >= min && s.length < max

export const numberBetween = (max = 100, min = 1) =>
	(i: unknown) =>
		typeof i === 'number' && i >= min && i < max

export const acceptAny = (rules: RULE[] = []) =>
	async (i: unknown, ...extra: unknown[]) =>
		(await Promise.all(rules.map(rule => rule.call(undefined, i, ...extra)))).some(e => e)

// Whole schema helpers
export const allowUndefined = (rules: RULES) =>
	Object.entries(rules).reduce((acc, [key, rule]) => ({
		...acc, [key]: (i: unknown, ...overload: unknown[]) => typeof i === 'undefined' ? true : rule(i, ...overload)
	}), {});

export const preprocess = (fn: Function, rules: RULES) =>
	Object.entries(rules).reduce((acc, [key, rule]) => ({
		...acc, [key]: (i: unknown, ...overload: unknown[]) => rule(fn(i), ...overload)
	}), {})


exports = {
	type,
	matchesRegex,
	allowUndefined,
	preprocess,
	stringBetween,
	numberBetween,
	acceptAny
}