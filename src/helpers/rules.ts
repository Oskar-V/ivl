// Functions which affect a single rule

import { RULE, RULE_SYNC } from '@types';

export const type =
	(type: "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function"): RULE =>
		(value: unknown) => typeof value === type

export const matchesRegex = (regex: RegExp) =>
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

export const acceptAnySync = (rules: RULE_SYNC[] = []) =>
	(i: unknown, ...extra: unknown[]) =>
		rules.map((rule) => rule.call(undefined, i, ...extra)).some(e => e)
