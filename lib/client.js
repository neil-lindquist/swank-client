var net = require('net');
var paredit = require('paredit.js');

/* Swank client class! */

function Client(host, port) {
  this.host = host;
  this.port = port;
  this.socket = null;
  this.connected = false;

  // Useful protocol information
  this.req_counter = 1;
  this.req_table = {};

  this.on_handlers = {
    connect: function() {},
    print_string: function(m) {},
    presentation_start: function (pid) {},
    presentation_end: function (pid) {},
    new_package: function(p) {},
    debug_activate: function(obj) {},
    debug_setup: function(obj) {},
    debug_return: function(obj) {},
    profile_command_complete: function(msg) {},
    disconnect: function() {}
  };

  // Bootstrap the reading state
  this.setup_read(6, this.header_complete_callback);
}


/*****************************************************************
 General Utilities
 *****************************************************************/
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


/*****************************************************************
 Low-level data handling protocol
 *****************************************************************/

Client.prototype.send_message = function(msg) {
  var len_str = Buffer.byteLength(msg).toString(16);
  len_str = Array((6 - len_str.length) + 1).join('0') + len_str;
  // Assemble overall message
  var msg_overall = len_str + msg;
  // Send it
  // console.log("Write:")
  // console.log("    Length: " + len_str + " (" + msg_utf8.length + ")");
  // console.log("    Msg: ...");
  // console.log(msg_overall) // Great for debugging!
  this.socket.write(msg_overall);
}


Client.prototype.connect = function() {
  var sc = this; // Because the 'this' operator changes scope
  return new Promise(function(resolve, reject) {
    // Create a socket
    sc.socket = net.connect({
        host: sc.host,
        port: sc.port
      }, function() {
        sc.connected = true;
        resolve();
      });
    sc.socket.setNoDelay(true);
    sc.socket.setEncoding('utf8');

    sc.socket.on('error', function(err) {
      reject();
    });
    sc.socket.on('data', function(data) {
      sc.socket_data_handler(data);
    });
    sc.socket.on('end', function() {
      sc.connected = false;
      sc.on_handlers.disconnect();
    });
  });
}

/* Some data just came in over the wire. Make sure to read it in
message chunks with the length */
Client.prototype.socket_data_handler = function(data) {
  var source = Buffer.from(data);
  var byte_offset = 0; // offset into source that has been copied so far

  while (byte_offset < Buffer.byteLength(source)) {
    var amount_to_read = Math.min(this.len_remaining, Buffer.byteLength(source) - byte_offset);
    var copied = source.copy(this.buffer, Buffer.byteLength(this.buffer) - this.len_remaining, byte_offset, byte_offset + amount_to_read);
    this.len_remaining -= copied;
    byte_offset += copied;
    if (this.len_remaining == 0) {
      this.buffer_complete_callback(this.buffer.toString());
    }
  }
}

Client.prototype.setup_read = function(length, fn) {
  this.buffer = Buffer.alloc(length);
  this.len_remaining = length;
  this.buffer_complete_callback = fn;
}

Client.prototype.header_complete_callback = function(data) {
  // Parse the length
  var len = parseInt(data, 16);
  // Set up to read data
  this.setup_read(len, this.data_complete_callback);
}

Client.prototype.data_complete_callback = function(data) {
  // Call the handler
  try {
    this.on_swank_message(data);
  } catch (e) {
    console.log("Error in swank-js callback");
    console.log(e);
  }

  // Set up again to read the header
  this.setup_read(6, this.header_complete_callback); // It's 6 bytes long
}

Client.prototype.on = function(event, fn) {
  this.on_handlers[event] = fn;
}

