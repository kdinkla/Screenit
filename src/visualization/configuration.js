var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
define(["require", "exports", '../core/graphics/snippet'], function (require, exports, snippet_1) {
    "use strict";
    var ConfigurationOptions = (function (_super) {
        __extends(ConfigurationOptions, _super);
        function ConfigurationOptions(identifier, topLeft, targetState, targetField, targetMap) {
            _super.call(this, identifier, topLeft);
            this.targetState = targetState;
            this.targetField = targetField;
            this.targetMap = targetMap;
            var cfg = targetState.configuration;
            var baseStyle = new snippet_1.LabelStyle(cfg.annotationFont, cfg.baseDim, 'left', 'top');
            var selectedStyle = new snippet_1.LabelStyle(cfg.annotationFont, cfg.baseEmphasis, 'left', 'top');
            var buttonSnippets = _.pairs(targetMap).map(function (p, pI) {
                var label = p[0];
                var value = p[1];
                // Default to first option.
                var style = cfg[targetField] === value || (!cfg[targetField] && pI === 0) ? selectedStyle : baseStyle;
                return new ConfigurationButton(identifier + "_" + value, label, topLeft, targetField, value, style);
            });
            this.buttons = new snippet_1.List(identifier + "_lst", buttonSnippets, topLeft, [0, 0], 'horizontal', 5, 'top');
            this.setDimensions(this.buttons.dimensions);
        }
        ConfigurationOptions.prototype.setTopLeft = function (topLeft) {
            _super.prototype.setTopLeft.call(this, topLeft);
            if (this.buttons)
                this.buttons.setTopLeft(topLeft);
        };
        ConfigurationOptions.prototype.paint = function (context) {
            context.snippet(this.buttons);
        };
        return ConfigurationOptions;
    }(snippet_1.PlacedSnippet));
    exports.ConfigurationOptions = ConfigurationOptions;
    var ConfigurationButton = (function (_super) {
        __extends(ConfigurationButton, _super);
        function ConfigurationButton(identifier, text, position, targetField, targetValue, style) {
            _super.call(this, identifier, text, position, style, true);
            this.targetField = targetField;
            this.targetValue = targetValue;
        }
        ConfigurationButton.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            interaction.configuration[this.targetField] = this.targetValue;
        };
        return ConfigurationButton;
    }(snippet_1.Label));
});
//# sourceMappingURL=configuration.js.map