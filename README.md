# Super lightweight input validation library
This is a lightweight library for user input validation.
Main focus is on speed and flexibility of the validation rules.

By default `getValueErrors` and `getSchemaErrors` automatically detects and chooses the most performant checking method for your rule set.

If you validate against the same rule set or schema repeatedly, compile it once with `compileRules`/`compileSchema` (see [Compiled validators](#compiled-validators)) - that does the sync/async detection up front and is the fastest option.

Use synchronous versions of the functions for better performance if you don't need to support asynchronous checks on your inputs. 


# Main functionality
Write your own custom validators to exactly match your use case using a simple object:
```javascript
const my_rules = {
  "Input must be more than 40": (i) => i > 40,
  "Input must be divisible by 10": (i) => !(i % 10)
}
console.log(getValueErrors(50, my_rules)); // []
console.log(getValueErrors(11, my_rules)); // ["Input must be more than 40", "Input must be divisible by 10"]
console.log(getValueErrors(30, my_rules)) // ["Input must be more than 40"]
```
# Type inference
`getValueErrors` and `getSchemaErrors` infer their return type from the rules you pass in:

```typescript
const sync_rules = { "Is string": (i: unknown) => typeof i === 'string' };
const async_rules = { "Exists": async (i: unknown) => await lookup(i) };

getValueErrors('x', sync_rules);  // string[]
getValueErrors('x', async_rules); // Promise<string[]>

const errors = getSchemaErrors(input, {
  name: sync_rules,
  ids: [sync_rules, { "Is number": (i: unknown) => typeof i === 'number' }],
});
errors.name; // string[]
errors.ids;  // string[][] - one error list per alternative rule set
```

Rules and rule sets are generic over the value type and any extra "overload" arguments:

```typescript
import type { RULE } from 'ivl';

// A rule that only accepts strings and needs a context object passed as an overload
const inDatabase: RULE<string, [ctx: { db: Database }]> = async (value, ctx) => ctx.db.has(value);
```

> **Note:** annotating a rule set as `RULES` (or a schema as `SCHEMA`) widens every rule to
> "may be sync or async", so the return type becomes `string[] | Promise<string[]>`. Prefer
> `satisfies RULES` / `satisfies SCHEMA`, which validates the shape without losing the inferred types.

# Compiled validators
`compileRules` and `compileSchema` turn a rule set or schema into a reusable validator. They return
exactly what `getValueErrors`/`getSchemaErrors` would, with the same sync/async type inference, but the
work those functions repeat on every call - finding the rule keys and checking for async rules - is
done once up front:

```typescript
import { compileSchema } from 'ivl';
import { EMAIL_RULES, STRONG_PASSWORD_RULES } from 'ivl/patterns';

// Compile once, at module level
const validateRegistration = compileSchema({
  email: EMAIL_RULES,
  password: STRONG_PASSWORD_RULES,
}, { strict: true });

// ...then call it per request
const errors = validateRegistration(body); // { email: string[], password: string[] }
```

The rule sets and options are captured when compiling, so changing them afterwards has no effect on an
existing validator.

# Options
`getSchemaErrors`, `getSchemaErrorsSync`, `getSchemaErrorsAsync` and `compileSchema` take an options object;
`compileRules` takes `break_early`. Both options are off by default.

- **`strict`** - also report keys of the object that the schema doesn't have, each as `['Key not allowed']`.
- **`break_early`** - report only the first failing rule of each rule set instead of all of them. Rules
  that aren't `async` run first, in order, and stop at the first failure; `async` rules only run if all of
  those passed. So a cheap check that fails skips the expensive ones, like a long regex or a database lookup:

```typescript
const validateEmail = compileRules({
  ...EMAIL_RULES, // cheap checks first
  "Email already registered": async (i: unknown) => !(await emailExists(i)),
}, { break_early: true });

await validateEmail('not an email'); // ['Must be a valid email address'] - the lookup never ran
```

Every field of a schema is still validated with `break_early`; each just reports at most one error. Leave
it off when you want to show users every problem at once, e.g. all unmet password requirements.

# Ready-made rule sets
`ivl/patterns` exports rule sets for common formats, ready to drop into a schema:

```typescript
import { getSchemaErrors } from 'ivl';
import { EMAIL_RULES, STRONG_PASSWORD_RULES, IPV4_RULES, IPV6_RULES } from 'ivl/patterns';

const errors = getSchemaErrors(input, {
  email: EMAIL_RULES,
  password: STRONG_PASSWORD_RULES,
  ip: [IPV4_RULES, IPV6_RULES], // passes if either rule set passes
});
```

Available: `EMAIL_RULES`, `URL_RULES`, `UUID_RULES`, `UUID_V4_RULES`, `IPV4_RULES`, `IPV6_RULES`,
`MAC_ADDRESS_RULES`, `HEX_COLOR_RULES`, `SLUG_RULES`, `E164_PHONE_RULES`, `SEMVER_RULES`, `BASE64_RULES`,
`JWT_RULES`, `ISO_8601_DATE_RULES`, `ISO_8601_DATETIME_RULES`, `ISO_8601_TIME_RULES`, `PASSWORD_RULES`
and `STRONG_PASSWORD_RULES`.

All of them are synchronous and frozen. To customise one, spread it into a new object:

```typescript
const COMPANY_EMAIL_RULES = {
  ...EMAIL_RULES,
  "Must be a company address": (i: unknown) => typeof i === 'string' && i.endsWith('@example.com'),
};
```

The date rule sets also check the calendar, so `2024-02-30` fails even though it matches the pattern.

# Installing
```typescript
bun add ivl // bun.js
yarn add ivl // yarn
npm install ivl // npm
pnpm install ivl // pnpm
```

*deno coming soon*

---
# Usage examples
## Frontend example
### `index.ts`
```typescript
import { getValueErrors } from 'ivl';
import type { RULES } from 'ivl';
import { matchesRegex, minLength, maxLength, isType } from 'ivl/helpers';

// This pattern is also exportable from 'ivl/patterns'
const EMAIL_PATTERN = /^[\w.%+-]+@[\w.-]+\.[a-zA-Z]{1,}$/;

// `satisfies` checks the object against RULES while keeping each rule's exact type,
// so `getValueErrors` can infer that this rule set is async.
const EMAIL_REQUIREMENTS = {
  "Must be string": isType('string'),
  "Must be less then 100 characters": maxLength(100),
  "Not a valid email address": matchesRegex(EMAIL_PATTERN),
  "That email is already in use": async (i: unknown) => {
    // Fetch info from whatever backend and make a decision based on that asynchronously
    const email_in_use = await fetch(`https://mybackend/email-exists/${i}`)
    return !email_in_use // We will return true if the email is not already taken
  }
} satisfies RULES;

