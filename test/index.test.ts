import { describe, test, expect } from 'bun:test'

import { getValueErrors, getValueErrorsSync, getSchemaErrors, getSchemaErrorsSync, getValueErrorsAsync } from '../src';
import type { SCHEMA } from '../src/types';

describe('Successfully detect failing rules', () => {
	const passing_input = 'string';
	const failing_input = undefined;
	const conditional_rules = { "Is string": (i: unknown) => typeof i === 'string' }
	const passing_rules = { "Passes": () => true }
	const failing_rules = { "Fails": () => false }

	test('Smart rules running as async', async () => {
		const func = getValueErrors(passing_input, { "Async": async (i) => true });
		expect(func.constructor.name).toBe('Promise');
		expect(await func).toBeArray();
	})

	test('Smart rules running as sync', () => {
		const func = getValueErrors(passing_input, { "Sync": (i) => true });
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
});

describe('Successfully detect failing schemas', () => {
	const schema: SCHEMA = {
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
	const t = () => { throw Error() }
	const rules = { "Must match regex": t, }
	const schema = { username: rules, }
	test('Error inside simple async rule', async () => {
		expect(await getValueErrors(input_string, rules)).toEqual(Object.keys(rules))
	})
	test('Error inside simple sync rule', () => {
		expect(getValueErrorsSync(input_string, rules)).toEqual(Object.keys(rules))
	})
	test('Error inside simple async schema', async () => {
		expect(await getSchemaErrors(input_string, schema)).toEqual({ 'username': Object.keys(rules) })
	})
	test('Error inside simple sync schema', () => {
		expect(getSchemaErrorsSync(input_string, schema)).toEqual({ 'username': Object.keys(rules) })
	})
})