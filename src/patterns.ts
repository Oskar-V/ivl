const EMAIL_PATTERN = /^[\w.%+-]+@[\w.-]+\.[a-zA-Z]{1,}$/;
const TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
const URL_PATTERN = /^(https?:\/\/)?([^\s$.?#].[^\s]*)\.[a-z]{2,}(\/[^\s]*)?$/i;

export {EMAIL_PATTERN, TIMESTAMP_PATTERN, URL_PATTERN}