/// <reference path="view.ts" />

import _ = require('lodash');
import bacon = require('bacon');

import collection = require('../collection');

import model = require('./model');
import Model = model.Model;

import view = require('./view');
import View = view.View;
import ViewEvent = view.ViewEvent;
import MouseEvent = view.ViewMouseEvent;

import data = require('../dataprovider');
import ProxyService = data.ProxyService;

// Controller.
export class Controller<M extends Model> {
    public model: M;
    private modelBus: bacon.Bus<M>;                 // Enables manual model updates.
    public modelStream: bacon.EventStream<M>;       // Stream of new models.
    public proxyService: ProxyService<M>;

    constructor(public view: View<M>) { //}, public mutations: Mutation<M>[] = []) {
        this.modelBus = new bacon.Bus();

        this.modelStream = view.event.map(event => {
            // Copy model, alter it according to event, and propagate it.
            //var newModel: M = Object.create(this.model['__proto__']);
            //this.model = <M> _.assign(newModel, this.model);

            this.model = collection.snapshot(view.model);   //<any> this.model.clone();

            // Alter model copy with separate mutations.
            //mutations.forEach(mut => mut(event, this.model));

            // Alter model copy with mutations that are defined at snippet.
            event.onMouse(me =>
                me.hits.forEach(hit => {
                    if(event.type in hit.snippet) hit.snippet[event.type](this.model, event, hit.local);
                })
            );

            //this.model.proxy();

            return this.model;
        }).skipDuplicates().throttle(250);

        // Extend model with information from server.
        /*this.proxyService = new ProxyService("server", modelAdjust.merge(this.modelBus));
        //this.proxyService.output.onValue((m) => this.model = m);
        this.modelStream = this.proxyService.output.map(m => {
            //m.conform();
            this.model = m;
            return m;
        });*/
    }

    // Push the first model state.
    push(model: M) {
        //model.proxy();
        this.model = model;
        this.modelBus.push(this.model);
    }
}

// Mutation of a data model.
/*export interface Mutation<M> {
    (event: ViewEvent<any>, model: M): any;
}*/
