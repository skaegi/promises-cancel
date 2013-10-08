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

define(["orion/assert", "orion/test", "ProgressPromise"], function(assert, mTest, ProgressPromise) {

    function Deferred() {
        this.promise = new ProgressPromise(function(resolve, reject, progress) {
            this.resolve = resolve;
            this.reject = reject;
            this.progress = progress;
        }.bind(this));
    }


    var tests = {};
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
            reject: d.reject,
            progress: d.progress
        };
    }

    function done() {}

    var sentinel = {
        sentinel: "sentinel"
    }; // a sentinel fulfillment value to test for with strict equality
    var dummy = {
        dummy: "dummy"
    }; // we fulfill or reject with this when we don't intend to test against it

    function isStopProgressPropagationError(error) {
        return error instanceof Error && error.name === "StopProgressPropagation";
    }

    tests["test send progress - pending"] = function() {
        var d = pending();
        setTimeout(d.reject.bind(undefined, "timeout"), 200);
        var promise = d.promise.then(null, null, function(value) {
            assert.ok(value === sentinel);
            d.fulfill();
        });
        d.progress(sentinel);
        return promise;
    };
    
    tests["test send progress - assumed"] = function() {
        var d = pending();
        var a = pending();
        setTimeout(a.reject.bind(undefined, "timeout"), 200);
        var promise = d.fulfill(a).then(null, null, function(value) {
            assert.ok(value === sentinel);
            a.fulfill();
        });
        d.progress(sentinel);
        return promise;
    };

    tests["test send progress - fulfilled"] = function() {
        var d = pending();
        var promise = d.promise.then(function(){}, assert.fail, assert.fail);
        d.fulfill();
        d.progress();
        return ProgressPromise.all([promise, d.progress()]);
    };

    tests["test send progress - rejected"] = function() {
        var d = pending();
        var promise = d.promise.then(assert.fail, function(){}, assert.fail);
        d.reject();
        d.progress();
        return ProgressPromise.all([promise, d.progress()]);
    };

    return tests;
});