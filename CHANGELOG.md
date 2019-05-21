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
