/*******************************************************************************
 * @license
 * Copyright (c) 2011, 2012 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/*global define setTimeout console*/

define(["orion/assert", "orion/test", "orion/Deferred"], function(assert, mTest, Deferred) {

    var tests = {};
    var xtests = {};
    // dummy change
    tests["test basic synch"] = function() {};

    tests["test subtest"] = {
        "test sub1": function() {},
            "test sub2": function() {}
    };

    tests["test basic asynch"] = function() {
        var d = new Deferred();
        setTimeout(function() {
            assert.ok(true);
            d.resolve();
        }, 100);
        return d.promise;
    };

    tests["test expected asynch failure"] = function() {

        var failureTest = {
            "test Failure": function() {
                var d = new Deferred();
                setTimeout(function() {
                    try {
                        assert.ok(false, "expected failure");
                    } catch (e) {
                        d.reject(e);
                    }
                }, 100);
                return d.promise;
            }
        };
        var newTest = new mTest.Test();
        // by adding a dummy listener we avoid the error from useConsole() which is added if there are no listeners
        var failures = 0;
        newTest.addEventListener("testDone", function(event) {
            if (event.result === false) {
                failures++;
            }
        });
        newTest.useLocal = true;

        return newTest.run(failureTest).then(function() {
            assert.equal(failures, 1);
        });
    };

    tests["test basic asynch2"] = function() {
        var d = new Deferred();
        setTimeout(function() {
            d.resolve();
        }, 100);
        return d.promise.then(function() {
            assert.ok(true);
        });
    };

    tests["test expected asynch2 failure"] = function() {
        var d = new Deferred();
        setTimeout(function() {
            d.resolve();
        }, 100);
        return d.promise.then(function() {
            throw "expected";
        }).then(function() {
            assert.ok(false); // unexpected, should be an error
        }, function() {
            assert.ok(true); // expected, catch the error and continue
        });
    };

    tests["test basic list"] = function() {
        var listTests = {
            "test 1": function() {},
                "test obj": {
                "test2": function() {}
            }
        };
        assert.deepEqual(mTest.list(listTests), ["test 1", "test obj.test2"]);
    };

    tests["test blow stack with promise"] = function() {
        var first = new Deferred(),
            p = first.promise,
            i, recurses = 0,
            max = 2000;

        function returnPromise() {
            recurses++;
            return first;
        }
        for (i = 0; i < max; i++) {
            p = p.then(returnPromise);
        }
        first.resolve();

        return p.then(function() {
            assert.ok(max === recurses, "Stack blown at " + recurses + " recurses.");
        });
    };

    tests["test blow stack with value"] = function() {
        var first = new Deferred(),
            p = first.promise,
            i, recurses = 0,
            max = 2000;

        function returnValue() {
            recurses++;
            return 1;
        }

        for (i = 0; i < max; i++) {
            p = p.then(returnValue);
        }
        first.resolve();

        return p.then(function() {
            assert.ok(max === recurses, "Stack blown at " + recurses + " recurses.");
        });
    };

    tests["test blow stack with exception"] = function() {
        var first = new Deferred(),
            p = first.promise,
            i, recurses = 0,
            max = 2000;

        function throwException() {
            recurses++;
            throw "exception";
        }

        for (i = 0; i < max; i++) {
            p = p.then(null, throwException);
        }

        first.reject();

        return p.then(function() {
            assert.ok(false, "Expected an exception");
        }, function() {
            assert.ok(max === recurses, "Stack blown at " + recurses + " recurses.");
        });
    };

    tests["test cancel a"] = function() {
        var a = new Deferred();
        var result = a.promise.then(function() {
            return assert.ok(false, "Expected an exception");
        }, function() {
            // expected
        });
        a.promise.cancel();
        return result;
    };

    tests["test cancel result"] = function() {
        var a = new Deferred();
        var test = a.promise.then(function() {
            return assert.ok(false, "Expected an exception");
        }, function() {
            a.resolve();
        });
        test.cancel();
        return test;
    };

    tests["test cancel parent"] = function() {
        var parent = new Deferred();

        var test = parent.promise.then(function() {
            return assert.ok(false, "Expected an exception");
        }, function() {
            // expected
        });

        var testCancel = test.cancel;
        test.cancel = function() {
            parent.promise.cancel();
            testCancel();
        };
        test.cancel();
        return parent.promise.then(function() {
            return assert.ok(false, "Expected an exception");
        }, function() {
            // expected
        });
    };

    tests["test cancel assumed"] = function() {
        var assumed = new Deferred();
        var a = new Deferred();
        var test = a.promise.then(function() {
            return assumed.promise;
        });
        assumed.promise.assumed = true;
        a.promise.a = true;
        test.test = true;

        a.resolve().then(function() {
            test.cancel();
        });
        return assumed.promise.then(function() {
            return assert.ok(false, "Expected an exception");
        }, function() {
            // expected
        });
    };


    //promises a+ cancel tests
    function fulfilled(value) {
        return new Deferred().resolve(value);
    }

    function rejected(reason) {
        return new Deferred().reject(reason);
    }

    function pending() {
        var d = new Deferred();
        return {
            promise: d.promise,
            fulfill: d.resolve,
            reject: d.reject
        };
    }

    function done() {}

    var sentinel = {
        sentinel: "sentinel"
    }; // a sentinel fulfillment value to test for with strict equality
    var dummy = {
        dummy: "dummy"
    }; // we fulfill or reject with this when we don't intend to test against it

    function isCancellationError(error) {
        return error instanceof Error && error.name === "Cancel";
    }

    tests["test Cancel.1: If the promise is not pending the 'cancel' call has no effect" + "\n" + "already-fulfilled"] = function() {
        var promise = fulfilled(sentinel);
        var result = promise.then(function(value) {
            assert.strictEqual(value, sentinel);
            done();
        }, assert.fail);
        promise.cancel();
        return result;
    };

    tests["test Cancel.1: If the promise is not pending the 'cancel' call has no effect" + "\n" + "already-rejected"] = function() {
        var promise = rejected(sentinel);
        var result = promise.then(assert.fail, function(reason) {
            assert.strictEqual(reason, sentinel);
            done();
        });
        promise.cancel();
        return result;
    };


    tests["test Cancel.2: If the promise is pending and waiting on another promise the 'cancel' call should instead propagate to this parent promise but MUST be done asynchronously after this call returns." + "\n" + "parent pending"] = function() {
        var parentCancelled = false;
        var tuple = pending();
        var parent = tuple.promise;
        parent.then(assert.fail, function(reason) {
            assert.ok(isCancellationError(reason));
            parentCancelled = true;
            throw reason;
        });
        var promise = parent.then(assert.fail, function(reason) {
            assert.ok(isCancellationError(reason));
            assert.ok(parentCancelled);
            done();
        });
        promise.cancel();
        return promise;
    };

    tests["test Cancel.2: If the promise is pending and waiting on another promise the 'cancel' call should instead propagate to this parent promise but MUST be done asynchronously after this call returns" + "\n" + "grand parent pending"] = function() {
        var grandparentCancelled = false;
        var parentCancelled = false;
        var uncleCancelled = false;

        var tuple = pending();
        var grandparent = tuple.promise;
        var grandparentCancel = grandparent.cancel.bind(grandparent);
        grandparent.cancel = function() {
            grandparentCancelled = true;
            grandparentCancel();
        };

        grandparent.then(null, function(reason) {
            uncleCancelled = true;
            assert.ok(isCancellationError(reason));
            throw reason;
        });

        var parent = grandparent.then(assert.fail, function(reason) {
            assert.ok(isCancellationError(reason));
            parentCancelled = true;
            throw reason;
        });

        var promise = parent.then(assert.fail, function(reason) {
            assert.ok(isCancellationError(reason));
            assert.ok(grandparentCancelled);
            assert.ok(uncleCancelled);
            assert.ok(parentCancelled);
            done();
        });
        promise.cancel();
        return promise;
    };

    tests["test Cancel.3: Otherwise the promise is rejected with a CancellationError." + "\n" + "simple"] = function() {
        var promise = pending().promise;
        var result = promise.then(assert.fail, function(reason) {
            assert.ok(isCancellationError(reason));
            done();
        });
        promise.cancel();
        return result;
    };

    tests["test Cancel.3: Otherwise the promise is rejected with a CancellationError." + "\n" + "then fulfilled assumption"] = function() {
        var assumedCancelled = false;
        var assumed = pending().promise;
        var assumedCancel = assumed.cancel.bind(assumed);
        assumed.cancel = function() {
            assumedCancelled = true;
            assumedCancel();
        };

        var promise = fulfilled().then(function() {
            return assumed;
        }).then(assert.fail, function(reason) {
            assert.ok(isCancellationError(reason));
            assert.ok(assumedCancelled);
            done();
        });
        promise.cancel();
        return promise;
    };

    tests["test Cancel.3: Otherwise the promise is rejected with a CancellationError." + "\n" + "assume pending assumption"] = function() {
        var d = pending();
        d.fulfill(pending().promise);
        var promise = d.promise.then(assert.fail, function(reason) {
            assert.ok(isCancellationError(reason));
            done();
        });
        promise.cancel();
        return promise;
    };

    tests["test Cancel.3: Otherwise the promise is rejected with a CancellationError." + "\n" + "assume fulfilled assumption"] = function() {
        var d = pending();
        d.fulfill(fulfilled());
        var promise = d.promise.then(function() {
            return pending().promise;
        }).then(assert.fail, function(reason) {
            assert.ok(isCancellationError(reason));
            done();
        });
        promise.cancel();
        return promise;
    };

    tests["test Cancel.3: Otherwise the promise is rejected with a CancellationError." + "\n" + "assume rejected assumption"] = function() {
        var d = pending();
        d.fulfill(rejected());
        var promise = d.promise.then(assert.fail, function(reason) {
            assert.ok(!isCancellationError(reason));
            done();
        });
        promise.cancel();
        return promise;
    };

    tests["test Cancel.3: Otherwise the promise is rejected with a CancellationError." + "\n" + "then chain-fulfilled assumption"] = function() {
        var assumedCancelled = false;
        var assumed = pending().promise;
        var assumedCancel = assumed.cancel.bind(assumed);
        assumed.cancel = function() {
            assumedCancelled = true;
            assumedCancel();
        };

        var promise = fulfilled().then(function() {
            return fulfilled();
        }).then(function() {
            return assumed;
        }).then(assert.fail, function(reason) {
            assert.ok(isCancellationError(reason));
            assert.ok(assumedCancelled);
            done();
        });
        promise.cancel();
        return promise;
    };

    tests["test Cancel.3: Otherwise the promise is rejected with a CancellationError." + "\n" + "then rejected assumption"] = function() {
        var assumedCancelled = false;
        var assumed = pending().promise;
        assumed.then(null, function(reason) {
            assumedCancelled = true;
            assert.ok(isCancellationError(reason));
        });
        var promise = rejected().then(null, function() {
            return assumed;
        }).then(assert.fail, function(reason) {
            assert.ok(isCancellationError(reason));
            assert.ok(assumedCancelled);
            done();
        });
        promise.cancel();
        return promise;
    };

    tests["test Cancel.3: Otherwise the promise is rejected with a CancellationError." + "\n" + "then chain-rejected assumption"] = function() {
        var assumedCancelled = false;
        var assumed = pending().promise;
        var assumedCancel = assumed.cancel.bind(assumed);
        assumed.cancel = function() {
            assumedCancelled = true;
            assumedCancel();
        };

        var promise = rejected().then(null, function() {
            return rejected();
        }).then(null, function() {
            return assumed;
        }).then(assert.fail, function(reason) {
            assert.ok(isCancellationError(reason));
            assert.ok(assumedCancelled);
            done();
        });
        promise.cancel();
        return promise;
    };

    tests["test Cancel.3: Otherwise the promise is rejected with a CancellationError." + "\n" + "then noCancel assumption"] = function() {

        var noCancel = {
            then: function(cb) {
                setTimeout(cb, 2000);
            }
        };

        var promise = fulfilled().then(function() {
            return noCancel;
        }).then(assert.fail, function(reason) {
            assert.ok(isCancellationError(reason));
            done();
        });
        promise.cancel();
        return promise;
    };

    tests["test Cancel.3: Otherwise the promise is rejected with a CancellationError." + "\n" + "resolve noCancel assumption"] = function() {

        var noCancel = {
            then: function(cb) {
                setTimeout(cb, 2000);
            }
        };

        var promise = fulfilled(noCancel).then(assert.fail, function(reason) {
            assert.ok(isCancellationError(reason));
            done();
        });
        promise.cancel();
        return promise;
    };
    
    tests["The cancel logic should execute on its own stack"+ "\n" + "resolve assumption"] = function() {

		var d = pending();
		var promise = d.promise;
		
		promise.cancel();
		d.resolve();
		
		return promise.then(done, assert.fail);
    };
    
    tests["The cancel logic should execute on its own stack"+ "\n" + "reject assumption"] = function() {

		var d = pending();
		var promise = d.promise;
		
		promise.cancel();
		d.reject();
		
		return promise.then(assert.fail, function(reason) {
            assert.ok(!isCancellationError(reason));
            done();
        });
    };
    return tests;
});