Client.prototype.on_swank_message = function(msg) {
  // console.log(msg); // Great for debugging!
  var ast = paredit.parse(msg);
  var sexp = ast.children[0];
  var cmd = sexp.children[0].source.toLowerCase();
  if (cmd == ":return") {
    this.swank_message_rex_return_handler(sexp);
  } else if (cmd == ':write-string') {
    this.on_handlers.print_string(from_lisp_string(sexp.children[1].source));
  } else if (cmd == ':presentation-start') {
    var presentation_id = sexp.children[1].source;
    this.on_handlers.presentation_start(presentation_id);
  } else if (cmd == ':presentation-end') {
    var presentation_id = sexp.children[1].source;
    // console.log(presentation_id);
    this.on_handlers.presentation_end(presentation_id);
  } else if (cmd == ":new-package") {
    this.on_handlers.new_package(from_lisp_string(sexp.children[1].source));
  } else if (cmd == ":debug") {
    this.debug_setup_handler(sexp);
  } else if (cmd == ":debug-activate") {
    this.debug_activate_handler(sexp);
  } else if (cmd == ":debug-return") {
    this.debug_return_handler(sexp);
  } else if (cmd == ":ping") {
    this.ping_handler(sexp);
  } else {
    // console.log("Ignoring command " + cmd);
  }

}



/*****************************************************************
 Evaluating EMACS-REX (remote execution) commandsreturn ast.children[0].children.map(function(competion) {
          return competion.source.slice(1, -1);
        })
 */

Client.prototype.rex = function(cmd, pkg, thread) {
  // Run an EMACS-REX command, and call the callback
  // when we have a return value, with the parsed paredit s-expression
  // Add an entry into our table!
  var sc = this;
  var resolve_fn = null;
  var id = sc.req_counter;
  var promise = new Promise(function(resolve, reject) {
    // Dispatch a command to swank
    resolve_fn = resolve;
    var rex_cmd = "(:EMACS-REX " + cmd + " \"" + pkg + "\" " + thread + " " + id + ")";
    // console.log(rex_cmd);
    sc.send_message(rex_cmd);
  });

  sc.req_counter = sc.req_counter + 1;
  sc.req_table[id] = {
    id: id,
    cmd: cmd,
    pkg: pkg,
    promise_resolve_fn: resolve_fn
  };
  return promise;
}

Client.prototype.swank_message_rex_return_handler = function(cmd) {
    var status = cmd.children[1].children[0].source.toLowerCase();
    var return_val = cmd.children[1].children[1];
    var id = cmd.children[2].source;

    // Look up the appropriate callback and return it!
    if (id in this.req_table) {
        var req = this.req_table[id];
        delete this.req_table[id];
        // console.log("Resolving " + id);
        req.promise_resolve_fn(return_val);
    } else {
        console.error("Received REX response for unknown command ID");
    }
}


Client.prototype.ping_handler = function(sexp) {
  // Swank occasionally send's ping messages to see if we're okay.
  // We must respond!
  var response = '(:EMACS-PONG ' + sexp.children[1].source + ' ' + sexp.children[2].source + ')';
  this.send_message(response);
}

/*****************************************************************
 Higher-level commands
 */
Client.prototype.initialize = function() {
  // Run these useful initialization commands one after another
  var self = this;
  return self.rex("(SWANK:SWANK-REQUIRE  \
    '(SWANK-IO-PACKAGE::SWANK-TRACE-DIALOG SWANK-IO-PACKAGE::SWANK-PACKAGE-FU \
      SWANK-IO-PACKAGE::SWANK-PRESENTATIONS SWANK-IO-PACKAGE::SWANK-FUZZY \
      SWANK-IO-PACKAGE::SWANK-FANCY-INSPECTOR SWANK-IO-PACKAGE::SWANK-C-P-C \
      SWANK-IO-PACKAGE::SWANK-ARGLISTS SWANK-IO-PACKAGE::SWANK-REPL))", 'COMMON-LISP-USER', 'T')
      .then(function(response) {
        return self.rex("(SWANK:INIT-PRESENTATIONS)", 'COMMON-LISP-USER', 'T');})
      .then(function(response) {
        return self.rex('(SWANK-REPL:CREATE-REPL NIL :CODING-SYSTEM "utf-8-unix")', 'COMMON-LISP-USER', 'T');});
}

