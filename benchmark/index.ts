import { run, bench, group } from 'mitata';
import { getValueErrorsAsync, getValueErrors as getValueErrors, getValueErrorsSync } from '../src/index';
import { matchesRegex } from '../src/helpers';
import { EMAIL_PATTERN } from '../src/patterns'

// Comparison imports
import { z } from 'zod';
import yup from 'yup';

group('Regex promise vs no promise', () => {
	const test_string = "test@email.com";
	bench("pure regex helper", () => matchesRegex(EMAIL_PATTERN)(test_string)).baseline(true);
	bench('async regex helper', () => getValueErrorsAsync(test_string, { "Pattern": matchesRegex(EMAIL_PATTERN) }));
	bench('smart regex helper', () => getValueErrors(test_string, { "Pattern": matchesRegex(EMAIL_PATTERN) }));
	bench('sync regex helper', () => getValueErrorsSync(test_string, { "Pattern": matchesRegex(EMAIL_PATTERN) }));
});

group('Compare simple regex with other libraries', () => {
	const test_string = "test@email.com";
	bench('ivl smart regex', () => {
		const errors = getValueErrors(test_string, { "Must match regex": matchesRegex(EMAIL_PATTERN) })
	}).baseline(true)
	bench('ivl sync regex', () => {
		const errors = getValueErrorsSync(test_string, { "Must match regex": matchesRegex(EMAIL_PATTERN) })
	})
	bench('ivl async regex', () => {
		const errors = getValueErrorsAsync(test_string, { "Must match regex": matchesRegex(EMAIL_PATTERN) })
	})
	bench('ivl sync custom', () => {
		const errors = getValueErrorsSync(test_string, { "Must match regex": (i: unknown) => typeof i === 'string' && EMAIL_PATTERN.test(i) })
	})
	bench('ivl async custom', () => {
		const errors = getValueErrorsAsync(test_string, { "Must match regex": (i: unknown) => typeof i === 'string' && EMAIL_PATTERN.test(i) })
	})
	bench('zod sync regex', () => {
		const errors = z.string().regex(EMAIL_PATTERN, "Must match regex").parse(test_string)
	})
	bench('zod async regex', () => {
		const errors = z.string().regex(EMAIL_PATTERN, "Must match regex").parseAsync(test_string)
	})
	bench('zod sync custom', () => {
		const errors = z.custom((val) => typeof val === 'string' && EMAIL_PATTERN.test(val)).parse(test_string)
	})
	bench('zod async custom', () => {
		const errors = z.custom((val) => typeof val === 'string' && EMAIL_PATTERN.test(val)).parseAsync(test_string)
	})
	bench('yup sync regex', () => {
		const errors = yup.string().matches(EMAIL_PATTERN, "Must match regex").isValidSync(test_string)
	})
	bench('yup async regex', () => {
		const errors = yup.string().matches(EMAIL_PATTERN, "Must match regex").isValid(test_string)
	})
	bench('yup sync custom', () => {
		const errors = yup.string().test("patter", 'Must match regex', (i) => typeof i === 'string' && EMAIL_PATTERN.test(i)).isValidSync(test_string)
	})
	bench('yup async custom', () => {
		const errors = yup.string().test("patter", 'Must match regex', (i) => typeof i === 'string' && EMAIL_PATTERN.test(i)).isValid(test_string)
	})
})

// CI sets BENCH_FORMAT=markdown to produce the README benchmark section
const markdown = process.env.BENCH_FORMAT === 'markdown';

await run({
	colors: !markdown, // enable/disable colors (default: true)
	format: markdown ? 'markdown' : 'mitata', // 'mitata' | 'json' | 'markdown' | 'quiet'
});