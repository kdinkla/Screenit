///<reference path="../references.d.ts"/>
define(["require", "exports", 'jquery', 'lodash', 'bacon'], function (require, exports, $, _, bacon) {
    "use strict";
    var RemoteService = (function () {
        function RemoteService(url) {
            this.url = url;
        }
        RemoteService.prototype.remoteFunction = function (name) {
            return new RemoteFunction(this.url + "/" + name);
        };
        return RemoteService;
    }());
    exports.RemoteService = RemoteService;
    var RemoteFunction = (function () {
        function RemoteFunction(url) {
            this.url = url;
        }
        RemoteFunction.prototype.call = function (args) {
            if (args === void 0) { args = {}; }
            var query = _.pairs(args).map(function (p) { return p[0] + "=" + p[1]; }).join("&");
            return Promise.resolve($.ajax(this.url, { data: query }));
        };
        return RemoteFunction;
    }());
    exports.RemoteFunction = RemoteFunction;
    // Proxy service provider.
    var ProxyService = (function () {
        function ProxyService(url, // Server root URL.
            input // Model input stream.
            ) {
            var _this = this;
            this.url = url;
            this.input = input;
            this.clearActive = false;
            this.input.onValue(function (model) {
                _this.resolvingModel = _this.update(_this.resolvingModel, model);
                _this.propagate();
            });
            this.expandBus = new bacon.Bus();
            this.output = this.expandBus;
            this.requestBuffer = [];
        }
        // Compose update requests.
        ProxyService.prototype.update = function (oldBranch, newBranch) {
            var _this = this;
            if (!oldBranch)
                oldBranch = newBranch; // Fall back to new branch.
            // Copy new branch.
            var result = null;
            if (_.isArray(newBranch) || _.isString(newBranch) || _.isNumber(newBranch) || _.isBoolean(newBranch)) {
                result = newBranch;
            }
            else if (newBranch && typeof newBranch !== "undefined") {
                result = newBranch;
            }
            if (newBranch && !(_.isString(newBranch) || _.isNumber(newBranch) || _.isBoolean(newBranch))) {
                _.pairs(newBranch).forEach(function (nP) {
                    var newKey = nP[0];
                    var newValue = nP[1];
                    var oldValue = oldBranch[newKey];
                    // Resolve proxy values, and (deep) update non-proxy values.
                    result[newKey] = newValue instanceof ProxyValue ?
                        _this.resolve(oldValue, newValue) :
                        _this.update(oldValue, newValue);
                });
            }
            return result;
        };
        // Resolve a proxy value.
        ProxyService.prototype.resolve = function (oldValue, newValue) {
            // Proxy value was already resolved in old branch; clone it.
            if (oldValue.converged && oldValue.isEqual(newValue)) {
                newValue.value = oldValue.value;
                newValue.converged = true;
            }
            else {
                newValue.value = oldValue.value;
                this.request(newValue);
            }
            return newValue;
        };
        // Request a value for the given proxy value.
        ProxyService.prototype.request = function (proxyValue) {
            // Clear buffer of requests with the same function name.
            this.requestBuffer = this.requestBuffer.filter(function (bVal) { return bVal.name !== proxyValue.name; });
            // Add request to request buffer.
            this.requestBuffer.push(proxyValue);
            this.clearRequests();
        };
        ProxyService.prototype.clearRequests = function () {
            var _this = this;
            if (this.requestBuffer.length > 0 && !this.clearActive) {
                this.clearActive = true;
                var proxyValue = _.head(this.requestBuffer);
                this.requestBuffer = _.tail(this.requestBuffer);
                // Convert complex arguments to json.
                var flatArgs = {};
                _.pairs(proxyValue.args).forEach(function (p) { return flatArgs[p[0]] = JSON.stringify(p[1]); });
                // Send request for information to server.
                Promise
                    .resolve($.ajax({
                    type: "POST",
                    url: this.url + "/" + proxyValue.name,
                    data: flatArgs,
                    dataType: "json"
                }))
                    .then(function (v) {
                    proxyValue.value = proxyValue.map(v);
                    proxyValue.converged = true;
                    _this.propagate();
                    _this.clearActive = false;
                    _this.clearRequests();
                });
            }
        };
        // Propagate model change to the outside world.
        ProxyService.prototype.propagate = function () {
            // Allow model to update its internal state if it is implemented.
            if ('update' in this.resolvingModel)
                this.resolvingModel['update']();
            this.expandBus.push(this.resolvingModel);
        };
        return ProxyService;
    }());
    exports.ProxyService = ProxyService;
    var ProxyValue = (function () {
        function ProxyValue(name, args, initialValue, map) {
            if (initialValue === void 0) { initialValue = null; }
            if (map === void 0) { map = function (v) { return v; }; }
            this.name = name;
            this.args = args;
            this.initialValue = initialValue;
            this.map = map;
            this.value = initialValue;
            this.converged = false;
        }
        ProxyValue.prototype.isEqual = function (that) {
            return this.name === that.name && _.isEqual(this.args, that.args);
        };
        return ProxyValue;
    }());
    exports.ProxyValue = ProxyValue;
});
//# sourceMappingURL=dataprovider.js.map