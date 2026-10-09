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
	URL_RULES,
	SLUG_RULES,
	STRONG_PASSWORD_RULES,
} from '../src/patterns';

// Comparison imports
import { z } from 'zod';
import * as v from 'valibot';
import * as yup from 'yup';

// Runs on Bun (`bun run benchmark`, JavaScriptCore) and on Node (`bun run benchmark:node`, V8).
//
// Fairness rules for the library comparisons:
// - every validator is built once, outside the timed function ("ivl" is the plain
//   getValueErrors/getSchemaErrors call, "ivl compiled" uses compileRules/compileSchema)
// - every library uses the same regexes and checks, except in the "built-in" scenario
// - each benchmark cycles through several inputs instead of repeating one, so no library gets
//   a single input's best case; the invalid inputs include wrong types and missing fields
// - before anything is timed, every library must agree on which inputs are valid
// - "report all errors" scenarios use each library's full error reporting (zod/valibot
//   safeParse, yup abortEarly: false, ivl's default); "pass/fail" scenarios use the cheapest
//   way each library offers to only get a yes/no answer
// - yup runs in strict mode, so it validates instead of casting like the others
// Differences that remain are listed in CAVEATS, which is printed with the results.

const CAVEATS = [
	'Error reports differ in detail: ivl returns the names of the failing rules, zod and valibot build an issue object per failure and copy the parsed value, and yup throws a ValidationError. The "report all errors" results on invalid input largely measure that cost; the "pass/fail" scenarios compare validation alone.',
	'After a failed type check, zod and valibot skip the rest of that field, while ivl still runs every rule unless break_early is set.',
	'In "pass/fail", valibot (v.is) and yup (isValidSync) stop at the first failure in the whole object; ivl (break_early) still checks every field, stopping within each; zod has no early-exit mode, so it runs safeParse and reads .success.',
	'The "built-in email" scenario uses each library\'s own email regex, so it compares what you get out of the box rather than equal work; ivl\'s regex is simpler and looser than zod\'s.',
	'Each benchmark cycles through 8 valid or 8 invalid inputs. The async rule resolves immediately, so the async scenario measures promise overhead, not I/O.',
];

type Validator = (input: unknown) => unknown;
type Library = { validate: Validator, isValid: (result: unknown) => boolean };
type Scenario = {
	name: string,
	valid: unknown[],
	invalid: unknown[],
	libraries: { [library: string]: Library },
	async?: boolean,
};

// Each adapter pairs a validator with how to read "valid" from its result
const errorList = (validate: Validator): Library => ({ validate, isValid: (r) => (r as string[]).length === 0 });
const errorObject = (validate: Validator): Library => ({ validate, isValid: (r) => Object.values(r as object).every((e) => e.length === 0) });
const safeParse = (validate: Validator): Library => ({ validate, isValid: (r) => (r as { success: boolean }).success });
const boolean = (validate: Validator): Library => ({ validate, isValid: (r) => r === true });
// yup only reports errors by throwing, so its "report all errors" results include that cost
const yupErrors = (schema: yup.Schema): Library => ({
	validate: (input) => {
		try { return schema.validateSync(input, { abortEarly: false, strict: true }) && null }
		catch (error) { return error }
	},
	isValid: (r) => r === null,
});
const yupErrorsAsync = (schema: yup.Schema): Library => ({
	validate: (input) => schema.validate(input, { abortEarly: false, strict: true }).then(() => null, (error: unknown) => error),
	isValid: (r) => r === null,
});
const yupBoolean = (schema: yup.Schema): Library => boolean((input) => schema.isValidSync(input, { strict: true }));

// --- Inputs ------------------------------------------------------------------

const VALID_EMAILS = [
	'test@email.com', 'jane.doe@example.org', 'a@b.co', 'first.last+tag@sub.example.co.uk',
	'user_name@domain.io', 'x@mail.example.com', 'someone.with.a.longer.name@company-domain.com', 'q@q.dev',
];
const INVALID_EMAILS: unknown[] = [
	'not an email', 'missing-at.example.com', '@example.com', 'jane@', 'two@@example.com', '', 42, null,
];

