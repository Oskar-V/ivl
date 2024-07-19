export type RULE_SYNC = (value: unknown, ...overload: unknown[]) => boolean;
export type RULE = (value: unknown, ...overload: unknown[]) => boolean | Promise<boolean>;

export type RULES_SYNC = { [index: string]: RULE_SYNC };
export type RULES = { [index: string]: RULE };

export type SCHEMA_SYNC = { [index: string]: RULES_SYNC };
export type SCHEMA = { [index: string]: RULES };

export type CHECKABLE_OBJECT = { [index: string]: unknown };

/**
 * @arg {boolean} strict --- Don't allow object to have keys not included in the schema
 * @arg {boolean} break_early --- Return the first error found
 */
export type SCHEMA_OPTIONS = {
	strict?: boolean
	// break_early?: boolean
};

export type CHECKED_SCHEMA_SYNC = { [index: string]: string[] };
export type CHECKED_SCHEMA = Promise<CHECKED_SCHEMA_SYNC>;
