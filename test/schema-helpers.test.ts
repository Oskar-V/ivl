import { describe, test, expect } from 'bun:test'

import { getSchemaErrors } from '../src';
import { allowUndefined } from '../src/helpers'

describe('Test allowUndefined schema helper', () => {
	const passing_key_object = { incoming_key: "string" }
	const failing_key_object = { incoming_key: 123 }
	const undefined_key_object = { undefined_key: 'string' };


	test('Helper doesn\'t alter the underlying function type', async () => {
		const schema = {
			Sync: () => true,
			Async: async () => await Promise.resolve(true),
		};

		const result = allowUndefined(schema);

		// Check that function behavior remains unchanged
		expect(await result.Async()).toBe(await schema.Async());
		expect(result.Sync()).toBe(schema.Sync());

		// Check that async and sync functions retain their types
		expect(result.Async.constructor.name).toBe(schema.Async.constructor.name);
		expect(result.Sync.constructor.name).toBe(schema.Sync.constructor.name);
	});

	test('Undefined value on synchronous rules', () => {
		const schema = {
			incoming_key: allowUndefined({
				"Passes": () => true,
				"Fails": () => false,
				"Is string": (i: unknown) => typeof i === 'string',
			})
		}
		const i = getSchemaErrors(passing_key_object, schema);
		const j = getSchemaErrors(failing_key_object, schema);
		const k = getSchemaErrors(undefined_key_object, schema);

		// Make sure all functions ran as sync
		for (const func of [i, j, k]) {
			expect(func.constructor.name).not.toBe('Promise')
		}

		expect(i).toEqual({ incoming_key: ['Fails'] })
		expect(j).toEqual({ incoming_key: ['Fails', 'Is string'] })
		expect(k).toEqual({ incoming_key: [] })
	})

	test('Undefined value on asynchronous rules', async () => {
		const schema = {
			incoming_key: allowUndefined({
				"Passes": async () => await Promise.resolve(true),
				"Fails": async () => await Promise.resolve(false),
				"Rejects": async () => await Promise.reject(),
				"Is string": async (i: unknown) => await Promise.resolve(typeof i === 'string'),
			})
		};

		const i = getSchemaErrors(passing_key_object, schema);
		const j = getSchemaErrors(failing_key_object, schema);
		const k = getSchemaErrors(undefined_key_object, schema);


		// Make sure all functions ran as async
		for (const func of [i, j, k]) {
			expect(func.constructor.name).toBe('Promise');
		}

		const t = (await Promise.allSettled([i, j, k]))
		const answers = [
			['Fails', 'Rejects'],
			['Fails', 'Rejects', 'Is string'],
			[]
		]
		for (let idx = 0; idx < t.length; idx++) {
			expect(t[idx].status).toEqual("fulfilled");
			// @ts-ignore
			expect(t[idx].value).toEqual({ 'incoming_key': answers[idx] })
		}
	})
});
