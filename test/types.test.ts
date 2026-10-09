// Compile-time assertions for the inferred types. This file is checked by `bun run typecheck`;
// the single runtime test below only exists so `bun test` picks the file up.
import { test, expect } from 'bun:test';

import { getValueErrors, getSchemaErrors, getSchemaErrorsSync, getSchemaErrorsAsync, compileRules, compileSchema } from '../src';
import { allowUndefined, preprocess, minLength, acceptAnySync, acceptAnyAsync, notAsync, everyElementSync, everyElementAsync } from '../src/helpers';
import type { RULE, RULES, SCHEMA, CHECKED_SCHEMA_SYNC } from '../src';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

const sync_rules = { "a": (i: unknown) => typeof i === 'string' };
const async_rules = { "a": async (i: unknown) => typeof i === 'string' };
const mixed_rules = { ...sync_rules, "b": async () => true };
const annotated_rules: RULES = { "a": () => true };

// --- getValueErrors: sync / async is inferred from the rules ------------------------
type _v1 = Expect<Equal<ReturnType<typeof getValueErrors<unknown, typeof sync_rules>>, string[]>>;
type _v2 = Expect<Equal<ReturnType<typeof getValueErrors<unknown, typeof async_rules>>, Promise<string[]>>>;
type _v3 = Expect<Equal<ReturnType<typeof getValueErrors<unknown, typeof mixed_rules>>, Promise<string[]>>>;
// Rules annotated with the loose `RULES` type can't be resolved statically
type _v4 = Expect<Equal<ReturnType<typeof getValueErrors<unknown, typeof annotated_rules>>, string[] | Promise<string[]>>>;

// --- getValueErrors: rules are checked against the value type -----------------------
const string_rules = { "long enough": (s: string) => s.length > 3 };
getValueErrors('hello', string_rules);
// @ts-expect-error a number is not assignable to a rule expecting a string
getValueErrors(123, string_rules);

// `satisfies` keeps the narrow rule types, unlike a `: RULES` annotation
const satisfied_rules = { "a": async () => true } satisfies RULES;
type _v5 = Expect<Equal<ReturnType<typeof getValueErrors<unknown, typeof satisfied_rules>>, Promise<string[]>>>;

// --- getSchemaErrors: keys and per-key shapes are inferred ---------------------------
const schema = {
	name: sync_rules,
	// An array of rule sets => string[][]
	id: [sync_rules, { "is number": (i: unknown) => typeof i === 'number' }],
};
const sync_result = getSchemaErrors({}, schema);
type _s1 = Expect<Equal<typeof sync_result['name'], string[]>>;
type _s2 = Expect<Equal<typeof sync_result['id'], string[][]>>;
// Unknown keys are still accessible (strict mode may add them)
type _s3 = Expect<Equal<typeof sync_result['anything'], string[] | string[][]>>;

const async_result = getSchemaErrors({}, { ...schema, email: async_rules });
type _s4 = Expect<Equal<typeof async_result, Promise<Awaited<typeof async_result>>>>;
type _s5 = Expect<Equal<Awaited<typeof async_result>['email'], string[]>>;

const annotated_schema: SCHEMA = schema;
const annotated_result = getSchemaErrors({}, annotated_schema);
type _s6 = Expect<Equal<typeof annotated_result, CHECKED_SCHEMA_SYNC<SCHEMA> | Promise<CHECKED_SCHEMA_SYNC<SCHEMA>>>>;

// Explicit variants keep their fixed sync / async return types
type _s7 = Expect<Equal<ReturnType<typeof getSchemaErrorsSync<typeof schema>>['name'], string[]>>;
type _s8 = Expect<Equal<Awaited<ReturnType<typeof getSchemaErrorsAsync<typeof schema>>>['id'], string[][]>>;
// @ts-expect-error the sync variant refuses async rules
getSchemaErrorsSync({}, { email: async_rules });

