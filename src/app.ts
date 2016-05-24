///<reference path="references.d.ts"/>

import bacon = require('bacon');
import _ = require('lodash');

import { InteractionState, EnrichedState } from './model';
import { ProxyService } from './core/dataprovider';
import { OverView } from './overview';

// URL to the REST API.
var serverPath = "server";

// If no session key is specified in URL, request one and redirect to new session URL.
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
    // Main view with a canvas across the entire window.
    var overView = new OverView();

    // Current state of the application.
    var interactionState = new InteractionState();

    // Stream for pushing, and listening for, new application states.
    var interactionStates = new bacon.Bus<InteractionState>();

    // Enrich the state with additional information, which includes server dependent information.
    var enrichedStates = interactionStates
        .throttle(100)
        .map(s => new EnrichedState(s));
    var proxyService = new ProxyService<EnrichedState>(serverPath, enrichedStates);

    // Mutate interaction state, based on mouse and keyboard event.
    overView.event.onValue(event => {
        var oldState = overView.model;
        var newState = overView.model ? overView.model.cloneInteractionState() : new EnrichedState(interactionState);

        // Alter model copy with mutations that are defined at snippet.
        event.onMouse(me => {
                if (me.topHit && event.type in me.topHit.snippet)
                    me.topHit.snippet[event.type](event, me.topHit.local, oldState, newState)
        });

        // Alter well annotation filter on key press.
        event.onKey(ke => {
            var key = ke.keyCode || ke.charCode;
            var keyChar = String.fromCharCode(ke.which);
            var oldFilter = oldState.selectedCoordinates.wellFilter;

            // Backspace.
            if(key === 8 || key === 46)
                newState.selectedCoordinates.wellFilter = oldFilter.substring(0, oldFilter.length - 1);
            // Normal character.
            else if(!keyChar.match(/^[^A-Za-z0-9+#\.\-]+$/))
                newState.selectedCoordinates.wellFilter = oldFilter + keyChar.toLowerCase();
        });

        interactionState = newState;
        interactionStates.push(interactionState);
    });

    // Push state, enriched with latest information from server, to the view.
    proxyService.output.onValue(m => overView.update(m));

    // Finally, trigger state update by fetching a stored state from server, and otherwise creating a new state.
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

    // Always create a new session id to prevent overwriting old one.
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

    // Regularly save interaction states on server.
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