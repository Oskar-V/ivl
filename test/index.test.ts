import { describe, test, expect } from 'bun:test'

import { getValueErrors, getValueErrorsSync, getSchemaErrors, getSchemaErrorsSync, getValueErrorsAsync, getSchemaErrorsAsync } from '../src';
import type { SCHEMA, SCHEMA_SYNC, CHECKABLE_OBJECT } from '../src/types';

describe('Successfully detect failing rules', () => {
	const passing_input = 'string';
	const failing_input = 123;
	const conditional_rules = { "Is string": (i: unknown) => typeof i === 'string' }
	const passing_rules = { "Passes": () => true }
	const failing_rules = { "Fails": () => false }

	test('Smart rules running as async', async () => {
		const func = getValueErrors(passing_input, { "Async": async () => await Promise.resolve(true) });
		expect(func.constructor.name).toBe('Promise');
		expect(await func).toBeArray();
	})

	test('Smart rules running as sync', () => {
		const func = getValueErrors(passing_input, { "Sync": () => true });
		expect(func).toBeArray();
	});

	test('Async rules', async () => {
		expect(await getValueErrorsAsync(passing_input, passing_rules)).toEqual([]);
		expect(await getValueErrorsAsync(passing_input, failing_rules)).toEqual(Object.keys(failing_rules));
		expect(await getValueErrorsAsync(passing_input, conditional_rules)).toEqual([]);
		expect(await getValueErrorsAsync(failing_input, conditional_rules)).toEqual(Object.keys(conditional_rules));
	});

	test('Sync rules', () => {
		expect(getValueErrorsSync(passing_input, passing_rules)).toEqual([]);
		expect(getValueErrorsSync(passing_input, failing_rules)).toEqual(Object.keys(failing_rules));
		expect(getValueErrorsSync(passing_input, conditional_rules)).toEqual([]);
		expect(getValueErrorsSync(failing_input, conditional_rules)).toEqual(Object.keys(conditional_rules))
	});

	test('A rule returning a Promise fails the sync path instead of silently passing', () => {
		// Not declared `async`, so async detection can't see it - the sync path must fail
		// closed rather than treat the pending (truthy) Promise as a pass.
		const thenable_rules = {
			"Is string": ((i: unknown) => Promise.resolve(typeof i === 'string')) as unknown as (i: unknown) => boolean,
			"Resolves true": (() => Promise.resolve(true)) as unknown as () => boolean,
		};
		expect(getValueErrorsSync(failing_input, thenable_rules)).toEqual(['Is string', 'Resolves true']);
		const smart = getValueErrors(failing_input, thenable_rules);
		expect(smart.constructor.name).not.toBe('Promise');
		expect(smart).toEqual(['Is string', 'Resolves true']);
	});
});

describe('Successfully detect failing schemas', () => {
	const schema: SCHEMA_SYNC = {
		passing_key: {
			'passes': () => true,
			'conditional': (i) => typeof i === 'string'
		},
		failing_key: {
			'passes': () => true,
			'fails': () => false,
			'conditional': (i) => typeof i === 'string'
		},
	}
	const object = {
		passing_key: 'test',
		failing_key: 10,
		disallowed_key: 'test'
	}

	test('Async non-strict schema', async () => {
		const errors = await getSchemaErrors(object, schema);
		expect(errors).toEqual({
			passing_key: [],
			failing_key: ['fails', 'conditional'],
		})
	})

	test('Async strict schema', async () => {
		const errors = await getSchemaErrors(object, schema, { strict: true });
		expect(errors).toEqual({
			passing_key: [],
			failing_key: ['fails', 'conditional'],
			disallowed_key: ['Key not allowed']
		})
	})

	test('Sync non-strict schema', () => {
		const errors = getSchemaErrorsSync(object, schema);
		expect(errors).toEqual({
			passing_key: [],
			failing_key: ['fails', 'conditional'],
		})
	})

	test('Sync strict schema', () => {
		const errors = getSchemaErrorsSync(object, schema, { strict: true });
		expect(errors).toEqual({
			passing_key: [],
			failing_key: ['fails', 'conditional'],
			disallowed_key: ['Key not allowed']
		})
	})

	// Add tests to detect early breaking
});

describe("Gracefully handle errors inside developer functions", () => {
	const input_string = "";
	const rules = { "Will throw error": () => { throw Error('Self thrown') } }
	const schema = { username: rules, }
	test('Error inside simple async rule', async () => {
		expect(await getValueErrors(input_string, rules))
			.toEqual(Object.keys(rules))
	})
	test('Error inside simple sync rule', () => {
		expect(getValueErrorsSync(input_string, rules))
			.toEqual(Object.keys(rules))
	})
	test('Error inside simple async schema', async () => {
		expect(await getSchemaErrors(input_string as unknown as CHECKABLE_OBJECT, schema))
			.toEqual({ 'username': Object.keys(rules) })
	})
	test('Error inside simple sync schema', () => {
		expect(getSchemaErrorsSync(input_string as unknown as CHECKABLE_OBJECT, schema))
			.toEqual({ 'username': Object.keys(rules) })
	})
})

