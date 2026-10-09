import { run, bench, group } from 'mitata';
import { getValueErrorsAsync, getValueErrors, getValueErrorsSync, getSchemaErrors, compileRules, compileSchema } from '../src/index';
import { matchesRegex, isInteger, numberBetween, allowUndefined } from '../src/helpers';
import {
	EMAIL_PATTERN,
	URL_PATTERN,
	SLUG_PATTERN,
	CONTAINS_LOWERCASE_CHARACTER_PATTERN as LOWER,
	CONTAINS_UPPERCASE_CHARACTER_PATTERN as UPPER,
	CONTAINS_DIGIT_CHARACTER_PATTERN as DIGIT,
	CONTAINS_SYMBOL_CHARACTER_PATTERN as SYMBOL,
	EMAIL_RULES,
	UUID_RULES,
	URL_RULES,
	SLUG_RULES,
	STRONG_PASSWORD_RULES,
} from '../src/patterns';

// Comparison imports
import { z } from 'zod';
import * as v from 'valibot';
import * as yup from 'yup';

// Fairness rules for the library comparisons:
// - every validator is built once, outside the timed function ("ivl" is the plain
//   getValueErrors/getSchemaErrors call, "ivl compiled" uses compileRules/compileSchema)
// - every library uses the same regexes and checks, in its "report all errors" mode
//   (zod/valibot safeParse, yup abortEarly: false, ivl always reports all)
// - yup runs in strict mode, so it validates instead of casting like the others
// - each scenario is timed with both a valid and an invalid input, and verify() below
//   checks that all libraries agree on which is which before anything is timed
// zod and valibot also build a parsed output object, while ivl only returns errors;
// that is inherent to their APIs and is part of what is measured.

type Validator = (input: unknown) => unknown;
type Scenario = {
	name: string,
	valid: unknown,
	invalid: unknown,
	// Each validator returns a truthy "has errors" value
	libraries: { [library: string]: { validate: Validator, hasErrors: (result: unknown) => boolean } },
	async?: boolean,
};

const ivlValue = (validate: Validator) => ({ validate, hasErrors: (r: unknown) => (r as string[]).length > 0 });
const ivlSchema = (validate: Validator) => ({ validate, hasErrors: (r: unknown) => Object.values(r as object).some((e) => e.length > 0) });
const zodLike = (validate: Validator) => ({ validate, hasErrors: (r: unknown) => !(r as { success: boolean }).success });
// yup only reports errors by throwing, so its benchmark includes that cost
const yupSync = (schema: yup.Schema) => ({
	validate: (input: unknown) => {
		try { return schema.validateSync(input, { abortEarly: false, strict: true }) && null }
		catch (error) { return error }
	},
	hasErrors: (r: unknown) => r !== null,
});
const yupAsync = (schema: yup.Schema) => ({
	validate: (input: unknown) => schema.validate(input, { abortEarly: false, strict: true }).then(() => null, (error: unknown) => error),
	hasErrors: (r: unknown) => r !== null,
});

// --- Scenarios ---------------------------------------------------------------

const single_regex: Scenario = {
	name: 'single regex rule',
	valid: 'test@email.com',
	invalid: 'test@email',
	libraries: {
		ivl: ivlValue(((rules) => (i: unknown) => getValueErrors(i, rules))({ 'Must match regex': matchesRegex(EMAIL_PATTERN) })),
		'ivl compiled': ivlValue(compileRules({ 'Must match regex': matchesRegex(EMAIL_PATTERN) })),
		zod: zodLike(((schema) => (i: unknown) => schema.safeParse(i))(z.string().regex(EMAIL_PATTERN))),
		valibot: zodLike(((schema) => (i: unknown) => v.safeParse(schema, i))(v.pipe(v.string(), v.regex(EMAIL_PATTERN)))),
		yup: yupSync(yup.string().required().matches(EMAIL_PATTERN)),
	},
};

// Each library's own email validator; the regexes differ, so this measures what a user gets
// out of the box rather than pure library overhead
const builtin_email: Scenario = {
	name: 'built-in email validator',
	valid: 'test@email.com',
	// Not "test@email": yup follows the HTML spec, which allows a domain without a TLD
	invalid: 'not an email',
	libraries: {
		ivl: ivlValue((i) => getValueErrors(i, EMAIL_RULES)),
		'ivl compiled': ivlValue(compileRules(EMAIL_RULES)),
		zod: zodLike(((schema) => (i: unknown) => schema.safeParse(i))(z.email())),
		valibot: zodLike(((schema) => (i: unknown) => v.safeParse(schema, i))(v.pipe(v.string(), v.email()))),
		yup: yupSync(yup.string().required().email()),
	},
};

const builtin_uuid: Scenario = {
	name: 'built-in UUID validator',
	valid: '123e4567-e89b-12d3-a456-426614174000',
	invalid: '123e4567e89b12d3a456426614174000',
	libraries: {
		ivl: ivlValue((i) => getValueErrors(i, UUID_RULES)),
		'ivl compiled': ivlValue(compileRules(UUID_RULES)),
		zod: zodLike(((schema) => (i: unknown) => schema.safeParse(i))(z.uuid())),
		valibot: zodLike(((schema) => (i: unknown) => v.safeParse(schema, i))(v.pipe(v.string(), v.uuid()))),
		yup: yupSync(yup.string().required().uuid()),
	},
};

// A registration payload: 5 fields, 15 checks, the same checks in every library
const valid_user = { email: 'jane@example.com', password: 'Passw0rd!', username: 'jane-doe', age: 30, website: 'https://example.com' };
const invalid_user = { email: 'nope', password: 'short', username: 'Jane Doe', age: 12.5, website: 'nope' };

