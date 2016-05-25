var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
define(["require", "exports", '../core/graphics/snippet', '../core/graphics/view', '../core/graphics/style', '../core/math'], function (require, exports, snippet_1, view_1, style_1, math_1) {
    "use strict";
    var FeatureHistogramTable = (function (_super) {
        __extends(FeatureHistogramTable, _super);
        function FeatureHistogramTable(state) {
            _super.call(this, "ftrCols", [
                new FeatureList("ftrLbls", state, FeatureLabel, 'right'),
                new FeatureList("ftrHistos", state, FeatureHistogram),
                new FeatureParallelCoordinates(state),
                new Splom(state)
            ], [0, 0], [0, 0], 'horizontal', state.configuration.featureCellSpace[0], 'left');
            this.state = state;
        }
        FeatureHistogramTable.prototype.toString = function () {
            return "Features";
        };
        return FeatureHistogramTable;
    }(snippet_1.List));
    exports.FeatureHistogramTable = FeatureHistogramTable;
    var FeatureList = (function (_super) {
        __extends(FeatureList, _super);
        function FeatureList(identifier, state, construct, align) {
            if (align === void 0) { align = 'middle'; }
            _super.call(this, identifier, state.features.value.map(function (f) { return new construct(f, state); }), [0, 0], [0, 0], 'vertical', state.configuration.featureCellSpace[1], align);
        }
        return FeatureList;
    }(snippet_1.List));
    var FeatureLabel = (function (_super) {
        __extends(FeatureLabel, _super);
        function FeatureLabel(feature, state) {
            _super.call(this, "ftrLbl" + feature, feature, [0, 0], new snippet_1.LabelStyle(state.configuration.featureFont, state.populationSpace.features.has(feature) ?
                state.configuration.base :
                state.configuration.baseDim, 'left', 'top'), true);
            this.feature = feature;
        }
        FeatureLabel.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            interaction.populationSpace.features = enriched.populationSpace.features.toggle(this.feature);
        };
        return FeatureLabel;
    }(snippet_1.Label));
    var FeatureHistogram = (function (_super) {
        __extends(FeatureHistogram, _super);
        function FeatureHistogram(feature, state) {
            _super.call(this, "ftrHst_" + feature);
            this.feature = feature;
            this.state = state;
            this.setDimensions(state.configuration.featureCellDimensions);
        }
        FeatureHistogram.prototype.paint = function (context) {
            var _this = this;
            var state = this.state;
            var cfg = state.configuration;
            var histograms = state.featureHistograms.value;
            var frames = histograms.histograms;
            var populations = state.populationSpace.populations.elements.filter(function (p) { return p.identifier.toString() in frames; });
            var cacheTag = this.identifier + "_" + populations;
            var cachedImage = histograms[cacheTag];
            if (!cachedImage) {
                cachedImage = view_1.View.renderToCanvas(this.dimensions[0], this.dimensions[1], function (plainContext) {
                    // Per population frame.
                    var draw = function (fill) {
                        populations.forEach(function (population) {
                            var frame = frames[population.identifier];
                            var normFrequencies = frame.matrix[frame.columnIndex[_this.feature]];
                            plainContext.beginPath();
                            var len = normFrequencies.length - 1;
                            var spanWidth = _this.dimensions[0];
                            var spanHeight = _this.dimensions[1] - 1;
                            plainContext.moveTo(0, _this.dimensions[1]);
                            for (var i = 0; i <= len; i++) {
                                var x1 = i * spanWidth / len;
                                var f1 = normFrequencies[i];
                                var y1 = (1 - f1) * spanHeight;
                                plainContext.lineTo(x1, y1);
                            }
                            plainContext.lineTo(_this.dimensions[0], _this.dimensions[1]);
                            if (fill) {
                                var fontColor = population.colorTrans;
                                plainContext.fillStyle = fontColor.toString();
                                plainContext.fill();
                            }
                            else {
                                plainContext.lineWidth = .5;
                                plainContext.strokeStyle = cfg.backgroundColor.toString();
                                plainContext.stroke();
                            }
                        });
                    };
                    draw(true);
                    draw(false);
                });
                histograms[cacheTag] = cachedImage;
            }
            context.save();
            context.translate(this.topLeft);
            context.drawImage(cachedImage);
            // Normalized pickable area.
            context.picking = true;
            context.scale(this.dimensions[0], this.dimensions[1]);
            context.fillStyle(style_1.Color.NONE);
            context.fillRect(0, 0, 1, 1);
            context.picking = false;
            context.restore();
        };
        FeatureHistogram.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            interaction.selectedCoordinates.switchProbe([this.feature], [coordinates[0]]);
        };
        return FeatureHistogram;
    }(snippet_1.PlacedSnippet));
    var FeatureParallelCoordinates = (function (_super) {
        __extends(FeatureParallelCoordinates, _super);
        function FeatureParallelCoordinates(state) {
            _super.call(this, "ftrPrl_");
            this.state = state;
            var cfg = state.configuration;
            this.setDimensions([
                cfg.featureCellDimensions[0],
                state.features.value.length * (cfg.featureCellDimensions[1] + cfg.featureCellSpace[1]) - cfg.featureCellSpace[1]]);
        }
        FeatureParallelCoordinates.prototype.paint = function (context) {
            var _this = this;
            var state = this.state;
            var cfg = state.configuration;
            var populations = this.state.populationSpace.populations.elements;
            context.save();
            context.translate(this.topLeft);
            context.transitioning = false;
            populations.forEach(function (p) {
                return p.exemplars.elements.forEach(function (pE) {
                    return _this.paintPolyLine(context, pE.toString(), state.populationColorTranslucent(p));
                });
            });
            var focusedObject = state.focused().object;
            if (focusedObject !== null) {
                this.paintPolyLine(context, focusedObject.toString(), cfg.backgroundColor, 4);
                this.paintPolyLine(context, focusedObject.toString(), cfg.baseSelected, 2);
            }
            context.transitioning = true;
            context.restore();
        };
        FeatureParallelCoordinates.prototype.paintPolyLine = function (context, object, color, lineWidth) {
            if (lineWidth === void 0) { lineWidth = 1; }
            var state = this.state;
            var features = state.features.value;
            var featureValues = state.objectFeatureValues.value;
            var width = this.dimensions[0];
            var height = this.dimensions[1];
            if (object in featureValues.rowIndex) {
                context.strokeStyle(color);
                context.lineWidth(lineWidth);
                context.context.lineJoin = 'round';
                context.beginPath();
                features.forEach(function (f, fI) {
                    var x = featureValues.cell(f, object) * width;
                    var y = (fI + .5) * height / features.length;
                    return fI > 0 ? context.lineTo(x, y) : context.moveTo(x, y);
                });
                context.stroke();
            }
        };
        return FeatureParallelCoordinates;
    }(snippet_1.PlacedSnippet));
    var Splom = (function (_super) {
        __extends(Splom, _super);
        function Splom(model) {
            _super.call(this, "splom", [0, 0]);
            this.model = model;
            var cfg = model.configuration;
            var features = model.populationSpace.features.elements;
            // Model feature histograms.
            this.plots = features
                .map(function (f1, i1) { return features.map(function (f2, i2) {
                return i1 < i2 ?
                    new ObjectFeaturePlot(f1, f2, [0, 0], model, cfg, model.objectHistogramSize, i2 === features.length - 1, i1 === 0) :
                    null;
            }); });
            // Optional MDS plot.
            if (model.objectHistograms.value.matricesFor("mds0", "mds1")) {
                this.mdsPlot = new ObjectFeaturePlot("mds0", "mds1", [0, 0], model, cfg, model.objectHistogramSize, false, false, "Landscape");
            }
            var size = Math.max(1, features.length - 1) * model.objectHistogramSize;
            this.setDimensions([cfg.sideFont.size + size, size]);
        }
        Splom.prototype.setTopLeft = function (topLeft) {
            var _this = this;
            _super.prototype.setTopLeft.call(this, topLeft);
            if (this.plots) {
                var cfg = this.model.configuration;
                var marginTopLeft = math_1.Vector.add(this.topLeft, [cfg.sideFont.size, 0]);
                this.plots.forEach(function (pC, pCI) { return pC.forEach(function (p, pRI) {
                    var tPCI = Math.max(0, pCI);
                    var t2PRI = Math.max(0, pRI - 1);
                    if (p)
                        p.topLeft = math_1.Vector.add(marginTopLeft, [pCI * _this.model.objectHistogramSize + tPCI * cfg.splomSpace,
                            (pRI - 1) * _this.model.objectHistogramSize + t2PRI * cfg.splomSpace]);
                }); });
            }
            if (this.mdsPlot) {
                var cfg = this.model.configuration;
                this.mdsPlot.topLeft = math_1.Vector.subtract(this.topRight, [this.model.objectHistogramSize - cfg.splomSpace, 0]);
            }
        };
        Splom.prototype.paint = function (context) {
            this.plots.map(function (plts) { return context.snippets(plts); });
            context.snippet(this.mdsPlot);
        };
        Splom.prototype.toString = function () {
            return "Space";
        };
        return Splom;
    }(snippet_1.PlacedSnippet));
    var ObjectFeaturePlot = (function (_super) {
        __extends(ObjectFeaturePlot, _super);
        function ObjectFeaturePlot(feature1, feature2, topLeft, model, configuration, size, columnLabel, rowLabel, headerLabel) {
            var _this = this;
            if (columnLabel === void 0) { columnLabel = false; }
            if (rowLabel === void 0) { rowLabel = false; }
            if (headerLabel === void 0) { headerLabel = null; }
            _super.call(this, "objPlt_" + feature1 + ".." + feature2);
            this.feature1 = feature1;
            this.feature2 = feature2;
            this.topLeft = topLeft;
            this.model = model;
            this.configuration = configuration;
            this.size = size;
            this.columnLabel = columnLabel;
            this.rowLabel = rowLabel;
            this.headerLabel = headerLabel;
            // Cache for changing histograms and hovered population.
            var cachedBackgrounds = model.objectHistograms.value[this.identifier] || {};
            var focusPopulation = (model.focused().population || -1).toString();
            this.cachedBackground = cachedBackgrounds[focusPopulation];
            if (!this.cachedBackground) {
                this.cachedBackground = view_1.View.renderToCanvas(size, size, function (c) { return _this.histogram2DtoImage(c); });
                model.objectHistograms.value[this.identifier] = this.cachedBackground;
            }
        }
        ObjectFeaturePlot.prototype.histogram2DtoImage = function (context) {
            var mod = this.model;
            var size = this.size;
            // Paint histograms, if available.
            var histograms = mod.objectHistograms.value.matricesFor(this.feature1, this.feature2) || [];
            context.save();
            var populations = mod.populationSpace.populations.elements.filter(function (p) { return p.identifier in histograms; });
            var popHistos = populations.map(function (p) { return histograms[p.identifier.toString()]; });
            var firstHisto = popHistos[0];
            if (firstHisto) {
                firstHisto.forEach(function (c, xI) { return c.forEach(function (cell, yI) {
                    var mPI = -1; // Maximum population index.
                    var mPV = 0; // Maximum population value.
                    popHistos.forEach(function (pH, pHI) {
                        var pHV = pH[xI][yI];
                        if (pHV > mPV) {
                            mPI = pHI;
                            mPV = pHV;
                        }
                    });
                    if (mPV > 0) {
                        var highestPop = populations[mPI];
                        context.fillStyle = highestPop.color.darken(1 - 0.333 / mPV).toString();
                        if (mPV < 2)
                            context.fillRect(xI - .25, size - yI - .25, 1.5, 1.5);
                        else
                            context.fillRect(xI, size - yI, 1, 1);
                    }
                }); });
            }
            context.restore();
        };
        ObjectFeaturePlot.prototype.paint = function (context) {
            var _this = this;
            var mod = this.model;
            var cfg = this.configuration;
            var size = this.size;
            context.save();
            context.translate(this.topLeft);
            context.scale(size, size);
            // Support picking over entire area.
            context.picking = true;
            context.fillStyle(style_1.Color.NONE);
            context.fillRect(0, 0, 1, 1);
            context.picking = false;
            context.restore();
            context.save();
            context.translate(this.topLeft);
            context.transitioning = false;
            context.drawImageScaled(this.cachedBackground, [0, 0], [this.size, this.size]);
            var objectFeatures = this.model.objectInfo.value;
            var x = objectFeatures.columnVector(this.feature1) || [];
            var y = objectFeatures.columnVector(this.feature2) || [];
            // Large colored dots with halo for representatives.
            mod.populationSpace.populations.forEach(function (pop) {
                return pop.exemplars.forEach(function (ex) {
                    var oI = objectFeatures.rowIndex[ex];
                    ObjectFeaturePlot.drawBigDot(context, cfg, _this.model.populationColor(pop) /*pop.color*/, x[oI] * size, (1 - y[oI]) * size);
                });
            });
            // Color dot for hovered object.
            var focusedObject = mod.focused().object;
            if (focusedObject !== null) {
                var oI = objectFeatures.rowIndex[focusedObject];
                ObjectFeaturePlot.drawBigDot(context, cfg, cfg.baseSelected, x[oI] * size, (1 - y[oI]) * size, true);
            }
            context.transitioning = true;
            // Bounding rectangle.
            context.strokeStyle(cfg.baseVeryDim);
            context.strokeRect(0, 0, size, size);
            // Labels.
            context.save();
            context.font(cfg.sideFont.string);
            context.textAlign('center');
            // Header label for special plots.
            context.textBaseline('bottom');
            context.save();
            context.fillStyle(this.headerLabel ? cfg.base : style_1.Color.NONE);
            context.translate([.5 * this.size, 0]);
            context.fillText(this.headerLabel, 0, 0);
            context.restore();
            // Column (bottom) label.
            context.textBaseline('top');
            context.save();
            context.fillStyle(this.columnLabel ? cfg.base : style_1.Color.NONE);
            context.translate([.5 * this.size, this.size]);
            context.fillText(this.feature1, 0, 0);
            context.restore();
            // Row (left) label.
            context.textBaseline('bottom');
            context.save();
            context.fillStyle(this.rowLabel ? cfg.base : style_1.Color.NONE);
            context.translate([0, .5 * this.size]);
            context.rotate(-.5 * Math.PI);
            context.fillText(this.feature2, 0, 0);
            context.restore();
            context.restore();
            context.restore();
        };
        ObjectFeaturePlot.drawBigDot = function (context, cfg, color, x, y, enlarge) {
            if (enlarge === void 0) { enlarge = false; }
            var rO = (enlarge ? 1.5 : 1) * cfg.splomRepresentativeOuterDotRadius;
            var rI = (enlarge ? 1.5 : 1) * cfg.splomRepresentativeInnerDotRadius;
            context.fillStyle(cfg.backgroundColor);
            context.fillEllipse(x, y, rO, rO);
            context.fillStyle(color);
            context.fillEllipse(x, y, rI, rI);
        };
        ObjectFeaturePlot.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            var invCs = [coordinates[0], 1 - coordinates[1]]; // Inverted y-axis.
            interaction.selectedCoordinates.switchProbe([this.feature1, this.feature2], invCs);
        };
        return ObjectFeaturePlot;
    }(snippet_1.BaseSnippet));
});
//# sourceMappingURL=features.js.map