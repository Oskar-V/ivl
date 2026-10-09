import { describe, test, expect } from 'bun:test'

import { getValueErrors, getSchemaErrors } from '../src';
import type { RULES_SYNC } from '../src';
import { allowUndefined } from '../src/helpers';
import {
	EMAIL_RULES,
	URL_RULES,
	UUID_RULES,
	UUID_V4_RULES,
	IPV4_RULES,
	IPV6_RULES,
	MAC_ADDRESS_RULES,
	HEX_COLOR_RULES,
	SLUG_RULES,
	E164_PHONE_RULES,
	SEMVER_RULES,
	BASE64_RULES,
	JWT_RULES,
	ISO_8601_DATE_RULES,
	ISO_8601_DATETIME_RULES,
	ISO_8601_TIME_RULES,
	PASSWORD_RULES,
	STRONG_PASSWORD_RULES,
} from '../src/patterns';

const NON_STRINGS = [1, null, undefined, {}, [], true];

// `invalid` maps an input to the exact errors it should produce, so each rule's message is pinned
const testRuleSet = (name: string, rules: Readonly<RULES_SYNC>, valid: string[], invalid: [string, string[]][]) => {
	describe(name, () => {
		test('Is frozen', () => {
			expect(Object.isFrozen(rules)).toBe(true);
		})

		test('Runs synchronously', () => {
			expect(Array.isArray(getValueErrors(valid[0], rules))).toBe(true);
		})

		valid.forEach((i) => {
			test(`Passes "${i}"`, () => {
				expect(getValueErrors(i, rules)).toEqual([]);
			})
		})

		invalid.forEach(([i, errors]) => {
			test(`Fails "${i}"`, () => {
				expect(getValueErrors(i, rules)).toEqual(errors);
			})
		})

		NON_STRINGS.forEach((i) => {
			test(`Fails non-string ${JSON.stringify(i) ?? String(i)}`, () => {
				expect(getValueErrors(i, rules)).toContain('Must be a string');
			})
		})
	})
}

testRuleSet('Email rule set', EMAIL_RULES,
	['a@b.co', 'first.last+tag@sub.example.org'],
	[
		['not-an-email', ['Must be a valid email address']],
		[`${'a'.repeat(250)}@b.co`, ['Must be at most 254 characters']],
		[`${'a'.repeat(260)}@b`, ['Must be at most 254 characters', 'Must be a valid email address']],
	])

testRuleSet('URL rule set', URL_RULES,
	['https://example.com', 'example.com/path'],
	[['https://example', ['Must be a valid URL']]])

testRuleSet('UUID rule set', UUID_RULES,
	['123e4567-e89b-12d3-a456-426614174000'],
	[['123e4567e89b12d3a456426614174000', ['Must be a valid UUID']]])

testRuleSet('UUID v4 rule set', UUID_V4_RULES,
	['c73bcdcc-2669-4bf6-81d3-e4ae73fb11fd'],
	[['123e4567-e89b-12d3-a456-426614174000', ['Must be a valid version 4 UUID']]])

testRuleSet('IPv4 rule set', IPV4_RULES,
	['192.168.1.1'],
	[['256.0.0.1', ['Must be a valid IPv4 address']]])

testRuleSet('IPv6 rule set', IPV6_RULES,
	['::1', '2001:db8::8a2e:370:7334'],
	[['2001:db8::85a3::7334', ['Must be a valid IPv6 address']]])

testRuleSet('MAC address rule set', MAC_ADDRESS_RULES,
	['00:1A:2B:3C:4D:5E'],
	[['00:1a-2b:3c-4d:5e', ['Must be a valid MAC address']]])

testRuleSet('Hex color rule set', HEX_COLOR_RULES,
	['#fff', '#FF0000aa'],
	[['fff', ['Must be a valid hex color']]])

testRuleSet('Slug rule set', SLUG_RULES,
	['hello-world'],
	[['Hello World', ['Must be a valid slug']]])

testRuleSet('E.164 phone rule set', E164_PHONE_RULES,
	['+15555550123'],
	[['5555550123', ['Must be a valid E.164 phone number']]])

testRuleSet('Semver rule set', SEMVER_RULES,
	['1.0.0-rc.1+build.123'],
	[['v1.2.3', ['Must be a valid semantic version']]])

testRuleSet('Base64 rule set', BASE64_RULES,
	['aGVsbG8='],
	[['aGVsbG8', ['Must be valid base64']]])

