# swank-client
[![Build Status](https://travis-ci.org/neil-lindquist/swank-client.svg?branch=master)](https://travis-ci.org/neil-lindquist/swank-client)


Implementation of a Swank client in Javascript. Intended for communicating with running Common Lisp processes running a swank server, just like SLIME in Emacs.  This was package was forked from [Steve Levine's swank-client-js](https://github.com/sjlevine/swank-client-js) due to maintenance issues.

This library provides an editor/view-independent API for making the following queries to a Swank server:

- Evaluating arbitrary Lisp expressions
- Retrieving auto documentation
- Controlling a debugger
- Autocompletion requests
- Object introspection requests

See `test.js` for an example use case.

This package forms a core part of the `SLIMA` package for the Atom text editor.
