import type { RULES, SCHEMA, CHECKABLE_OBJECT, CHECKED_SCHEMA, RULES_SYNC, SCHEMA_SYNC, CHECKED_SCHEMA_SYNC, SCHEMA_OPTIONS, RULE } from '@types';

const DEFAULT_SCHEMA_OPTIONS: SCHEMA_OPTIONS = {
	strict: false,
	// break_early: false // To be implemented
};

/**
 * Detect if a RULES object has any async rules in it
 * 
 * @param {Record<string, RULE>|Record<string, RULE>[]} rules a rules object
 * @returns {boolean} true if any of the rules is an async function otherwise false
 */
export const hasAsyncFunction = (rules: Record<string, RULE> | Record<string, RULE>[]): boolean => {
	if (Array.isArray(rules)) {
		return rules.some((e) =>
			Object.values(e).some((rule =>
				typeof rule === 'function' && rule.constructor.name === 'AsyncFunction'
			))
		)
	}
	return Object.values(rules).some(rule =>
		typeof rule === 'function' && rule.constructor.name === 'AsyncFunction'
	)
};

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
	schema: { [K in T]: RULES | RULES[] },
	options: SCHEMA_OPTIONS = DEFAULT_SCHEMA_OPTIONS,
	...overload: unknown[]
) => {
	const errors: Partial<CHECKED_SCHEMA_SYNC<T>> | Promise<T[]>[] = {};
	const validationPromises: Promise<void>[] = [];
	Object.entries<RULES | RULES[]>(schema).forEach(([key, rules]) => {
		let promise;
		if (Array.isArray(rules)) {
			promise = Promise.allSettled(
				rules.map((rule_set) => getValueErrorsAsync(object_to_check[key as T], rule_set, ...overload)))
				.then((result) => {
					const tmp = result.map((e) => {
						if (e.status === 'fulfilled')
							return e.value
						return ["Unknown error occurred"]
					}, []);

					if (tmp.some((e) => !e.length))
						errors[key as T] = []
					else
						errors[key as T] = tmp
				})
				.catch((error: unknown) => {
					if (error instanceof Error) {
						errors[key as T] = [error.message]
					} else {
						errors[key as T] = ['Unknown error occurred']
					}
				})
		} else {
			promise = getValueErrorsAsync(object_to_check[key as T], rules, ...overload)
				.then((result) => { errors[key as T] = result })
				.catch((result) => { errors[key as T] = result })
		}
		validationPromises.push(promise)
	});

	if (options.strict) {
		const incoming_keys = Object.keys(object_to_check);
		const allowed_keys = new Set(Object.keys(schema));
		const disallowed_keys = incoming_keys.filter((key) => !allowed_keys.has(key));
		disallowed_keys.forEach((key) => { errors[key as T] = ['Key not allowed'] });
	}

	await Promise.allSettled(validationPromises);
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
		(acc, [key, rules]) => {
			if (Array.isArray(rules)) {
				const tmp = rules.map((rule_set) => getValueErrorsSync(object[key], rule_set, ...overload));
				if (tmp.some((e) => !e.length))
					return { ...acc, [key]: [] }
				return { ...acc, [key]: tmp }
			}
			return (
				{ ...acc, [key]: getValueErrorsSync(object[key], rules, ...overload) }
			)
		},
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

// Type guard to check if a schema has async functions
const isAsyncSchema = (schema: SCHEMA_SYNC | SCHEMA): schema is SCHEMA =>
	Object.values(schema).some(hasAsyncFunction);

/**
 * Check a schema against all provided validation rules
 * 
 * @param {CHECKABLE_OBJECT} object object to be validated
 * @param {SCHEMA|SCHEMA_SYNC} schema schema to validate against
 * @param {SCHEMA_OPTIONS} options options affecting how the rules are run
 * @param {unknown[]} overload array of extra values the validator rules might need to properly validate the value 
 * @returns {CHECKED_SCHEMA} an object containing keys and their respective lists of failed rule names
 */
export const getSchemaErrors = <T extends keyof CHECKABLE_OBJECT>(
	object: CHECKABLE_OBJECT,
	schema: SCHEMA_SYNC | SCHEMA,
	options: SCHEMA_OPTIONS = DEFAULT_SCHEMA_OPTIONS,
	...overload: unknown[]): CHECKED_SCHEMA<T> | CHECKED_SCHEMA_SYNC<T> => {
	if (isAsyncSchema(schema)) {
		return getSchemaErrorsAsync(object, schema, options, ...overload)
	}
	return getSchemaErrorsSync(object, schema, options, ...overload)
}