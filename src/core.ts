import { RULES, SCHEMA, CHECKABLE_OBJECT, CHECKED_SCHEMA, RULES_SYNC, SCHEMA_SYNC, CHECKED_SCHEMA_SYNC } from '@types'

export const getValueErrors = async (
	value: unknown,
	rules: RULES,
	...overload: unknown[]
): Promise<string[]> => {
	const errors: { [index: string]: any } = {}; // Figure out how to properly remove this any
	Object.entries(rules).forEach(([key, rule]) => {
		// Wrap everything into a promise
		errors[key] = Promise.resolve()
			.then(() => rule(value, ...overload))
			.then((result) => errors[key] = result)
			.catch(() => { errors[key] = false });
	});
	await Promise.allSettled(Object.values(errors))

	// Filter out the non empty errors and map to an array
	return Object.entries(errors).reduce<string[]>(
		(acc, [error, val]) => (val ? acc : [...acc, error]),
		[])
}

export const getSchemaErrors = async (
	object: CHECKABLE_OBJECT,
	schema: SCHEMA,
	strict: boolean = false,
	...overload: unknown[]
): CHECKED_SCHEMA => {
	const errors: { [index: string]: any } = {}; // Figure out how to properly remove this any
	Object.entries(schema).forEach(([key, rules]) => {
		errors[key] = getValueErrors(object[key], rules, ...overload)
			.then((result) => { errors[key] = result })
			.catch((result) => { errors[key] = result })
	})

	if (strict) {
		const incoming_keys = Object.keys(object);
		const allowed_keys = new Set(Object.keys(schema));
		const disallowed_keys = incoming_keys.filter((key) => !allowed_keys.has(key))
		disallowed_keys.forEach((key) => { errors[key] = ['Key not allowed'] })
	}

	await Promise.allSettled(Object.values(errors))
	return errors
}

export const getValueErrorsSync = (
	value: unknown,
	rules: RULES_SYNC,
	...overload: unknown[]
): string[] =>
	Object.entries(rules).reduce(
		(acc, [key, rule]) => {
			try {
				return rule(value, ...overload) ? acc : [...acc, key];
			} catch (error) {
				return [...acc, key];
			}
		},
		[] as string[]);

export const getSchemaErrorsSync = (
	object: CHECKABLE_OBJECT,
	schema: SCHEMA_SYNC,
	strict: boolean = false,
	...overload: unknown[]
): CHECKED_SCHEMA_SYNC => {
	const errors = Object.entries(schema).reduce(
		(acc, [key, rules]) => (
			{ ...acc, [key]: getValueErrorsSync(object[key], rules, ...overload) }
		),
		{} as CHECKED_SCHEMA_SYNC)

	if (strict) {
		const incoming_keys = Object.keys(object);
		const allowed_keys = new Set(Object.keys(schema));
		const disallowed_keys = incoming_keys.filter((key) => !allowed_keys.has(key))
		disallowed_keys.forEach((key) => { errors[key] = ['Key not allowed'] })
	}

	return errors
}