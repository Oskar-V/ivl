import { describe, test, expect } from 'bun:test'

import { compileRules, compileSchema, getValueErrors, getSchemaErrors } from '../src';
import type { RULES, SCHEMA, CHECKABLE_OBJECT } from '../src';
import { allowUndefined, isInteger, numberBetween } from '../src/helpers';
import { EMAIL_RULES, STRONG_PASSWORD_RULES, SLUG_RULES, URL_RULES, IPV4_RULES, IPV6_RULES } from '../src/patterns';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The compiled validators must give exactly what the uncompiled functions give
describe('Compiled rules match getValueErrors', () => {
	const cases: [string, RULES][] = [
		['empty', {}],
		['sync rule set', EMAIL_RULES],
		['throwing rule', { "Throws": () => { throw new Error('boom') }, "Passes": () => true }],
		['plain rule returning a promise', { "Thenable": (() => Promise.resolve(true)) as unknown as () => boolean }],
		['mixed sync and async', {
			"Sync fails": () => false,
			"Slow async fails": async () => { await delay(2); return false },
			"Async passes": async () => true,
			"Async rejects": async () => { throw new Error('nope') },
		}],
		['overload aware', { "Matches context": (i: unknown, expected: unknown) => i === expected }],
	];
	const inputs = ['a@b.co', 'nope', 1, null, undefined];

	for (const [name, rules] of cases) {
		test(name, async () => {
			const compiled = compileRules(rules);
			for (const input of inputs) {
				expect(await compiled(input)).toEqual(await getValueErrors(input, rules));
				expect(await compiled(input, 'nope')).toEqual(await getValueErrors(input, rules, 'nope'));
			}
		})
	}
})

describe('Compiled schemas match getSchemaErrors', () => {
	const user_schema = {
		email: EMAIL_RULES,
		password: STRONG_PASSWORD_RULES,
		username: SLUG_RULES,
		age: { 'Must be an integer': isInteger(), 'Must be between 13 and 130': numberBetween(130, 13) },
		website: allowUndefined(URL_RULES),
		ip: [IPV4_RULES, IPV6_RULES],
	};
	const async_schema = {
		...user_schema,
		email: { ...EMAIL_RULES, "Email already registered": async (i: unknown) => { await delay(1); return i !== 'taken@example.com' } },
		ip: [IPV4_RULES, { "Slow IPv6": async (i: unknown) => { await delay(2); return i === '::1' } }],
	};
	const inputs: CHECKABLE_OBJECT[] = [
		{ email: 'jane@example.com', password: 'Passw0rd!', username: 'jane-doe', age: 30, ip: '::1' },
		{ email: 'taken@example.com', password: 'short', username: 'Jane Doe', age: 12.5, website: 'nope', ip: 'nope' },
		{ extra: 'not in the schema' },
		{},
	];

	for (const [name, schema] of [['sync schema', user_schema], ['async schema', async_schema]] as [string, SCHEMA][]) {
		for (const strict of [false, true]) {
			test(`${name}, strict: ${strict}`, async () => {
				const compiled = compileSchema(schema, { strict });
				for (const input of inputs) {
					const result = await compiled(input);
					const expected = await getSchemaErrors(input, schema, { strict });
					expect(result).toEqual(expected);
					// Key order is part of the result too
					expect(Object.keys(result)).toEqual(Object.keys(expected));
				}
			})
		}
	}

	test('Overloads reach the rules', async () => {
		const schema = { key: { "Matches context": async (i: unknown, expected: unknown) => i === expected } };
		const compiled = compileSchema(schema);
		expect(await compiled({ key: 'a' }, 'a')).toEqual({ key: [] });
		expect(await compiled({ key: 'a' }, 'b')).toEqual({ key: ['Matches context'] });
	})
})

describe('Compiled validator behaviour', () => {
	test('Sync rules compile to a sync validator, async to an async one', () => {
		expect(Array.isArray(compileRules(EMAIL_RULES)('a@b.co'))).toBe(true);
		expect(compileRules({ "Async": async () => true })('x')).toBeInstanceOf(Promise);
		expect(Array.isArray(compileSchema({ email: EMAIL_RULES })({ email: 'a@b.co' }).email)).toBe(true);
		expect(compileSchema({ key: { "Async": async () => true } })({})).toBeInstanceOf(Promise);
	})

	test('Changing the rules after compiling has no effect', () => {
		const rules: Record<string, (i: unknown) => boolean> = { "Is string": (i) => typeof i === 'string' };
		const compiled = compileRules(rules);
		rules["Always fails"] = () => false;
		rules["Is string"] = () => false;
		expect(compiled('x')).toEqual([]);
	})

	test('Changing the schema after compiling has no effect', () => {
		const field: Record<string, (i: unknown) => boolean> = { "Is string": (i) => typeof i === 'string' };
		const schema: Record<string, typeof field> = { field };
		const compiled = compileSchema(schema, { strict: true });
		field["Always fails"] = () => false;
		schema['other'] = { "Always fails": () => false };
		expect(compiled({ field: 'x' })).toEqual({ field: [] });
		// The strict check also uses the keys from compile time
		expect(compiled({ field: 'x', other: 1 })).toEqual({ field: [], other: ['Key not allowed'] });
	})

	test('A compiled validator can be reused', () => {
		const compiled = compileRules(EMAIL_RULES);
		expect(compiled('nope')).toEqual(['Must be a valid email address']);
		expect(compiled('a@b.co')).toEqual([]);
		expect(compiled('nope')).toEqual(['Must be a valid email address']);
	})
})
