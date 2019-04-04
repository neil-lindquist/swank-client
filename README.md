# swank-client


Implementation of a Swank client in Javascript. Intended for communicating with running Common Lisp processes running a swank server, just like SLIME in Emacs.  This is a fork of [Steve Levine's swank-client-js](https://github.com/sjlevine/swank-client-js), that was forked due to maintenance issues.

This library provides an editor/view-independent API for making the following queries to a Swank server:

- Evaluating arbitrary Lisp expressions
- Retrieving auto documentation
- Controlling a debugger

Future additions to the API:

- Autocompletion requests
- Object introspection requests

See `test.js` for an example use case.

This package forms a core part of the `AtomSlime` package for the Atom text editor.
