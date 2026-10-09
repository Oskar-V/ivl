import { describe, test, expect } from 'bun:test'

import {
	UUID_PATTERN,
	UUID_V4_PATTERN,
	IPV4_PATTERN,
	IPV6_PATTERN,
	MAC_ADDRESS_PATTERN,
	HEX_COLOR_PATTERN,
	SLUG_PATTERN,
	E164_PHONE_PATTERN,
	ISO_8601_DATE_PATTERN,
	SEMVER_PATTERN,
	BASE64_PATTERN,
	JWT_PATTERN,
	EMAIL_PATTERN,
	URL_PATTERN,
	MYSQL_TIMESTAMP_PATTERN,
	ISO_8601_DATETIME_PATTERN_STRICT,
	ISO_8601_DATETIME_PATTERN,
	ISO_8601_TIME_PATTERN,
	CONTAINS_LOWERCASE_CHARACTER_PATTERN,
	CONTAINS_UPPERCASE_CHARACTER_PATTERN,
	CONTAINS_DIGIT_CHARACTER_PATTERN,
	CONTAINS_SYMBOL_CHARACTER_PATTERN,
} from '../src/patterns';

// `known_gaps` are inputs the pattern currently accepts but shouldn't. They run as
// test.failing, so fixing the pattern turns them red as a reminder to move them to `invalid`.
const testPattern = (name: string, pattern: RegExp, valid: string[], invalid: string[], known_gaps: string[] = []) => {
	describe(name, () => {
		valid.forEach((i) => {
			test(`Passes "${i}"`, () => {
				expect(pattern.test(i)).toBe(true)
			})
		})
		invalid.forEach((i) => {
			test(`Fails "${i}"`, () => {
				expect(pattern.test(i)).toBe(false)
			})
		})
		known_gaps.forEach((i) => {
			test.failing(`Known gap: should fail "${i}"`, () => {
				expect(pattern.test(i)).toBe(false)
			})
		})
	})
}

testPattern('UUID pattern', UUID_PATTERN,
	[
		'123e4567-e89b-12d3-a456-426614174000',
		'C73BCDCC-2669-4BF6-81D3-E4AE73FB11FD',
		'00000000-0000-1000-8000-000000000000',
		'00000000-0000-0000-0000-000000000000', // nil UUID, RFC 9562 §5.9
		'ffffffff-ffff-ffff-ffff-ffffffffffff', // max UUID, RFC 9562 §5.10
	],
	[
		'123e4567-e89b-12d3-a456-42661417400', // too short
		'123e4567e89b12d3a456426614174000', // missing dashes
		'g23e4567-e89b-12d3-a456-426614174000', // non-hex character
		'123e4567-e89b-02d3-a456-426614174000', // invalid version 0
		'',
	])

testPattern('UUID v4 pattern', UUID_V4_PATTERN,
	[
		'c73bcdcc-2669-4bf6-81d3-e4ae73fb11fd',
		'C73BCDCC-2669-4BF6-A1D3-E4AE73FB11FD',
	],
	[
		'123e4567-e89b-12d3-a456-426614174000', // version 1
		'c73bcdcc-2669-4bf6-c1d3-e4ae73fb11fd', // invalid variant
		'',
	])

testPattern('IPv4 pattern', IPV4_PATTERN,
	[
		'0.0.0.0',
		'127.0.0.1',
		'192.168.1.1',
		'255.255.255.255',
	],
	[
		'256.0.0.1', // octet out of range
		'1.2.3', // too few octets
		'1.2.3.4.5', // too many octets
		'01.2.3.4', // leading zero
		'1.2.3.4 ', // trailing whitespace
		'',
	])

testPattern('IPv6 pattern', IPV6_PATTERN,
	[
		'2001:0db8:85a3:0000:0000:8a2e:0370:7334',
		'2001:db8:85a3::8a2e:370:7334',
		'::1',
		'::',
		'fe80::1',
		'::ffff:192.168.1.1', // IPv4-mapped, RFC 4291 §2.5.5.2
		'::ffff:0:255.255.255.255', // IPv4-translated
		'64:ff9b::192.0.2.33', // IPv4-embedded (NAT64)
	],
	[
		'2001:0db8:85a3:0000:0000:8a2e:0370:7334:1234', // too many groups
		'2001:db8::85a3::7334', // double "::"
		'2001:db8:85a3:0000:0000:8a2e:0370:g334', // non-hex character
		'1.2.3.4',
		'::ffff:192.168.1.256', // embedded IPv4 octet out of range
		'',
	])

testPattern('MAC address pattern', MAC_ADDRESS_PATTERN,
	[
		'00:1A:2B:3C:4D:5E',
		'00-1a-2b-3c-4d-5e',
	],
	[
		'00:1A:2B:3C:4D', // too short
		'00:1A:2B:3C:4D:5E:6F', // too long
		'00:1G:2B:3C:4D:5E', // non-hex character
		'00:1a-2b:3c-4d:5e', // mixed separators
		'',
	])

testPattern('Hex color pattern', HEX_COLOR_PATTERN,
	[
		'#fff',
		'#FFF',
		'#f00a', // 4-digit #RGBA shorthand, CSS Color Level 4
		'#ff0000',
		'#FF0000aa',
	],
	[
		'fff', // missing #
		'#ff000', // 5 digits
		'#gggggg', // non-hex characters
		'',
	])

