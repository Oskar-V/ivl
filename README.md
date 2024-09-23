# Super lightweight input validation library
This is a lightweight library for user input validation.
Main focus is on speed and flexibility of the validation rules.

By default `getInputErrors` and `getSchemaErrors` automatically detects and chooses the most performant checking method for your rule set.

If your rule set and/or schema are very large or complex, you may want to directly use `getInputErrorsSync`/`getSchemaErrorsSync` or `getInputErrorsAsync`/`getSchemaErrorsAsync` for improved performance on synchronous and asynchronous rule sets respectively.

Use synchronous versions of the functions for better performance if you don't need to support asynchronous checks on your inputs. 


# Main functionality
Write your own custom validators to exactly match your use case using a simple object:
```javascript
const my_rules = {
  "Input must be more than 40": (i) => i > 40,
  "Input must be divisible by 10": (i) => !(i % 10)
}
console.log(getInputErrors(50, my_rules)); // []
console.log(getInputErrors(11, my_rules)); // ["Input must be more than 40", "Input must be divisible by 10"]
console.log(getInputErrors(30, my_rules)) // ["Input must be more than 40"]
```
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
import { getInputErrors } from 'ivl';
import type { RULES } from 'ivl';
import { matchesRegex, minLength, maxLength, isType } from 'ivl/helpers';

// This pattern is also exportable from 'ivl/patterns'
const EMAIL_PATTERN = /^[\w.%+-]+@[\w.-]+\.[a-zA-Z]{1,}$/;

const EMAIL_REQUIREMENTS: RULES = {
  "Must be string": isType('string'),
  "Must be less then 100 characters": maxLength(100),
  "Not a valid email address": matchesRegex(EMAIL_PATTERN),
  "That email is already in use": async (i) => {
    // Fetch info from whatever backend and make a decision based on that asynchronously
    const email_in_use = await fetch(`https://mybackend/email-exists/${i}`)
    return !email_in_use // We will return true if the email is not already taken
  }
};

const PASSWORD_REQUIREMENTS: RULES = {
  "Must be string": isType('string'),
  "Must be at least 8 characters": minLength(8),
  "Must contain at least one upper case character": matchesRegex(/[A-Z]/),
  "Must contain at least one lower case character": matchesRegex(/[a-z]/),
};

// You can of course expand on your existing rules: 
const STRONG_PASSWORD_REQUIREMENTS: RULES = {
  ...PASSWORD_REQUIREMENTS,
  "Must contain at least one digit": matchesRegex(/\d/),
  "Must contain at least one symbol": matchesRegex(/[^\w\s]/),
};

const email_value = "some-value";
const pw_value = "Passesweakpw";

const email_errors = getInputErrors(email_value, EMAIL_REQUIREMENTS);
const pw_errors = getInputErrors(pw_value, PASSWORD_REQUIREMENTS);
const strong_pw_errors = getInputErrors(pw_value, STRONG_PASSWORD_REQUIREMENTS);

console.log({email_errors, pw_errors, strong_pw_errors});
```


## Backend example with Hono & Bun.js

### `rules.ts`
```typescript
import { isType, minLength, maxLength, matchesRegex } from 'ivl/helpers';
import { EMAIL_PATTERN } from 'ivl/patterns';
import type { SCHEMA } from 'ivl';
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
  organization_name: {}
  email: {
    ...EMAIL_REQUIREMENTS,
    "Email already registered": existsInDatabase('email','users', false)
  },
  password: PASSWORD_REQUIREMENTS
};

// Registering via invitation needs all the same values except organization name
// inherit parts of rule sets, as opposed to extending the rule set as show in the
// frontend example
export const INVITE_REGISTER_SCHEMA = (({ organization_name, ...invite_schema }) => invite_schema)(REGISTRATION_SCHEMA)

export const INVITATION_PARAM: SCHEMA = {
  invitation_code: {
    "Not a valid invitation": existsInDatabase('code', 'invitation')
  }
};

```

### `index.ts`
```typescript
import { Hono, ValidationTargets } from 'hono';
import { validator } from 'hono/validator';
import { getSchemaErrors } from 'ivl';
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