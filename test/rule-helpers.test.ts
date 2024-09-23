import { describe, test, expect } from 'bun:test'

import { matchesRegex, maxLength, minLength, max, min, stringBetween, numberBetween, acceptAnySync } from '../src/helpers'
import { EMAIL_PATTERN } from '../src/patterns';
import { getValueErrors } from '../src';

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
	test("Passes valid email", () => {
		expect(matchesRegex(EMAIL_PATTERN)(valid_email)).toBe(true)
	})

	test("Fails invalid email", () => {
		expect(matchesRegex(EMAIL_PATTERN)(invalid_email)).toBe(false)
	})

	non_strings.forEach((i) => {
		test(`Fails non-string ${typeof i}`, () => {
			expect(matchesRegex(EMAIL_PATTERN)(i)).toBe(false);
		}, 100)
	})
});

describe('max length helper', () => {
	test('Passes maxLength', () => {
		expect(maxLength(Infinity)("test_string")).toBe(true);
	})

	test('Fails maxLength properly', () => {
		expect(maxLength(0)("test_string")).toBe(false);
	})

	test('Fails for a value without length property', () => {
		expect(maxLength(0)(0)).toBe(false);
	})
});

describe('min length helper', () => {
	test('Passes minLength', () => {
		expect(minLength(0)("test_string")).toBe(true);
	})

	test('Fails minLength properly', () => {
		expect(minLength(Infinity)("test_string")).toBe(false);
	})

	test('Fails for a value without length property', () => {
		expect(minLength(0)(0)).toBe(false);
	})
});

describe('max value helper', () => {
	test('Passes max properly', () => {
		expect(max(10)(5)).toBe(true);
	})
	test('Fails max properly', () => {
		expect(max(5)(10)).toBe(false);
	})
	test('Fails invalid input', () => {
		expect(max(10)('test')).toBe(false);
	})
})

describe('min value helper', () => {
	test('Passes min properly', () => {
		expect(min(5)(10)).toBe(true);
	})
	test('Fails min properly', () => {
		expect(min(10)(5)).toBe(false);
	})
	test('Fails invalid input', () => {
		expect(min(5)('test')).toBe(false);
	})
});

describe('numberBetween helper', () => {
	test('Passes lower value properly', () => {
		expect(numberBetween(10)(2)).toBe(true);
	})
	test('Passes higher value properly', () => {
		expect(numberBetween(10, 1)(2)).toBe(true);
	})
	test('Fails higher value properly', () => {
		expect(numberBetween(10)(11)).toBe(false);
	})
	test('Fails lower value properly', () => {
		expect(numberBetween(10, 5)(1)).toBe(false);
	})
	test('Fails any value for wrong input', () => {
		const values = [-Infinity, 0, Infinity];
		for (let i = 0; i < 20; i++) {
			values.push(Math.random() * 2e9 - 1e9);
		}
		values.forEach((v) => expect(numberBetween(-Infinity, Infinity)(v)).toBe(false))
	})
});

describe('stringBetween helper', () => {
	test('Passes lower value properly', () => {
		expect(stringBetween(10)("string")).toBe(true);
	})
	test('Passes higher value properly', () => {
		expect(stringBetween(10, 1)("string")).toBe(true);
	})
	test('Fails higher value properly', () => {
		expect(stringBetween(10)(11)).toBe(false);
	})
	test('Fails lower value properly', () => {
		expect(stringBetween(10, 5)(1)).toBe(false);
	})
	test('Fails any value for wrong input', () => {
		const values = [-Infinity, 0, Infinity];
		for (let i = 0; i < 20; i++) {
			values.push(Math.random() * 2e9 - 1e9);
		}
		values.forEach((v) => expect(stringBetween(-Infinity, Infinity)(v)).toBe(false))
	})
});

describe('acceptAny rules helper', () => {
	test('Accepts different async rules', () => {
		// TODO implement properly in the future
	})
	test('Accept different sync rules', () => {
		const rules = {
			'Can\'t be 3': acceptAnySync([max(2), min(4)])
		}
		expect(getValueErrors(1, rules)).toBeArrayOfSize(0);
		expect(getValueErrors(3, rules)).toBeArrayOfSize(1);
		expect(getValueErrors('1', rules)).toBeArrayOfSize(1);
	})
})