testRuleSet('JWT rule set', JWT_RULES,
	['eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'],
	[['eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0', ['Must be a valid JWT']]])

testRuleSet('ISO 8601 time rule set', ISO_8601_TIME_RULES,
	['23:59:59Z'],
	[['24:00:00', ['Must be a valid ISO 8601 time']]])

testRuleSet('ISO 8601 date rule set', ISO_8601_DATE_RULES,
	[
		'2024-01-01',
		'2024-02-29', // leap year
		'2000-02-29', // divisible by 400 is a leap year
	],
	[
		['2024-02-30', ['Must be a valid ISO 8601 date']],
		['2023-02-29', ['Must be a valid ISO 8601 date']], // not a leap year
		['1900-02-29', ['Must be a valid ISO 8601 date']], // divisible by 100 but not 400
		['2024-04-31', ['Must be a valid ISO 8601 date']], // April has 30 days
		['2024-13-01', ['Must be a valid ISO 8601 date']],
		['2024-1-1', ['Must be a valid ISO 8601 date']],
	])

testRuleSet('ISO 8601 datetime rule set', ISO_8601_DATETIME_RULES,
	[
		'2024-01-01T12:00:00Z',
		'2024-02-29T23:59:59.999+05:30',
		'2024-01-01T00:00:00', // offset is optional
	],
	[
		['2024-02-30T12:00:00Z', ['Must be a valid ISO 8601 date and time']], // impossible date
		['2024-01-01T24:00:00Z', ['Must be a valid ISO 8601 date and time']], // hour out of range
		['2024-01-01T12:00:00+25:00', ['Must be a valid ISO 8601 date and time']], // offset out of range
		['2024-19-39T12:00:00Z', ['Must be a valid ISO 8601 date and time']],
		['2024-01-01', ['Must be a valid ISO 8601 date and time']],
	])

testRuleSet('Password rule set', PASSWORD_RULES,
	['Password', 'longerPASSPHRASE with spaces'],
	[
		['Short1', ['Must be at least 8 characters']],
		['alllowercase', ['Must contain at least one upper case character']],
		['ALLUPPERCASE', ['Must contain at least one lower case character']],
		['12345678', ['Must contain at least one lower case character', 'Must contain at least one upper case character']],
		[`Aa${'x'.repeat(127)}`, ['Must be at most 128 characters']],
	])

testRuleSet('Strong password rule set', STRONG_PASSWORD_RULES,
	['Passw0rd!'],
	[
		['Password', ['Must contain at least one digit', 'Must contain at least one symbol']],
		['Passw0rd', ['Must contain at least one symbol']],
		['aB1!', ['Must be at least 8 characters']],
	])

describe('Using rule sets', () => {
	test('Strong password rule set contains every password rule', () => {
		for (const key of Object.keys(PASSWORD_RULES)) {
			expect(STRONG_PASSWORD_RULES).toHaveProperty([key]);
		}
	})

	test('Rule sets cannot be mutated', () => {
		expect(() => { (EMAIL_RULES as RULES_SYNC)['Always fails'] = () => false }).toThrow();
		expect(getValueErrors('a@b.co', EMAIL_RULES)).toEqual([]);
	})

	test('Rule sets can be extended by spreading', () => {
		const rules = {
			...EMAIL_RULES,
			'Must be a company address': (i: unknown) => typeof i === 'string' && i.endsWith('@example.com'),
		};
		expect(getValueErrors('a@example.com', rules)).toEqual([]);
		expect(getValueErrors('a@b.co', rules)).toEqual(['Must be a company address']);
	})

	test('Rule sets work as schema entries, including alternatives and wrappers', () => {
		const schema = {
			email: EMAIL_RULES,
			password: STRONG_PASSWORD_RULES,
			ip: [IPV4_RULES, IPV6_RULES],
			website: allowUndefined(URL_RULES),
		};

		const valid = getSchemaErrors({ email: 'a@b.co', password: 'Passw0rd!', ip: '::1' }, schema);
		expect(Array.isArray(valid.email)).toBe(true); // sync result, not a promise
		expect(valid).toEqual({ email: [], password: [], ip: [], website: [] });

		const invalid = getSchemaErrors({ email: 'nope', password: 'Passw0rd', ip: 'nope', website: 'nope' }, schema);
		expect(invalid).toEqual({
			email: ['Must be a valid email address'],
			password: ['Must contain at least one symbol'],
			ip: [['Must be a valid IPv4 address'], ['Must be a valid IPv6 address']],
			website: ['Must be a valid URL'],
		});
	})
})