const PASSWORD_REQUIREMENTS = {
  "Must be string": isType('string'),
  "Must be at least 8 characters": minLength(8),
  "Must contain at least one upper case character": matchesRegex(/[A-Z]/),
  "Must contain at least one lower case character": matchesRegex(/[a-z]/),
} satisfies RULES;

// You can of course expand on your existing rules: 
const STRONG_PASSWORD_REQUIREMENTS = {
  ...PASSWORD_REQUIREMENTS,
  "Must contain at least one digit": matchesRegex(/\d/),
  "Must contain at least one symbol": matchesRegex(/[^\w\s]/),
} satisfies RULES;

const email_value = "some-value";
const pw_value = "Passesweakpw";

const email_errors = await getValueErrors(email_value, EMAIL_REQUIREMENTS); // Promise<string[]> - one rule is async
const pw_errors = getValueErrors(pw_value, PASSWORD_REQUIREMENTS);             // string[] - all rules are sync
const strong_pw_errors = getValueErrors(pw_value, STRONG_PASSWORD_REQUIREMENTS); // string[]

console.log({email_errors, pw_errors, strong_pw_errors});
```


## Backend example with Hono & Bun.js

### `rules.ts`
```typescript
import { isType, minLength, maxLength, matchesRegex } from 'ivl/helpers';
import { EMAIL_PATTERN } from 'ivl/patterns';
import type { RULE, SCHEMA } from 'ivl';
import { checkValueInDatabase } from 'my-database-controller';