const VALID_USERS = [
	{ email: 'jane@example.com', password: 'Passw0rd!', username: 'jane-doe', age: 30, website: 'https://example.com' },
	{ email: 'a@b.co', password: 'Sup3r$ecret', username: 'a', age: 13 },
	{ email: 'first.last+tag@sub.example.co.uk', password: 'C0rrect-horse-battery', username: 'first-last-2', age: 130, website: 'example.org/about' },
	{ email: 'user_name@domain.io', password: 'Xy9!Xy9!', username: 'user-name', age: 42 },
	{ email: 'x@mail.example.com', password: 'Tr0ub4dor&3', username: 'x', age: 18, website: 'http://www.example.com/a/b?c=d' },
	{ email: 'q@q.dev', password: 'Aa1!aaaa', username: 'q-q-q', age: 99 },
	{ email: 'test@email.com', password: 'L0ng!' + 'x'.repeat(100), username: 'test', age: 25, website: 'https://test.example.net' },
	{ email: 'someone@company-domain.com', password: 'Pa$$w0rd', username: 'someone-at-company', age: 64 },
];
const INVALID_USERS: unknown[] = [
	{ email: 'nope', password: 'short', username: 'Jane Doe', age: 12.5, website: 'nope' }, // every field invalid
	{ email: 'jane@example.com', password: 'Passw0rd!', username: 'jane-doe', age: 12 }, // one field invalid
	{ email: 'jane@example.com', password: 'password', username: 'jane-doe', age: 30 }, // weak password
	{ email: 1, password: 2, username: 3, age: '30', website: 4 }, // wrong types everywhere
	{}, // every field missing
	{ email: 'jane@example.com', password: 'Passw0rd!', username: 'jane-doe' }, // one field missing
	{ email: 'x'.repeat(300) + '@example.com', password: 'Passw0rd!', username: 'jane-doe', age: 30 }, // email too long
	{ email: 'jane@example.com', password: 'Passw0rd!', username: 'Jane_Doe', age: 30, website: 'not a url' }, // two fields invalid
];

// --- Validators --------------------------------------------------------------

const email_rules = { 'Must match regex': matchesRegex(EMAIL_PATTERN) };
const zod_email = z.string().regex(EMAIL_PATTERN);
const valibot_email = v.pipe(v.string(), v.regex(EMAIL_PATTERN));
const yup_email = yup.string().required().matches(EMAIL_PATTERN);

const ivl_user_schema = {
	email: EMAIL_RULES,
	password: STRONG_PASSWORD_RULES,
	username: SLUG_RULES,
	age: { 'Must be an integer': isInteger(), 'Must be between 13 and 130': numberBetween(130, 13) },
	website: allowUndefined(URL_RULES),
};
const zod_user = z.object({
	email: z.string().max(254).regex(EMAIL_PATTERN),
	password: z.string().min(8).max(128).regex(LOWER).regex(UPPER).regex(DIGIT).regex(SYMBOL),
	username: z.string().regex(SLUG_PATTERN),
	age: z.number().int().min(13).max(130),
	website: z.string().regex(URL_PATTERN).optional(),
});
const valibot_user_fields = {
	email: v.pipe(v.string(), v.maxLength(254), v.regex(EMAIL_PATTERN)),
	password: v.pipe(v.string(), v.minLength(8), v.maxLength(128), v.regex(LOWER), v.regex(UPPER), v.regex(DIGIT), v.regex(SYMBOL)),
	username: v.pipe(v.string(), v.regex(SLUG_PATTERN)),
	age: v.pipe(v.number(), v.integer(), v.minValue(13), v.maxValue(130)),
	website: v.optional(v.pipe(v.string(), v.regex(URL_PATTERN))),
};
const valibot_user = v.object(valibot_user_fields);
const yup_user_fields = {
	email: yup.string().required().max(254).matches(EMAIL_PATTERN),
	password: yup.string().required().min(8).max(128).matches(LOWER).matches(UPPER).matches(DIGIT).matches(SYMBOL),
	username: yup.string().required().matches(SLUG_PATTERN),
	age: yup.number().required().integer().min(13).max(130),
	website: yup.string().matches(URL_PATTERN),
};
const yup_user = yup.object(yup_user_fields);

// One async check, standing in for a database lookup
const TAKEN_EMAILS = new Set(['taken@example.com']);
const isEmailFree = async (i: unknown) => !TAKEN_EMAILS.has(i as string);
const ivl_async_user_schema = { ...ivl_user_schema, email: { ...EMAIL_RULES, 'Email already registered': isEmailFree } };

// --- Scenarios ---------------------------------------------------------------

const asObject = (i: unknown) => i as Record<string, unknown>;
const compiled_user = compileSchema(ivl_user_schema);
const compiled_user_first_error = compileSchema(ivl_user_schema, { break_early: true });
const compiled_email_first_error = compileRules(email_rules, { break_early: true });

