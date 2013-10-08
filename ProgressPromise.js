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

    function ProgressPromise(resolver) {
        var resolverArgs, _resolve, _reject;
        Promise.call(this, function(resolve, reject) {
            resolverArgs = Array.prototype.slice.call(arguments);
            _resolve = resolve;
            _reject = reject;
        });
        var _then = this.then;

        var _this = this;
        var called = false;
        var calledProgressable = false;
        // protected-ish	
        var _protected = {progressListeners:[]};
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
                            calledProgressable = true;
                            valueThen(_resolve, _reject);
                            return _this;
                        }
                    } catch (error) {
                        return _reject(error);
                    }
                }
            }
            return _resolve(value);
        }

        function reject(reason) {
            if (!called) {
                called = true;
            }
            return _reject(reason);
        }

        function progress(value) {
            if (!called || calledProgressable) {
                var progressPromises = [];
                _protected.progressListeners.forEach(function(listener) {
                    var progress = listener.promise._protected(protectedSecret).progress;
                    try {
                        var result = listener.onProgress(value);
                        var resultThen = result && (typeof result === "object" || typeof result === "function") && result.then;
                        if (typeof resultThen === "function") {
                            progressPromises.push(resultThen.call(undefined, progress));
                        } else {
                            progressPromises.push(progress.call(undefined, result));
                        }
                    } catch (error) {
                        progressPromises.push(Promise.reject(error));
                    }
                });
                return Promise.all(progressPromises);
            }
            return Promise.resolve();
        }
        _protected.progress = progress;

        this.then = function(onFulfilled, onRejected, onProgress) {
            var listener = {
                promise: _then.apply(_this, arguments)
            };
            if (typeof onProgress === "function") {
                listener.onProgress = onProgress;
            }
            _protected.progressListeners.push(listener);
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