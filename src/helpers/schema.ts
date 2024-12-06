// Functions which affect the a whole rule set - to be used inside schema objects

import type { RULES } from '@types';
import { isAsyncFunction } from 'core';

export const allowUndefined = (rules: RULES): RULES =>
	Object.entries(rules).reduce((acc, [key, rule]) => {
		if (isAsyncFunction(rule)) {
			return { ...acc, [key]: async (i: unknown, ...overload: unknown[]) => typeof i === 'undefined' ? true : rule(i, ...overload) }
		}
		return { ...acc, [key]: (i: unknown, ...overload: unknown[]) => typeof i === 'undefined' ? true : rule(i, ...overload) }
	}, {});

export const preprocess = (fn: Function, rules: RULES): RULES =>
	Object.entries(rules).reduce((acc, [key, rule]) => ({
		...acc, [key]: (i: unknown, ...overload: unknown[]) => rule(fn(i), ...overload)
	}), {});