/* Gets autodocumentation for the given sexp, given the cursor's position */
Client.prototype.autodoc = function(sexp_string, cursor_position, pkg) {
  var ast = paredit.parse(sexp_string);
  try {
    var forms = ast.children[0];
    var output_forms = [];
    var didCursor = false;
    for(var i = 0; i < forms.children.length; i++) {
      var form = forms.children[i];
      output_forms.push('"' + sexp_string.substring(form.start, form.end) + '"');
      if (cursor_position >= form.start && cursor_position <= form.end && !didCursor) {
        output_forms.push('SWANK::%CURSOR-MARKER%');
        didCursor = true;
        break;
      }
    }
    if (!didCursor) {
      output_forms.push('""');
      output_forms.push('SWANK::%CURSOR-MARKER%');
      didCursor = true;
    }
    var cmd = '(SWANK:AUTODOC \'('; // '"potato" SWANK::%CURSOR-MARKER%) :PRINT-RIGHT-MARGIN 80)';
    cmd += output_forms.join(' ');
    cmd += ') :PRINT-RIGHT-MARGIN 80)';
  } catch (e) {
    // Return a promise with nothing then
    console.log("Error constructing command:");
    console.log(e);
    return Promise.resolve({type: 'symbol', source: ':not-available'});
  }
  // Return a promise that will yield the result.
  return this.rex(cmd, pkg, ':REPL-THREAD')
    .then(function (ast) {
      try {
        return ast.children[0];
      } catch (e) {
        return {type: 'symbol', source: ':not-available'};
      }
    });
}

Client.prototype.autocomplete = function(prefix, pkg) {
  prefix = to_lisp_string(prefix);
  var cmd = '(SWANK:SIMPLE-COMPLETIONS ' + prefix + ' \'"' + pkg + '")';
  return this.rex(cmd, pkg, "T")
    .then(function (ast) {
      try {
        return ast.children[0].children.map(function(competion) {
          return from_lisp_string(competion.source);
        });
      } catch (e) {
        return [];
      }
    });
}


Client.prototype.eval = function(sexp_string, pkg) {
  var cmd = '(SWANK-REPL:LISTENER-EVAL ' + to_lisp_string(sexp_string) +')';
  return this.rex(cmd, pkg, ':REPL-THREAD');
}


Client.prototype.debug_setup_handler = function(sexp) {
  var obj = {};
  obj.thread = sexp.children[1].source;
  obj.level = sexp.children[2].source;
  obj.title = from_lisp_string(sexp.children[3].children[0].source);
  obj.type = from_lisp_string(sexp.children[3].children[1].source);
  obj.restarts = [];
  sexp.children[4].children.forEach(function(restart_sexp) {
    obj.restarts.push({
      cmd: from_lisp_string(restart_sexp.children[0].source),
      description: from_lisp_string(restart_sexp.children[1].source)
    });
  });
  obj.stack_frames = [];
  sexp.children[5].children.forEach(function(frame_sexp){
    if (frame_sexp.children.length >= 3) {
      restartable = frame_sexp.children[2].children[1].source.toLowerCase() != 'nil';
    } else {
      restartable = false;
    }
    obj.stack_frames.push({
      frame_number: frame_sexp.children[0].source,
      description: from_lisp_string(frame_sexp.children[1].source),
      restartable: restartable
    });
  });

  this.on_handlers.debug_setup(obj);
}

Client.prototype.debug_activate_handler = function(sexp) {
  var thread = sexp.children[1].source;
  var level = sexp.children[2].source;
  this.on_handlers.debug_activate({thread: thread, level: level});
}

Client.prototype.debug_return_handler = function(sexp) {
  var thread = sexp.children[1].source;
  var level = sexp.children[2].source;
  this.on_handlers.debug_return({thread: thread, level: level});
}

Client.prototype.debug_invoke_restart = function(level, restart, thread) {
  var cmd = '(SWANK:INVOKE-NTH-RESTART-FOR-EMACS ' + level + ' ' + restart + ')';
  return this.rex(cmd, 'COMMON-LISP-USER', thread);
}

