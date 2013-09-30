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
    function CancellablePromise(resolver) {
        var _resolve, _reject;
        Promise.call(this, function(resolve, reject) {
            _resolve = resolve;
            _reject = reject;
        });
        var _then = this.then;
        var called = false;
        var canceler;
        // ideally protected
        Object.defineProperty(this, "_canceler", {
            set: function(value) {
                canceler = value;
            }
        });

        function resolve(value) {
            if (!called) {
                called = true;
                if (value && typeof value.then === "function") { //IsPromise
                    canceler = value;
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

        var _this = this;
        this.then = function(onResolve, onReject, onProgress) {
            var derived;

            function wrap(f) {
                return function() {
                    var result = f.apply(null, arguments);
                    if (result && typeof result.then === "function") { //IsPromise
                        derived._canceler = result; //ideally protected access
                    }
                    return result;
                };
            }
            derived = _then(wrap(onResolve), wrap(onReject), onProgress);
            derived._canceler = _this; //ideally protected access
            var derivedCancel = derived.cancel;
            derived.cancel = setTimeout.bind(null, derivedCancel, 0);
            return derived;
        };
        this.cancel = function() {
            if (canceler && typeof canceler.cancel === "function") {
                canceler.cancel();
            } else {
                if (!called) {
                    var cancelError = new Error("Cancel"); //$NON-NLS-0$
                    cancelError.name = "Cancel"; //$NON-NLS-0$
                    reject(cancelError);
                }
            }
            return _this;
        };
        resolver(resolve, reject);
    }
    // copy methods from Promise
    for (var prop in Promise) {
        if (Promise.hasOwnProperty(prop)) {
            CancellablePromise[prop] = Promise[prop];
        }
    }
    return CancellablePromise;
}));