/// <reference path='style.ts' />
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
define(["require", "exports", './style', '../math'], function (require, exports, style_1, math_1) {
    "use strict";
    // Base implementation of snippet.
    var BaseSnippet = (function () {
        function BaseSnippet(identifier) {
            this.identifier = identifier;
        }
        // Do not paint anything.
        BaseSnippet.prototype.paint = function (context) {
        };
        BaseSnippet.prototype.toString = function () {
            return this.identifier;
        };
        return BaseSnippet;
    }());
    exports.BaseSnippet = BaseSnippet;
    // Positioned snippet with dimensions. Abstract class
    var PlacedSnippet = (function (_super) {
        __extends(PlacedSnippet, _super);
        // Identifier and top left position of snippet.
        function PlacedSnippet(identifier, topLeft) {
            if (topLeft === void 0) { topLeft = [0, 0]; }
            _super.call(this, identifier);
            //this.topLeft = topLeft;
            this.dimensions = [0, 0];
            this.setTopLeft(topLeft);
        }
        // Sets top left position.
        PlacedSnippet.prototype.setTopLeft = function (topLeft) {
            this.topLeft = topLeft;
            this.updatePositions();
        };
        // Sets dimensions.
        PlacedSnippet.prototype.setDimensions = function (dimensions) {
            this.dimensions = dimensions;
            this.updatePositions();
        };
        PlacedSnippet.prototype.updatePositions = function () {
            this.topRight = [this.topLeft[0] + this.dimensions[0], this.topLeft[1]];
            this.bottomLeft = [this.topLeft[0], this.topLeft[1] + this.dimensions[1]];
            this.bottomRight = math_1.Vector.add(this.topLeft, this.dimensions);
        };
        return PlacedSnippet;
    }(BaseSnippet));
    exports.PlacedSnippet = PlacedSnippet;
    var List = (function (_super) {
        __extends(List, _super);
        function List(identifier, snippets, topLeft, // Top left corner.
            dimensions, // Minimum dimensions.
            orientation, space, alignment) {
            if (topLeft === void 0) { topLeft = [0, 0]; }
            if (dimensions === void 0) { dimensions = [0, 0]; }
            if (orientation === void 0) { orientation = 'vertical'; }
            if (space === void 0) { space = 0; }
            if (alignment === void 0) { alignment = 'middle'; }
            _super.call(this, identifier, topLeft);
            this.snippets = snippets;
            this.orientation = orientation;
            this.space = space;
            this.alignment = alignment;
            this.topLeft = topLeft;
            this.dimensions = dimensions;
            this.updateLayout();
        }
        // Also update positions of listed snippets.
        List.prototype.setTopLeft = function (topLeft) {
            this.topLeft = topLeft;
            this.updateLayout();
        };
        // Block dimension alteration, for now.
        List.prototype.setDimensions = function (dimensions) {
            this.dimensions = dimensions;
            this.updateLayout();
        };
        List.prototype.updateLayout = function () {
            var _this = this;
            if (this.snippets) {
                var lAxis = this.orientation === 'vertical' ? 1 : 0;
                var wAxis = this.orientation === 'vertical' ? 0 : 1;
                // Column width is snippets maximum width.
                var span = this.snippets.length > 0 ? Math.max.apply(null, this.snippets.map(function (s) { return s.dimensions[wAxis]; })) : 0;
                span = Math.max(span, this.dimensions[wAxis]);
                var lAcc = this.topLeft[lAxis];
                this.snippets.forEach(function (s) {
                    var wPos = _this.topLeft[wAxis] +
                        (_this.alignment === 'right' ? span - s.dimensions[wAxis] :
                            _this.alignment === 'middle' ? .5 * (span - s.dimensions[wAxis]) : 0);
                    s.setTopLeft(_this.orientation === 'vertical' ? [wPos, lAcc] : [lAcc, wPos]);
                    s.updatePositions();
                    lAcc += s.dimensions[lAxis] + _this.space;
                });
                this.dimensions = this.snippets.length > 0 ?
                    math_1.Vector.subtract(this.snippets[this.snippets.length - 1].bottomRight, this.snippets[0].topLeft) :
                    [0, 0];
                this.dimensions[wAxis] = span;
            }
            this.updatePositions();
        };
        List.prototype.paint = function (context) {
            context.snippets(this.snippets);
        };
        return List;
    }(PlacedSnippet));
    exports.List = List;
    // Background snippet.
    var Background = (function (_super) {
        __extends(Background, _super);
        function Background(color) {
            _super.call(this, "Background");
            this.color = color;
        }
        // Paint background.
        Background.prototype.paint = function (context) {
            context.fillStyle(this.color); // Transition background color.
            context.transitioning = false; // Guarantee entire display fill.
            context.fillRect(0, 0, context.dimensions[0], context.dimensions[1]); // Clear display.
        };
        return Background;
    }(BaseSnippet));
    exports.Background = Background;
    // Basic snippets.
    var Rectangle = (function (_super) {
        __extends(Rectangle, _super);
        function Rectangle(identifier, topLeft, size, color, pickable) {
            if (color === void 0) { color = style_1.Color.BLACK; }
            if (pickable === void 0) { pickable = false; }
            _super.call(this, identifier);
            this.identifier = identifier;
            this.topLeft = topLeft;
            this.size = size;
            this.color = color;
            this.pickable = pickable;
        }
        Rectangle.prototype.paint = function (context) {
            context.picking = this.pickable;
            context.save();
            context.fillStyle(this.color);
            context.translate(this.topLeft);
            context.fillRect(0, 0, this.size[0], this.size[1]);
            context.restore();
        };
        return Rectangle;
    }(BaseSnippet));
    exports.Rectangle = Rectangle;
    var Triangle = (function (_super) {
        __extends(Triangle, _super);
        function Triangle(identifier, coordinates, color, pickable) {
            if (color === void 0) { color = style_1.Color.BLACK; }
            if (pickable === void 0) { pickable = false; }
            _super.call(this, identifier);
            this.identifier = identifier;
            this.coordinates = coordinates;
            this.color = color;
            this.pickable = pickable;
        }
        Triangle.prototype.paint = function (context) {
            context.picking = this.pickable;
            context.save();
            context.fillStyle(this.color);
            context.translate(this.coordinates[0]);
            context.beginPath();
            context.moveTo(0, 0);
            var sC = math_1.Vector.subtract(this.coordinates[1], this.coordinates[0]);
            context.lineTo(sC[0], sC[1]);
            var fC = math_1.Vector.subtract(this.coordinates[2], this.coordinates[0]);
            context.lineTo(fC[0], fC[1]);
            context.closePath();
            context.fill();
            context.restore();
        };
        return Triangle;
    }(BaseSnippet));
    exports.Triangle = Triangle;
    var Polygon = (function (_super) {
        __extends(Polygon, _super);
        function Polygon(identifier, coordinates, fillColor, strokeColor, transition) {
            if (fillColor === void 0) { fillColor = null; }
            if (strokeColor === void 0) { strokeColor = null; }
            if (transition === void 0) { transition = true; }
            _super.call(this, identifier);
            this.coordinates = coordinates;
            this.fillColor = fillColor;
            this.strokeColor = strokeColor;
            this.transition = transition;
        }
        Polygon.prototype.paint = function (context) {
            var cs = this.coordinates;
            context.save();
            context.context.lineJoin = "round";
            context.transitioning = this.transition;
            if (cs.length > 0) {
                context.beginPath();
                context.moveTo(cs[0][0], cs[0][1]);
                for (var i = 1; i < cs.length; i++)
                    context.lineTo(cs[i][0], cs[i][1]);
                context.closePath();
            }
            context.transitioning = true;
            context.fillStyle(this.fillColor);
            context.fill();
            context.strokeStyle(this.strokeColor);
            context.stroke();
            context.restore();
        };
        return Polygon;
    }(BaseSnippet));
    exports.Polygon = Polygon;
    var Line = (function (_super) {
        __extends(Line, _super);
        function Line(identifier, coordinates, strokeColor, transition) {
            if (strokeColor === void 0) { strokeColor = null; }
            if (transition === void 0) { transition = true; }
            _super.call(this, identifier);
            this.coordinates = coordinates;
            this.strokeColor = strokeColor;
            this.transition = transition;
        }
        Line.prototype.paint = function (context) {
            var cs = this.coordinates;
            context.save();
            context.context.lineJoin = "round";
            context.transitioning = this.transition;
            if (cs.length > 0) {
                context.beginPath();
                context.moveTo(cs[0][0], cs[0][1]);
                for (var i = 1; i < cs.length; i++)
                    context.lineTo(cs[i][0], cs[i][1]);
            }
            context.transitioning = true;
            context.strokeStyle(this.strokeColor);
            context.stroke();
            context.restore();
        };
        return Line;
    }(BaseSnippet));
    exports.Line = Line;
    // Basic text label.
    var LabelStyle = (function () {
        function LabelStyle(font, color, horizontalAnchor, verticalAnchor, rotation) {
            if (font === void 0) { font = new style_1.Font(); }
            if (color === void 0) { color = style_1.Color.BLACK; }
            if (horizontalAnchor === void 0) { horizontalAnchor = 'left'; }
            if (verticalAnchor === void 0) { verticalAnchor = 'top'; }
            if (rotation === void 0) { rotation = 0; }
            this.font = font;
            this.color = color;
            this.horizontalAnchor = horizontalAnchor;
            this.verticalAnchor = verticalAnchor;
            this.rotation = rotation;
        }
        return LabelStyle;
    }());
    exports.LabelStyle = LabelStyle;
    var Label = (function (_super) {
        __extends(Label, _super);
        function Label(identifier, text, position, style, pickable) {
            if (style === void 0) { style = new LabelStyle(); }
            if (pickable === void 0) { pickable = false; }
            _super.call(this, identifier, position);
            this.identifier = identifier;
            this.position = position;
            this.style = style;
            this.pickable = pickable;
            // Multiple lines and their dimension.
            this.lines = style.font.wordWrap(text);
            var dimensions = style.font.wrapDimensions(this.lines);
            // Determine top left position from position and align.
            this.topLeft = math_1.Vector.clone(this.position);
            if (this.style.horizontalAnchor === 'middle')
                this.topLeft[0] -= .5 * this.dimensions[0];
            else if (this.style.horizontalAnchor === 'right')
                this.topLeft[0] -= this.dimensions[0];
            if (this.style.verticalAnchor === 'middle')
                this.topLeft[1] += .5 * this.dimensions[1];
            else if (this.style.verticalAnchor === 'top')
                this.topLeft[1] += this.dimensions[1];
            _super.prototype.setDimensions.call(this, dimensions);
        }
        Label.prototype.paint = function (context) {
            var _this = this;
            context.picking = this.pickable;
            context.fillStyle(this.style.color);
            context.font(this.style.font.toString());
            context.save();
            context.translate(this.topLeft);
            context.rotate(this.style.rotation);
            var dY = 0;
            this.lines.forEach(function (l) {
                dY += _this.style.font.size;
                context.fillText(l, 0, dY);
            });
            context.restore();
        };
        return Label;
    }(PlacedSnippet));
    exports.Label = Label;
});
//# sourceMappingURL=snippet.js.map