const SCENARIOS: Scenario[] = [
	{
		name: 'single regex rule, report all errors',
		valid: VALID_EMAILS,
		invalid: INVALID_EMAILS,
		libraries: {
			ivl: errorList((i) => getValueErrors(i, email_rules)),
			'ivl compiled': errorList(compileRules(email_rules)),
			zod: safeParse((i) => zod_email.safeParse(i)),
			valibot: safeParse((i) => v.safeParse(valibot_email, i)),
			yup: yupErrors(yup_email),
		},
	},
	{
		name: 'single regex rule, pass/fail',
		valid: VALID_EMAILS,
		invalid: INVALID_EMAILS,
		libraries: {
			'ivl compiled': boolean((i) => compiled_email_first_error(i).length === 0),
			zod: boolean((i) => zod_email.safeParse(i).success),
			valibot: boolean((i) => v.is(valibot_email, i)),
			yup: yupBoolean(yup_email),
		},
	},
	{
		name: 'built-in email validator (regexes differ)',
		valid: VALID_EMAILS,
		invalid: INVALID_EMAILS,
		libraries: {
			ivl: errorList((i) => getValueErrors(i, EMAIL_RULES)),
			'ivl compiled': errorList(compileRules(EMAIL_RULES)),
			zod: safeParse(((schema) => (i: unknown) => schema.safeParse(i))(z.email())),
			valibot: safeParse(((schema) => (i: unknown) => v.safeParse(schema, i))(v.pipe(v.string(), v.email()))),
			yup: yupErrors(yup.string().required().email()),
		},
	},
	{
		name: 'object schema, report all errors',
		valid: VALID_USERS,
		invalid: INVALID_USERS,
		libraries: {
			ivl: errorObject((i) => getSchemaErrors(asObject(i), ivl_user_schema)),
			'ivl compiled': errorObject((i) => compiled_user(asObject(i))),
			zod: safeParse((i) => zod_user.safeParse(i)),
			valibot: safeParse((i) => v.safeParse(valibot_user, i)),
			yup: yupErrors(yup_user),
		},
	},
	{
		name: 'object schema, pass/fail',
		valid: VALID_USERS,
		invalid: INVALID_USERS,
		libraries: {
			'ivl compiled': boolean((i) => {
				const errors = compiled_user_first_error(asObject(i));
				for (const key in errors) if (errors[key]!.length) return false;
				return true;
			}),
			zod: boolean((i) => zod_user.safeParse(i).success),
			valibot: boolean((i) => v.is(valibot_user, i)),
			yup: yupBoolean(yup_user),
		},
	},
	{
		name: 'object schema with an async rule, report all errors',
		valid: VALID_USERS,
		invalid: [...INVALID_USERS.slice(1), { ...VALID_USERS[0], email: 'taken@example.com' }],
		async: true,
		libraries: {
			ivl: errorObject((i) => getSchemaErrors(asObject(i), ivl_async_user_schema)),
			'ivl compiled': errorObject(compileSchema(ivl_async_user_schema) as Validator),
			zod: safeParse(((schema) => (i: unknown) => schema.safeParseAsync(i))(
				z.object({ ...zod_user.shape, email: zod_user.shape.email.refine(isEmailFree) }))),
			valibot: safeParse(((schema) => (i: unknown) => v.safeParseAsync(schema, i))(
				v.objectAsync({ ...valibot_user_fields, email: v.pipeAsync(valibot_user_fields.email, v.checkAsync<string>(isEmailFree)) }))),
			yup: yupErrorsAsync(yup.object({ ...yup_user_fields, email: yup_user_fields.email.test('free', 'Email already registered', isEmailFree) })),
		},
	},
];

// --- Fairness check ----------------------------------------------------------

for (const scenario of SCENARIOS) {
	for (const [library, { validate, isValid }] of Object.entries(scenario.libraries)) {
		for (const [label, inputs, expected] of [['valid', scenario.valid, true], ['invalid', scenario.invalid, false]] as const) {
			for (const input of inputs) {
				if (isValid(await validate(input)) !== expected)
					throw new Error(`${library} disagrees on ${label} input ${JSON.stringify(input)} in "${scenario.name}"`);
			}
		}
	}
}

// --- Benchmarks --------------------------------------------------------------

// Cycles through `inputs`; every library pays the same indexing cost
const cycle = (validate: Validator, inputs: unknown[]) => {
	let index = 0;
	return () => validate(inputs[index = (index + 1) % inputs.length]);
}

group('ivl execution paths', () => {
	const test_string = "test@email.com";
	const regex_rule = matchesRegex(EMAIL_PATTERN);
	bench("pure regex helper", () => regex_rule(test_string));
	bench('async regex helper', () => getValueErrorsAsync(test_string, email_rules));
	bench('smart regex helper', () => getValueErrors(test_string, email_rules));
	bench('sync regex helper', () => getValueErrorsSync(test_string, email_rules));
});

for (const scenario of SCENARIOS) {
	for (const [label, inputs] of [['valid', scenario.valid], ['invalid', scenario.invalid]] as const) {
		group(`${scenario.name} (${label} input)`, () => {
			for (const [library, { validate }] of Object.entries(scenario.libraries)) {
				const next = cycle(validate, inputs);
				if (scenario.async) bench(library, async () => await next());
				else bench(library, next);
			}
		});
	}
}

// CI sets BENCH_FORMAT=markdown to produce the README benchmark section
const markdown = process.env['BENCH_FORMAT'] === 'markdown';

await run({
	colors: !markdown, // enable/disable colors (default: true)
	format: markdown ? 'markdown' : 'mitata', // 'mitata' | 'json' | 'markdown' | 'quiet'
});

if (markdown) {
	console.log('\n**Caveats**\n');
	for (const caveat of CAVEATS) console.log(`- ${caveat}`);
}