const existsInDatabase = (key: string, table: string, exists: boolean = true): RULE =>
  async (value) =>
    exists != !(await checkValueInDatabase(value as string, key, table)).length

const EMAIL_REQUIREMENTS = {
  "Must be string": isType('string'),
  "Must be less then 100 characters": maxLength(100),
  "Not a valid email address": matchesRegex(EMAIL_PATTERN),
};

const PASSWORD_REQUIREMENTS = {
  "Must be string": isType('string'),
  "Must be at least 8 characters": minLength(8),
  "Must contain at least one upper case character": matchesRegex(/[A-Z]/),
  "Must contain at least one lower case character": matchesRegex(/[a-z]/),
  "Must contain at least one digit": matchesRegex(/\d/),
  "Must contain at least one symbol": matchesRegex(/[^\w\s]/),
};

export const LOGIN_SCHEMA: SCHEMA =  {
  email: EMAIL_REQUIREMENTS,
  password: PASSWORD_REQUIREMENTS
};

export const REGISTER_SCHEMA: SCHEMA = {
  // We can pass in an empty rule set to allow any value
  // Or we can omit the argument entirely and set the strict flag to false when checking the schema
  organization_name: {},
  email: {
    ...EMAIL_REQUIREMENTS,
    "Email already registered": existsInDatabase('email','users', false)
  },
  password: PASSWORD_REQUIREMENTS
};

// Registering via invitation needs all the same values except organization name
// inherit parts of rule sets, as opposed to extending the rule set as show in the
// frontend example
export const INVITE_REGISTER_SCHEMA = (({ organization_name, ...invite_schema }) => invite_schema)(REGISTER_SCHEMA)

export const INVITATION_PARAM: SCHEMA = {
  invitation_code: {
    "Not a valid invitation": existsInDatabase('code', 'invitation')
  }
};

```

### `index.ts`
```typescript
import { Hono, ValidationTargets } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { validator } from 'hono/validator';
import { getSchemaErrors } from 'ivl';
import type { SCHEMA, CHECKABLE_OBJECT } from 'ivl';
import { LOGIN_SCHEMA, REGISTER_SCHEMA, INVITE_REGISTER_SCHEMA, INVITATION_PARAM } from './rules.ts';

// Wrapper for hono validator middleware
export const validate = (input_type: keyof ValidationTargets, schema: SCHEMA) =>
  validator(input_type, async (value: CHECKABLE_OBJECT) => {
    const errors = await getSchemaErrors(value, schema, { strict: true });
    if (Object.values(errors).filter((e) => e.length).length) {
      throw new HTTPException(400, {
        message: JSON.stringify(errors),
      });
    }
    return value;
  })

const app = new Hono();

app.post('/login',
  validate('json', LOGIN_SCHEMA),
  (c) => c.text("Success"));

app.all('/logout', (c) => c.text("Success"));

app.put('/register', 
  validate('json', REGISTER_SCHEMA),
  (c) => c.text("Success"));

// This first validates the invitation parameter against our database
// And then validates the body of the request
app.put('/register/:invitation_code',
  validate('param', INVITATION_PARAM),
  validate('json', INVITE_REGISTER_SCHEMA ),
  (c)=> c.text("Success"));

