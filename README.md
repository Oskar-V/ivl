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
Compare rows within a table rather than across runs.

- **clk**: ~1.57 GHz
- **cpu**: AMD EPYC 7763 64-Core Processor
- **runtime**: bun 1.4.2 (x64-linux)

| • Regex promise vs no promise |              avg |         min |         p75 |         p99 |         max |
| ------------------ | ---------------- | ----------- | ----------- | ----------- | ----------- |
| pure regex helper  | `  7.08 ns/iter` | `  5.04 ns` | `  6.16 ns` | ` 56.46 ns` | `126.26 ns` |
| async regex helper | `374.36 ns/iter` | `351.56 ns` | `366.67 ns` | `562.45 ns` | `627.72 ns` |
| smart regex helper | `163.46 ns/iter` | `141.04 ns` | `151.71 ns` | `308.08 ns` | `638.28 ns` |
| sync regex helper  | `101.63 ns/iter` | ` 94.49 ns` | ` 99.88 ns` | `166.06 ns` | `350.99 ns` |

| • Compare simple regex with other libraries |              avg |         min |         p75 |         p99 |         max |
| ---------------- | ---------------- | ----------- | ----------- | ----------- | ----------- |
| ivl smart regex  | `157.51 ns/iter` | `145.43 ns` | `155.35 ns` | `223.88 ns` | `325.46 ns` |
| ivl sync regex   | `103.97 ns/iter` | ` 96.77 ns` | `101.51 ns` | `173.17 ns` | `194.60 ns` |
| ivl async regex  | `304.87 ns/iter` | `282.51 ns` | `298.78 ns` | `422.95 ns` | `494.39 ns` |
| ivl sync custom  | `112.35 ns/iter` | `101.32 ns` | `110.99 ns` | `180.52 ns` | `231.06 ns` |
| ivl async custom | `336.46 ns/iter` | `294.49 ns` | `367.35 ns` | `557.00 ns` | `674.76 ns` |
| zod sync regex   | `  5.78 µs/iter` | `  3.73 µs` | `  5.69 µs` | ` 18.61 µs` | `471.11 µs` |
| zod async regex  | `  6.33 µs/iter` | `  4.44 µs` | `  7.10 µs` | `  9.07 µs` | `  9.27 µs` |
| zod sync custom  | `  1.99 µs/iter` | `  1.09 µs` | `  1.94 µs` | `  6.41 µs` | `389.93 µs` |
| zod async custom | `  2.05 µs/iter` | `  1.22 µs` | `  2.56 µs` | `  3.95 µs` | `  4.98 µs` |
| yup sync regex   | `  4.65 µs/iter` | `  2.96 µs` | `  4.58 µs` | ` 17.17 µs` | `511.93 µs` |
| yup async regex  | `  3.56 µs/iter` | `  3.26 µs` | `  3.72 µs` | `  3.95 µs` | `  3.95 µs` |
| yup sync custom  | `  2.97 µs/iter` | `  2.86 µs` | `  2.99 µs` | `  3.22 µs` | `  3.73 µs` |
| yup async custom | `  3.49 µs/iter` | `  3.18 µs` | `  3.67 µs` | `  3.79 µs` | `  3.80 µs` |
<!-- benchmark:end -->