// --- helpers preserve sync / async-ness ----------------------------------------------
type _h1 = Expect<Equal<ReturnType<typeof getValueErrors<unknown, ReturnType<typeof allowUndefined<typeof sync_rules>>>>, string[]>>;
type _h2 = Expect<Equal<ReturnType<typeof getValueErrors<unknown, ReturnType<typeof allowUndefined<typeof async_rules>>>>, Promise<string[]>>>;

const preprocessed = preprocess((i) => String(i), { "trimmed": (s: string) => s.trim().length > 0, "checked": async (s: string) => s.length < 10 });
type _h3 = Expect<Equal<ReturnType<typeof getValueErrors<unknown, typeof preprocessed>>, Promise<string[]>>>;
// The returned rules accept `unknown`, regardless of what the inner rules were typed as
type _h4 = Expect<Equal<Parameters<typeof preprocessed['trimmed']>[0], unknown>>;
// @ts-expect-error inner rules must accept the output of `fn`
preprocess((i) => Number(i), { "bad": (s: string) => s.length > 0 });

// Overload arguments can be typed on individual rules
const with_context: RULE<string, [ctx: { db: string }]> = (value, ctx) => ctx.db.includes(value);
type _o1 = Expect<Equal<Parameters<typeof with_context>[1], { db: string }>>;

// Rule helpers return sync rules, so composing them stays sync
type _o2 = Expect<Equal<ReturnType<typeof getValueErrors<unknown, { a: ReturnType<typeof acceptAnySync>, b: ReturnType<typeof minLength> }>>, string[]>>;

// Always-async combinators are typed RULE_ASYNC, so the result is a clean Promise (not a union)
type _o3 = Expect<Equal<ReturnType<typeof getValueErrors<unknown, { a: ReturnType<typeof acceptAnyAsync>, b: ReturnType<typeof notAsync> }>>, Promise<string[]>>>;

// Element rules may be typed against the element, not just `unknown`
const typed_every_sync = everyElementSync((n: number) => n > 0);
const typed_every_async = everyElementAsync(async (s: string) => s.length > 0);
type _o4 = Expect<Equal<ReturnType<typeof getValueErrors<unknown, { a: typeof typed_every_sync }>>, string[]>>;
type _o5 = Expect<Equal<ReturnType<typeof getValueErrors<unknown, { a: typeof typed_every_async }>>, Promise<string[]>>>;

// --- compileRules / compileSchema: same inference as the uncompiled functions --------
type _c1 = Expect<Equal<ReturnType<ReturnType<typeof compileRules<typeof sync_rules>>>, string[]>>;
type _c2 = Expect<Equal<ReturnType<ReturnType<typeof compileRules<typeof async_rules>>>, Promise<string[]>>>;
type _c3 = Expect<Equal<ReturnType<ReturnType<typeof compileRules<typeof mixed_rules>>>, Promise<string[]>>>;
type _c4 = Expect<Equal<ReturnType<ReturnType<typeof compileRules<typeof annotated_rules>>>, string[] | Promise<string[]>>>;
// The value parameter comes from the rules
compileRules(string_rules)('hello');
// @ts-expect-error a number is not assignable to a rule expecting a string
compileRules(string_rules)(123);
compileRules(sync_rules)(123);
// Rules with typed overloads are accepted
const context_rules = { "in db": (i: string, ctx: { db: Set<string> }) => ctx.db.has(i) };
compileRules(context_rules)('x', { db: new Set() });

const compiled_sync = compileSchema(schema)({});
type _c5 = Expect<Equal<typeof compiled_sync, CHECKED_SCHEMA_SYNC<typeof schema>>>;
const compiled_async = compileSchema({ ...schema, extra: async_rules })({});
type _c6 = Expect<Equal<typeof compiled_async, Promise<CHECKED_SCHEMA_SYNC<typeof schema & { extra: typeof async_rules }>>>>;

// Referenced here so `noUnusedLocals` is satisfied
export type Assertions = [_v1, _v2, _v3, _v4, _v5, _s1, _s2, _s3, _s4, _s5, _s6, _s7, _s8, _h1, _h2, _h3, _h4, _o1, _o2, _o3, _o4, _o5, _c1, _c2, _c3, _c4, _c5, _c6];

test('type assertions compile', () => { expect(true).toBe(true); });
