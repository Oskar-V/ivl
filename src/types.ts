type RULE = (value: unknown, ...overload: unknown[]) => boolean | Promise<boolean>;
type RULES = { [index: string]: RULE };
type CHECKABLE_OBJECT = { [index: string]: unknown };
type SCHEMA = { [index: string]: RULES };
type CHECKED_SCHEMA = Promise<{ [index: string]: string[] }>

export type { RULE, RULES, CHECKABLE_OBJECT, SCHEMA, CHECKED_SCHEMA };