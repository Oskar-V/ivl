import { run, bench, group, baseline } from 'mitata';
import { getValueErrors, getValueErrorsSync } from '../src/index';
import { matchesRegex } from '../src/helpers';
import { EMAIL_PATTERN } from '../src/patterns'

group('Regex promise vs no promise', () => {
	const test_string = "test@email.com";
	baseline("pure regex helper", () => matchesRegex(EMAIL_PATTERN).call(test_string))
	bench('sync regex helper', () => getValueErrorsSync(test_string, { "Pattern": matchesRegex(EMAIL_PATTERN) }));
	bench('async regex helper', () => getValueErrors(test_string, { "Pattern": matchesRegex(EMAIL_PATTERN) }));
});

await run({
	silent: false, // enable/disable stdout output
	avg: true, // enable/disable avg column (default: true)
	json: false, // enable/disable json output (default: false)
	colors: true, // enable/disable colors (default: true)
	min_max: true, // enable/disable min/max column (default: true)
	percentiles: false, // enable/disable percentiles column (default: true)
});