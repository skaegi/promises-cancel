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
    if (typeof define === "function" && define.amd) { //$NON-NLS-0$
        define(["Promise"], factory);
    } else if (typeof exports === "object") { //$NON-NLS-0$
        module.exports = factory(require("Promise"));
    } else {
        root.CancellablePromise = factory(root.Promise);
    }
}(this, function(Promise) {
    var protectedSecret = Math.random();

    function CancellablePromise(resolver) {
        var resolverArgs;
        Promise.call(this, function() {
            resolverArgs = Array.prototype.slice.call(arguments);
        });
        var _resolve = resolverArgs[0];
        var _reject = resolverArgs[1];
        var _then = this.then;
        
        var _this = this;
        var called = false;
        var calledCancellable = false;

        // protected-ish	
        var _protected = {};
        Object.defineProperty(this, "_protected", {
            value: function(secret) {
                return secret === protectedSecret ? _protected : {};
            }
        });

        function resolve(value) {
            if (!called) {
                called = true;
                if (value && typeof value.then === "function") { //IsPromise
                    if (typeof value.cancel !== "function") {
                        calledCancellable = true;
                        value.then(_resolve, _reject);
                        return _this;
                    } else if (value !== _this) {
                        _protected.canceler = value;
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

        this.then = function(onResolve, onReject, onProgress) {
            var derived;

            function wrap(f) {
                return function() {
                    var result = f.apply(null, arguments);
                    if (result && typeof result.then === "function") { //IsPromise
                        derived._protected(protectedSecret).canceler = result;
                    }
                    return result;
                };
            }
            derived = _then(wrap(onResolve), wrap(onReject), onProgress);
            derived._protected(protectedSecret).canceler = _this;
            var derivedCancel = derived.cancel;
            derived.cancel = setTimeout.bind(null, derivedCancel, 0);
            return derived;
        };
        this.cancel = function() {
            if (!called || calledCancellable) {
                var canceler = _protected.canceler;
                if (canceler && typeof canceler.cancel === "function") {
                    canceler.cancel();
                } else {
                    called = true;
                    calledCancellable = false;
                    var cancelError = new Error("Cancel");
                    cancelError.name = "Cancel";
                    _reject(cancelError);
                }
            }
            return _this;
        };
        if (typeof resolver === "function") {
            resolverArgs[0] = resolve;
            resolverArgs[1] = reject;
            resolver.apply(null, resolverArgs);
        }
    }
    // copy methods from Promise
    for (var prop in Promise) {
        if (Promise.hasOwnProperty(prop)) {
            CancellablePromise[prop] = Promise[prop];
        }
    }
    return CancellablePromise;
}));