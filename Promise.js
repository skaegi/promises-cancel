/*******************************************************************************
 * @license
 * Copyright (c) 2013 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/
/*global exports module define setTimeout*/

(function(root, factory) { // UMD
    if (typeof define === "function" && define.amd) { //$NON-NLS-0$
        define(factory);
    } else if (typeof exports === "object") { //$NON-NLS-0$
        module.exports = factory();
    } else {
        root.Promise = factory();
    }
}(this, function() {
    var syncQueue = [],
        asyncQueue = [],
        running = false;

    function run() {
        var fn;
        while ((fn = syncQueue.shift() || asyncQueue.shift())) { //empty the sync queue first!!
            fn();
        }
        running = false;
    }

    function enqueue(fn, async) {
        var queue = async ? asyncQueue : syncQueue;
        queue.push(fn);
        if (!running) {
            running = true;
            if (async) {
                setTimeout(run, 0);
            } else {
                run();
            }
        }
    }

    function noReturn(fn) {
        return function() {
            fn.apply(null, arguments);
        };
    }

    function getDeferred(C) {
        if (typeof C !== "function") {
            throw "Not a constructor";
        }
        var deferred = {};
        deferred.promise = new C(function(resolve, reject) {
            deferred.resolve = resolve;
            deferred.reject = reject;
        });
        return deferred;
    }

    function Promise(resolver) {
        var result, state, listeners = [],
            _this = this;

        function notify() {
            var listener;
            while ((listener = listeners.shift())) {
                var deferred = listener.deferred;
                var methodName = state === "resolved" ? "resolve" : "reject";
                if (typeof listener[methodName] === "function") {
                    try {
                        var listenerResult = listener[methodName](result);
                        if (listenerResult && typeof listenerResult.then === "function") {
                            listenerResult.then(noReturn(deferred.resolve), noReturn(deferred.reject), deferred.progress);
                        } else {
                            deferred.resolve(listenerResult);
                        }
                    } catch (e) {
                        deferred.reject(e);
                    }
                } else {
                    deferred[methodName](result);
                }
            }
        }

        function reject(error, strict) {
            if (!state) {
                state = "rejected"; //$NON-NLS-0$
                result = error;
                if (listeners.length) {
                    enqueue(notify);
                }
            }
            return _this;
        }

        function resolve(value, strict) {
            if (!state) {
                state = "resolved"; //$NON-NLS-0$
                result = value;
                if (listeners.length) {
                    enqueue(notify);
                }
            }
            return _this;
        }

		// Note: then and catch should be on the protoype in a native implementation that has access to listeners and enqueue
        this.then = function(onResolve, onReject) {
            var listener = {
                resolve: onResolve,
                reject: onReject,
                deferred: getDeferred(_this.constructor)
            };
            listeners.push(listener);
            if (state) {
                enqueue(notify, true); //runAsync
            }
            return listener.deferred.promise;
        };

        this["catch"] = function(onReject) {
            _this.then(null, onReject);
        };
        resolver(resolve, reject);
    }

    Promise.resolve = function(value) {
        return getDeferred(this).resolve(value);
    };

    Promise.reject = function(reason) {
        return getDeferred(this).reject(reason);
    };

    Promise.cast = function(value) {
        return value instanceof this ? value : getDeferred(this).resolve(value);
    };

    Promise.race = function(promises) {
        var deferred = getDeferred(this);
        promises.forEach(function(promise) {
            promise.then(deferred.resolve, deferred.reject);
        });
        return deferred.promise;
    };

    Promise.all = function(promises) {
        var count = promises.length,
            result = [],
            deferred = getDeferred(this);

        function onResolve(i, value) {
            result[i] = value;
            if (--count === 0) {
                deferred.resolve(result);
            }
        }

        if (count === 0) {
            deferred.resolve(result);
        } else {
            promises.forEach(function(promise, i) {
                promise.then(onResolve.bind(null, i), deferred.reject);
            });
        }
        return deferred.promise;
    };

    return Promise;
}));