export const EMAIL_PATTERN = /^[\w.%+-]+@[\w.-]+\.[a-zA-Z]{1,}$/;
export const MYSQL_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
export const URL_PATTERN = /^(https?:\/\/)?([^\s$.?#].[^\s]*)\.[a-z]{2,}(\/[^ \t\r\n\v\f]*)?$/i;

// Time patterns - there's going to be a ton of these...
export const ISO_8601_DATETIME_PATTERN_STRICT = /^(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d(?:\.\d+)?(?:[+-][0-2]\d:[0-5]\d|Z)?)$/;
export const ISO_8601_DATETIME_PATTERN = /^(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d(?::[0-5]\d(?:\.\d+)?)?)$/;
export const ISO_8601_TIME_PATTERN = /^(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(Z|[+-](?:2[0-3]|[01][0-9]):([0-5][0-9]))?$/;

export const CONTAINS_LOWERCASE_CHARACTER_PATTERN = /[a-z]/;
export const CONTAINS_UPPERCASE_CHARACTER_PATTERN = /[A-Z]/;
export const CONTAINS_DIGIT_CHARACTER_PATTERN = /\d/;
export const CONTAINS_SYMBOL_CHARACTER_PATTERN = /[^\w\s]/;
