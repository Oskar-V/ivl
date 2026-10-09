// Ready-made rule sets built from the patterns, for use directly as schema entries:
//   getSchemaErrors(input, { email: EMAIL_RULES, id: UUID_RULES })
// Every rule set is synchronous, so it keeps getValueErrors/getSchemaErrors on the sync path.
// They are frozen; extend or trim them by spreading into a new object:
//   { ...PASSWORD_RULES, "Must not contain the username": (i, username) => ... }
// Annotated as RULES_SYNC rather than inferred, because JSR rejects inferred export types.

import type { RULES_SYNC } from '../types';
import { isType, matchesRegex, maxLength, minLength } from '../helpers/rules';
import {
	EMAIL_PATTERN,
	URL_PATTERN,
	UUID_PATTERN,
	UUID_V4_PATTERN,
	IPV4_PATTERN,
	IPV6_PATTERN,
	MAC_ADDRESS_PATTERN,
	HEX_COLOR_PATTERN,
	SLUG_PATTERN,
	E164_PHONE_PATTERN,
	SEMVER_PATTERN,
	BASE64_PATTERN,
	JWT_PATTERN,
	ISO_8601_DATE_PATTERN,
	ISO_8601_DATETIME_PATTERN_STRICT,
	ISO_8601_TIME_PATTERN,
	CONTAINS_LOWERCASE_CHARACTER_PATTERN,
	CONTAINS_UPPERCASE_CHARACTER_PATTERN,
	CONTAINS_DIGIT_CHARACTER_PATTERN,
	CONTAINS_SYMBOL_CHARACTER_PATTERN,
} from './patterns';

const MUST_BE_STRING = 'Must be a string';

/** A string rule set: a type check followed by a single format check. */
const formatRules = (message: string, pattern: RegExp): Readonly<RULES_SYNC> =>
	Object.freeze({
		[MUST_BE_STRING]: isType('string'),
		[message]: matchesRegex(pattern),
	});

// The date patterns only check digit shapes, and Date.parse rolls invalid days over
// ("2024-02-31" becomes March 2nd), so the calendar is checked by round-tripping the parts.
const isCalendarDate = (year: number, month: number, day: number): boolean => {
	const date = new Date(0);
	date.setUTCFullYear(year, month - 1, day);
	return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const isRealDate = (value: string): boolean => {
	const [year, month, day] = value.slice(0, 10).split('-').map(Number) as [number, number, number];
	return isCalendarDate(year, month, day);
}

// The strict datetime pattern allows hours 00-29 in both the time and the offset
const OFFSET_HOUR = /([+-])(\d\d):\d\d$/;
const isRealDateTime = (value: string): boolean => {
	const offset_hour = OFFSET_HOUR.exec(value.slice(19))?.[2];
	return isRealDate(value) &&
		Number(value.slice(11, 13)) < 24 &&
		(offset_hour === undefined || Number(offset_hour) < 24);
}

// RFC 5321 §4.5.3.1.3 caps a forward-path at 256 octets including the surrounding "<>"
const EMAIL_MAX_LENGTH = 254;
// Long passwords are a hashing DoS vector; 128 leaves plenty of room for passphrases
const PASSWORD_MAX_LENGTH = 128;

export const EMAIL_RULES: Readonly<RULES_SYNC> = Object.freeze({
	[MUST_BE_STRING]: isType('string'),
	[`Must be at most ${EMAIL_MAX_LENGTH} characters`]: maxLength(EMAIL_MAX_LENGTH),
	'Must be a valid email address': matchesRegex(EMAIL_PATTERN),
});

export const URL_RULES: Readonly<RULES_SYNC> = formatRules('Must be a valid URL', URL_PATTERN);
export const UUID_RULES: Readonly<RULES_SYNC> = formatRules('Must be a valid UUID', UUID_PATTERN);
export const UUID_V4_RULES: Readonly<RULES_SYNC> = formatRules('Must be a valid version 4 UUID', UUID_V4_PATTERN);
export const IPV4_RULES: Readonly<RULES_SYNC> = formatRules('Must be a valid IPv4 address', IPV4_PATTERN);
export const IPV6_RULES: Readonly<RULES_SYNC> = formatRules('Must be a valid IPv6 address', IPV6_PATTERN);
export const MAC_ADDRESS_RULES: Readonly<RULES_SYNC> = formatRules('Must be a valid MAC address', MAC_ADDRESS_PATTERN);
export const HEX_COLOR_RULES: Readonly<RULES_SYNC> = formatRules('Must be a valid hex color', HEX_COLOR_PATTERN);
export const SLUG_RULES: Readonly<RULES_SYNC> = formatRules('Must be a valid slug', SLUG_PATTERN);
export const E164_PHONE_RULES: Readonly<RULES_SYNC> = formatRules('Must be a valid E.164 phone number', E164_PHONE_PATTERN);
export const SEMVER_RULES: Readonly<RULES_SYNC> = formatRules('Must be a valid semantic version', SEMVER_PATTERN);
export const BASE64_RULES: Readonly<RULES_SYNC> = formatRules('Must be valid base64', BASE64_PATTERN);
export const JWT_RULES: Readonly<RULES_SYNC> = formatRules('Must be a valid JWT', JWT_PATTERN);
export const ISO_8601_TIME_RULES: Readonly<RULES_SYNC> = formatRules('Must be a valid ISO 8601 time', ISO_8601_TIME_PATTERN);

export const ISO_8601_DATE_RULES: Readonly<RULES_SYNC> = Object.freeze({
	[MUST_BE_STRING]: isType('string'),
	'Must be a valid ISO 8601 date': (i: unknown) =>
		typeof i === 'string' && ISO_8601_DATE_PATTERN.test(i) && isRealDate(i),
});

export const ISO_8601_DATETIME_RULES: Readonly<RULES_SYNC> = Object.freeze({
	[MUST_BE_STRING]: isType('string'),
	'Must be a valid ISO 8601 date and time': (i: unknown) =>
		typeof i === 'string' && ISO_8601_DATETIME_PATTERN_STRICT.test(i) && isRealDateTime(i),
});

export const PASSWORD_RULES: Readonly<RULES_SYNC> = Object.freeze({
	[MUST_BE_STRING]: isType('string'),
	'Must be at least 8 characters': minLength(8),
	[`Must be at most ${PASSWORD_MAX_LENGTH} characters`]: maxLength(PASSWORD_MAX_LENGTH),
	'Must contain at least one lower case character': matchesRegex(CONTAINS_LOWERCASE_CHARACTER_PATTERN),
	'Must contain at least one upper case character': matchesRegex(CONTAINS_UPPERCASE_CHARACTER_PATTERN),
});

export const STRONG_PASSWORD_RULES: Readonly<RULES_SYNC> = Object.freeze({
	...PASSWORD_RULES,
	'Must contain at least one digit': matchesRegex(CONTAINS_DIGIT_CHARACTER_PATTERN),
	'Must contain at least one symbol': matchesRegex(CONTAINS_SYMBOL_CHARACTER_PATTERN),
});
