import { describe, test, expect } from 'bun:test'

import { getSchemaErrors, getSchemaErrorsSync, getSchemaErrorsAsync, compileRules, compileSchema } from '../src';
import type { RULES, SCHEMA, CHECKABLE_OBJECT } from '../src';
import { EMAIL_RULES, STRONG_PASSWORD_RULES, IPV4_RULES, IPV6_RULES } from '../src/patterns';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Wraps a rule so the test can see whether it was called
const counted = <F extends (...args: never[]) => unknown>(rule: F) => {
	const wrapped = ((...args: Parameters<F>) => { wrapped.calls++; return rule(...args) }) as F & { calls: number };
	wrapped.calls = 0;
	return wrapped;
}
const countedAsync = (rule: (i: unknown) => Promise<boolean>) => {
	const wrapped = Object.assign(async (i: unknown) => { wrapped.calls++; return rule(i) }, { calls: 0 });
	return wrapped;
}

describe('break_early is off by default', () => {
	test('Every failing rule is reported', () => {
		expect(compileRules(STRONG_PASSWORD_RULES)('short')).toEqual([
			'Must be at least 8 characters',
			'Must contain at least one upper case character',
			'Must contain at least one digit',
			'Must contain at least one symbol',
		]);
		expect(getSchemaErrors({ password: 'short' }, { password: STRONG_PASSWORD_RULES }).password).toHaveLength(4);
	})
})

describe('break_early with sync rules', () => {
	test('Reports only the first failure and skips the remaining rules', () => {
		const later = counted((_: unknown) => false);
		const rules = { "First passes": () => true, "Second fails": () => false, "Third fails": later };
		expect(compileRules(rules, { break_early: true })(null)).toEqual(['Second fails']);
		expect(getSchemaErrorsSync({ key: null }, { key: rules }, { break_early: true })).toEqual({ key: ['Second fails'] });
		expect(later.calls).toBe(0);
	})

	test('A throwing rule counts as the first failure', () => {
		const rules = { "Throws": () => { throw new Error('boom') }, "Fails": () => false };
		expect(compileRules(rules, { break_early: true })(null)).toEqual(['Throws']);
	})

	test('Valid input still passes every rule', () => {
		expect(compileRules(STRONG_PASSWORD_RULES, { break_early: true })('Passw0rd!')).toEqual([]);
	})

	test('Cheap rules first avoid the expensive ones on bad input', () => {
		const expensive = counted((i: unknown) => typeof i === 'string' && /^[a-z]+$/.test(i));
		const rules = { "Too long": (i: unknown) => typeof i === 'string' && i.length <= 10, "Lowercase only": expensive };
		expect(compileRules(rules, { break_early: true })('x'.repeat(10_000))).toEqual(['Too long']);
		expect(expensive.calls).toBe(0);
	})
})

describe('break_early with async rules', () => {
	test('A failing sync rule skips every async rule, wherever it is in the set', () => {
		const lookup = countedAsync(async () => true);
		const rules = {
			"Already registered": lookup, // before the sync rule in key order, still skipped
			...EMAIL_RULES,
		};
		return compileRules(rules, { break_early: true })('not an email').then((errors) => {
			expect(errors).toEqual(['Must be a valid email address']);
			expect(lookup.calls).toBe(0);
		});
	})

	test('If every sync rule passes, async rules run and the first failure in rule order is reported', async () => {
		const rules: RULES = {
			"Is string": (i) => typeof i === 'string',
			"Slow, fails": async () => { await delay(5); return false },
			"Fast, fails": async () => false,
			"Passes": async () => true,
		};
		expect(await compileRules(rules, { break_early: true })('x')).toEqual(['Slow, fails']);
		expect(await getSchemaErrors({ key: 'x' }, { key: rules }, { break_early: true })).toEqual({ key: ['Slow, fails'] });
	})

	test('Async rules run concurrently', async () => {
		const rules = {
			"A": async () => { await delay(20); return true },
			"B": async () => { await delay(20); return true },
			"C": async () => { await delay(20); return true },
		};
		const start = performance.now();
		expect(await compileRules(rules, { break_early: true })(null)).toEqual([]);
		expect(performance.now() - start).toBeLessThan(55);
	})

	test('A rejecting async rule counts as a failure', async () => {
		const rules = { "Rejects": async () => { throw new Error('nope') }, "Passes": async () => true };
		expect(await compileRules(rules, { break_early: true })(null)).toEqual(['Rejects']);
	})

	test('A plain rule returning a promise is awaited like an async rule', async () => {
		const rules = {
			"Resolves false": (() => Promise.resolve(false)) as unknown as () => boolean,
			"Passes": () => true,
		};
		expect(await getSchemaErrorsAsync({ key: null }, { key: rules }, { break_early: true })).toEqual({ key: ['Resolves false'] });
	})

	test('A started promise is abandoned cleanly when a later sync rule fails', async () => {
		const rules = {
			"Rejects later": (() => delay(1).then(() => Promise.reject(new Error('ignored')))) as unknown as () => boolean,
			"Fails now": () => false,
		};
		expect(await getSchemaErrorsAsync({ key: null }, { key: rules }, { break_early: true })).toEqual({ key: ['Fails now'] });
		// Give the abandoned promise time to reject; an unhandled rejection would fail the test run
		await delay(5);
	})
})

describe('break_early in schemas', () => {
	const schema = {
		email: EMAIL_RULES,
		password: STRONG_PASSWORD_RULES,
		ip: [IPV4_RULES, IPV6_RULES],
	};

	test('Applies per field: every field is still reported', () => {
		expect(getSchemaErrors({ email: 1, password: 'short', ip: 'nope' }, schema, { break_early: true })).toEqual({
			email: ['Must be a string'],
			password: ['Must be at least 8 characters'],
			ip: [['Must be a valid IPv4 address'], ['Must be a valid IPv6 address']],
		});
	})

	test('Works together with strict', () => {
		expect(getSchemaErrors({ email: 'a@b.co', password: 'Passw0rd!', ip: '::1', extra: 1 }, schema, { break_early: true, strict: true }))
			.toEqual({ email: [], password: [], ip: [], extra: ['Key not allowed'] });
	})

	test('Compiled schemas give the same results', async () => {
		const async_schema = { ...schema, email: { ...EMAIL_RULES, "Already registered": async (i: unknown) => i !== 'taken@b.co' } };
		const inputs: CHECKABLE_OBJECT[] = [
			{ email: 'a@b.co', password: 'Passw0rd!', ip: '::1' },
			{ email: 'taken@b.co', password: 'short', ip: 'nope', extra: true },
			{ email: 1 },
			{},
		];
		for (const s of [schema, async_schema] as SCHEMA[]) {
			for (const options of [{ break_early: true }, { break_early: true, strict: true }]) {
				const compiled = compileSchema(s, options);
				for (const input of inputs) {
					expect(await compiled(input)).toEqual(await getSchemaErrors(input, s, options));
				}
			}
		}
	})
})
