// Functions which affect a single rule

import type { RULE, RULE_SYNC } from '@types';

// Type guards
const hasLengthProperty = (obj: unknown): obj is { length: number } =>
	typeof obj === 'string' || (obj !== null && typeof obj === 'object' && 'length' in obj) && typeof (obj as any).length === 'number';

// Helpers
export const isType =
	(type: "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function"): RULE_SYNC =>
		(value: unknown) => typeof value === type

export const matchesRegex = (regex: RegExp): RULE_SYNC =>
	(value: unknown) =>
		typeof value === 'string' && regex.test(value)

export const max = (max_value: number = Infinity): RULE_SYNC =>
	(i: unknown) =>
		typeof i === 'number' && i <= max_value

export const min = (min_value: number = -Infinity): RULE_SYNC =>
	(i: unknown) =>
		typeof i === 'number' && i >= min_value

export const maxLength = (max_length: number = Infinity): RULE_SYNC =>
	(i: unknown) =>
		hasLengthProperty(i) && i.length <= max_length

export const minLength = (min_length: number = 0): RULE_SYNC =>
	(i: unknown) =>
		hasLengthProperty(i) && i.length >= min_length

export const stringBetween = (max = Infinity, min = 0): RULE_SYNC =>
	(s: unknown) =>
		typeof s === 'string' && s.length >= min && s.length <= max

export const numberBetween = (max = Infinity, min = -Infinity): RULE_SYNC =>
	(i: unknown) =>
		typeof i === 'number' && i >= min && i <= max

export const acceptAnyAsync = (rules: RULE[] = []): RULE =>
	async (i: unknown, ...overload: unknown[]) =>
		(await Promise.all(rules.map(rule => rule(i, ...overload)))).some(e => e)

export const acceptAnySync = (rules: RULE_SYNC[] = []): RULE_SYNC =>
	(i: unknown, ...overload: unknown[]) =>
		rules.map((rule) => rule(i, ...overload)).some(e => e)
