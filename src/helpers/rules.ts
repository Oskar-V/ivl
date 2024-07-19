// Functions which affect a single rule

import { RULE, RULE_SYNC } from '@types';

// Type guards
const hasLengthProperty = (obj: unknown): obj is { length: number } =>
	obj !== null && typeof obj === 'object' && 'length' in obj && typeof (obj as any).length === 'number';

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

export const minLength = (min_length: number = Infinity): RULE_SYNC =>
	(i: unknown) =>
		hasLengthProperty(i) && i.length <= min_length

export const stringBetween = (max = 100, min = 0): RULE_SYNC =>
	(s: unknown) =>
		typeof s === 'string' && s.length >= min && s.length < max

export const numberBetween = (max = 100, min = 1): RULE_SYNC =>
	(i: unknown) =>
		typeof i === 'number' && i >= min && i < max

export const acceptAny = (rules: RULE[] = []): RULE =>
	async (i: unknown, ...extra: unknown[]) =>
		(await Promise.all(rules.map(rule => rule(undefined, i, ...extra)))).some(e => e)

export const acceptAnySync = (rules: RULE_SYNC[] = []): RULE_SYNC =>
	(i: unknown, ...extra: unknown[]) =>
		rules.map((rule) => rule(undefined, i, ...extra)).some(e => e)
