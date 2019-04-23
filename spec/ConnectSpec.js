const {spawn} = require('child_process');
const Swank = require('../lib/client');

describe('connecting', function(){

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

  it('Can connect', function() {
    expect(swank.connected).toBe(true);
  });

  it('Can disconnect', function() {
    disconnect_handler = jasmine.createSpy('disconnect_handler').and.returnValue(undefined);
    swank.on('disconnect', disconnect_handler);

    swank.quit().then(function() {
      expect(swank.disconnect).toBe(false);
      expect(disconnect_handler.calls.count()).toEqual(1);
    });
  });
});
