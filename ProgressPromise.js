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
/*global exports module define setTimeout require*/

(function(root, factory) { // UMD
    if (typeof define === "function" && define.amd) {
        define(["Promise"], factory);
    } else if (typeof exports === "object") {
        module.exports = factory(require("./Promise.js"));
    } else {
        root.ProgressPromise = factory(root.Promise);
    }
}(this, function(Promise) {
    var protectedSecret = {};
    var RESOLVED = Promise.resolve();

    function isStopProgressPropagationError(error) {
        return error instanceof Error && error.name === "StopProgressPropagation";
    }

    function ProgressPromise(resolver) {
        var resolverArgs, _resolve, _reject, settled = false;
        Promise.call(this, function(resolve, reject) {
            function wrap(fn) {
                return function() {
                    settled = true;
                    return fn.apply(undefined, arguments);
                };
            }

            resolverArgs = Array.prototype.slice.call(arguments);
            _resolve = wrap(resolve);
            _reject = wrap(reject);
        });
        var _then = this.then;

        var _this = this;
        var called = false;
        var progressListeners = [];
        var calledProgressable = false;
        // protected-ish	
        var _protected = {};
        Object.defineProperty(this, "_protected", {
            value: function(secret) {
                if (secret !== protectedSecret) {
                    throw new Error("protected");
                }
                return _protected;
            }
        });

        function resolve(value) {
            if (!called) {
                called = true;
                if (value !== _this) {
                    try {
                        var valueThen = value && (typeof value === "object" || typeof value === "function") && value.then;
                        if (typeof valueThen === "function") {
                            valueThen(_resolve, _reject);
                            return _this;
                        }
                    } catch (error) {
                        return _reject(error);
                    }
                }
                return _resolve(value);
            }
            return _this;
        }

        function reject(reason) {
            if (!called) {
                called = true;
                return _reject(reason);
            }
            return _this;
        }

        function _progress(value) {
            if (!called || calledProgressable) {
                var progressPromises = [];
                var progressError;
                progressListeners.forEach(function(listener) {
                    try {
                        var result = listener.onProgress ? listener.onProgress(value) : value;
                        var resultThen = result && (typeof result === "object" || typeof result === "function") && result.then;
                        if (typeof resultThen === "function") {
                            progressPromises.push(resultThen.call(undefined, listener.progress).then(null, function(error) {
                                if (!isStopProgressPropagationError(error)) {
                                    progressError = progressError || error;
                                }
                            }));
                        } else {
                            progressPromises.push(listener.progress(result).then(null, function(error) {
                                progressError = progressError || error;
                            }));
                        }
                    } catch (error) {
                        if (!isStopProgressPropagationError(error)) {
                            progressError = progressError || error;
                        }
                    }
                });
                return Promise.all(progressPromises).then(function() {
                    if (progressError) {
                        throw progressError;
                    }
                });
            }
            return RESOLVED;
        }

        function progress(value) {
            if (!settled) {
                var valueThen = value && (typeof value === "object" || typeof value === "function") && value.then;
                if (typeof valueThen === "function") {
                    return valueThen(progress);
                }
                return new Promise(function(resolve, reject) {
                    setTimeout(function() {
                        _progress(value).then(resolve, reject);
                    }, 0);
                });
            }
            return RESOLVED;
        }
        _protected.progress = progress;

        this.then = function(onFulfilled, onRejected, onProgress) {
            var listener = {
                promise: _then.apply(_this, arguments)
            };
            listener.progress = listener.promise._protected(protectedSecret).progress;
            if (typeof onProgress === "function") {
                listener.onProgress = onProgress;
            }
            progressListeners.push(listener);
            return listener.promise;
        };
        if (typeof resolver === "function") {
            resolver.apply(undefined, [resolve, reject, progress].concat(Array.prototype.slice.call(arguments, 3)));
        }
    }
    // copy methods from Promise
    for (var prop in Promise) {
        if (Promise.hasOwnProperty(prop)) {
            ProgressPromise[prop] = Promise[prop];
        }
    }
    return ProgressPromise;
}));