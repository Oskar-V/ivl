import type { RULES, SCHEMA, CHECKABLE_OBJECT, CHECKED_SCHEMA, RULES_SYNC, SCHEMA_SYNC, CHECKED_SCHEMA_SYNC, SCHEMA_OPTIONS, RULE } from '@types';

const DEFAULT_SCHEMA_OPTIONS: SCHEMA_OPTIONS = {
	strict: false,
	// break_early: false // To be implemented
};

/**
 * Detect if a RULES object has any async rules in it
 * 
 * @param {Record<string, RULE>} rules a rules object
 * @returns {boolean} true if any of the rules is an async function otherwise false
 */
export const hasAsyncFunction = (rules: Record<string, RULE>): boolean =>
	Object.values(rules).some(value =>
		typeof value === 'function' && value.constructor.name === 'AsyncFunction'
	);

/**
 * Check the input against all provided validation rules asynchronously
 * 
 * @param {unknown} value the value to check
 * @param {RULES} rules rules object to use for validating the provided value
 * @param {unknown[]} overload array of extra values the validator rules might need to properly validate the value 
 * @returns {string[]} a list of rule names which failed validation
 */
export const getValueErrorsAsync = async (
	value: unknown,
	rules: RULES,
	...overload: unknown[]
): Promise<string[]> => {
	const errors: { [index: string]: Promise<boolean> | boolean } = {};
	Object.entries(rules).forEach(([key, rule]) => {
		// Wrap everything into a promise
		errors[key] = Promise.resolve(false)
			.then(() => rule(value, ...overload))
			.then((result) => errors[key] = result)
			.catch(() => {
				return errors[key] = false
			});
	});

	await Promise.allSettled(Object.values(errors));

	// Filter out the non empty errors and map to an array
	return Object.entries(errors).reduce<string[]>(
		(acc, [error, val]) => (val ? acc : [...acc, error]),
		[]);
}

/**
 * Check a schema against all provided validation rules asynchronously
 * 
 * @param {CHECKABLE_OBJECT} object_to_check object to be validated
 * @param {SCHEMA} schema schema to validate against
 * @param {SCHEMA_OPTIONS} options options affecting how the rules are run
 * @param {unknown[]} overload array of extra values the validator rules might need to properly validate the value 
 * @returns {CHECKED_SCHEMA<T>} an object containing keys and their respective lists of failed rule names
 */
export const getSchemaErrorsAsync = async <T extends keyof CHECKABLE_OBJECT>(
	object_to_check: Pick<CHECKABLE_OBJECT, T>,
	schema: { [K in T]: RULES },
	options: SCHEMA_OPTIONS = DEFAULT_SCHEMA_OPTIONS,
	...overload: unknown[]
) => {
	const errors: Partial<CHECKED_SCHEMA_SYNC<T>> | Promise<string[]>[] = {};
	const validationPromises: Promise<void>[] = [];
	// const errors: { [index: string]: any } = {}
	Object.entries<RULES>(schema).forEach(([key, rules]) => {
		validationPromises.push(
			getValueErrorsAsync(object_to_check[key as T], rules, ...overload)
				.then((result) => { errors[key as T] = result })
				.catch((result) => { errors[key as T] = result })
		)
	});

	if (options.strict) {
		const incoming_keys = Object.keys(object_to_check);
		const allowed_keys = new Set(Object.keys(schema));
		const disallowed_keys = incoming_keys.filter((key) => !allowed_keys.has(key));
		disallowed_keys.forEach((key) => { errors[key as T] = ['Key not allowed'] });
	}

	await Promise.allSettled(Object.values(validationPromises));
	return errors as CHECKED_SCHEMA<T>;
}

/**
 * 
 * @param {unknown} value the value to check
 * @param {RULES_SYNC} rules rules object to use for validating the provided value
 * @param {unknown[]} overload array of extra values the validator rules might need to properly validate the value 
 * @returns {string[]} a list of rule names which failed validation
 */
export const getValueErrorsSync = (
	value: unknown,
	rules: RULES_SYNC,
	...overload: unknown[]
): string[] =>
	Object.entries(rules).reduce<string[]>(
		(acc, [key, rule]) => {
			try {
				return rule(value, ...overload) ? acc : [...acc, key];
			} catch (error) {
				return [...acc, key];
			}
		},
		[]);

/**
* Check a schema against all provided validation rules asynchronously
* 
* @param {CHECKABLE_OBJECT} object object to be validated
* @param {SCHEMA} schema schema to validate against
* @param {SCHEMA_OPTIONS} options options affecting how the rules are run
* @param {unknown[]} overload array of extra values the validator rules might need to properly validate the value 
* @returns {CHECKED_SCHEMA_SYNC<T>} an object containing keys and their respective lists of failed rule names
*/
export const getSchemaErrorsSync = <T extends keyof CHECKABLE_OBJECT>(
	object: CHECKABLE_OBJECT,
	schema: SCHEMA_SYNC,
	options: SCHEMA_OPTIONS = DEFAULT_SCHEMA_OPTIONS,
	...overload: unknown[]
): CHECKED_SCHEMA_SYNC<T> => {
	const errors = Object.entries(schema).reduce(
		(acc, [key, rules]) => (
			{ ...acc, [key]: getValueErrorsSync(object[key], rules, ...overload) }
		),
		{} as CHECKED_SCHEMA_SYNC<T>);

	if (options.strict) {
		const incoming_keys = Object.keys(object);
		const allowed_keys = new Set(Object.keys(schema));
		const disallowed_keys = incoming_keys.filter((key) => !allowed_keys.has(key));
		disallowed_keys.forEach((key) => { errors[key as T] = ['Key not allowed'] });
	}

	return errors;
}

/**
 * 
 * @param {unknown} value the value to check
 * @param {RULES|RULES_SYNC} rules rules object to use for validating the provided value
 * @param {unknown[]} overload array of extra values the validator rules might need to properly validate the value 
 * @returns {Promise<string[]>|string[]} a list of rule names which failed validation
 */
export const getValueErrors = (
	value: unknown,
	rules: RULES | RULES_SYNC,
	...overload: unknown[]): Promise<string[]> | string[] => {
	if (hasAsyncFunction(rules)) {
		return getValueErrorsAsync(value, rules, ...overload);
	}
	return getValueErrorsSync(value, rules as RULES_SYNC, ...overload);
}

/**
 * Check a schema against all provided validation rules
 * 
 * @param {CHECKABLE_OBJECT} object object to be validated
 * @param {SCHEMA} schema schema to validate against
 * @param {SCHEMA_OPTIONS} options options affecting how the rules are run
 * @param {unknown[]} overload array of extra values the validator rules might need to properly validate the value 
 * @returns {CHECKED_SCHEMA} an object containing keys and their respective lists of failed rule names
 */
export const getSchemaErrors = <T extends keyof CHECKABLE_OBJECT>(
	object: CHECKABLE_OBJECT,
	schema: SCHEMA_SYNC | SCHEMA,
	options: SCHEMA_OPTIONS = DEFAULT_SCHEMA_OPTIONS,
	...overload: unknown[]): CHECKED_SCHEMA<T> | CHECKED_SCHEMA_SYNC<T> => {
	if (Object.values(schema).some(hasAsyncFunction)) {
		return getSchemaErrorsAsync(object, schema, options, ...overload)
	}
	return getSchemaErrorsSync(object, schema as SCHEMA_SYNC, options, ...overload)
}