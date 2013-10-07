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
    if (typeof define === "function" && define.amd) {
        define(factory);
    } else if (typeof exports === "object") {
        module.exports = factory();
    } else {
        root.Promise = factory();
    }
}(this, function() {
    var queue = [],
        running = false;

    function run() {
        var fn;
        while ((fn = queue.shift())) {
            fn();
        }
        running = false;
    }

    function enqueue(fn) {
        queue.push(fn);
        if (!running) {
            running = true;
            setTimeout(run, 0);
        }
    }

    function noReturn(fn) {
        return function() {
            fn.apply(undefined, arguments);
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
                var methodName = state === "fulfilled" ? "resolve" : "reject";
                if (typeof listener[methodName] === "function") {
                    try {
                        var fn = listener[methodName];
                        var listenerResult = fn(result);
                        var listenerThen = listenerResult && (typeof listenerResult === "object" || typeof listenerResult === "function") && listenerResult.then;
                        if (typeof listenerThen === "function") {
                            if (listenerResult === deferred.promise) {
                                deferred.reject(new TypeError());
                            } else {
                                listenerThen.call(listenerResult, noReturn(deferred.resolve), noReturn(deferred.reject));
                            }
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

        function _reject(error) {
            state = "rejected";
            result = error;
            if (listeners.length) {
                enqueue(notify);
            }
        }

        function _resolve(value) {
            var called = false;

            function once(fn) {
                return function(value) {
                    if (!called) {
                        called = true;
                        fn(value);
                    }
                };
            }

            try {
                var valueThen = value && (typeof value === "object" || typeof value === "function") && value.then;
                if (typeof valueThen === "function") {
                    if (value === _this) {
                        _reject(new TypeError());
                    } else {
                        state = "assumed";
                        result = value;
                        valueThen.call(value, once(_resolve), once(_reject));
                    }
                } else {
                    state = "fulfilled";
                    result = value;
                    if (listeners.length) {
                        enqueue(notify);
                    }
                }
            } catch (error) {
                once(_reject)(error);
            }
        }

        function resolve(value) {
            if (!state) {
                _resolve(value);
            }
            return _this;
        }
        
        function reject(error) {
            if (!state) {
                _reject(error);
            }
            return _this;
        }

        // Note: then and catch should be on the protoype in a native implementation that has access to listeners and enqueue
        this.then = function(onFulfill, onReject) {
            var listener = {
                resolve: onFulfill,
                reject: onReject,
                deferred: getDeferred(_this.constructor)
            };
            listeners.push(listener);
            if (state === "fulfilled" || state === "rejected") {
                enqueue(notify);
            }
            return listener.deferred.promise;
        };

        this["catch"] = function(onReject) {
            _this.then(undefined, onReject);
        };
        if (typeof resolver === "function") {
            resolver(resolve, reject);
        }
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
                promise.then(onResolve.bind(undefined, i), deferred.reject);
            });
        }
        return deferred.promise;
    };

    return Promise;
}));