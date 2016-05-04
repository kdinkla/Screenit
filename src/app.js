///<reference path="references.d.ts"/>
define(["require", "exports", 'bacon', './model', './core/dataprovider', './overview'], function (require, exports, bacon, mod, data, view) {
    "use strict";
    var InteractionState = mod.InteractionState;
    var EnrichedState = mod.EnrichedState;
    var ProxyService = data.ProxyService;
    var OverView = view.OverView;
    var serverPath = "server";
    // If no session key is specified in URL, request one and redirect to new session URL.
    var sessionPart = window.location.search.replace("?", "");
    if (sessionPart.length === 0) {
        // Request session key.
        Promise
            .resolve($.ajax({
            type: "POST",
            url: serverPath + "/makeSession",
            dataType: "json"
        }))
            .then(function (v) { return window.location.href = 'index.html?' + v; });
    }
    else {
        // Main view with a canvas across the entire window.
        var overView = new OverView();
        // Current state of the application.
        var interactionState = new InteractionState();
        // Stream for pushing, and listening for, new application states.
        var interactionStates = new bacon.Bus();
        // Enrich the state with additional information, which includes server dependent information.
        var enrichedStates = interactionStates
            .throttle(100)
            .map(function (s) { return new EnrichedState(s); });
        var proxyService = new ProxyService(serverPath, enrichedStates);
        // Mutate interaction state, based on mouse and keyboard event.
        overView.event.onValue(function (event) {
            var oldState = overView.model;
            var newState = overView.model ? overView.model.cloneInteractionState() : new EnrichedState(interactionState);
            // Alter model copy with mutations that are defined at snippet.
            event.onMouse(function (me) {
                if (me.topHit && event.type in me.topHit.snippet)
                    me.topHit.snippet[event.type](event, me.topHit.local, oldState, newState);
            });
            // Alter well annotation filter on key press.
            event.onKey(function (ke) {
                var key = ke.keyCode || ke.charCode;
                var keyChar = String.fromCharCode(ke.which);
                var oldFilter = oldState.selectedCoordinates.wellFilter;
                // Backspace.
                if (key === 8 || key === 46)
                    newState.selectedCoordinates.wellFilter = oldFilter.substring(0, oldFilter.length - 1);
                else if (!keyChar.match(/^[^A-Za-z0-9+#\.\-]+$/))
                    newState.selectedCoordinates.wellFilter = oldFilter + keyChar.toLowerCase();
            });
            interactionState = newState;
            interactionStates.push(interactionState);
        });
        // Push state, enriched with latest information from server, to the view.
        proxyService.output.onValue(function (m) { return overView.update(m); });
        // Finally, trigger state update by fetching a stored state from server, and otherwise creating a new state.
        var oldSessionKey = Number(sessionPart);
        Promise
            .resolve($.ajax({
            type: "POST",
            url: serverPath + "/loadSession",
            dataType: "json",
            data: { key: oldSessionKey }
        }))
            .then(function (v) {
            // Try to load state from server.
            try {
                var loadedState = InteractionState.fromJSON(v);
                interactionStates.push(loadedState);
            }
            // Otherwise go for default state.
            catch (ex) {
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
            .then(function (v) {
            newSessionKey = v;
            history.pushState({}, "HighCons", "index.html?" + v);
        });
        // Regularly save interaction states on server.
        interactionStates.throttle(3000).onValue(function (s) {
            // Guard from overwriting old session.
            if (newSessionKey !== null) {
                $.ajax({
                    type: "POST",
                    url: serverPath + "/storeSession",
                    dataType: "json",
                    data: {
                        key: newSessionKey,
                        state: s.toJSON()
                    }
                });
            }
        });
    }
});
//# sourceMappingURL=app.js.map