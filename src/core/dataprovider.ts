///<reference path="../references.d.ts"/>

import $ = require('jquery');
import _ = require('lodash');
import bacon = require('bacon');

export class RemoteService {
    constructor(public url: string) {
    }

    remoteFunction<R>(name: string) {
        return new RemoteFunction<R>(this.url + "/" + name);
    }
}

export class RemoteFunction<R> {
    constructor(public url: string) {}

    call(args: {} = {}): Promise<R> {
        var query = _.pairs(args).map((p) => p[0] + "=" + p[1]).join("&");

        return Promise.resolve( $.ajax(this.url, { data: query }) );
    }
}

// Proxy service provider.
export class ProxyService<M> {
    private resolvingModel: M;
    private expandBus: bacon.Bus<M>;
    private requestBuffer: ProxyValue<any>[];

    public output: bacon.EventStream<M>;        // Model output stream, enriched with information from server.

    constructor(
        public url: string,                     // Server root URL.
        public input: bacon.EventStream<M>      // Model input stream.
    ) {
        this.input.onValue((model: M) => {
            this.resolvingModel = this.update(this.resolvingModel, model);
            this.propagate();
        });
        this.expandBus = new bacon.Bus<M>();
        this.output = this.expandBus;
        this.requestBuffer = [];
    }

    // Compose update requests.
    private update(oldBranch: any, newBranch: any): any {
        if(!oldBranch) oldBranch = newBranch;   // Fall back to new branch.

        // Copy new branch.
        var result = null;

        if (_.isArray(newBranch) || _.isString(newBranch) || _.isNumber(newBranch) || _.isBoolean(newBranch)) {
            result = newBranch;
        } else if(newBranch && typeof newBranch !== "undefined") {
            result = newBranch;
        }

        if (newBranch && !(_.isString(newBranch) || _.isNumber(newBranch) || _.isBoolean(newBranch))) {
            _.pairs(newBranch).forEach(nP => {
                var newKey = nP[0];
                var newValue = nP[1];
                var oldValue = oldBranch[newKey];

                // Resolve proxy values, and (deep) update non-proxy values.
                result[newKey] = newValue instanceof ProxyValue ?
                    this.resolve(oldValue, newValue) :
                    this.update(oldValue, newValue);
            });
        }

        return result;
    }

    // Resolve a proxy value.
    private resolve(oldValue: ProxyValue<any>, newValue: ProxyValue<any>): ProxyValue<any> {
        // Proxy value was already resolved in old branch; clone it.
        if(oldValue.converged && oldValue.isEqual(newValue)) {
            newValue.value = oldValue.value;
            newValue.converged = true;
        }
        // Otherwise, request value update.
        else {
            newValue.value = oldValue.value;
            this.request(newValue);
        }

        return newValue;
    }

    // Request a value for the given proxy value.
    private request(proxyValue: ProxyValue<any>) {
        // Clear buffer of requests with the same function name.
        this.requestBuffer = this.requestBuffer.filter(bVal => bVal.name !== proxyValue.name);

        // Add request to request buffer.
        this.requestBuffer.push(proxyValue);

        this.clearRequests();
    }

    private clearActive = false;
    private clearRequests() {
        if(this.requestBuffer.length > 0 && !this.clearActive) {
            this.clearActive = true;

            var proxyValue = _.head(this.requestBuffer);
            this.requestBuffer = _.tail(this.requestBuffer);

            // Convert complex arguments to json.
            var flatArgs = {};
            _.pairs(proxyValue.args).forEach((p) => flatArgs[p[0]] = JSON.stringify(p[1]));

            // Send request for information to server.
            Promise
                .resolve($.ajax({
                    type: "POST",
                    url: this.url + "/" + proxyValue.name,
                    data: flatArgs,
                    dataType: "json"
                }))
                .then(v => {
                    proxyValue.value = proxyValue.map(v);
                    proxyValue.converged = true;

                    this.propagate();

                    this.clearActive = false;
                    this.clearRequests();
                });
        }
    }

    // Propagate model change to the outside world.
    private propagate() {
        // Allow model to update its internal state if it is implemented.
        if('update' in this.resolvingModel) this.resolvingModel['update']();
        this.expandBus.push(this.resolvingModel);
    }
}

export class ProxyValue<V> {
    public value: V;
    public converged: boolean;

    constructor(public name: string,
                public args: {},
                public initialValue: V = null,
                public map: (v: any) => V = (v) => v) {
        this.value = initialValue;
        this.converged = false;
    }

    isEqual(that: ProxyValue<V>) {
        return this.name === that.name && _.isEqual(this.args, that.args);
    }
}