import { RULES, SCHEMA, CHECKABLE_OBJECT, CHECKED_SCHEMA } from './types'

const getValueErrors = async (
	value: unknown,
	rules: RULES,
	...overload: unknown[]
): Promise<string[]> => {
	const errors: { [index: string]: any } = {}; // Figure out how to properly remove this any
	Object.entries(rules).forEach(([key, rule]) => {
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

const getSchemaErrors = async (
	object: CHECKABLE_OBJECT,
	schema: SCHEMA,
	strict: Boolean = false,
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

exports = {
	getValueErrors,
	getSchemaErrors
}