export default app;
```

<!-- benchmark:start -->
# Benchmarks

Generated by CI on a GitHub-hosted runner, so absolute numbers vary between runs.
Compare rows within a table rather than across runs. Read the caveats at the end before
drawing conclusions: the libraries do different amounts of work in some scenarios.

## Bun (JavaScriptCore)

- **clk**: ~4.30 GHz
- **cpu**: AMD EPYC 9V45 96-Core Processor
- **runtime**: bun 1.4.2 (x64-linux)

| • ivl execution paths |              avg |         min |         p75 |         p99 |         max |
| ------------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| pure regex helper  | ` 13.52 ns/iter` | ` 12.84 ns` | ` 13.64 ns` | ` 16.26 ns` | ` 35.29 ns` |
| async regex helper | ` 82.30 ns/iter` | ` 73.32 ns` | ` 80.07 ns` | `156.46 ns` | `265.68 ns` |
| smart regex helper | ` 26.02 ns/iter` | ` 22.43 ns` | ` 24.92 ns` | ` 82.75 ns` | `180.55 ns` |
| sync regex helper  | ` 24.25 ns/iter` | ` 19.55 ns` | ` 23.57 ns` | ` 75.54 ns` | `210.71 ns` |

| • single regex rule, report all errors (valid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl          | ` 34.12 ns/iter` | ` 28.45 ns` | ` 34.15 ns` | ` 90.83 ns` | `133.14 ns` |
| ivl compiled | ` 38.29 ns/iter` | ` 34.44 ns` | ` 37.92 ns` | ` 95.95 ns` | `122.56 ns` |
| zod          | ` 61.64 ns/iter` | ` 50.50 ns` | ` 54.90 ns` | `197.04 ns` | `418.33 ns` |
| valibot      | ` 36.60 ns/iter` | ` 33.16 ns` | ` 36.12 ns` | ` 69.51 ns` | `129.53 ns` |
| yup          | `705.02 ns/iter` | `618.97 ns` | `732.24 ns` | `846.00 ns` | `  1.25 µs` |

| • single regex rule, report all errors (invalid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl          | ` 21.34 ns/iter` | ` 18.91 ns` | ` 20.92 ns` | ` 80.84 ns` | `109.01 ns` |
| ivl compiled | ` 29.84 ns/iter` | ` 26.05 ns` | ` 28.86 ns` | ` 97.03 ns` | `148.36 ns` |
| zod          | `  1.11 µs/iter` | `  1.03 µs` | `  1.11 µs` | `  1.36 µs` | `  1.45 µs` |
| valibot      | ` 59.58 ns/iter` | ` 50.78 ns` | ` 57.61 ns` | `127.88 ns` | `184.43 ns` |
| yup          | `  5.00 µs/iter` | `  4.78 µs` | `  5.05 µs` | `  5.35 µs` | `  5.42 µs` |

| • single regex rule, pass/fail (valid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl compiled | ` 26.07 ns/iter` | ` 23.87 ns` | ` 25.92 ns` | ` 40.28 ns` | `113.68 ns` |
| zod          | ` 58.58 ns/iter` | ` 50.32 ns` | ` 56.24 ns` | `133.43 ns` | `150.19 ns` |
| valibot      | ` 31.14 ns/iter` | ` 27.63 ns` | ` 29.65 ns` | ` 90.41 ns` | `151.00 ns` |
| yup          | `722.17 ns/iter` | `639.21 ns` | `770.56 ns` | `816.36 ns` | `901.42 ns` |

| • single regex rule, pass/fail (invalid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl compiled | ` 16.51 ns/iter` | ` 14.88 ns` | ` 16.05 ns` | ` 28.92 ns` | ` 97.51 ns` |
| zod          | `  1.05 µs/iter` | `992.50 ns` | `  1.06 µs` | `  1.19 µs` | `  1.21 µs` |
| valibot      | ` 56.66 ns/iter` | ` 46.98 ns` | ` 53.78 ns` | `136.47 ns` | `341.59 ns` |
| yup          | `  3.40 µs/iter` | `  3.26 µs` | `  3.46 µs` | `  3.59 µs` | `  3.61 µs` |

| • built-in email validator (regexes differ) (valid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl          | ` 51.80 ns/iter` | ` 47.35 ns` | ` 50.80 ns` | `127.91 ns` | `194.98 ns` |
| ivl compiled | ` 41.66 ns/iter` | ` 37.96 ns` | ` 41.18 ns` | `103.09 ns` | `136.03 ns` |
| zod          | ` 70.53 ns/iter` | ` 63.73 ns` | ` 69.40 ns` | `141.86 ns` | `294.39 ns` |
| valibot      | ` 43.41 ns/iter` | ` 40.13 ns` | ` 43.64 ns` | ` 72.32 ns` | `143.37 ns` |
| yup          | `832.47 ns/iter` | `751.96 ns` | `880.36 ns` | `961.46 ns` | `981.26 ns` |

| • built-in email validator (regexes differ) (invalid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl          | ` 45.57 ns/iter` | ` 40.58 ns` | ` 44.95 ns` | `124.01 ns` | `155.78 ns` |
| ivl compiled | ` 36.58 ns/iter` | ` 31.31 ns` | ` 33.96 ns` | `111.54 ns` | `215.61 ns` |
| zod          | `  1.32 µs/iter` | `  1.18 µs` | `  1.29 µs` | `  2.22 µs` | `  2.77 µs` |
| valibot      | ` 70.15 ns/iter` | ` 62.03 ns` | ` 68.73 ns` | `137.41 ns` | `170.45 ns` |
| yup          | `  4.30 µs/iter` | `  4.04 µs` | `  4.41 µs` | `  4.60 µs` | `  4.65 µs` |

| • object schema, report all errors (valid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl          | `327.50 ns/iter` | `299.90 ns` | `320.39 ns` | `492.24 ns` | `668.48 ns` |
| ivl compiled | `203.15 ns/iter` | `185.28 ns` | `197.36 ns` | `349.93 ns` | `545.51 ns` |
| zod          | `348.37 ns/iter` | `309.78 ns` | `339.21 ns` | `617.57 ns` | `879.07 ns` |
| valibot      | `321.00 ns/iter` | `306.99 ns` | `322.20 ns` | `425.95 ns` | `498.46 ns` |
| yup          | `  5.37 µs/iter` | `  5.17 µs` | `  5.49 µs` | `  5.57 µs` | `  5.62 µs` |

| • object schema, report all errors (invalid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl          | `351.10 ns/iter` | `327.31 ns` | `353.17 ns` | `441.63 ns` | `531.51 ns` |
| ivl compiled | `198.54 ns/iter` | `184.70 ns` | `195.92 ns` | `283.96 ns` | `316.35 ns` |
| zod          | `  2.12 µs/iter` | `  1.87 µs` | `  2.28 µs` | `  2.59 µs` | `  2.60 µs` |
| valibot      | `545.94 ns/iter` | `497.96 ns` | `555.42 ns` | `665.79 ns` | `  1.13 µs` |
| yup          | ` 17.34 µs/iter` | `  8.43 µs` | ` 16.94 µs` | ` 47.33 µs` | `636.65 µs` |

| • object schema, pass/fail (valid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl compiled | `212.72 ns/iter` | `198.92 ns` | `210.15 ns` | `296.15 ns` | `305.23 ns` |
| zod          | `379.33 ns/iter` | `330.83 ns` | `355.65 ns` | `790.78 ns` | `972.48 ns` |
| valibot      | `335.73 ns/iter` | `325.24 ns` | `335.79 ns` | `419.19 ns` | `429.04 ns` |
| yup          | `  5.53 µs/iter` | `  5.33 µs` | `  5.60 µs` | `  5.83 µs` | `  5.83 µs` |

| • object schema, pass/fail (invalid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl compiled | `165.02 ns/iter` | `146.93 ns` | `154.26 ns` | `372.14 ns` | `539.38 ns` |
| zod          | `  2.05 µs/iter` | `  1.93 µs` | `  2.09 µs` | `  2.36 µs` | `  2.40 µs` |
| valibot      | `219.92 ns/iter` | `190.17 ns` | `206.55 ns` | `470.12 ns` | `573.75 ns` |
| yup          | `  6.74 µs/iter` | `  6.35 µs` | `  6.82 µs` | `  7.05 µs` | `  7.32 µs` |

| • object schema with an async rule, report all errors (valid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl          | `  1.49 µs/iter` | `991.00 ns` | `  1.55 µs` | `  3.67 µs` | `407.89 µs` |
| ivl compiled | `972.10 ns/iter` | `892.33 ns` | `  1.01 µs` | `  1.22 µs` | `  1.50 µs` |
| zod          | `  2.04 µs/iter` | `  1.45 µs` | `  2.13 µs` | `  4.55 µs` | `421.99 µs` |
| valibot      | `  2.06 µs/iter` | `  1.42 µs` | `  2.17 µs` | `  4.55 µs` | `413.39 µs` |
| yup          | `  6.34 µs/iter` | `  6.05 µs` | `  6.48 µs` | `  6.68 µs` | `  6.72 µs` |

| • object schema with an async rule, report all errors (invalid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl          | `  1.15 µs/iter` | `  1.08 µs` | `  1.20 µs` | `  1.25 µs` | `  1.45 µs` |
| ivl compiled | `988.52 ns/iter` | `926.70 ns` | `  1.04 µs` | `  1.09 µs` | `  1.09 µs` |
| zod          | `  3.25 µs/iter` | `  3.03 µs` | `  3.34 µs` | `  3.50 µs` | `  3.51 µs` |
| valibot      | `  1.76 µs/iter` | `  1.60 µs` | `  1.81 µs` | `  1.96 µs` | `  1.99 µs` |
| yup          | ` 12.97 µs/iter` | ` 12.54 µs` | ` 13.12 µs` | ` 13.27 µs` | ` 13.37 µs` |

## Node (V8)

- **clk**: ~4.25 GHz
- **cpu**: AMD EPYC 9V45 96-Core Processor
- **runtime**: node 24.21.0 (x64-linux)

| • ivl execution paths |              avg |         min |         p75 |         p99 |         max |
| ------------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| pure regex helper  | ` 24.51 ns/iter` | ` 20.15 ns` | ` 23.01 ns` | ` 59.01 ns` | `141.77 ns` |
| async regex helper | `115.24 ns/iter` | `103.07 ns` | `116.37 ns` | `244.47 ns` | `565.06 ns` |
| smart regex helper | ` 57.60 ns/iter` | ` 53.07 ns` | ` 56.42 ns` | `113.03 ns` | `173.16 ns` |
| sync regex helper  | ` 37.14 ns/iter` | ` 34.47 ns` | ` 37.31 ns` | ` 54.91 ns` | ` 88.52 ns` |

| • single regex rule, report all errors (valid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl          | ` 62.56 ns/iter` | ` 57.85 ns` | ` 61.46 ns` | `121.22 ns` | `259.12 ns` |
| ivl compiled | ` 33.48 ns/iter` | ` 30.43 ns` | ` 33.13 ns` | ` 53.45 ns` | `104.86 ns` |
| zod          | ` 83.41 ns/iter` | ` 68.60 ns` | `103.02 ns` | `216.69 ns` | `618.68 ns` |
| valibot      | ` 43.02 ns/iter` | ` 40.24 ns` | ` 43.45 ns` | ` 60.00 ns` | `136.12 ns` |
| yup          | `698.06 ns/iter` | `638.67 ns` | `710.79 ns` | `  1.00 µs` | `  1.24 µs` |

| • single regex rule, report all errors (invalid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl          | ` 49.52 ns/iter` | ` 46.45 ns` | ` 49.37 ns` | ` 68.94 ns` | ` 95.38 ns` |
| ivl compiled | ` 23.19 ns/iter` | ` 21.80 ns` | ` 22.96 ns` | ` 38.54 ns` | `113.55 ns` |
| zod          | `  1.53 µs/iter` | `  1.28 µs` | `  1.36 µs` | `  3.73 µs` | `  3.76 µs` |
| valibot      | `184.48 ns/iter` | ` 71.54 ns` | ` 78.01 ns` | `  4.15 µs` | `  4.90 µs` |
| yup          | ` 23.65 µs/iter` | ` 22.82 µs` | ` 23.81 µs` | ` 23.96 µs` | ` 25.73 µs` |

| • single regex rule, pass/fail (valid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl compiled | ` 32.47 ns/iter` | ` 29.39 ns` | ` 33.25 ns` | ` 38.61 ns` | ` 83.76 ns` |
| zod          | ` 72.01 ns/iter` | ` 66.45 ns` | ` 70.41 ns` | `122.20 ns` | `604.70 ns` |
| valibot      | ` 40.36 ns/iter` | ` 38.46 ns` | ` 40.81 ns` | ` 47.20 ns` | `100.89 ns` |
| yup          | `696.18 ns/iter` | `668.23 ns` | `705.27 ns` | `760.27 ns` | `810.10 ns` |

| • single regex rule, pass/fail (invalid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl compiled | ` 22.68 ns/iter` | ` 21.30 ns` | ` 22.63 ns` | ` 36.02 ns` | `127.04 ns` |
| zod          | `  1.50 µs/iter` | `  1.30 µs` | `  1.33 µs` | `  3.32 µs` | `  3.41 µs` |
| valibot      | `188.62 ns/iter` | ` 71.83 ns` | ` 76.80 ns` | `  4.18 µs` | `  5.15 µs` |
| yup          | ` 13.65 µs/iter` | ` 13.58 µs` | ` 13.70 µs` | ` 13.70 µs` | ` 13.72 µs` |

| • built-in email validator (regexes differ) (valid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl          | `118.83 ns/iter` | `107.39 ns` | `114.09 ns` | `295.92 ns` | `390.04 ns` |
| ivl compiled | ` 43.08 ns/iter` | ` 40.58 ns` | ` 43.35 ns` | ` 68.22 ns` | `145.20 ns` |
| zod          | `117.66 ns/iter` | `100.59 ns` | `106.00 ns` | `346.64 ns` | `654.21 ns` |
| valibot      | ` 46.13 ns/iter` | ` 43.45 ns` | ` 46.57 ns` | ` 67.45 ns` | `142.49 ns` |
| yup          | `675.60 ns/iter` | `639.19 ns` | `683.40 ns` | `785.82 ns` | `  1.21 µs` |

| • built-in email validator (regexes differ) (invalid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl          | `103.16 ns/iter` | ` 97.03 ns` | `104.03 ns` | `132.85 ns` | `181.27 ns` |
| ivl compiled | ` 34.96 ns/iter` | ` 31.56 ns` | ` 34.17 ns` | ` 73.88 ns` | `179.74 ns` |
| zod          | `  1.61 µs/iter` | `  1.37 µs` | `  1.45 µs` | `  3.51 µs` | `  3.71 µs` |
| valibot      | `170.76 ns/iter` | ` 71.09 ns` | ` 76.18 ns` | `  3.93 µs` | `  5.23 µs` |
| yup          | ` 22.65 µs/iter` | ` 21.50 µs` | ` 22.21 µs` | ` 24.04 µs` | ` 28.84 µs` |

| • object schema, report all errors (valid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl          | `725.21 ns/iter` | `700.77 ns` | `724.11 ns` | `830.31 ns` | `  1.17 µs` |
| ivl compiled | `261.26 ns/iter` | `251.23 ns` | `260.07 ns` | `318.92 ns` | `555.87 ns` |
| zod          | `748.41 ns/iter` | `641.54 ns` | `681.16 ns` | `  1.57 µs` | `  1.62 µs` |
| valibot      | `423.50 ns/iter` | `404.05 ns` | `417.93 ns` | `734.86 ns` | `893.94 ns` |
| yup          | `  4.93 µs/iter` | `  4.82 µs` | `  4.93 µs` | `  5.27 µs` | `  5.52 µs` |

| • object schema, report all errors (invalid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl          | `695.66 ns/iter` | `681.21 ns` | `694.45 ns` | `751.23 ns` | `918.42 ns` |
| ivl compiled | `256.14 ns/iter` | `246.15 ns` | `258.42 ns` | `291.06 ns` | `329.57 ns` |
| zod          | `  3.57 µs/iter` | `  1.95 µs` | `  3.13 µs` | `  8.54 µs` | `  8.68 ms` |
| valibot      | `  1.34 µs/iter` | `725.76 ns` | `769.83 ns` | `  6.39 µs` | `  6.67 µs` |
| yup          | ` 56.17 µs/iter` | ` 26.44 µs` | ` 72.63 µs` | `132.72 µs` | `363.54 µs` |

| • object schema, pass/fail (valid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl compiled | `290.00 ns/iter` | `280.18 ns` | `289.45 ns` | `334.74 ns` | `694.99 ns` |
| zod          | `743.37 ns/iter` | `654.72 ns` | `701.12 ns` | `  1.25 µs` | `  1.27 µs` |
| valibot      | `402.39 ns/iter` | `391.71 ns` | `402.53 ns` | `444.24 ns` | `753.31 ns` |
| yup          | `  4.98 µs/iter` | `  4.90 µs` | `  5.00 µs` | `  5.09 µs` | `  5.24 µs` |

| • object schema, pass/fail (invalid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl compiled | `220.63 ns/iter` | `212.62 ns` | `219.76 ns` | `252.80 ns` | `478.33 ns` |
| zod          | `  3.33 µs/iter` | `  2.62 µs` | `  4.45 µs` | `  5.82 µs` | `  6.13 µs` |
| valibot      | `472.12 ns/iter` | `286.54 ns` | `300.30 ns` | `  5.70 µs` | `  5.85 µs` |
| yup          | ` 15.55 µs/iter` | ` 14.94 µs` | ` 15.32 µs` | ` 15.95 µs` | ` 19.16 µs` |

| • object schema with an async rule, report all errors (valid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl          | `  1.86 µs/iter` | `  1.37 µs` | `  1.96 µs` | `  4.55 µs` | `  4.88 µs` |
| ivl compiled | `  2.08 µs/iter` | `  1.20 µs` | `  2.54 µs` | `  4.50 µs` | `  4.60 µs` |
| zod          | `  1.83 µs/iter` | `  1.71 µs` | `  1.92 µs` | `  2.10 µs` | `  2.22 µs` |
| valibot      | `  2.36 µs/iter` | `  1.83 µs` | `  2.69 µs` | `  2.92 µs` | `  3.12 µs` |
| yup          | `  5.48 µs/iter` | `  5.35 µs` | `  5.48 µs` | `  5.72 µs` | `  6.15 µs` |

| • object schema with an async rule, report all errors (invalid input) |              avg |         min |         p75 |         p99 |         max |
| ------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl          | `  1.85 µs/iter` | `  1.37 µs` | `  2.28 µs` | `  3.41 µs` | `  3.68 µs` |
| ivl compiled | `  1.55 µs/iter` | `  1.14 µs` | `  2.14 µs` | `  2.27 µs` | `  2.53 µs` |
| zod          | `  4.05 µs/iter` | `  3.42 µs` | `  4.66 µs` | `  4.77 µs` | `  4.80 µs` |
| valibot      | `  3.10 µs/iter` | `  2.04 µs` | `  3.62 µs` | `  4.11 µs` | `  4.99 µs` |
| yup          | ` 40.79 µs/iter` | ` 16.19 µs` | ` 62.34 µs` | ` 84.30 µs` | `705.87 µs` |

**Caveats**


- Error reports differ in detail: ivl returns the names of the failing rules, zod and valibot build an issue object per failure and copy the parsed value, and yup throws a ValidationError. The "report all errors" results on invalid input largely measure that cost; the "pass/fail" scenarios compare validation alone.
- After a failed type check, zod and valibot skip the rest of that field, while ivl still runs every rule unless break_early is set.
- In "pass/fail", valibot (v.is) and yup (isValidSync) stop at the first failure in the whole object; ivl (break_early) still checks every field, stopping within each; zod has no early-exit mode, so it runs safeParse and reads .success.
- The "built-in email" scenario uses each library's own email regex, so it compares what you get out of the box rather than equal work; ivl's regex is simpler and looser than zod's.
- Each benchmark cycles through 8 valid or 8 invalid inputs. The async rule resolves immediately, so the async scenario measures promise overhead, not I/O.
<!-- benchmark:end -->
