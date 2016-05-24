define(["require", "exports"], function (require, exports) {
    "use strict";
    // Font configuration.
    var Font = (function () {
        function Font(size, // Font size.
            wrapLength) {
            if (size === void 0) { size = 16; }
            if (wrapLength === void 0) { wrapLength = 1000; }
            this.size = size;
            this.wrapLength = wrapLength;
            this.string = this.size + "px OpenSans";
        }
        Font.prototype.toString = function () {
            return this.string;
        };
        // The width of the painted text, in pixels.
        Font.prototype.width = function (text) {
            var canvas = Font.textCanvas || (Font.textCanvas = document.createElement("canvas"));
            var context = canvas.getContext("2d");
            context.font = this.toString();
            var metrics = context.measureText(text);
            return metrics.width;
        };
        // Cut text into multiple sentences to respect wrapLength.
        Font.prototype.wordWrap = function (text) {
            var _this = this;
            var words = text.split(" ");
            var lines = [];
            words.forEach(function (wrd) {
                var w = wrd;
                var wWidth = _this.width(w);
                while (wWidth > _this.wrapLength) {
                    w = w.substr(0, w.length - 1);
                    wWidth = _this.width(w);
                }
                if (!lines.length) {
                    lines.push(w);
                }
                else if (_this.width(lines[lines.length - 1] + " ") + wWidth < _this.wrapLength) {
                    lines[lines.length - 1] += " " + w;
                }
                else {
                    lines.push(w);
                }
            });
            return lines;
        };
        Font.prototype.wrapDimensions = function (lines) {
            var _this = this;
            var maxLineLength = Math.max.apply(null, lines.map(function (l) { return _this.width(l); }));
            return [maxLineLength, lines.length * this.size];
        };
        return Font;
    }());
    exports.Font = Font;
    // RGBA color in [0..255] (maps to CSS rgb string).
    var Color = (function () {
        // Construct color from red, green, and blue in [0..255].
        function Color(r, g, b, a) {
            if (a === void 0) { a = 1; }
            this.r = r;
            this.g = g;
            this.b = b;
            this.a = a;
            this.cssString = "rgba(" + r + "," + g + "," + b + "," + a + ")";
        }
        // Alpha adjusted color.
        Color.prototype.alpha = function (mulAlpha) {
            return new Color(this.r, this.g, this.b, mulAlpha * this.a);
        };
        // Darken the color by the given factor.
        Color.prototype.darken = function (factor) {
            return new Color(Math.floor(factor * this.r), Math.floor(factor * this.g), Math.floor(factor * this.b), this.a);
        };
        Color.prototype.toString = function () {
            return this.cssString;
        };
        // Interpolate this color with the given color, where s == 0 => this and s == 1 => target.
        Color.prototype.interpolate = function (target, s) {
            var nS = 1 - s;
            return new Color(Math.round(nS * this.r + s * target.r), Math.round(nS * this.g + s * target.g), Math.round(nS * this.b + s * target.b), nS * this.a + s * target.a);
        };
        Color.fromJSON = function (data) {
            return new Color(data['r'], data['g'], data['b'], data['a']);
        };
        // Construct gray-scale value (in [0..255]).
        Color.grey = function (v, a) {
            if (a === void 0) { a = 1; }
            return new Color(v, v, v, a);
        };
        // Static shortcuts.
        Color.WHITE = new Color(255, 255, 255);
        Color.BLACK = new Color(0, 0, 0);
        Color.RED = new Color(255, 0, 0);
        Color.CRIMSON = new Color(165, 28, 48);
        Color.GREEN = new Color(0, 255, 0);
        Color.BLUE = new Color(0, 0, 255);
        Color.NONE = new Color(0, 0, 0, 0);
        // 8 color nominal mapping.
        Color.colorMapNominal8 = [
            new Color(228, 26, 28),
            new Color(55, 126, 184),
            new Color(77, 175, 74),
            new Color(152, 78, 163),
            new Color(255, 127, 0),
            new Color(255, 255, 51),
            new Color(166, 86, 40),
            new Color(247, 129, 191)
        ];
        // 18 color nominal mapping.
        Color.colorMapNominal18 = [
            new Color(27, 158, 119),
            new Color(217, 95, 2),
            new Color(117, 112, 179),
            new Color(231, 41, 138),
            new Color(102, 166, 30),
            new Color(230, 171, 2),
            new Color(166, 118, 29),
            new Color(102, 102, 102),
            new Color(228, 26, 28),
            new Color(55, 126, 184),
            new Color(77, 175, 74),
            new Color(152, 78, 163),
            new Color(255, 127, 0),
            new Color(255, 255, 51),
            new Color(166, 86, 40),
            new Color(247, 129, 191)
        ];
        return Color;
    }());
    exports.Color = Color;
});
//# sourceMappingURL=style.js.map