/* Escape from all errors */
Client.prototype.debug_escape_all = function(thread="1") {
  //"1" was previously hardcoded as the thread.  Leave it for backwards compatability
  var cmd = '(SWANK:THROW-TO-TOPLEVEL)';
  return this.rex(cmd, "COMMON-LISP-USER", thread);
}

/* Use the continue restart */
Client.prototype.debug_continue = function(thread) {
  var cmd = '(SWANK:SLDB-CONTINUE)';
  return this.rex(cmd, "COMMON-LISP-USER", thread)
}

/* Abort the current debug level */
Client.prototype.debug_abort_current_level = function (level, thread) {
  var cmd;
  if (level == 1) {
    cmd = '(SWANK:THROW-TO-TOPLEVEL)';
  } else {
    cmd = '(SWANK:SLDB-ABORT)';
  }
  return this.rex(cmd, 'COMMON-LISP-USER', thread)
}

/* Get the entire stack trace
   Returns a promise of the list of objects, each containing a stack frame*/
Client.prototype.debug_get_stack_trace = function(thread) {
  var cmd = '(SWANK:BACKTRACE 0 NIL)';
  return this.rex(cmd, "COMMON-LISP-USER", thread).then(function(sexp) {
    stack_frames = [];
    sexp.children.forEach(function(frame_sexp){
      if (frame_sexp.children.length >= 3) {
        restartable = frame_sexp.children[2].children[1].source.toLowerCase() != 'nil';
      } else {
        restartable = false;
      }
      stack_frames.push({
        frame_number: frame_sexp.children[0].source,
        description: from_lisp_string(frame_sexp.children[1].source),
        restartable: restartable
      });
    });
    return stack_frames;
  });
}

/* Retrieve the stack frame details for the specified frame.
   The existing stack frame object will be updated.
   Returns a promise of the updated stack frame object. */
Client.prototype.debug_stack_frame_details = function(index, stack_frames, thread) {
  frame_info = stack_frames.find(function(frame) {
    return Number(frame.frame_number) === Number(index);
  });
  if (frame_info.hasOwnProperty('locals')) {
    //frame details have already been fetched
    return Promise.resolve(frame_info);
  } else {
    var cmd = '(SWANK:FRAME-LOCALS-AND-CATCH-TAGS ' + index + ')';
    return this.rex(cmd, "COMMON-LISP-USER", thread).then(function(sexp) {
      if (sexp.children[0].type.toLowerCase() == 'list'){
        frame_info.locals = sexp.children[0].children.map(function(local_sexp) {
          return {
            name:  from_lisp_string(local_sexp.children[1].source),
            id:    local_sexp.children[3].source,
            value: local_sexp.children[5].source
          };
        });
      } else {
        frame_info.locals = [];
      }

      if (sexp.children[1].type.toLowerCase() == 'list') {
        frame_info.catch_tags = sexp.children[1].children.map(function(tag_sexp) {
          return from_lisp_string(tag_sexp.source);
        });
      } else {
        frame_info.catch_tags = []
      }

      return frame_info;
    });
  }
}

/* Restart the specified frame.
   May not be supported on some implementations. */
Client.prototype.debug_restart_frame = function(frame, thread) {
  var cmd = '(SWANK:RESTART-FRAME ' + frame + ')';
  return this.rex(cmd, "COMMON-LISP-USER", thread);
}

/* Return the given value from the specified frame.
   May not be supported on some implementations.
   Returns a promise that will throw an error if Lisp can't return from this frame. */
Client.prototype.debug_return_from_frame = function(frame, value, thread) {
  var cmd = '(SWANK:SLDB-RETURN-FROM-FRAME ' + frame + ' ' + to_lisp_string(value) + ')';
  return this.rex(cmd, "COMMON-LISP-USER", thread).then(function(rawErrorMessage) {
    errorMessage = from_lisp_string(rawErrorMessage.source);
    if (errorMessage != 'NIL') {
      throw new Error(errorMessage);
    }
  });
}

