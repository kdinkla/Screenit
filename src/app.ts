///<reference path="references.d.ts"/>

import bacon = require('bacon');
import _ = require('lodash');

import collection = require('./core/collection');

import mod = require('./model');
import InteractionState = mod.InteractionState;
import EnrichedState = mod.EnrichedState;

import data = require('./core/dataprovider');
import ProxyService = data.ProxyService;

import mutations = require('./mutations');

import view = require('./overview');
import OverView = view.OverView;

// Module view as main view in index.html.
var overView = new OverView();

var interactionState = new InteractionState();
var interactionStates = new bacon.Bus<InteractionState>();
var enrichedStates = interactionStates
    //.skipDuplicates((l, r) => _.isEqual(l, r))
    .throttle(250)
    .map(s => new EnrichedState(s));
var proxyService = new ProxyService<EnrichedState>("server", enrichedStates);

overView.event.onValue(event => {
    var oldState = overView.model;
    var newState = overView.model.cloneInteractionState();

    // Alter model copy with mutations that are defined at snippet.
    event.onMouse(me => {
            if (me.topHit && event.type in me.topHit.snippet) me.topHit.snippet[event.type](event, me.topHit.local, oldState, newState)
            /*me.hits.forEach(hit => {
             if(event.type in hit.snippet) hit.snippet[event.type](event, hit.local, oldState, newState);
             })*/
        }
    );

    interactionState = newState;
    interactionStates.push(interactionState);
});

// Extend model with information from server.
proxyService.output.onValue(m => overView.update(m));

// Finally, trigger model update.
interactionStates.push(interactionState);
