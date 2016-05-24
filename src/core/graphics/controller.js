/// <reference path="view.ts" />
define(["require", "exports", 'bacon', '../collection'], function (require, exports, bacon, collection) {
    "use strict";
    // Controller of model changes.
    var Controller = (function () {
        function Controller(view) {
            var _this = this;
            this.view = view;
            this.modelBus = new bacon.Bus();
            this.modelStream = view.event.map(function (event) {
                _this.model = collection.snapshot(view.model);
                // Alter model copy with mutations that are defined at snippet.
                event.onMouse(function (me) {
                    return me.hits.forEach(function (hit) {
                        if (event.type in hit.snippet)
                            hit.snippet[event.type](_this.model, event, hit.local);
                    });
                });
                return _this.model;
            }).skipDuplicates().throttle(250);
        }
        // Push the first model state.
        Controller.prototype.push = function (model) {
            this.model = model;
            this.modelBus.push(this.model);
        };
        return Controller;
    }());
    exports.Controller = Controller;
});
//# sourceMappingURL=controller.js.map