testPattern('Slug pattern', SLUG_PATTERN,
	[
		'hello-world',
		'a',
		'my-2nd-post',
	],
	[
		'Hello-World', // uppercase
		'-hello', // leading dash
		'hello-', // trailing dash
		'hello--world', // consecutive dashes
		'hello world', // whitespace
		'',
	])

testPattern('E.164 phone pattern', E164_PHONE_PATTERN,
	[
		'+15555550123',
		'+3725555123',
		'+15',
	],
	[
		'15555550123', // missing +
		'+05555550123', // leading zero
		'+1 555 555 0123', // whitespace
		'+123456789012345678', // too long
		'+1', // too short
		'',
	])

testPattern('ISO 8601 date pattern', ISO_8601_DATE_PATTERN,
	[
		'2024-01-01',
		'1999-12-31',
	],
	[
		'2024-13-01', // invalid month
		'2024-01-32', // invalid day
		'2024-1-1', // missing zero-padding
		'20240101', // missing dashes
		'2024-01-01T00:00:00', // datetime, not date
		'',
	])

testPattern('Semver pattern', SEMVER_PATTERN,
	[
		'1.2.3',
		'0.4.1',
		'1.0.0-alpha.1',
		'1.0.0-rc.1+build.123',
	],
	[
		'1.2', // missing patch
		'v1.2.3', // leading v
		'1.02.3', // leading zero
		'1.2.3-', // empty pre-release
		'',
	])

testPattern('Base64 pattern', BASE64_PATTERN,
	[
		'aGVsbG8=',
		'aGVsbG8h',
		'aGk=',
		'aQ==',
	],
	[
		'aGVsbG8', // length not a multiple of 4
		'aGVsbG8===', // too much padding
		'aGVs bG8=', // whitespace
		'aGVsb!8=', // invalid character
		'',
	])

testPattern('JWT pattern', JWT_PATTERN,
	[
		'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
	],
	[
		'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0', // only two segments
		'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.c2ln.ZXh0cmE', // four segments
		'eyJhbGciOiJIUzI1NiJ9.eyJzdWIrOiIxMjM0In0=.c2ln', // padding character
		'',
	])

testPattern('Email pattern', EMAIL_PATTERN,
	[
		'a@b.co',
		'first.last+tag@sub.example.org',
		'under_score%percent@example.com',
	],
	[
		'a@b', // no TLD
		'@b.co', // missing local part
		'a@.co', // missing domain
		'a b@c.co', // whitespace
		'a@b.c1', // digit in TLD
		'a@@b.co', // double @
		'',
	],
	[
		'a..b@c.co', // consecutive dots in local part
		'a@b..co', // consecutive dots in domain
	])

testPattern('URL pattern', URL_PATTERN,
	[
		'https://example.com',
		'http://example.com/path?q=1#x',
		'example.com', // scheme is optional
		'www.example.co.uk/a',
	],
	[
		'https://exa mple.com', // whitespace
		'https://example', // no TLD
		'',
	],
	[
		'ftp://example.com', // only http(s) schemes are meant to be accepted
	])

testPattern('MySQL timestamp pattern', MYSQL_TIMESTAMP_PATTERN,
	[
		'2024-01-01 12:00:00',
		'1999-12-31 23:59:59',
	],
	[
		'2024-01-01T12:00:00', // ISO "T" separator
		'2024-1-1 12:00:00', // missing zero-padding
		'2024-01-01 12:00', // missing seconds
		'',
	],
	[
		'2024-13-45 99:99:99', // field ranges aren't checked
	])

testPattern('ISO 8601 strict datetime pattern', ISO_8601_DATETIME_PATTERN_STRICT,
	[
		'2024-01-01T12:00:00Z',
		'2024-01-01T12:00:00.123+02:00',
		'2024-01-01T12:00:00', // offset is optional
	],
	[
		'2024-01-01T12:00', // missing seconds
		'2024-01-01 12:00:00Z', // space separator
		'2024-01-01', // date only
		'',
	],
	[
		'2024-01-01T29:00:00Z', // hour out of range
		'2024-19-39T12:00:00Z', // month and day out of range
	])

testPattern('ISO 8601 datetime pattern', ISO_8601_DATETIME_PATTERN,
	[
		'2024-01-01T12:00:00',
		'2024-01-01T12:00', // seconds are optional
		'2024-01-01T12:00:00.5',
	],
	[
		'2024-01-01T12:00:00Z', // offsets are not accepted
		'2024-01-01', // date only
		'',
	])

testPattern('ISO 8601 time pattern', ISO_8601_TIME_PATTERN,
	[
		'12:00:00',
		'23:59:59Z',
		'00:00:00+05:30',
	],
	[
		'24:00:00', // hour out of range
		'12:60:00', // minute out of range
		'12:00', // missing seconds
		'12:00:00+24:00', // offset out of range
		'',
	])

testPattern('Contains lowercase pattern', CONTAINS_LOWERCASE_CHARACTER_PATTERN, ['ABCd', 'a'], ['ABC', '123', ''])
testPattern('Contains uppercase pattern', CONTAINS_UPPERCASE_CHARACTER_PATTERN, ['abcD', 'A'], ['abc', '123', ''])
testPattern('Contains digit pattern', CONTAINS_DIGIT_CHARACTER_PATTERN, ['abc1', '0'], ['abc', ''])
testPattern('Contains symbol pattern', CONTAINS_SYMBOL_CHARACTER_PATTERN,
	['abc!', '#', 'a-b'],
	[
		'abc_', // underscore counts as a word character
		'abc 1', // whitespace isn't a symbol
		'abc',
		'',
	])
