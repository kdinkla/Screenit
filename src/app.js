///<reference path="references.d.ts"/>
define(["require", "exports", 'bacon', './model', './core/dataprovider', './overview'], function (require, exports, bacon, mod, data, view) {
    var InteractionState = mod.InteractionState;
    var EnrichedState = mod.EnrichedState;
    var ProxyService = data.ProxyService;
    var OverView = view.OverView;
    var serverPath = "server";
    // If no session key is specified, request one and redirect to session.
    var sessionPart = window.location.search.replace("?", "");
    if (sessionPart.length === 0) {
        // Request session key.
        Promise.resolve($.ajax({
            type: "POST",
            url: serverPath + "/makeSession",
            dataType: "json"
        })).then(function (v) { return window.location.href = 'index.html?' + v; });
    }
    else {
        // Module view as main view in index.html.
        var overView = new OverView();
        var interactionState = new InteractionState();
        var interactionStates = new bacon.Bus();
        var enrichedStates = interactionStates.throttle(100).map(function (s) { return new EnrichedState(s); });
        var proxyService = new ProxyService(serverPath, enrichedStates);
        overView.event.onValue(function (event) {
            var oldState = overView.model;
            var newState = overView.model ? overView.model.cloneInteractionState() : new EnrichedState(interactionState);
            // Alter model copy with mutations that are defined at snippet.
            event.onMouse(function (me) {
                if (me.topHit && event.type in me.topHit.snippet)
                    me.topHit.snippet[event.type](event, me.topHit.local, oldState, newState);
            });
            // Alter annotation filter on key press.
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
        // Extend model with information from server.
        proxyService.output.onValue(function (m) { return overView.update(m); });
        // Finally, trigger model update by fetching existing one from server or pushing a new one.
        var oldSessionKey = Number(sessionPart);
        Promise.resolve($.ajax({
            type: "POST",
            url: serverPath + "/loadSession",
            dataType: "json",
            data: { key: oldSessionKey }
        })).then(function (v) {
            try {
                var loadedState = InteractionState.fromJSON(v);
                interactionStates.push(loadedState);
            }
            catch (ex) {
                console.log("Failed to load session " + oldSessionKey);
                interactionStates.push(interactionState);
            }
        });
        // Fetch new session id (to prevent overwriting old one).
        var newSessionKey = null;
        Promise.resolve($.ajax({
            type: "POST",
            url: serverPath + "/makeSession",
            dataType: "json"
        })).then(function (v) {
            newSessionKey = v;
            history.pushState({}, "HighCons", "index.html?" + v);
        });
        // Save interaction states to server.
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