/* Gets information to display the frame's source */
Client.prototype.debug_frame_source = function(frame, thread) {
  var cmd = '(SWANK:FRAME-SOURCE-LOCATION ' + frame + ')';
  return this.rex(cmd, "COMMON-LISP-USER", thread).then(function(location_sexp) {
    //(:location <buffer> <position> <hints>)
    location = {};

    if(location_sexp.children[0].source.toLowerCase() == ":error"){
      location.buffer_type = "error";
      location.error = from_lisp_string(location_sexp.children[1].source);
    } else {
      var raw_buffer_sexp = location_sexp.children[1];
      location.buffer_type = raw_buffer_sexp.children[0].source.slice(1).toLowerCase();
      if (location.buffer_type == 'file') {
        location.file = from_lisp_string(raw_buffer_sexp.children[1].source);
      } else if (location.buffer_type == 'buffer') {
        location.buffer_name = from_lisp_string(raw_buffer_sexp.children[1].source);
      } else if (location.buffer_type == 'buffer-and-file') {
        location.buffer_name = from_lisp_string(raw_buffer_sexp.children[1].source);
        location.file = from_lisp_string(raw_buffer_sexp.children[2].source);
      } else if (location.buffer_type == 'source-form') {
        location.source_form = from_lisp_string(raw_buffer_sexp.children[1].source);
      } else if (location.buffer_type == 'zip') {
        location.zip_file = from_lisp_string(raw_buffer_sexp.children[1].source);
        location.zip_entry = from_lisp_string(raw_buffer_sexp.children[1].source);
      }

      var raw_position_sexp = location_sexp.children[2];

      location.position_type = raw_position_sexp.children[0].source.slice(1).toLowerCase();
      if (location.position_type == 'position') {
        location.position_offset = Number(raw_position_sexp.children[1].source);
      } else if (location.position_type == 'offset') {
        location.position_type = 'position'
        location.position_offset = Number(raw_position_sexp.children[1].source)
                                 + Number(raw_position_sexp.children[2].source);
      } else if (location.position_type == 'line') {
        location.position_line = Number(raw_position_sexp.children[1]);
        if (raw_position_sexp.children.length >= 3) {
          location.position_column = Number(raw_position_sexp.children[2]);
        }
      } else if (location.position_type == 'function-name') {
        location.position_function = raw_position_sexp.children[1].source;
      } else if (location.position_type == 'source_path') {
        if (raw_position_sexp.children[1].type.toLowerCase == 'list') {
          location.position_source_path_list = raw_position_sexp.children[1].map(function(elt) {
            return elt.source;
          });
        } else {
          location.position_source_path_list = [];
        }
        location.position_source_path_start = raw_position_sexp.children[2].source;
      } else if (location.position_type == 'method') {
        location.position_method_name = raw_position_sexp.children[1].source;
        if (raw_position_sexp.children[2].type.toLowerCase == 'list') {
          location.position_specializers = raw_position_sexp.children[2].map(function(elt) {
            return elt.source;
          });
        } else {
          location.position_specializers = [];
        }
        location.position_qualifiers = raw_position_sexp.children.slice(3).map(function(elt) {
          return elt.source;
        });
      }
    }

    return location;
  });
}

/* Disassembles the specified frame. */
Client.prototype.debug_disassemble_frame = function(frame, thread) {
  var cmd = '(SWANK:SLDB-DISASSEMBLE ' + frame + ')';
  return this.rex(cmd, "COMMON-LISP-USER", thread).then(function(sexp) {
    return from_lisp_string(sexp.source);
  });
}

/* Evaluate the given string in the specified frame.
   Returns a promise of the results of the evaluation as a string. */
Client.prototype.debug_eval_in_frame = function(frame, expr, thread) {
  var cmd = '(SWANK:EVAL-STRING-IN-FRAME ' + to_lisp_string(expr) + ' '
                                         + frame + ' "COMMON-LISP-USER")';
  return this.rex(cmd, "COMMON-LISP-USER", thread).then(function(result) {
    return from_lisp_string(result.source);
  });
}

