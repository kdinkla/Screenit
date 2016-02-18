///<reference path="references.d.ts"/>
define(["require", "exports", 'bacon', './model', './core/dataprovider', './overview'], function (require, exports, bacon, mod, data, view) {
    var InteractionState = mod.InteractionState;
    var EnrichedState = mod.EnrichedState;
    var ProxyService = data.ProxyService;
    var OverView = view.OverView;
    // Module view as main view in index.html.
    var overView = new OverView();
    var interactionState = new InteractionState();
    var interactionStates = new bacon.Bus();
    var enrichedStates = interactionStates.throttle(250).map(function (s) { return new EnrichedState(s); });
    var proxyService = new ProxyService("server", enrichedStates);
    overView.event.onValue(function (event) {
        var oldState = overView.model;
        var newState = overView.model ? overView.model.cloneInteractionState() : new EnrichedState(interactionState);
        // Alter model copy with mutations that are defined at snippet.
        event.onMouse(function (me) {
            if (me.topHit && event.type in me.topHit.snippet)
                me.topHit.snippet[event.type](event, me.topHit.local, oldState, newState);
        });
        interactionState = newState;
        interactionStates.push(interactionState);
    });
    // Extend model with information from server.
    proxyService.output.onValue(function (m) { return overView.update(m); });
    // Finally, trigger model update.
    interactionStates.push(interactionState);
});
//# sourceMappingURL=app.js.map