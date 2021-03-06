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
    var protectedSecret = {};

    function CancellablePromise(resolver) {
        var resolverArgs, _resolve, _reject;
        Promise.call(this, function(resolve, reject) {
            resolverArgs = Array.prototype.slice.call(arguments);
            _resolve = resolve;
            _reject = reject;
        });
        var _then = this.then;

        var _this = this;
        var called = false;
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
                delete _protected.parentCancel;
                try {
                    var valueThen = value && (typeof value === "object" || typeof value === "function") && value.then;
                    if (typeof valueThen === "function") {
                        var valueCancel = value && value.cancel;
                        if (typeof valueCancel !== "function") {
                            value = new CancellablePromise(function(resolve, reject) {
                                try {
                                    valueThen(resolve, reject);
                                } catch (error) {
                                    reject(error);
                                }
                            });
                            valueCancel = value.cancel;
                        }
                        _protected.parentCancel = valueCancel.bind(value);
                    }

                } catch (error) {
                    return _reject(error);
                }
            }
            return _resolve(value);
        }

        function reject(reason) {
            if (!called) {
                called = true;
                delete _protected.parentCancel;
            }
            return _reject(reason);
        }

        function cancel() {
            var parentCancel = _protected.parentCancel;
            if (parentCancel) {
                delete _protected.parentCancel;
                parentCancel();
            } else if (!called) {
                called = true;
                var cancelError = new Error("Cancel");
                cancelError.name = "Cancel";
                _reject(cancelError);
            }
        }

        this.then = function(onFulfilled, onRejected) {
            var derived;

            function wrap(fn) {
                if (typeof fn !== "function") {
                    return fn;
                }
                return function() {
                    var result = fn.apply(undefined, arguments);
                    var resultCancel = result && result.cancel;
                    if (typeof resultCancel === "function") {
                        derived._protected(protectedSecret).parentCancel = resultCancel.bind(result);
                    } else {
                        delete derived._protected(protectedSecret).parentCancel;
                    }
                    return result;
                };
            }
            derived = _then.apply(_this, [wrap(onFulfilled), wrap(onRejected)].concat(Array.prototype.slice.call(arguments, 2)));
            derived._protected(protectedSecret).parentCancel = _this.cancel.bind(_this);
            return derived;
        };
        this.cancel = function() {
            setTimeout(cancel, 0);
            return _this;
        };

        if (typeof resolver === "function") {
            resolver.apply(undefined, [resolve, reject].concat(Array.prototype.slice.call(arguments, 2)));
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