/* Steps the debugger to the next expression in the frame. */
Client.prototype.debug_step = function(frame, thread) {
  var cmd = '(SWANK:SLDB-STEP ' + frame + ')';
  return this.rex(cmd, "COMMON-LISP-USER", thread);
}

/* Steps the debugger to the next form in the function. */
Client.prototype.debug_next = function(frame, thread) {
  var cmd = '(SWANK:SLDB-NEXT ' + frame + ')';
  return this.rex(cmd, "COMMON-LISP-USER", thread);
}

/* Complete the current function then resume stepping. */
Client.prototype.debug_step_out = function(frame, thread) {
  var cmd = '(SWANK:SLDB-OUT ' + frame + ')';
  return this.rex(cmd, "COMMON-LISP-USER", thread);
}

/* Insert a breakpoint at the end of the frame. */
Client.prototype.debug_break_on_return = function(frame, thread) {
  var cmd = '(SWANK:SLDB-BREAK-ON-RETURN ' + frame + ')';
  return this.rex(cmd, "COMMON-LISP-USER", thread);
}

/* Insert a breakpoint at the specified function. */
Client.prototype.debug_break = function(function_name, thread) {
  var cmd = '(SWANK:SLDB-BREAK ' + to_lisp_string(function_name) + ')';
  return this.rex(cmd, "COMMON-LISP-USER", thread);
}


/*************
 * Profiling *
 *************/

 Client.prototype.profile_invoke_toggle_function = function(func) {
   var cmd = '(SWANK:TOGGLE-PROFILE-FDEFINITION "' + func + '")';
   var prof_func = this.on_handlers.profile_command_complete;
   return this.rex(cmd, 'COMMON-LISP-USER', ":REPL-THREAD").then(function(sexp) {
       prof_func(sexp.source.slice(1,-1));
   });
 }

 Client.prototype.profile_invoke_toggle_package = function(pack, rec_calls, prof_meth) {
   var cmd = '(SWANK:SWANK-PROFILE-PACKAGE "' + pack + '" ' + rec_calls + ' ' + prof_meth + ')';
   var prof_func = this.on_handlers.profile_command_complete;
   return this.rex(cmd, 'COMMON-LISP-USER', ":REPL-THREAD").then(function(sexp) {
       prof_func("Attempting to profile package " + pack + "...");
   });
 }

 Client.prototype.profile_invoke_unprofile_all = function(func) {
   var cmd = '(SWANK/BACKEND:UNPROFILE-ALL)';
   var prof_func = this.on_handlers.profile_command_complete;
   return this.rex(cmd, 'COMMON-LISP-USER', ":REPL-THREAD").then(function(sexp) {
     prof_func(sexp.source.slice(1,-1));
   });
 }

 Client.prototype.profile_invoke_reset = function(func) {
   var cmd = '(SWANK/BACKEND:PROFILE-RESET)';
   var prof_func = this.on_handlers.profile_command_complete;
   return this.rex(cmd, 'COMMON-LISP-USER', ":REPL-THREAD").then(function(sexp) {
     prof_func(sexp.source.slice(1,-1));
   });
 }

 Client.prototype.profile_invoke_report = function(func) {
   var cmd = '(SWANK/BACKEND:PROFILE-REPORT)';
   var prof_func = this.on_handlers.profile_command_complete;
   return this.rex(cmd, 'COMMON-LISP-USER', ":REPL-THREAD").then(function(sexp) {
     prof_func("Profile report printed to REPL");
   });
 }