const ivl_user_schema = {
	email: EMAIL_RULES,
	password: STRONG_PASSWORD_RULES,
	username: SLUG_RULES,
	age: { 'Must be an integer': isInteger(), 'Must be between 13 and 130': numberBetween(130, 13) },
	website: allowUndefined(URL_RULES),
};
const zod_user_fields = {
	email: z.string().max(254).regex(EMAIL_PATTERN),
	password: z.string().min(8).max(128).regex(LOWER).regex(UPPER).regex(DIGIT).regex(SYMBOL),
	username: z.string().regex(SLUG_PATTERN),
	age: z.number().int().min(13).max(130),
	website: z.string().regex(URL_PATTERN).optional(),
};
const valibot_user_fields = {
	email: v.pipe(v.string(), v.maxLength(254), v.regex(EMAIL_PATTERN)),
	password: v.pipe(v.string(), v.minLength(8), v.maxLength(128), v.regex(LOWER), v.regex(UPPER), v.regex(DIGIT), v.regex(SYMBOL)),
	username: v.pipe(v.string(), v.regex(SLUG_PATTERN)),
	age: v.pipe(v.number(), v.integer(), v.minValue(13), v.maxValue(130)),
	website: v.optional(v.pipe(v.string(), v.regex(URL_PATTERN))),
};
const yup_user_fields = {
	email: yup.string().required().max(254).matches(EMAIL_PATTERN),
	password: yup.string().required().min(8).max(128).matches(LOWER).matches(UPPER).matches(DIGIT).matches(SYMBOL),
	username: yup.string().required().matches(SLUG_PATTERN),
	age: yup.number().required().integer().min(13).max(130),
	website: yup.string().matches(URL_PATTERN),
};

const object_schema: Scenario = {
	name: 'object schema',
	valid: valid_user,
	invalid: invalid_user,
	libraries: {
		ivl: ivlSchema((i) => getSchemaErrors(i as Record<string, unknown>, ivl_user_schema)),
		'ivl compiled': ivlSchema(compileSchema(ivl_user_schema) as Validator),
		zod: zodLike(((schema) => (i: unknown) => schema.safeParse(i))(z.object(zod_user_fields))),
		valibot: zodLike(((schema) => (i: unknown) => v.safeParse(schema, i))(v.object(valibot_user_fields))),
		yup: yupSync(yup.object(yup_user_fields)),
	},
};

// The same payload with one async check, standing in for a database lookup
const TAKEN_EMAILS = new Set(['taken@example.com']);
const isEmailFree = async (i: unknown) => !TAKEN_EMAILS.has(i as string);

const ivl_async_user_schema = { ...ivl_user_schema, email: { ...EMAIL_RULES, 'Email already registered': isEmailFree } };

const async_object_schema: Scenario = {
	name: 'object schema with an async rule',
	valid: valid_user,
	invalid: invalid_user,
	async: true,
	libraries: {
		ivl: ivlSchema((i) => getSchemaErrors(i as Record<string, unknown>, ivl_async_user_schema)),
		'ivl compiled': ivlSchema(compileSchema(ivl_async_user_schema) as Validator),
		zod: zodLike(((schema) => (i: unknown) => schema.safeParseAsync(i))(
			z.object({ ...zod_user_fields, email: zod_user_fields.email.refine(isEmailFree) }))),
		valibot: zodLike(((schema) => (i: unknown) => v.safeParseAsync(schema, i))(
			v.objectAsync({ ...valibot_user_fields, email: v.pipeAsync(valibot_user_fields.email, v.checkAsync<string>(isEmailFree)) }))),
		yup: yupAsync(yup.object({ ...yup_user_fields, email: yup_user_fields.email.test('free', 'Email already registered', isEmailFree) })),
	},
};

const SCENARIOS = [single_regex, builtin_email, builtin_uuid, object_schema, async_object_schema];

// --- Fairness check ----------------------------------------------------------

for (const scenario of SCENARIOS) {
	for (const [library, { validate, hasErrors }] of Object.entries(scenario.libraries)) {
		for (const [label, input, expected] of [['valid', scenario.valid, false], ['invalid', scenario.invalid, true]] as const) {
			if (hasErrors(await validate(input)) !== expected)
				throw new Error(`${library} disagrees on the ${label} input of "${scenario.name}"`);
		}
	}
}

// --- Benchmarks --------------------------------------------------------------

group('ivl execution paths', () => {
	const test_string = "test@email.com";
	const rules = { "Pattern": matchesRegex(EMAIL_PATTERN) };
	bench("pure regex helper", () => matchesRegex(EMAIL_PATTERN)(test_string)).baseline(true);
	bench('async regex helper', () => getValueErrorsAsync(test_string, rules));
	bench('smart regex helper', () => getValueErrors(test_string, rules));
	bench('sync regex helper', () => getValueErrorsSync(test_string, rules));
});

for (const scenario of SCENARIOS) {
	for (const [label, input] of [['valid', scenario.valid], ['invalid', scenario.invalid]] as const) {
		group(`${scenario.name} (${label} input)`, () => {
			for (const [library, { validate }] of Object.entries(scenario.libraries)) {
				const b = scenario.async
					? bench(library, async () => await validate(input))
					: bench(library, () => validate(input));
				if (library === 'ivl') b.baseline(true);
			}
		});
	}
}

// CI sets BENCH_FORMAT=markdown to produce the README benchmark section
const markdown = process.env.BENCH_FORMAT === 'markdown';

await run({
	colors: !markdown, // enable/disable colors (default: true)
	format: markdown ? 'markdown' : 'mitata', // 'mitata' | 'json' | 'markdown' | 'quiet'
});
