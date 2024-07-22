// Functions which affect the a whole rule set - to be used inside schema objects

import { RULES } from '@types';

export const allowUndefined = (rules: RULES) =>
	Object.entries(rules).reduce((acc, [key, rule]) => ({
		...acc, [key]: (i: unknown, ...overload: unknown[]) => typeof i === 'undefined' ? true : rule(i, ...overload)
	}), {});

export const preprocess = (fn: Function, rules: RULES) =>
	Object.entries(rules).reduce((acc, [key, rule]) => ({
		...acc, [key]: (i: unknown, ...overload: unknown[]) => rule(fn(i), ...overload)
	}), {});