// Returns function definitions. Returns a list of objects, each of which has a
// label property, a filename, and an index
Client.prototype.find_definitions = function(fn, pkg) {
  var cmd = '(SWANK:FIND-DEFINITIONS-FOR-EMACS "' + fn + '")';
  return this.rex(cmd, pkg, "T")
    .then(function (ast) {
      var refs = [];
      for(var i = 0; i < ast.children.length; i++) {
        try {
          // Extract the filename depending on the response
          var filename = null;
          if (ast.children[i].children[1].children[1].children[0].source.toLowerCase() == ":file") {
            filename = from_lisp_string(ast.children[i].children[1].children[1].children[1].source);
          } else if (ast.children[i].children[1].children[1].children[0].source.toLowerCase() == ":buffer-and-file") {
            filename = from_lisp_string(ast.children[i].children[1].children[1].children[2].source);
          }

          // Push an appropriate reference!
          refs.push({
            label: from_lisp_string(ast.children[i].children[0].source),
            filename: filename,
            index: parseInt(ast.children[i].children[1].children[2].children[1].source)
          });
        } catch (e) {
          // Don't add the reference - it didn't parse correctly
        }
      }
      return refs;
    });
}

// Compiles the given string
Client.prototype.compile_string = function(compile_string, filename, filename_full, position, line, column, package) {
  var cmd = '(SWANK:COMPILE-STRING-FOR-EMACS ' +  to_lisp_string(compile_string) + ' ' + to_lisp_string(filename) + " '((:POSITION " + position + "))"  + to_lisp_string(filename_full) + " 'NIL)";
  return this.rex(cmd, package, "T").then((result) => this.on_compilation(package, result));
}

// Compiles the given file
Client.prototype.compile_file = function(filename, package, load=true) {
  var cmd = "(SWANK:COMPILE-FILE-FOR-EMACS " + to_lisp_string(filename) + " " + (load?"T":"NIL") + ")";
  return this.rex(cmd, package, "T").then((result) => this.on_compilation(package, result));
}

// Called after a compilation command to ensure things are loaded as needed
Client.prototype.on_compilation = function(package, result) {
  if(result.children[2].source.toUpperCase() != "NIL"
     && result.children[4].source.toUpperCase() != "NIL") {
    this.rex("(SWANK:LOAD-FILE " + result.children[5].source + ")", package, "T")
  }
}


Client.prototype.inspect_presentation = function(presentation_id) {
  var cmd = "(SWANK:INSPECT-PRESENTATION '" + presentation_id + " T)";
  return this.rex(cmd, 'COMMON-LISP-USER', ':REPL-THREAD');
}


Client.prototype.get_type_of_presentation_object = function(presentation_id) {
  var cmd_desired = "(let ((object (swank:lookup-presented-object '" + presentation_id + "))) (cond ((typep object 'string) \"string\") ((typep object 'character) \"character\") ((typep object 'number) \"number\") ((typep object 'boolean) \"boolean\") ((typep object 'symbol) \"symbol\") ((typep object 'list) \"list\") ((typep object 'array) \"array\") ((typep object 'hash-table) \"hash-table\") (T \"other\")))";
  var cmd = "(SWANK:EVAL-AND-GRAB-OUTPUT " + to_lisp_string(cmd_desired) + ")";
  return this.rex(cmd, 'COMMON-LISP-USER', ':REPL-THREAD');
}


Client.prototype.get_type_of_inspection_nth_part = function(index) {
  // inspector-nth-part
  var cmd_desired = "(let ((object (swank:inspector-nth-part " + index + "))) (cond ((typep object 'string) \"string\") ((typep object 'character) \"character\") ((typep object 'number) \"number\") ((typep object 'boolean) \"boolean\") ((typep object 'symbol) \"symbol\") ((typep object 'list) \"list\") ((typep object 'array) \"array\") ((typep object 'hash-table) \"hash-table\") (T \"other\")))";
  var cmd = '(SWANK:EVAL-AND-GRAB-OUTPUT ' + to_lisp_string(cmd_desired) + ')';
  return this.rex(cmd, 'COMMON-LISP-USER', ':REPL-THREAD');
}


Client.prototype.interrupt = function() {
  var cmd = '(:EMACS-INTERRUPT :REPL-THREAD)';
  this.send_message(cmd);
}


Client.prototype.quit = function() {
  var cmd = '(SWANK/BACKEND:QUIT-LISP)';
  return this.rex(cmd, "COMMON-LISP-USER", "T")
}


module.exports.Client = Client;
