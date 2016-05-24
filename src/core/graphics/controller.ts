/// <reference path="view.ts" />

import _ = require('lodash');
import bacon = require('bacon');
import collection = require('../collection');

import { View } from './view';

// Controller of model changes.
export class Controller<M> {
    public model: M;
    private modelBus: bacon.Bus<M>;             // Enables manual model updates.
    public modelStream: bacon.EventStream<M>;   // Stream of new models.

    constructor(public view: View<M>) {
        this.modelBus = new bacon.Bus();

        this.modelStream = view.event.map(event => {
            this.model = collection.snapshot(view.model);

            // Alter model copy with mutations that are defined at snippet.
            event.onMouse(me =>
                me.hits.forEach(hit => {
                    if(event.type in hit.snippet) hit.snippet[event.type](this.model, event, hit.local);
                })
            );

            return this.model;
        }).skipDuplicates().throttle(250);
    }

    // Push the first model state.
    push(model: M) {
        this.model = model;
        this.modelBus.push(this.model);
    }
}