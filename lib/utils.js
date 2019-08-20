
/* Reads a string value from a raw lisp source */
function from_lisp_string(raw) {
  return raw.slice(1, -1) //remove leading/trailing quotes
            .replace(/\\("|\\)/g, "$1"); //resolve escapes
}

/* Converts a string value to a lisp source string */
function to_lisp_string(str) {
  //escapes " and \ then wraps the string with double quotes
  return '"' + str.replace(/\\/g, "\\\\").replace(/"/g, "\\\"") + '"';
}

/* Reads a js boolean from a paredit object */
function from_lisp_bool(raw) {
  return raw.type != 'symbol' || raw.source.toLowerCase() != 'nil'
}

/* Converts a js boolean to a lisp source boolean */
function to_lisp_bool(bool) {
  return bool?'T':'NIL'
}


module.exports.from_lisp_string = from_lisp_string
module.exports.to_lisp_string = to_lisp_string
module.exports.from_lisp_bool = from_lisp_bool
module.exports.to_lisp_bool = to_lisp_bool
