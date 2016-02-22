///<reference path="references.d.ts"/>

import bacon = require('bacon');
import _ = require('lodash');

import collection = require('./core/collection');

import mod = require('./model');
import InteractionState = mod.InteractionState;
import EnrichedState = mod.EnrichedState;

import data = require('./core/dataprovider');
import ProxyService = data.ProxyService;

import view = require('./overview');
import OverView = view.OverView;

var serverPath = "server";

// If no session key is specified, request one and redirect to session.
var sessionPart = window.location.search.replace("?", "");
if(sessionPart.length === 0) {
    // Request session key.
    Promise
        .resolve($.ajax({
            type: "POST",
            url: serverPath + "/makeSession",
            dataType: "json"
        }))
        // Redirect to new url with session key.
        .then(v => window.location.href = 'index.html?' + v);
}
// Otherwise, set up session.
else {
    // Module view as main view in index.html.
    var overView = new OverView();

    var interactionState = new InteractionState();
    var interactionStates = new bacon.Bus<InteractionState>();
    var enrichedStates = interactionStates
        //.skipDuplicates((l, r) => _.isEqual(l, r))
        .throttle(250)
        .map(s => new EnrichedState(s));
    var proxyService = new ProxyService<EnrichedState>(serverPath, enrichedStates);

    overView.event.onValue(event => {
        var oldState = overView.model;
        var newState = overView.model ? overView.model.cloneInteractionState() : new EnrichedState(interactionState);

        // Alter model copy with mutations that are defined at snippet.
        event.onMouse(me => {
                if (me.topHit && event.type in me.topHit.snippet)
                    me.topHit.snippet[event.type](event, me.topHit.local, oldState, newState)
            }
        );

        interactionState = newState;
        interactionStates.push(interactionState);
    });

    // Extend model with information from server.
    proxyService.output.onValue(m => overView.update(m));

    // Finally, trigger model update by fetching existing one from server or pushing a new one.
    var oldSessionKey = Number(sessionPart);
    Promise
        .resolve($.ajax({
            type: "POST",
            url: serverPath + "/loadSession",
            dataType: "json",
            data: { key: oldSessionKey }
        }))
        // Redirect to new url with session key.
        .then(v => {
            // Try to load state from server.
            try {
                var loadedState = InteractionState.fromJSON(v);
                interactionStates.push(loadedState);
            }
            // Otherwise go for default state.
            catch(ex) {
                console.log("Failed to load session " + oldSessionKey);
                interactionStates.push(interactionState);
            }
        });

    // Fetch new session id (to prevent overwriting old one).
    var newSessionKey = null;
    Promise
        .resolve($.ajax({
            type: "POST",
            url: serverPath + "/makeSession",
            dataType: "json"
        }))
        // Redirect to new url with session key.
        .then(v => {
            newSessionKey = v;
            history.pushState({}, "HighCons", "index.html?" + v);
        });

    // Save interaction states to server.
    interactionStates.throttle(3000).onValue(s => {
        // Guard from overwriting old session.
        if(newSessionKey !== null) {
            $.ajax({
                type: "POST",
                url: serverPath + "/storeSession",
                dataType: "json",
                data: {
                    key: newSessionKey,
                    state: s.toJSON()
                }
            })
        }
    });

}