describe('acceptAny schema helper', () => {
	type t = { name?: any, email?: any };
	test('Accept different async schemas', async () => {
		const test_schema: SCHEMA = {
			user: [
				{
					'is a valid id': (i) => typeof i === 'number'
				},
				{
					'has a name': async (i) => {
						await Promise.resolve(false)
						return (i as t).name
					},
					'has an email': (i) => (i as t).email
				}
			]
		};

		expect(await getSchemaErrors({ user: 5 }, test_schema)).toEqual({ user: [] });
		expect(await getSchemaErrors({ user: { name: 'name', email: 'email' } }, test_schema)).toEqual({ user: [] });
		expect(await getSchemaErrors({ user: { email: 'email' } }, test_schema)).toEqual({ user: [['is a valid id'], ['has a name']] });
		expect(await getSchemaErrors({ user: 'name' }, test_schema)).toEqual({ user: [['is a valid id'], ['has a name', 'has an email']] });

	})
	test('Accept different sync schemas', () => {
		const test_schema: SCHEMA = {
			user: [
				{ "is a valid id": (i) => typeof i === 'number' },
				{
					'has a name': (i) => (i as t).name,
					'has an email': (i) => (i as t).email
				}
			]
		}
		expect(getSchemaErrors({ user: 5 }, test_schema)).toEqual({ user: [] });
		expect(getSchemaErrors({ user: { name: 'name', email: 'email' } }, test_schema)).toEqual({ user: [] });
		expect(getSchemaErrors({ user: { email: 'email' } }, test_schema)).toEqual({ user: [['is a valid id'], ['has a name']] });
		expect(getSchemaErrors({ user: 'name' }, test_schema)).toEqual({ user: [['is a valid id'], ['has a name', 'has an email']] });
	})
})
describe('Execution semantics', () => {
	const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

	test('Errors follow rule order when sync and async rules are mixed', async () => {
		const rules = {
			"First": () => false,
			"Second (slow async)": async () => { await delay(5); return false },
			"Third": () => false,
			"Fourth (fast async)": async () => false,
			"Passes": () => true,
		};
		const expected = ['First', 'Second (slow async)', 'Third', 'Fourth (fast async)'];
		expect(await getValueErrors(null, rules)).toEqual(expected);
		expect(await getValueErrorsAsync(null, rules)).toEqual(expected);
	})

	test('The async path awaits a plain rule that returns a promise', async () => {
		const rules = {
			"Resolves true": (() => Promise.resolve(true)) as unknown as () => boolean,
			"Resolves false": (() => Promise.resolve(false)) as unknown as () => boolean,
			"Rejects": (() => Promise.reject(new Error('nope'))) as unknown as () => boolean,
		};
		expect(await getValueErrorsAsync(null, rules)).toEqual(['Resolves false', 'Rejects']);
	})

	test('A rejecting async rule fails without failing the others', async () => {
		const rules = {
			"Rejects": async () => { throw new Error('nope') },
			"Passes": async () => true,
		};
		expect(await getValueErrorsAsync(null, rules)).toEqual(['Rejects']);
	})

	test('Overload arguments reach every rule on every path', async () => {
		const sync_rules = { "Matches context": (i: unknown, expected: unknown) => i === expected };
		const async_rules = { "Matches context": async (i: unknown, expected: unknown) => i === expected };
		expect(getValueErrorsSync('a', sync_rules, 'a')).toEqual([]);
		expect(getValueErrorsSync('a', sync_rules, 'b')).toEqual(['Matches context']);
		expect(getValueErrors('a', sync_rules, 'b')).toEqual(['Matches context']);
		expect(await getValueErrorsAsync('a', sync_rules, 'a')).toEqual([]);
		expect(await getValueErrors('a', async_rules, 'b')).toEqual(['Matches context']);
		expect(getSchemaErrorsSync({ key: 'a' }, { key: sync_rules }, {}, 'a')).toEqual({ key: [] });
		expect(await getSchemaErrorsAsync({ key: 'a' }, { key: async_rules }, {}, 'b')).toEqual({ key: ['Matches context'] });
		expect(await getSchemaErrors({ key: 'a' }, { key: [async_rules, sync_rules] }, {}, 'b')).toEqual({ key: [['Matches context'], ['Matches context']] });
	})

	test('Async schemas with sync and async fields report every field', async () => {
		const schema = {
			sync_field: { "Is string": (i: unknown) => typeof i === 'string' },
			async_field: { "Is number": async (i: unknown) => typeof i === 'number' },
			alternatives: [
				{ "Is slow true": async (i: unknown) => { await delay(5); return i === true } },
				{ "Is null": (i: unknown) => i === null },
			],
		};
		expect(await getSchemaErrors({ sync_field: 's', async_field: 1, alternatives: null }, schema))
			.toEqual({ sync_field: [], async_field: [], alternatives: [] });
		expect(await getSchemaErrors({ sync_field: 1, async_field: 's', alternatives: 's' }, schema))
			.toEqual({ sync_field: ['Is string'], async_field: ['Is number'], alternatives: [['Is slow true'], ['Is null']] });
	})

	test('Rules inherited through the prototype are ignored, like before', () => {
		const base = { "Inherited fails": () => false };
		const rules = Object.assign(Object.create(base), { "Own passes": () => true });
		expect(getValueErrorsSync(null, rules)).toEqual([]);
		expect(getValueErrors(null, rules)).toEqual([]);
	})
})
