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
                if (secret !== protectedSecret) {
                    throw new Error("protected");
                }
                return _protected;
            }
        });

        function resolve(value) {
            if (!called) {
                called = true;
                try {
                    var valueThen = value && (typeof value === "object" || typeof value === "function") && value.then;
                    if (typeof valueThen === "function") {
                        if (typeof value.cancel !== "function") {
                            calledCancellable = true;
                            valueThen(_resolve, _reject);
                            return _this;
                        } else if (value !== _this) {
                            _protected.canceler = value;
                        }
                    }
                } catch (error) {
                    _reject(error);
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

        this.then = function() {
            var thenArguments = Array.prototype.slice.call(arguments);
            var derived;

            function wrap(f) {
                return function() {
                    var result = f.apply(undefined, arguments);
                    if (result === derived) {
                        _reject(new TypeError());
                        return result;
                    }
                    var resultThen = result && (typeof result === "object" || typeof result === "function") && result.then;
                    if (typeof resultThen === "function") { //IsPromise
                        result = {
                            then: resultThen.bind(result),
                            cancel: result.cancel
                        };
                        derived._protected(protectedSecret).canceler = result;
                    }
                    return result;
                };
            }
            for (var i = 0, length = Math.min(2, thenArguments.length); i < length; i++) {
                if (typeof thenArguments[i] === "function") {
                    thenArguments[i] = wrap(thenArguments[i]);
                }
            }
            derived = _then.apply(_this, thenArguments);
            derived._protected(protectedSecret).canceler = _this;
            var derivedCancel = derived.cancel;
            derived.cancel = setTimeout.bind(undefined, derivedCancel, 0);
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
            resolver.apply(undefined, resolverArgs);
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