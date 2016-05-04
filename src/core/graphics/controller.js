/// <reference path="view.ts" />
define(["require", "exports", 'bacon', '../collection'], function (require, exports, bacon, collection) {
    "use strict";
    // Controller.
    var Controller = (function () {
        function Controller(view) {
            var _this = this;
            this.view = view;
            this.modelBus = new bacon.Bus();
            this.modelStream = view.event.map(function (event) {
                // Copy model, alter it according to event, and propagate it.
                //var newModel: M = Object.create(this.model['__proto__']);
                //this.model = <M> _.assign(newModel, this.model);
                _this.model = collection.snapshot(view.model); //<any> this.model.clone();
                // Alter model copy with separate mutations.
                //mutations.forEach(mut => mut(event, this.model));
                // Alter model copy with mutations that are defined at snippet.
                event.onMouse(function (me) {
                    return me.hits.forEach(function (hit) {
                        if (event.type in hit.snippet)
                            hit.snippet[event.type](_this.model, event, hit.local);
                    });
                });
                //this.model.proxy();
                return _this.model;
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
        Controller.prototype.push = function (model) {
            //model.proxy();
            this.model = model;
            this.modelBus.push(this.model);
        };
        return Controller;
    }());
    exports.Controller = Controller;
});
// Mutation of a data model.
/*export interface Mutation<M> {
    (event: ViewEvent<any>, model: M): any;
}*/
//# sourceMappingURL=controller.js.map