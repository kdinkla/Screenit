/// <reference path="../references.d.ts"/>
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
define(["require", "exports", '../model', '../core/graphics/view', '../core/graphics/snippet', './column', './datasets', './plates', './wells', './features', './exemplars', '../core/graphics/style'], function (require, exports, model_1, view_1, snippet_1, column_1, datasets_1, plates_1, wells_1, features_1, exemplars_1, style_1) {
    "use strict";
    // View identifiers and their constructors.
    var viewConstructors = function () {
        return {
            'datasets': datasets_1.DataSetList,
            'plates': plates_1.PlateIndex,
            'wells': wells_1.WellView,
            'exemplars': exemplars_1.ExemplarTable,
            'features': features_1.FeatureHistogramTable
        };
    };
    var OverView = (function (_super) {
        __extends(OverView, _super);
        function OverView() {
            _super.call(this, "overView");
        }
        OverView.prototype.updateScene = function (state) {
            var cfg = state.configuration;
            var constructors = viewConstructors(); // All panel constructors.
            // Active panels.
            var openPanels = model_1.viewCycle.map(function (ov) {
                return new column_1.ColumnPanel(ov, new constructors[ov](state), state, state.openViews.has(ov));
            });
            this.panelColumns = new snippet_1.List("pnlCols", openPanels, [0, 0], [0, 0], 'horizontal', cfg.panelSpace, 'left');
            //console.log("State:");
            //console.log(state);
        };
        OverView.prototype.paint = function (c, state) {
            var cfg = state.configuration;
            c.translate([.5, .5]);
            // Center panels.
            this.panelColumns.setTopLeft([
                Math.min(.5 * (this.dimensions()[0] - this.panelColumns.dimensions[0]), this.dimensions()[0] - this.panelColumns.dimensions[0] - cfg.windowMargin),
                cfg.panelSpace
            ]);
            c.snippet(this.panelColumns);
            // Show data loading text, or filtering text.
            var isLoading = _.keys(state).filter(function (prp) { return state[prp] && _.isBoolean(state[prp]['converged']); }).some(function (prp) { return !state[prp].converged; });
            var secondsMod = Math.round(Date.now() / 1000) % 3;
            c.save();
            c.strokeStyle(isLoading ? cfg.backgroundColor : style_1.Color.NONE);
            c.lineWidth(3);
            c.font(cfg.bigGuideStyle.font.toString());
            c.textBaseline('bottom');
            c.textAlign('left');
            var compTxt = 'Computing' + (secondsMod === 1 ? '.' : secondsMod === 2 ? '..' : '...');
            c.transitioning = false;
            c.translate([.5 * this.dimensions()[0] - 20, this.dimensions()[1] - cfg.windowMargin]);
            c.transitioning = true;
            // Show computation text.
            c.fillStyle(isLoading ? cfg.baseEmphasis : style_1.Color.NONE);
            c.strokeText(compTxt);
            c.fillText(compTxt);
            c.restore();
        };
        return OverView;
    }(view_1.View));
    exports.OverView = OverView;
});
//# sourceMappingURL=overview.js.map