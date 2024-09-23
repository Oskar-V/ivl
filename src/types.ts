export type RULE_SYNC = (value: unknown, ...overload: unknown[]) => boolean;
export type RULE = (value: unknown, ...overload: unknown[]) => boolean | Promise<boolean>;

export type RULES_SYNC = { [index: string]: RULE_SYNC };
export type RULES = { [index: string]: RULE };

export type SCHEMA_SYNC = { [index: string]: RULES_SYNC | RULES_SYNC[] };
export type SCHEMA = { [index: string]: RULES | RULES[] };

/**
 * @arg {boolean} strict --- Don't allow object to have keys not included in the schema
*/
export type SCHEMA_OPTIONS = {
	strict?: boolean
	// break_early?: boolean
};

export type CHECKABLE_OBJECT = { [index: string]: unknown };

export type CHECKED_SCHEMA_SYNC<T extends keyof CHECKABLE_OBJECT> = { [K in T]: string[] | string[][] };
export type CHECKED_SCHEMA<T extends keyof CHECKABLE_OBJECT> = Promise<CHECKED_SCHEMA_SYNC<T>>;
