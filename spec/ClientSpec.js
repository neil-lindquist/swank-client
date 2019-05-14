const {spawn} = require('child_process');
const Swank = require('../lib/client');

describe('Swank Client', function(){

  swank = new Swank.Client("localhost", 4005);

  //lisp start up can be slow, give it a full 30 seconds before crashing the test
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;
  beforeEach(function (done) {
    lisp_proc = spawn('ros', ['run', '--load', 'slime/start-swank.lisp'],
      {
        cwd: process.cwd()
      }
    );
    lisp_proc.stdout.on('data', function(data) {
      //console.log(`lisp stdout: ${data}`);
    });
    lisp_proc.stderr.on('error', function(data) {
      //console.log(`lisp stderr: ${data}`);
    });
    lisp_proc.on('close', function(code) {
        //console.log(`lisp process exited with code ${code}`);
    });
    tryToConnect = function() {
      var promise = swank.connect();
      promise.then(function() {
        return swank.initialize();
      }).then(function() {
        done();
      }).catch((reason) => {// couldn't connect
        setTimeout(tryToConnect, 500);
      });
    };

    tryToConnect();
  });

  afterEach(function() {
    lisp_proc.kill();
  });

  it('can connect', function() {
    expect(swank.connected).toBe(true);
  });

  it('can disconnect', function(done) {
    disconnect_handler = function() {
      expect(swank.connected).toBe(false);
      done();
    }
    swank.on('disconnect', disconnect_handler);

    swank.quit()
  });

  it('can eval', function(done) {
    print_handler = jasmine.createSpy('print_handler');
    swank.on('print_string', print_handler);
    pres_start_handler = jasmine.createSpy('pres_start_handler');
    swank.on('presentation_start', pres_start_handler);
    pres_end_handler = jasmine.createSpy('pres_end_handler');
    swank.on('presentation_end', pres_end_handler);

    swank.eval('(list (+ 1 1) "4")\n').then(function (){
      expect(pres_start_handler.calls.count()).toEqual(1);
      expect(pres_start_handler.calls.argsFor(0)).toMatch(/\d+/);
      expect(pres_end_handler.calls.count()).toEqual(1);
      expect(pres_end_handler.calls.argsFor(0)).toEqual(pres_start_handler.calls.argsFor(0));

      expect(print_handler.calls.count()).toEqual(2);
      expect(print_handler.calls.argsFor(0)).toEqual(['(2 "4")']);
      expect(print_handler.calls.argsFor(1)).toEqual(['\n']);

      done();
    });
  });
});
