export const EMAIL_PATTERN = /^[\w.%+-]+@[\w.-]+\.[a-zA-Z]{1,}$/;
export const MYSQL_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
export const URL_PATTERN = /^(https?:\/\/)?([^\s$.?#].[^\s]*)\.[a-z]{2,}(\/[^\s]*)?$/i;

// Time patterns - there's going to be a ton of these...
export const ISO_8601_DATETIME_PATTERN_STRICT = /^(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))$/;
export const ISO_8601_DATETIME_PATTERN = /^(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+)|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d)|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d)$/;
export const ISO_8601_TIME_PATTERN = /^(2[0-3]|[01][0-9]):?([0-5][0-9]):?([0-5][0-9])(Z|[+-](?:2[0-3]|[01][0-9])(?::?(?:[0-5][0-9]))?)$/;
export const RFC_2822_TIMESTAMP_PATTERN = /^(?:(Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s+)?(0[1-9]|[1-2]?[0-9]|3[01])\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(19[0-9]{2}|[2-9][0-9]{3})\s+(2[0-3]|[0-1][0-9]):([0-5][0-9])(?::(60|[0-5][0-9]))?\s+([-\+][0-9]{2}[0-5][0-9]|(?:UT|GMT|(?:E|C|M|P)(?:ST|DT)|[A-IK-Z]))(\s+|\(([^\(\)]+|\\\(|\\\))*\))*$/;

export const CONTAINS_LOWERCASE_CHARACTER_PATTERN = /(?=.*[a-z])/;
export const CONTAINS_UPPERCASE_CHARACTER_PATTERN = /(?=.*[A-Z])/;
export const CONTAINS_DIGIT_CHARACTER_PATTERN = /(?=.*\d)/;
export const CONTAINS_SYMBOL_CHARACTER_PATTERN = /[^\w]/;
