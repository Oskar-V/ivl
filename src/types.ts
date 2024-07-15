export type RULE = (value: unknown, ...overload: unknown[]) => boolean | Promise<boolean>;
export type RULE_SYNC = (value: unknown, ...overload: unknown[]) => boolean;

export type RULES = { [index: string]: RULE };
export type RULES_SYNC = { [index: string]: RULE_SYNC }

export type SCHEMA = { [index: string]: RULES };
export type SCHEMA_SYNC = { [index: string]: RULES_SYNC }

export type CHECKABLE_OBJECT = { [index: string]: unknown };

export type CHECKED_SCHEMA = Promise<{ [index: string]: string[] }>
export type CHECKED_SCHEMA_SYNC = { [index: string]: string[] }
