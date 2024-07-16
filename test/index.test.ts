import { describe, test, expect } from 'bun:test'
import { getValueErrors, getValueErrorsSync, getSchemaErrors, getSchemaErrorsSync } from '../src';
import { matchesRegex } from '../src/helpers'
import { EMAIL_PATTERN } from '../src/patterns';

describe("Regex helper", () => {
	const valid_email = "valid@email.com";
	const invalid_email = "invalid.email@com"
	const non_strings = [
		1,
		null,
		undefined,
		{},
		[], // "typeof []"" crashes bun test runner when used with test.each()
		NaN,
		true,
		() => { }
	]
	non_strings.forEach((e) => console.log(e, typeof e));

	test("Passes valid email", () => {
		expect(matchesRegex(EMAIL_PATTERN).call(undefined, valid_email)).toBe(true)
	})

	test("Fails invalid email", () => {
		expect(matchesRegex(EMAIL_PATTERN).call(undefined, invalid_email)).toBe(false)
	})

	non_strings.forEach((i) => {
		test(`Fails non-string ${typeof i}, ${i}`, () => {
			expect(matchesRegex(EMAIL_PATTERN).call(undefined, i)).toBe(false);
		}, 100)
	})
});

describe("Gracefully handle errors inside developer functions", () => {
	const t = (i: string) => { throw Error(i) }
	const input_rules = {
		"Must match regex": t,
	}
	const schema = {
		username: input_rules,
	}
	test('Error inside simple async rule', async () => {
		expect(await getValueErrors('some-input', input_rules)).toEqual(Object.keys(input_rules))
	})
	test('Error inside simple sync rule', () => {
		expect(getValueErrorsSync('some-input', input_rules)).toEqual(Object.keys(input_rules))
	})
	test('Error inside simple async schema', async () => {
		expect(await getSchemaErrors('some-input', schema)).toEqual({ 'username': Object.keys(input_rules) })
	})
	test('Error inside simple sync schema', () => {
		expect(getSchemaErrorsSync('some-input', schema)).toEqual({ 'username': Object.keys(input_rules) })
	})
})