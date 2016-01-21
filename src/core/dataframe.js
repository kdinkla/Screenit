/// <reference path="collection.ts" />
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define(["require", "exports", './collection', './math'], function (require, exports, collection, math) {
    var Matrix = math.Matrix;
    var DataFrame = (function () {
        function DataFrame(dictionary) {
            var _this = this;
            if (dictionary === void 0) { dictionary = {}; }
            this.columns = _.keys(dictionary);
            this.columnIndex = collection.indexMap(this.columns);
            this.rows = this.columns.length > 0 ? _.keys(dictionary[this.columns[0]]) : [];
            this.rowIndex = collection.indexMap(this.rows);
            this.matrix = this.columns.map(function (c) { return _this.rows.map(function (r) { return dictionary[c][r]; }); });
        }
        DataFrame.prototype.columnVector = function (name) {
            return this.matrix[this.columnIndex[name]];
        };
        DataFrame.prototype.transpose = function () {
            var tr = this.shallowClone();
            tr.columns = this.rows;
            tr.rows = this.columns;
            tr.rowIndex = this.columnIndex;
            tr.columnIndex = this.rowIndex;
            tr.matrix = Matrix.transpose(tr.matrix);
            return tr;
        };
        // Apply function to cells.
        DataFrame.prototype.applyToCells = function (f) {
            var tr = this.shallowClone();
            tr.matrix = tr.matrix.map(function (c) { return c.map(f); });
            return tr;
        };
        // Normalize along columns, or globally.
        DataFrame.prototype.normalize = function (global, lowerBoundZero) {
            if (global === void 0) { global = false; }
            if (lowerBoundZero === void 0) { lowerBoundZero = false; }
            var tr = this.shallowClone();
            // Normalize by individual columns.
            var min = tr.matrix.map(function (c) { return _.min(c); });
            var max = tr.matrix.map(function (c) { return _.max(c); });
            // Normalize along all columns.
            if (global) {
                var indMin = _.min(min);
                var indMax = _.max(max);
                min = tr.matrix.map(function (c) { return indMin; });
                max = tr.matrix.map(function (c) { return indMax; });
            }
            tr.matrix = lowerBoundZero ? tr.matrix.map(function (c, cI) { return c.map(function (r) { return (r / max[cI]) || 0; }); }) : tr.matrix.map(function (c, cI) { return c.map(function (r) { return (r - min[cI]) / ((max[cI] - min[cI]) || 0); }); });
            return tr;
        };
        DataFrame.prototype.shallowClone = function () {
            var tr = new DataFrame({});
            tr.columns = this.columns;
            tr.rows = this.rows;
            tr.columnIndex = this.columnIndex;
            tr.rowIndex = this.rowIndex;
            tr.matrix = this.matrix;
            return tr;
        };
        DataFrame.prototype.join = function (that) {
            var _this = this;
            var joined = new DataFrame({});
            joined.columns = _.union(this.columns, that.columns);
            joined.rows = _.union(this.rows, that.rows);
            joined.columnIndex = collection.indexMap(joined.columns);
            joined.rowIndex = collection.indexMap(joined.rows);
            joined.matrix = Matrix.create(joined.columns.length, joined.rows.length, null);
            joined.columns.forEach(function (c) {
                var cI = joined.columnIndex[c];
                joined.rows.forEach(function (r) {
                    var rI = joined.rowIndex[r];
                    var tCI = _this.columnIndex[c];
                    var tRI = _this.rowIndex[r];
                    if (tCI >= 0 && tRI >= 0) {
                        joined.matrix[cI][rI] = _this.matrix[tCI][tRI];
                    }
                    else {
                        tCI = that.columnIndex[c];
                        tRI = that.rowIndex[r];
                        if (tCI >= 0 && tRI >= 0) {
                            joined.matrix[cI][rI] = that.matrix[tCI][tRI];
                        }
                    }
                });
            });
            return joined;
        };
        DataFrame.prototype.toDict = function () {
            var _this = this;
            var dict = {};
            this.columns.forEach(function (c, cI) {
                dict[c] = {};
                _this.rows.forEach(function (r, rI) { return dict[c][r] = _this.matrix[cI][rI]; });
            });
            return dict;
        };
        return DataFrame;
    })();
    exports.DataFrame = DataFrame;
    var NumberFrame = (function (_super) {
        __extends(NumberFrame, _super);
        function NumberFrame(dictionary, globalNormalization, cellTransform) {
            var _this = this;
            if (dictionary === void 0) { dictionary = {}; }
            if (globalNormalization === void 0) { globalNormalization = false; }
            if (cellTransform === void 0) { cellTransform = null; }
            _super.call(this, dictionary);
            // Apply optional cell transformation.
            if (cellTransform) {
                for (var i = 0; i < this.matrix.length; i++) {
                    for (var j = 0; j < this.matrix.length; j++) {
                        this.matrix[i][j] = cellTransform(this.matrix[i][j]);
                    }
                }
            }
            // Normalize by individual columns.
            this.min = this.matrix.map(function (c) { return _.min(c); });
            this.max = this.matrix.map(function (c) { return _.max(c); });
            // Normalize along all columns.
            if (globalNormalization) {
                var indMin = _.min(this.min);
                var indMax = _.max(this.max);
                this.min = this.matrix.map(function (c) { return indMin; });
                this.max = this.matrix.map(function (c) { return indMax; });
            }
            this.normalizedMatrix = this.matrix.map(function (c, cI) { return c.map(function (r) { return (r - _this.min[cI]) / ((_this.max[cI] - _this.min[cI]) || 1); }); });
            this.zeroNormalizedMatrix = this.matrix.map(function (c, cI) { return c.map(function (r) { return (r / _this.max[cI]) || 1; }); });
        }
        NumberFrame.prototype.normalizedColumnVector = function (name) {
            return this.normalizedMatrix[this.columnIndex[name]];
        };
        NumberFrame.prototype.zeroNormalizedColumnVector = function (name) {
            return this.zeroNormalizedMatrix[this.columnIndex[name]];
        };
        return NumberFrame;
    })(DataFrame);
    exports.NumberFrame = NumberFrame;
});
//# sourceMappingURL=dataframe.js.map