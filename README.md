# swank-client
[![Build Status](https://travis-ci.org/neil-lindquist/swank-client.svg?branch=master)](https://travis-ci.org/neil-lindquist/swank-client)

This is an implementation of a Swank client in Javascript, intended for communicating with running Common Lisp processes running a swank server, just like SLIME in Emacs.
Swank-client forms a core part of the [SLIMA](https://atom.io/packages/SLIMA) package for the Atom text editor.
This package was forked from [Steve Levine's swank-client-js](https://github.com/sjlevine/swank-client-js) due to maintenance issues.

If you are interested in using this library, please let me know.
Currently, the only user is the [SLIMA](https://atom.io/packages/SLIMA) package for Atom, so the documentation is pretty minimal.

This library provides an editor/view-independent API for making the following queries to a Swank server:

- Evaluating arbitrary Lisp expressions and files
- Retrieving auto documentation
- Controlling a debugger
- Autocompletion requests
- Object inspection requests
- Profiling functions
- Accessing compiler notes
- Macroexpansion requests

See `test.js` for an example use case.
