var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
define(["require", "exports", '../core/graphics/snippet', '../core/math'], function (require, exports, snippet_1, math_1) {
    "use strict";
    var ColumnPanel = (function (_super) {
        __extends(ColumnPanel, _super);
        function ColumnPanel(identifier, core, state, opened) {
            if (opened === void 0) { opened = false; }
            _super.call(this, "cp_" + identifier, _.union([new ColumnLabel(identifier, core['toString'](opened), opened, state)], opened ? [core] : []), [0, 0], [0, 0], 'vertical', state.configuration.panelSpace, 'middle');
        }
        return ColumnPanel;
    }(snippet_1.List));
    exports.ColumnPanel = ColumnPanel;
    var ColumnLabel = (function (_super) {
        __extends(ColumnLabel, _super);
        function ColumnLabel(viewIdentifier, text, opened, state) {
            _super.call(this, "clLbl_" + viewIdentifier, text, [0, 0], opened ? state.configuration.panelHeaderOpenLabel : state.configuration.panelHeaderLabel, true);
            this.viewIdentifier = viewIdentifier;
            this.opened = opened;
            if (!opened) {
                this.setDimensions([this.dimensions[1], this.dimensions[0]]);
            }
        }
        ColumnLabel.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            interaction.pushView(this.viewIdentifier);
        };
        ColumnLabel.prototype.paint = function (context) {
            var _this = this;
            context.picking = this.pickable;
            context.fillStyle(this.style.color);
            context.font(this.style.font.toString());
            context.save();
            context.translate(this.opened ? this.topLeft : math_1.Vector.add(this.topLeft, [0, this.dimensions[1]]));
            context.rotate(this.opened ? 0 : -.5 * Math.PI);
            var dY = 0;
            this.lines.forEach(function (l) {
                dY += _this.style.font.size;
                context.fillText(l, 0, dY);
            });
            context.restore();
        };
        return ColumnLabel;
    }(snippet_1.Label));
});
//# sourceMappingURL=column.js.map