## 4.5.0 (2020-09-05)
* Add `is_connected()` to query if the client is connected to a swank server
* Fix disconnect events not always occurring on disconnection

## 4.4.0 (2020-05-27)
* Add function to inspect the result of an arbitrary evaluation
* Add function to disconnect from Swank server
* Fix loading large inspectors

## 4.3.0 (2020-05-19)
* Add support for compiler notes
* Fix an issue when errors occur during compilation requests

## 4.2.0 (2020-03-01)
* Add support for macro and compiler-macro expansions
* Add support to utils.from_lisp_string for paredit.js ast objects

## 4.1.0 (2019-08-25)
* Add API for converting from lisp source strings/ast
* Fix a some things not loading after being compiled

## 4.0.0 (2019-07-28)
* Change the API for `profiles_invoke_toggle_package` to take JS booleans instead of strings of CL booleans
* Add handlers for `read-from-minibuffer`, `y-or-n-p`, `read-string`, and `read-aborted` swank messages


## 3.1.0 (2019-07-24)
* Add support for calling swank commands from packages other than CL-USER
* Remove debug printing statements that were accidently left in the last release

## 3.0.0 (2019-07-20)
* Change returned inspector object to be Javascript-y instead of a paredit.js object
* Add inspection functions
  * Presentations
  * Frame variables
  * Expressions evaluated in a frame
  * The current condition
  * The nth element in the current inspector
  * The previous inspector value
  * The next inspector value
* Add support for large inspections that require multiple sends from Swank.


## 2.0.3
* Fix the values of local variables in a stack frame being stored as lisp strings

## 2.0.2
* Fix a bug with autodoc not correctly escaping values

## 2.0.1
* Improve behavior when receiving non-ASCII characters

## 2.0.0
* Redo `find_definition` return value
* Redo `debug_return_from_frame` return value
* Require thread for `debug_escape_all`
* Add basic CI tests


## 1.1.3
* Fix autodoc issue with nested function calls
* Replace obsolete Buffer API usage
* Improve consistancy of internal function names

## 1.1.2
* Fix mistake in 1.1.1's compilation improvement

## 1.1.1
* Ensure code is loaded after compilation as needed
* Add .npmignore to avoid packaging unnessaccery files
* Increase minimum paredit version to 0.3.6
* Refactor escaping strings to lisp into a function
