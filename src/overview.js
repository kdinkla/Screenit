/// <reference path="references.d.ts"/>
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define(["require", "exports", 'jsts', './model', './core/graphics/view', './core/graphics/snippet', './configuration', './core/math', './core/dataframe', './core/graphics/style'], function (require, exports, jsts, model, view, snippet, config, math, dataframe, style) {
    var Population = model.Population;
    var WellCoordinates = model.WellCoordinates;
    var View = view.View;
    var BaseSnippet = snippet.BaseSnippet;
    var PlacedSnippet = snippet.PlacedSnippet;
    var List = snippet.List;
    var Label = snippet.Label;
    var LabelStyle = snippet.LabelStyle;
    var Polygon = snippet.Polygon;
    var Line = snippet.Line;
    var BaseConfiguration = config.BaseConfiguration;
    var Vector = math.Vector;
    var Color = style.Color;
    // View identifiers and their constructors.
    var viewConstructors = function () {
        return {
            'features': FeatureHistogramTable,
            //'splom':      Splom,
            'exemplars': ExemplarTable,
            'datasets': DataSetList,
            'plates': PlateIndex,
            //'plate':      JointWellPlates,
            'well': WellView
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
            var openPanels = model.viewCycle.map(function (ov) { return new ColumnPanel(ov, new constructors[ov](state), state, state.openViews.has(ov)); });
            this.panelColumns = new List("pnlCols", openPanels, [0, 0], [0, 0], 'horizontal', cfg.panelSpace, 'left');
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
            c.strokeStyle(isLoading ? cfg.backgroundColor : Color.NONE);
            c.lineWidth(3);
            c.font(cfg.bigGuideStyle.font.toString());
            c.textBaseline('bottom');
            c.textAlign('left');
            var compTxt = 'Computing' + (secondsMod === 1 ? '.' : secondsMod === 2 ? '..' : '...');
            c.transitioning = false;
            c.translate([.5 * this.dimensions()[0] - 20, this.dimensions()[1] - cfg.windowMargin]);
            c.transitioning = true;
            // Show computation text.
            c.fillStyle(isLoading ? cfg.baseEmphasis : Color.NONE);
            c.strokeText(compTxt);
            c.fillText(compTxt);
            c.restore();
        };
        return OverView;
    })(View);
    exports.OverView = OverView;
    var ColumnPanel = (function (_super) {
        __extends(ColumnPanel, _super);
        function ColumnPanel(identifier, core, state, opened) {
            if (opened === void 0) { opened = false; }
            _super.call(this, "cp_" + identifier, _.union([new ColumnLabel(identifier, core['toString'](opened), opened, state)], opened ? [core] : []), [0, 0], [0, 0], 'vertical', state.configuration.panelSpace, 'middle');
        }
        return ColumnPanel;
    })(List);
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
            context.translate(this.opened ? this.topLeft : Vector.add(this.topLeft, [0, this.dimensions[1]]));
            context.rotate(this.opened ? 0 : -.5 * Math.PI);
            var dY = 0;
            this.lines.forEach(function (l) {
                dY += _this.style.font.size;
                context.fillText(l, 0, dY);
            });
            context.restore();
        };
        return ColumnLabel;
    })(Label);
    var DataSetList = (function (_super) {
        __extends(DataSetList, _super);
        function DataSetList(state) {
            _super.call(this, "dataSetList", state.dataSets.value.filter(function (ds) { return ds !== state.selectedCoordinates.dataSet; }).map(function (ds) { return new DataSetLabel(ds, state); }), [0, 0], [0, 0], 'vertical', state.configuration.featureCellSpace[0]);
            this.state = state;
        }
        DataSetList.prototype.toString = function () {
            return "Screen: " + this.state.selectedCoordinates.dataSet;
        };
        return DataSetList;
    })(List);
    var DataSetLabel = (function (_super) {
        __extends(DataSetLabel, _super);
        function DataSetLabel(dataSet, state) {
            _super.call(this, "clLbl_" + dataSet, dataSet, [0, 0], state.configuration.panelHeaderLabel, true);
            this.dataSet = dataSet;
        }
        DataSetLabel.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            interaction.switchToDataSet(this.dataSet);
            interaction.pushView('plates');
        };
        return DataSetLabel;
    })(Label);
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
            if (this.state.populationSpace.features.length < 2) {
                this.guide = new GuideLabel("ftr", "Click on a feature label to add it to the phenotype model space.", [0, 0], [-80, 0], 25, state);
            }
        }
        FeatureHistogramTable.prototype.setTopLeft = function (topLeft) {
            _super.prototype.setTopLeft.call(this, topLeft);
            if (this.guide)
                this.guide.setTopLeft(Vector.add(this.topRight, [15, 250]));
        };
        FeatureHistogramTable.prototype.paint = function (context) {
            _super.prototype.paint.call(this, context);
            context.snippet(this.guide);
        };
        FeatureHistogramTable.prototype.toString = function () {
            return "Features";
        };
        return FeatureHistogramTable;
    })(List);
    var FeatureList = (function (_super) {
        __extends(FeatureList, _super);
        function FeatureList(identifier, state, construct, align) {
            if (align === void 0) { align = 'middle'; }
            _super.call(this, identifier, state.features.value.map(function (f) { return new construct(f, state); }), [0, 0], [0, 0], 'vertical', state.configuration.featureCellSpace[1], align);
        }
        return FeatureList;
    })(List);
    var FeatureLabel = (function (_super) {
        __extends(FeatureLabel, _super);
        function FeatureLabel(feature, state) {
            _super.call(this, "ftrLbl" + feature, feature, [0, 0], new LabelStyle(state.configuration.featureFont, state.populationSpace.features.has(feature) ? state.configuration.base : state.configuration.baseDim, 'left', 'top'), true);
            this.feature = feature;
        }
        FeatureLabel.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            interaction.populationSpace.features = enriched.populationSpace.features.toggle(this.feature);
            //interaction.pushView('splom');
        };
        return FeatureLabel;
    })(Label);
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
                cachedImage = View.renderToCanvas(this.dimensions[0], this.dimensions[1], function (plainContext) {
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
                                //plainContext.fillRect(x1, y1, 1, 1);
                                plainContext.lineTo(x1, y1);
                            }
                            plainContext.lineTo(_this.dimensions[0], _this.dimensions[1]);
                            if (fill) {
                                var fontColor = population.colorTrans; //population.colorTrans;
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
            context.fillStyle(Color.NONE);
            context.fillRect(0, 0, 1, 1);
            context.picking = false;
            context.restore();
        };
        FeatureHistogram.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            interaction.selectedCoordinates.switchProbe([this.feature], [coordinates[0]]);
        };
        return FeatureHistogram;
    })(PlacedSnippet);
    var FeatureParallelCoordinates = (function (_super) {
        __extends(FeatureParallelCoordinates, _super);
        function FeatureParallelCoordinates(state) {
            _super.call(this, "ftrPrl_");
            this.state = state;
            var cfg = state.configuration;
            this.setDimensions([
                cfg.featureCellDimensions[0],
                state.features.value.length * (cfg.featureCellDimensions[1] + cfg.featureCellSpace[1]) - cfg.featureCellSpace[1]
            ]);
        }
        FeatureParallelCoordinates.prototype.paint = function (context) {
            var _this = this;
            var state = this.state;
            var cfg = state.configuration;
            var populations = this.state.populationSpace.populations.elements;
            context.save();
            context.translate(this.topLeft);
            context.transitioning = false;
            //var allObjects = state.objectInfo.value.rows;
            //var genStroke = new Color(0, 0, 0, 0.05);
            //allObjects.forEach(ob => this.paintPolyLine(context, ob.toString(), genStroke));
            populations.forEach(function (p) { return p.exemplars.elements.forEach(function (pE) { return _this.paintPolyLine(context, pE.toString(), state.populationColorTranslucent(p)); }); });
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
            //var cfg = state.configuration
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
    })(PlacedSnippet);
    var Splom = (function (_super) {
        __extends(Splom, _super);
        function Splom(model) {
            _super.call(this, "splom", [0, 0]);
            this.model = model;
            var cfg = model.configuration;
            var features = model.populationSpace.features.elements;
            // Model feature histograms.
            this.plots = features.map(function (f1, i1) { return features.map(function (f2, i2) { return i1 < i2 ? new ObjectFeaturePlot(f1, f2, [0, 0], model, cfg, model.objectHistogramSize, i2 === features.length - 1, i1 === 0) : null; }); });
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
                var marginTopLeft = Vector.add(this.topLeft, [cfg.sideFont.size, 0]);
                this.plots.forEach(function (pC, pCI) { return pC.forEach(function (p, pRI) {
                    var tPCI = Math.max(0, pCI);
                    var t2PRI = Math.max(0, pRI - 1);
                    if (p)
                        p.topLeft = Vector.add(marginTopLeft, [pCI * _this.model.objectHistogramSize + tPCI * cfg.splomSpace, (pRI - 1) * _this.model.objectHistogramSize + t2PRI * cfg.splomSpace]);
                }); });
            }
            if (this.mdsPlot) {
                var cfg = this.model.configuration;
                this.mdsPlot.topLeft = Vector.subtract(this.topRight, [this.model.objectHistogramSize - cfg.splomSpace, 0]);
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
    })(PlacedSnippet);
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
                this.cachedBackground = view.View.renderToCanvas(size, size, function (c) { return _this.histogram2DtoImage(c); });
                model.objectHistograms.value[this.identifier] = this.cachedBackground;
            }
        }
        ObjectFeaturePlot.prototype.histogram2DtoImage = function (context) {
            var mod = this.model;
            var cfg = this.configuration;
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
            context.fillStyle(style.Color.NONE);
            context.fillRect(0, 0, 1, 1);
            context.picking = false;
            context.restore();
            context.save();
            context.translate(this.topLeft);
            context.transitioning = false;
            //context.transitioning = false;
            context.drawImageScaled(this.cachedBackground, [0, 0], [this.size, this.size]);
            var objectFeatures = this.model.objectInfo.value;
            var x = objectFeatures.columnVector(this.feature1) || [];
            var y = objectFeatures.columnVector(this.feature2) || [];
            //var clstr = mod.clusters.value;
            // Large colored dots with halo for representatives.
            mod.populationSpace.populations.forEach(function (pop) { return pop.exemplars.forEach(function (ex) {
                //var cI = clstr.clusterMap[pop.identifier];
                //var color = cI >= 0 ? cfg.clusterColors[clstr.identifierIndex[cI]] : Color.NONE;
                var oI = objectFeatures.rowIndex[ex];
                ObjectFeaturePlot.drawBigDot(context, cfg, _this.model.populationColor(pop), x[oI] * size, (1 - y[oI]) * size);
            }); });
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
            context.fillStyle(this.headerLabel ? cfg.base : style.Color.NONE);
            context.translate([.5 * this.size, 0]);
            context.fillText(this.headerLabel, 0, 0);
            context.restore();
            // Column (bottom) label.
            context.textBaseline('top');
            context.save();
            context.fillStyle(this.columnLabel ? cfg.base : style.Color.NONE);
            context.translate([.5 * this.size, this.size]);
            context.fillText(this.feature1, 0, 0);
            context.restore();
            // Row (left) label.
            context.textBaseline('bottom');
            context.save();
            context.fillStyle(this.rowLabel ? cfg.base : style.Color.NONE);
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
    })(BaseSnippet);
    var ExemplarTable = (function (_super) {
        __extends(ExemplarTable, _super);
        function ExemplarTable(state) {
            _super.call(this, "ExemplarStack", [0, 0]);
            this.state = state;
            var cfg = state.configuration;
            //var activePopulations = this.state.populationSpace.populations.elements;
            //.filter(p => p.identifier > Population.POPULATION_ALL_NAME);
            var visiblePopulations = this.state.populationSpace.visiblePopulations().elements;
            // Main Label.
            var activeTypeLabel = new Label("ShownLbl", "Shown", [0, 0], state.configuration.subPanelHeaderLabel, true);
            // Labels of active types.
            var activeTypeLabels = new List("ActiveTypeLabels", visiblePopulations.map(function (p) { return new TypeLabel(p, state); }), [0, 0], [0, 0], 'horizontal', cfg.exemplarColumnSpace, 'left');
            var exemplarSelected = state.isExemplarSelected();
            var exemplarLabel = new Label("ExemplarLbl", "Exemplars", [0, 0], state.configuration.subPanelHeaderLabel, true);
            var columns = new List("ExemplarColumns", visiblePopulations.map(function (p) { return new ExemplarColumn(state, p); }), [0, 0], [0, 0], 'horizontal', cfg.exemplarColumnSpace, 'left');
            //var mainPopulations = _.union(
            //        activePopulations, [state.populationSpace.populations.byId(Population.POPULATION_TOTAL_NAME)]);
            //var transferLabel = new Label("PopulationTransfersLbl", "Abundance Score",
            //                                [0,0], state.configuration.subPanelHeaderLabel, true);
            //var transferButtons = new List("PopulationTransfers",
            //        mainPopulations.map((p, pI) => new PopulationTransferEdit(p, state, pI === 0)),
            //        [0,0], [0,0], 'horizontal', cfg.exemplarColumnSpace, 'left');
            var selectedObjectDetailView = exemplarSelected ? new ObjectDetailView(state.focused().object, state, [0, 0]) : null;
            var segSnippets = _.compact([activeTypeLabel, activeTypeLabels, exemplarLabel, selectedObjectDetailView, columns]);
            var shownSegment = new List("ShownSegments", segSnippets, [0, 0], [0, 0], 'vertical', cfg.subPanelSpace);
            // Hidden types.
            var hiddenSegment = [];
            //if(state.populationSpace.inactivePopulations.length > 0) {
            var hiddenTypeLabel = new Label("HiddenLbl", "Hidden", [0, 0], state.configuration.subPanelHeaderLabel, true);
            var hiddenTypeStack = new List("HiddenTypeColumn", _.union(state.populationSpace.inactivePopulations.elements.map(function (ip) { return new TypeLabel(ip, state); }), state.isExemplarSelected() ? [
                new ExemplarAdditionButton(state.focused().object, state.populationSpace.allPopulations().byId(Population.POPULATION_UNCONFIDENT_NAME), state)
            ] : []), [0, 0], [cfg.clusterTileInnerSize, 0], 'vertical', cfg.exemplarColumnSpace, 'middle');
            hiddenSegment.push(new List("HiddenSegments", [hiddenTypeLabel, hiddenTypeStack], [0, 0], [0, 0], 'vertical', cfg.subPanelSpace));
            //}
            // Combine shown and hidden segment columns.
            this.segments = new List("TypeSegments", _.union([shownSegment], hiddenSegment), [0, 0], [0, 0], 'horizontal', cfg.subPanelSpace, 'left');
            this.setDimensions(this.segments.dimensions);
        }
        ExemplarTable.prototype.setTopLeft = function (topLeft) {
            _super.prototype.setTopLeft.call(this, topLeft);
            if (this.segments)
                this.segments.setTopLeft(topLeft);
        };
        ExemplarTable.prototype.paint = function (context) {
            context.snippet(this.segments);
        };
        ExemplarTable.prototype.toString = function () {
            return "Phenotypes";
        };
        return ExemplarTable;
    })(PlacedSnippet);
    var ExemplarAdditionButton = (function (_super) {
        __extends(ExemplarAdditionButton, _super);
        function ExemplarAdditionButton(object, population, state) {
            _super.call(this, "ExemplarLabel_" + population, [0, 0]);
            this.object = object;
            this.population = population;
            this.state = state;
            this.labelStyle = new LabelStyle(state.configuration.clusterAdditionLabel, state.populationColor(population));
            var cfg = state.configuration;
            this.setDimensions([cfg.clusterTileInnerSize, cfg.clusterTileInnerSize]);
        }
        ExemplarAdditionButton.prototype.paint = function (context) {
            _super.prototype.paint.call(this, context);
            var cfg = this.state.configuration;
            context.save();
            context.translate(this.topLeft);
            context.strokeStyle(cfg.baseDim);
            context.strokeRect(0, 0, this.dimensions[0], this.dimensions[1]);
            context.picking = true;
            context.fillStyle(Color.NONE);
            context.fillRect(0, 0, this.dimensions[0], this.dimensions[1]);
            context.picking = false;
            context.translate(Vector.mul(this.dimensions, .5));
            context.translate([0, -1]);
            context.textBaseline('middle');
            context.textAlign('center');
            context.fillStyle(cfg.baseDim);
            // Distinguish between regular phenotype and cell count phenotype.
            context.fillStyle(cfg.base);
            if (this.population.identifier === Population.POPULATION_UNCONFIDENT_NAME) {
                context.font(cfg.sideFont.toString());
                context.textBaseline('bottom');
                context.fillText('New');
                context.textBaseline('top');
                context.fillText('Type');
            }
            else {
                context.font(this.labelStyle.font.toString());
                context.fillText('+');
            }
            context.restore();
        };
        ExemplarAdditionButton.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            interaction.populationSpace.addExemplar(this.object, this.population.identifier);
        };
        return ExemplarAdditionButton;
    })(PlacedSnippet);
    var ExemplarHeader = (function (_super) {
        __extends(ExemplarHeader, _super);
        function ExemplarHeader(state, population, topLeft) {
            if (topLeft === void 0) { topLeft = [0, 0]; }
            _super.call(this, "esc_" + population.identifier, _.union([new TypeLabel(population, state)]), topLeft, [state.configuration.clusterTileInnerSize, 0], 'vertical', state.configuration.exemplarSpace, 'middle');
            this.state = state;
            this.population = population;
            this.topLeft = topLeft;
        }
        return ExemplarHeader;
    })(List);
    var ExemplarColumn = (function (_super) {
        __extends(ExemplarColumn, _super);
        function ExemplarColumn(state, population, topLeft) {
            if (topLeft === void 0) { topLeft = [0, 0]; }
            _super.call(this, "esc_" + population.identifier, _.union(state.isExemplarSelected() && (!population.predefined) ? [new ExemplarAdditionButton(state.focused().object, population, state)] : [], population.exemplars.elements.map(function (ex) { return new ObjectDetailView(ex, state, [0, 0]); })), topLeft, [state.configuration.clusterTileInnerSize, 0], 'vertical', state.configuration.exemplarSpace, 'middle');
            this.state = state;
            this.population = population;
            this.topLeft = topLeft;
        }
        return ExemplarColumn;
    })(List);
    var PopulationTransferEdit = (function (_super) {
        __extends(PopulationTransferEdit, _super);
        function PopulationTransferEdit(population, state, leftMost) {
            if (leftMost === void 0) { leftMost = false; }
            _super.call(this, "TransferEdit_" + population.identifier, [0, 0]);
            this.population = population;
            this.state = state;
            this.leftMost = leftMost;
            //var minScore = state.wellClusterShares.value.zScoresMin[population.identifier];
            //var maxScore = state.wellClusterShares.value.zScoresMax[population.identifier];
            this.minZScoreLabel = (-state.configuration.activationZScoreRange).toString(); //minScore < 0 ? minScore.toFixed(0) : '?';
            this.maxZScoreLabel = state.configuration.activationZScoreRange.toString(); //maxScore > 0 ? maxScore.toFixed(0) : '?';
            var cfg = state.configuration;
            this.setDimensions([cfg.transferPlotSize, cfg.transferPlotSize + cfg.transferFont.size]);
        }
        PopulationTransferEdit.prototype.paint = function (context) {
            _super.prototype.paint.call(this, context);
            var cfg = this.state.configuration;
            var center = Vector.mul([cfg.transferPlotSize, cfg.transferPlotSize], .5);
            context.save();
            context.translate(this.topLeft);
            // Internal axes.
            context.strokeStyle(cfg.baseVeryDim);
            context.strokeLine([center[0], 0], [center[0], cfg.transferPlotSize]);
            context.strokeLine([0, center[1]], [cfg.transferPlotSize, center[1]]);
            // Outlines.
            context.strokeStyle(cfg.baseDim);
            context.strokeRect(0, 0, cfg.transferPlotSize, cfg.transferPlotSize);
            // Side axis labels.
            context.transitioning = false;
            // Left-most axis score labels.
            if (this.leftMost) {
                context.fillStyle(cfg.base);
                context.font(cfg.transferFont.toString());
                context.textAlign('right');
                context.textBaseline('middle');
                context.fillText('1  ', 0, 3);
                //context.fillText('0  ', 0, .5 * cfg.transferPlotSize);
                context.fillText('-1  ', 0, cfg.transferPlotSize - 3);
                context.save();
                context.font(cfg.sideFont.toString());
                context.textAlign('right');
                context.textBaseline('middle');
                context.translate([-cfg.transferFont.size, .5 * cfg.transferPlotSize]);
                context.fillText('score');
                context.restore();
            }
            context.transitioning = true;
            // Function curve.
            var funcPoint = function (cs) { return [.5 * (1 + cs[0]) * cfg.transferPlotSize, .5 * (1 - cs[1]) * cfg.transferPlotSize]; };
            context.strokeStyle(this.population.color);
            context.lineWidth(2);
            context.beginPath();
            var startPoint = funcPoint([-1, this.population.activate(-1)]);
            context.moveTo(startPoint[0], startPoint[1]);
            for (var x = 1; x <= cfg.transferPlotSize; x += 3) {
                var actInput = (2 * x / cfg.transferPlotSize) - 1;
                var pnt = funcPoint([actInput, this.population.activate(actInput)]);
                context.lineTo(pnt[0], pnt[1]);
            }
            var endPoint = funcPoint([1, this.population.activate(1)]);
            context.lineTo(endPoint[0], endPoint[1]);
            context.stroke();
            // Control points.
            context.fillStyle(this.population.color);
            this.population.activation.forEach(function (cP) {
                var pnt = funcPoint(cP);
                context.fillEllipse(pnt[0], pnt[1], 2, 2);
            });
            // Selected well point.
            var focus = this.state.focused();
            var wellShare = this.state.wellClusterShares.value.zScore(this.population.identifier, focus.plate, focus.well) || 0;
            context.fillStyle(cfg.baseSelected);
            var wellInput = Math.max(-1, Math.min(1, wellShare / cfg.activationZScoreRange)); // Bound to shown range.
            var wellPnt = funcPoint([wellInput, this.population.activate(wellInput)]);
            context.fillEllipse(wellPnt[0], wellPnt[1], 2.5, 2.5);
            // Selected well line down.
            context.strokeStyle(cfg.baseSelected.alpha(.5));
            context.lineWidth(1);
            context.strokeLine(wellPnt, [wellPnt[0], cfg.transferPlotSize + 2]);
            // Selected well value.
            var absWellShare = this.state.wellClusterShares.value.share(this.population.identifier, focus.location()) || 0;
            context.fillStyle(cfg.baseSelected);
            context.font(cfg.transferFont.toString());
            context.textBaseline('top');
            context.textAlign('center');
            context.fillText(this.population.identifier === Population.POPULATION_TOTAL_NAME ? absWellShare + " cells" : (100 * absWellShare).toFixed(0) + "%", wellPnt[0], cfg.transferPlotSize);
            context.transitioning = false;
            // Bottom axis labels.
            context.fillStyle(cfg.base);
            context.font(cfg.transferFont.toString());
            context.textBaseline('bottom');
            context.textAlign('left');
            context.fillText(this.minZScoreLabel, 0, -cfg.exemplarSpace);
            context.textAlign('right');
            context.fillText(this.maxZScoreLabel, cfg.transferPlotSize, -cfg.exemplarSpace);
            context.textAlign('center');
            context.fillText('\u03C3', .5 * cfg.transferPlotSize, -cfg.exemplarSpace);
            context.transitioning = true;
            // Picking area.
            context.picking = true;
            context.translate(Vector.mul([cfg.transferPlotSize, cfg.transferPlotSize], 0.5));
            context.scale(.5 * cfg.transferPlotSize, -.5 * cfg.transferPlotSize);
            context.fillStyle(Color.NONE);
            context.fillRect(-1, -1, 2, 2);
            context.picking = false;
            context.restore();
        };
        PopulationTransferEdit.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            // Control points.
            var controlPoints = interaction.populationSpace.populations.byId(this.population.identifier).activation;
            var closestIndex = -1;
            var minDistance = Number.MAX_VALUE;
            controlPoints.forEach(function (c, cI) {
                var distance = Math.abs(c[0] - coordinates[0]);
                if (distance < minDistance) {
                    closestIndex = cI;
                    minDistance = distance;
                }
            });
            controlPoints[closestIndex] = coordinates;
            for (var i = 1; i < 3; i++)
                controlPoints[i][0] = Math.max(controlPoints[i][0], controlPoints[i - 1][0]);
        };
        return PopulationTransferEdit;
    })(PlacedSnippet);
    var TypeLabel = (function (_super) {
        __extends(TypeLabel, _super);
        function TypeLabel(population, state) {
            _super.call(this, "lbl_" + population.identifier, [0, 0]);
            this.population = population;
            this.state = state;
            this.tagLines = this.population.name.split("\n");
            var cfg = state.configuration;
            this.setDimensions([cfg.clusterTileInnerSize, cfg.clusterTileInnerSize + cfg.sideFont.size + 4]);
        }
        TypeLabel.prototype.paint = function (context) {
            _super.prototype.paint.call(this, context);
            var cfg = this.state.configuration;
            var canBeHidden = this.population.identifier !== Population.POPULATION_TOTAL_NAME;
            context.save();
            context.translate(this.topLeft);
            // Square colored inline and outline.
            if (canBeHidden) {
                context.strokeStyle(this.population.color);
                context.lineWidth(4);
                context.strokeRect(2, 2, cfg.clusterTileInnerSize - 4, cfg.clusterTileInnerSize - 4);
            }
            context.strokeStyle(cfg.baseDim);
            context.lineWidth(1);
            context.strokeRect(0, 0, cfg.clusterTileInnerSize, cfg.clusterTileInnerSize);
            // Picking support.
            if (canBeHidden) {
                context.picking = true;
                context.fillStyle(Color.NONE);
                context.fillRect(0, 0, this.dimensions[0], this.dimensions[1]);
                context.picking = false;
            }
            // Distinguish between regular phenotype and cell count phenotype.
            context.fillStyle(cfg.base);
            context.strokeStyle(cfg.backgroundColor);
            context.textBaseline('middle');
            context.textAlign('center');
            context.font(this.state.configuration.sideFont.toString());
            var fontHeight = cfg.sideFont.size + 1;
            context.save();
            context.translate(Vector.mul([cfg.clusterTileInnerSize, cfg.clusterTileInnerSize], .5));
            context.translate([0, -.5 * fontHeight * (this.tagLines.length - 1)]);
            this.tagLines.forEach(function (line, i) {
                context.strokeText(line, 0, i * fontHeight);
                context.fillText(line, 0, i * fontHeight);
            });
            context.restore();
            if (canBeHidden) {
                var actionLbl = this.state.populationSpace.populations.has(this.population) ? 'hide \u25B6' : '\u25C0 show';
                context.fillStyle(cfg.baseDim);
                context.textBaseline('bottom');
                context.fillText(actionLbl, .5 * this.dimensions[0], this.dimensions[1]);
            }
            context.restore();
        };
        TypeLabel.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            //interaction.selectedCoordinates.population = this.population.identifier;
            interaction.populationSpace.toggle(this.population);
        };
        return TypeLabel;
    })(PlacedSnippet);
    /*class TypeLabel extends Label {
        constructor(public population: Population,
                    public state: EnrichedState) {
            super("lbl_" + population.identifier,
                population.name,
                [0,0],
                //state.focused().population === population.identifier ?
                //    state.configuration.clusterSelectedLabel :
                    state.configuration.clusterLabel,
                true);
    
            this.setDimensions([state.configuration.clusterTileInnerSize, this.dimensions[1]]);
        }
    
        paint(context: ViewContext) {
            var state = this.state;
            var cfg = state.configuration;
    
            context.save();
            context.translate(this.topLeft);
            context.picking = true;
    
            context.fillStyle(state.populationColor(this.population));
            context.fillRect(0, 0, state.configuration.clusterTileInnerSize, this.dimensions[1]);
    
            context.font(cfg.sideFont.toString());
            context.fillStyle(cfg.base);
            context.textBaseline('top');
            context.fillText(state.populationSpace.inactivePopulations.has(this.population) ? "+" : "-");
    
            context.restore();
        }
    
        mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
            //interaction.selectedCoordinates.population = this.population.identifier;
            interaction.populationSpace.toggle(this.population);
        }
    }*/
    var AbstractPlate = (function (_super) {
        __extends(AbstractPlate, _super);
        function AbstractPlate(id, topLeft, state, columnLabels, rowLabels, prune) {
            var _this = this;
            if (columnLabels === void 0) { columnLabels = true; }
            if (rowLabels === void 0) { rowLabels = true; }
            if (prune === void 0) { prune = false; }
            _super.call(this, id, topLeft);
            this.state = state;
            this.columnLabels = columnLabels;
            this.rowLabels = rowLabels;
            this.prune = prune;
            var cfg = state.configuration;
            var info = state.dataSetInfo.value;
            var plate = this.state.focused().plate;
            var annotations = this.state.plateTargetAnnotations(plate);
            this.flatAnnotations = _.flatten(_.values(annotations).map(function (ann) { return _.values(ann); }));
            // Build up (pruned) column and row indices.
            /*if(prune) {
                this.columnIndices = [];
                this.rowIndices = [];
    
                _.values(annotations).forEach(cat =>
                    _.values(cat).forEach((wS: WellSelection) =>
                        wS.wells.forEach(w => {
                            this.columnIndices.push(w.column);
                            this.rowIndices.push(w.row);
                        })
                    )
                );
    
                this.columnIndices = _.uniq(this.columnIndices.sort((l, r) => l - r), true);
                this.rowIndices = _.uniq(this.rowIndices.sort((l, r) => l - r), true);
            }
            // Otherwise, all indices.
            else {*/
            this.columnIndices = _.range(0, info.columnCount);
            this.rowIndices = _.range(0, info.rowCount);
            //}
            this.columnToIndex = [];
            this.columnIndices.forEach(function (cI, i) { return _this.columnToIndex[cI] = i; });
            this.rowToIndex = [];
            this.rowIndices.forEach(function (rI, i) { return _this.rowToIndex[rI] = i; });
            // Adjust well diameter, based on number of selected columns and rows.
            this.wellDiameter = cfg.wellDiameter * Math.max(.5 * Math.min(Math.floor(info.columnCount / this.columnIndices.length), Math.floor(info.rowCount / this.rowIndices.length)), 1);
            // Selection contours.
            var gf = new jsts.geom.GeometryFactory();
            var tileAt = function (wc, dilation) {
                var columnIndex = _this.columnToIndex[wc.column];
                var rowIndex = _this.rowToIndex[wc.row];
                var topLeft = new jsts.geom.Coordinate(columnIndex * _this.wellDiameter - dilation, rowIndex * _this.wellDiameter - dilation);
                var topRight = new jsts.geom.Coordinate((columnIndex + 1) * _this.wellDiameter + dilation, rowIndex * _this.wellDiameter - dilation);
                var bottomRight = new jsts.geom.Coordinate((columnIndex + 1) * _this.wellDiameter + dilation, (rowIndex + 1) * _this.wellDiameter + dilation);
                var bottomLeft = new jsts.geom.Coordinate(columnIndex * _this.wellDiameter - dilation, (rowIndex + 1) * _this.wellDiameter + dilation);
                return gf.createPolygon(gf.createLinearRing([topRight, topLeft, bottomLeft, bottomRight, topRight]), []);
            };
            this.selectionOutlines = this.flatAnnotations.map(function (ws) {
                // Tile per well.
                var wellTiles = ws.wells.map(function (wc) { return tileAt(wc, 0); });
                var body = new jsts.operation.union.CascadedPolygonUnion(wellTiles).union();
                return body; //body ? body.buffer(1, 3, 0) : null;
            });
            this.selectionRims = this.flatAnnotations.map(function (ws) {
                // Tile per well.
                var wellTiles = ws.wells.map(function (wc) { return tileAt(wc, .5); });
                var body = new jsts.operation.union.CascadedPolygonUnion(wellTiles).union();
                return body; //body ? body.buffer(1, 3, 0) : null;
            });
            this.setDimensions([this.columnIndices.length * this.wellDiameter, this.rowIndices.length * this.wellDiameter]);
        }
        AbstractPlate.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            var xIndex = Math.round(coordinates[0] * (this.columnIndices.length - 1));
            var yIndex = Math.round(coordinates[1] * (this.rowIndices.length - 1));
            if (xIndex in this.columnIndices && yIndex in this.rowIndices) {
                var postPruneCoordinates = new WellCoordinates(this.columnIndices[xIndex], this.rowIndices[yIndex]);
                interaction.selectedCoordinates.switchWell(postPruneCoordinates);
                interaction.pushView('plates');
            }
        };
        AbstractPlate.prototype.paint = function (context) {
            var cfg = this.state.configuration;
            //var info = this.state.dataSetInfo.value;
            context.save();
            context.translate(this.topLeft);
            context.transitioning = false;
            // Paint selection outline.
            context.strokeStyle(cfg.baseSelected);
            context.lineWidth(2);
            context.strokeRect(-1.5, -1.5, this.dimensions[0] + 3, this.dimensions[1] + 3);
            //this.paintSelectionBody(ctx);
            this.paintWellLabels(context);
            this.paintSelectionOutlines(context);
            // Well selection.
            context.scale(this.columnIndices.length * this.wellDiameter, this.rowIndices.length * this.wellDiameter);
            context.picking = true;
            context.fillStyle(Color.NONE);
            context.fillRect(0, 0, 1, 1);
            context.picking = false;
            context.transitioning = true;
            context.restore();
        };
        AbstractPlate.prototype.paintWellLabels = function (ctx) {
            var _this = this;
            var cfg = this.state.configuration;
            var info = this.state.dataSetInfo.value;
            var lblX = -cfg.plateRowLabelMargin; //this.columnIndices.length * this.wellDiameter + cfg.plateRowLabelMargin;
            var lblY = this.rowIndices.length * this.wellDiameter + cfg.plateColLabelMargin;
            ctx.save();
            ctx.font(cfg.sideFont.toString());
            var focused = this.state.focused();
            // Column labels at the top.
            if (this.columnLabels) {
                ctx.textAlign('center');
                ctx.fillStyle(cfg.baseSelected);
                ctx.textBaseline('bottom');
                ctx.fillText(info.plateLabels[focused.plate], .5 * this.dimensions[0], -cfg.plateColLabelMargin);
                var columnColors = [];
                columnColors[0] = cfg.base;
                columnColors[info.columnCount - 1] = cfg.base;
                columnColors[focused.well.column] = cfg.baseSelected;
                var rowColors = [];
                rowColors[0] = cfg.base;
                rowColors[info.rowCount - 1] = cfg.base;
                rowColors[focused.well.row] = cfg.baseSelected;
                ctx.textBaseline('top');
                this.columnIndices.forEach(function (cI) {
                    if (cI in columnColors) {
                        ctx.fillStyle(columnColors[cI]);
                        ctx.fillText(info.columnLabels[cI], (_this.columnToIndex[cI] + .5) * _this.wellDiameter, lblY);
                    }
                });
            }
            // Row labels at the right.
            if (this.rowLabels) {
                ctx.textAlign('right');
                ctx.textBaseline('middle');
                this.rowIndices.forEach(function (rI) {
                    if (rI in rowColors) {
                        ctx.fillStyle(rowColors[rI]);
                        ctx.fillText(info.rowLabels[rI], lblX, (_this.rowToIndex[rI] + .5) * _this.wellDiameter);
                    }
                });
            }
            ctx.restore();
        };
        AbstractPlate.prototype.paintSelectionBody = function (ctx) {
            var cfg = this.state.configuration;
            var info = this.state.dataSetInfo.value;
            ctx.fillStyle(cfg.base.alpha(0.2));
            ctx.beginPath();
            this.selectionOutlines.forEach(function (so) { return TemplatePlate.geometryToPath(ctx, so); });
            ctx.fill();
        };
        AbstractPlate.prototype.paintSelectionOutlines = function (ctx) {
            var _this = this;
            var cfg = this.state.configuration;
            var info = this.state.dataSetInfo.value;
            this.selectionOutlines.forEach(function (so, i) {
                ctx.strokeStyle(cfg.backgroundColor);
                ctx.lineWidth(2);
                ctx.beginPath();
                TemplatePlate.geometryToPath(ctx, so); //this.selectionRims[i]);
                ctx.stroke();
                if (_this.flatAnnotations[i].category === "Selected") {
                    ctx.fillStyle(cfg.baseSelected);
                    ctx.beginPath();
                    TemplatePlate.geometryToPath(ctx, so);
                    ctx.fill();
                }
                else {
                    ctx.strokeStyle(cfg.base);
                    ctx.lineWidth(2);
                    ctx.beginPath();
                    TemplatePlate.geometryToPath(ctx, so);
                    ctx.stroke();
                }
            });
            /*ctx.strokeStyle(cfg.backgroundColor);
            ctx.lineWidth(3);
            ctx.beginPath();
            this.selectionOutlines.forEach(so => TemplatePlate.geometryToPath(ctx, so));
            ctx.stroke();
    
            ctx.strokeStyle(cfg.base);
            ctx.lineWidth(2);
            ctx.beginPath();
            this.selectionOutlines.forEach(so => TemplatePlate.geometryToPath(ctx, so));
            ctx.stroke();*/
        };
        AbstractPlate.geometryToPath = function (context, geometry) {
            if (!geometry)
                return;
            // Collection.
            if (geometry.getNumGeometries() > 1) {
                for (var i = 0; i < geometry.getNumGeometries(); i++) {
                    TemplatePlate.geometryToPath(context, geometry.getGeometryN(i));
                }
            }
            else if (geometry.getNumGeometries() > 0) {
                var polygon = geometry;
                var extRing = polygon.getExteriorRing();
                if (extRing.getCoordinates().length > 2) {
                    // All rings as paths.
                    TemplatePlate.ringToPath(context, extRing);
                    for (var i = 0; i < polygon.getNumInteriorRing(); i++) {
                        TemplatePlate.ringToPath(context, polygon.getInteriorRingN(i));
                    }
                }
            }
        };
        AbstractPlate.hullToPath = function (context, geometry) {
            if (!geometry)
                return;
            // Collection.
            if (geometry.getNumGeometries() > 1) {
                for (var i = 0; i < geometry.getNumGeometries(); i++) {
                    TemplatePlate.hullToPath(context, geometry.getGeometryN(i));
                }
            }
            else if (geometry.getNumGeometries() > 0) {
                var polygon = geometry;
                var extRing = polygon.getExteriorRing();
                if (extRing.getCoordinates().length > 2) {
                    // All rings as paths.
                    TemplatePlate.ringToPath(context, extRing);
                }
            }
        };
        AbstractPlate.holesToPath = function (context, geometry) {
            if (!geometry)
                return;
            // Collection.
            if (geometry.getNumGeometries() > 1) {
                for (var i = 0; i < geometry.getNumGeometries(); i++) {
                    TemplatePlate.holesToPath(context, geometry.getGeometryN(i));
                }
            }
            else if (geometry.getNumGeometries() > 0) {
                var polygon = geometry;
                var extRing = polygon.getExteriorRing();
                if (extRing.getCoordinates().length > 2) {
                    for (var i = 0; i < polygon.getNumInteriorRing(); i++) {
                        TemplatePlate.ringToPath(context, polygon.getInteriorRingN(i));
                    }
                }
            }
        };
        AbstractPlate.ringToPath = function (context, ring) {
            var cs = ring.getCoordinates();
            context.moveTo(cs[0].x, cs[0].y);
            for (var i = 1; i < cs.length; i++)
                context.lineTo(cs[i].x, cs[i].y);
            context.closePath();
        };
        return AbstractPlate;
    })(PlacedSnippet);
    var TemplatePlate = (function (_super) {
        __extends(TemplatePlate, _super);
        function TemplatePlate(topLeft, model) {
            _super.call(this, "tmpPlt", topLeft, model);
            this.model = model;
        }
        TemplatePlate.prototype.paint = function (context) {
            context.save();
            context.translate(this.topLeft);
            context.transitioning = false;
            this.paintWells(context);
            context.transitioning = true;
            context.restore();
            _super.prototype.paint.call(this, context);
        };
        TemplatePlate.prototype.paintWells = function (ctx) {
            var cfg = this.model.configuration;
            var info = this.model.dataSetInfo.value;
            var selection = this.model.focused();
            var wellShares = this.model.wellScores()[selection.plate] || [];
            // Well outlines.
            ctx.strokeStyle(cfg.baseDim);
            for (var c = 0; c < info.columnCount; c++) {
                var x = c * cfg.wellDiameter;
                for (var r = 0; r < info.rowCount; r++) {
                    var y = r * cfg.wellDiameter;
                    //ctx.strokeRect(x, y, this.wellDiameter, this.wellDiameter);
                    if (wellShares[c] && wellShares[c][r] >= -1) {
                        ctx.fillStyle(BaseConfiguration.shareColorMap(wellShares[c][r]));
                        ctx.fillRect(x + .25, y + .25, this.wellDiameter - .5, this.wellDiameter - .5);
                    }
                    else {
                    }
                }
            }
        };
        return TemplatePlate;
    })(AbstractPlate);
    var FlowerPlate = (function (_super) {
        __extends(FlowerPlate, _super);
        function FlowerPlate(topLeft, state) {
            _super.call(this, "flwPlt", topLeft, state, true, true, true);
            this.state = state;
        }
        FlowerPlate.prototype.paint = function (context) {
            // Selections behind well flowers.
            _super.prototype.paint.call(this, context);
            context.save();
            context.translate(this.topLeft);
            context.transitioning = false;
            this.paintWells(context);
            context.transitioning = true;
            context.restore();
        };
        FlowerPlate.prototype.paintWells = function (ctx) {
            var _this = this;
            var cfg = this.state.configuration;
            var info = this.state.dataSetInfo.value;
            ctx.save();
            // Population abundance flowers.
            //for(var c = 0; c < info.columnCount; c++)
            //    for(var r = 0; r < info.rowCount; r++)
            //        this.paintPopulationFlower(ctx, c, r);
            this.columnIndices.forEach(function (cI) { return _this.rowIndices.forEach(function (rI) { return _this.paintPopulationFlower(ctx, cI, rI); }); });
            ctx.restore();
        };
        // Population abundance flower.
        FlowerPlate.prototype.paintPopulationFlower = function (ctx, column, row) {
            var _this = this;
            var cfg = this.state.configuration;
            var selection = this.state.focused();
            var x = (this.columnToIndex[column] + .5) * this.wellDiameter;
            var y = (this.rowToIndex[row] + .5) * this.wellDiameter;
            // Fetch total cellCount.
            var wellClusterShares = this.state.wellClusterShares.value;
            var totalPopulation = wellClusterShares.wellIndex[Population.POPULATION_TOTAL_NAME] || [];
            var totalWellShares = totalPopulation[selection.plate] || [];
            var totalColumnShares = totalWellShares[column] || [];
            var cellCount = totalColumnShares[row];
            var maxObjectCount = wellClusterShares.maxPlateObjectCount[selection.plate]; //wellClusterShares.maxObjectCount;
            var normObjectCellCount = Math.sqrt(maxObjectCount);
            // Draw flower slice
            var populations = this.state.populationSpace.allPopulations().elements.filter(function (p) { return p.exemplars.length > 0; });
            populations.forEach(function (p, pI) {
                var clusterShares = _this.state.wellClusterShares.value.wellIndex[p.identifier] || [];
                var wellShares = clusterShares[selection.plate] || [];
                var columnShares = wellShares[column] || [];
                var share = columnShares[row];
                ctx.fillStyle(_this.state.populationColor(p));
                ctx.strokeStyle(cfg.baseEmphasis);
                ctx.lineWidth(.5);
                if (share >= 0 && cellCount >= 0) {
                    var beginRad = 0.5 * Math.PI + 2 * Math.PI * pI / populations.length;
                    var endRad = 0.5 * Math.PI + 2 * Math.PI * (pI + 1) / populations.length;
                    var normWellCount = Math.sqrt(share * cellCount) / normObjectCellCount;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.arc(x, y, normWellCount * 0.5 * _this.wellDiameter, beginRad, endRad);
                    ctx.lineTo(x, y);
                    ctx.fill();
                    ctx.stroke();
                }
            });
        };
        return FlowerPlate;
    })(AbstractPlate);
    var JointWellPlates = (function (_super) {
        __extends(JointWellPlates, _super);
        function JointWellPlates(state) {
            _super.call(this, "jntPlt", [new TemplatePlate([0, 0], state), new FlowerPlate([0, 0], state)], [0, 0], [0, 0], 'vertical', state.configuration.panelHeaderSpace);
            this.state = state;
        }
        JointWellPlates.prototype.toString = function () {
            var focusedPlate = this.state.focused().plate;
            return "Plate " + this.state.dataSetInfo.value.plateLabels[focusedPlate];
        };
        return JointWellPlates;
    })(List);
    var WellView = (function (_super) {
        __extends(WellView, _super);
        function WellView(state) {
            _super.call(this, "WellView", [new WellListView(state), new WellDetailView(state)], [0, 0], [0, 0], 'horizontal', state.configuration.subPanelSpace, 'left');
            this.state = state;
        }
        WellView.prototype.toString = function (opened) {
            var wellFilter = this.state.selectedCoordinates.wellFilter;
            return "Wells" + (opened ? ": " + (wellFilter.length > 0 ? wellFilter : "\<press key\>") : "");
        };
        return WellView;
    })(List);
    var WellListView = (function (_super) {
        __extends(WellListView, _super);
        function WellListView(state) {
            _super.call(this, "WellDetailView", [WellListView.transferButtons(state), WellListView.tableColumns(state)], [0, 0], [0, 0], 'vertical', state.configuration.subPanelSpace, 'right');
            this.state = state;
        }
        WellListView.tableColumns = function (state) {
            var columns = ['plate', 'column', 'row'].map(function (field) { return new WellLocationList(field, WellListView.composeWells(state), state); }).concat(new WellAbundanceList(state, WellListView.composeWells(state), WellListView.buttonsWidth(state)));
            return new List("WellDetailColumns", columns, [0, 0], [0, 0], 'horizontal', state.configuration.listColumnSpace, 'left');
        };
        WellListView.buttonsWidth = function (state) {
            var cfg = state.configuration;
            var pCnt = state.populationSpace.populations.length;
            return pCnt * cfg.transferPlotSize + (pCnt - 1) * cfg.exemplarColumnSpace;
        };
        WellListView.transferButtons = function (state) {
            var cfg = state.configuration;
            var mainPopulations = _.union(state.populationSpace.visiblePopulations().elements, [state.populationSpace.populations.byId(Population.POPULATION_TOTAL_NAME)]);
            //var transferLabel = new Label("PopulationTransfersLbl", "Score", [0,0], cfg.subPanelHeaderLabel, true);
            var transferButtons = new List("PopulationTransfers", mainPopulations.map(function (p, pI) { return new PopulationTransferEdit(p, state, pI === 0); }), [0, 0], [0, 0], 'horizontal', cfg.exemplarColumnSpace, 'left');
            return transferButtons;
        };
        WellListView.composeWells = function (state) {
            return state.topWells();
        };
        return WellListView;
    })(List);
    var WellLocationList = (function (_super) {
        __extends(WellLocationList, _super);
        function WellLocationList(field, wells, state) {
            _super.call(this, "WL_" + field, wells.map(function (well) { return new WellLocationLabel(well.location, field, state); }), [0, 0], [0, 0], 'vertical', state.configuration.listWellSpace, 'middle');
            this.state = state;
        }
        return WellLocationList;
    })(List);
    var WellLocationLabel = (function (_super) {
        __extends(WellLocationLabel, _super);
        function WellLocationLabel(location, field, state) {
            _super.call(this, "WL_" + field + "_" + location.toString(), state.dataSetInfo.value[field + "Labels"][location[field]], [0, 0], location.equals(state.selectedCoordinates.location()) ? state.configuration.selectedSideLabel : state.configuration.sideLabel, true);
            this.location = location;
        }
        WellLocationLabel.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            interaction.selectedCoordinates.switchLocation(this.location);
        };
        return WellLocationLabel;
    })(Label);
    var WellAbundanceList = (function (_super) {
        __extends(WellAbundanceList, _super);
        function WellAbundanceList(state, wells, width) {
            _super.call(this, "WellAbundances");
            this.state = state;
            this.wells = wells;
            var cfg = state.configuration;
            this.wellHeight = cfg.listWellLabel.font.size + cfg.listWellSpace;
            this.setDimensions([
                width,
                wells.length * this.wellHeight
            ]);
            this.createPopulationAreas();
        }
        WellAbundanceList.prototype.createPopulationAreas = function () {
            var _this = this;
            var cfg = this.state.configuration;
            var clusterShares = this.state.wellClusterShares.value;
            var populations = this.state.populationSpace.visiblePopulations().elements;
            // Per well, population.
            var shares = populations.map(function (p) { return _this.wells.map(function (well) { return clusterShares.share(p.identifier, well.location); }); });
            // Cumulative share, first column is padding.
            var cumulativeShares = [this.wells.map(function (w) { return 0; })];
            populations.forEach(function (p, i) { return cumulativeShares.push(Vector.add(cumulativeShares[i], shares[i])); });
            this.populationAreaWidth = this.dimensions[0] - cfg.transferPlotSize - cfg.exemplarColumnSpace;
            this.populationAreas = populations.map(function (p, pI) {
                var listCs = function (cI) {
                    var midCoordinates = cumulativeShares[cI].map(function (wShs, wI) {
                        var y = (wI + .5) * _this.wellHeight;
                        var x = wShs * _this.populationAreaWidth;
                        return [x, y];
                    });
                    // Extend ends to close list.
                    if (midCoordinates.length > 0)
                        midCoordinates = [[midCoordinates[0][0], 0]].concat(midCoordinates).concat([[midCoordinates[midCoordinates.length - 1][0], midCoordinates.length * _this.wellHeight]]);
                    return midCoordinates;
                };
                var preList = listCs(pI);
                var postList = listCs(pI + 1).reverse();
                var totalList = preList.concat(postList);
                return new Polygon("WellListArea_" + p.identifier, totalList, p.color, cfg.backgroundColor, false);
            });
            // Object count (total population).
            var counts = this.wells.map(function (w) { return clusterShares.share(Population.POPULATION_TOTAL_NAME, w.location); });
            if (counts) {
                var cntMin = 0;
                var cntMax = clusterShares.maxObjectCount;
                var cntDelta = (cntMax - cntMin);
                var cntWidth = cfg.transferPlotSize;
                var cntListCs = counts.map(function (cnt, wI) {
                    var y = (wI + .5) * _this.wellHeight;
                    var x = cntWidth * (cnt - cntMin) / cntDelta;
                    return [x, y];
                });
                // Extend ends to close list.
                if (cntListCs.length > 0)
                    cntListCs = [[cntListCs[0][0], 0]].concat(cntListCs).concat([[cntListCs[cntListCs.length - 1][0], cntListCs.length * this.wellHeight]]);
                this.cntLine = new Line("WellCountLine", cntListCs, Population.POPULATION_TOTAL_COLOR, false);
            }
        };
        WellAbundanceList.prototype.paint = function (context) {
            var cfg = this.state.configuration;
            context.save();
            context.translate(this.topLeft);
            context.snippets(this.populationAreas);
            context.translate([this.populationAreaWidth + cfg.exemplarColumnSpace, 0]);
            context.snippet(this.cntLine);
            context.restore();
        };
        return WellAbundanceList;
    })(PlacedSnippet);
    var WellDetailView = (function (_super) {
        __extends(WellDetailView, _super);
        function WellDetailView(state) {
            _super.call(this, "WellDetailView", [0, 0]);
            this.state = state;
            var cfg = state.configuration;
            this.imgDim = state.dataSetInfo.value.imageDimensions;
            this.wellScale = Math.min(1, cfg.wellViewMaxWidth / this.imgDim[0]);
            this.imgScaledDim = Vector.mul(this.imgDim, this.wellScale);
            this.setDimensions(this.imgScaledDim);
            var availableTypes = _.keys(state.availableImageTypes());
            var wellOptions = {};
            availableTypes.forEach(function (t) { return wellOptions[t] = t; });
            this.overlayOption = new ConfigurationOptions("WellOverlayOptions", [0, 0], state, "imagePopulationOverlay", { None: "None", Phenotypes: "Phenotypes" });
            this.imageTypeOption = new ConfigurationOptions("WellDetailOptions", [0, 0], state, "imageType", wellOptions);
            var options = new List("wellOptions", [this.overlayOption, this.imageTypeOption], [0, 0], [0, 0], 'vertical', cfg.annotationColumnSpace, 'left');
            var optionLabels = new List("wellOptionLabels", ["overlay", "image"].map(function (lbl) { return new Label("opt_" + lbl, lbl, [0, 0], cfg.annotationCategoryLabel); }), [0, 0], [0, 0], 'vertical', cfg.annotationColumnSpace, 'right');
            this.optionTable = new List("wellOptionTable", [optionLabels, options], [0, 0], [0, 0], 'horizontal', 2 * cfg.annotationColumnSpace);
            var focused = state.focused();
            this.annotationTable = new WellAnnotationTable("focusedAnnotations", state.wellAnnotations.value.annotationsAt(focused.plate, focused.well), state);
            // Generate predicted population outlines.
            this.computePopulationOutlines();
        }
        WellDetailView.prototype.setTopLeft = function (topLeft) {
            _super.prototype.setTopLeft.call(this, topLeft);
            if (this.optionTable && this.annotationTable) {
                var annotationHeight = this.annotationTable.dimensions[1];
                var optionsHeight = this.optionTable.dimensions[1];
                var maxHeight = Math.max(annotationHeight, optionsHeight);
                this.annotationTable.setTopLeft(Vector.add(this.topLeft, [0, maxHeight - annotationHeight]));
                this.optionTable.setTopLeft(Vector.add(this.topRight, [-this.optionTable.dimensions[0], maxHeight - optionsHeight]));
            }
        };
        WellDetailView.prototype.computePopulationOutlines = function () {
            var _this = this;
            this.objectMaxRadi = this.state.objectInfo.value["wellOutlines"];
            if (!this.objectMaxRadi) {
                var objectCoordinates = this.state.focusedWellCoordinates();
                this.objectMaxRadi = {};
                _.pairs(objectCoordinates).forEach(function (p) { return _this.objectMaxRadi[p[0]] = [
                    p[1][0],
                    p[1][1],
                    Math.min(_this.state.configuration.wellViewMaxObjectRadius, 0.5 * _.min(_.pairs(objectCoordinates).map(function (sp) { return p[0] === sp[0] ? Number.POSITIVE_INFINITY : Vector.distance(p[1], sp[1]); }))) - 5,
                    _this.state.objectInfo.value.cell("population", p[0])
                ]; });
                this.state.objectInfo.value["wellOutlines"] = this.objectMaxRadi; //this.outlines;
            }
        };
        WellDetailView.prototype.paint = function (ctx) {
            var _this = this;
            var state = this.state;
            var cfg = state.configuration;
            //ctx.transitioning = false;
            ctx.save();
            ctx.translate(this.topLeft);
            ctx.translate([0, 2 * cfg.annotationColumnSpace + Math.max(this.annotationTable.dimensions[1], this.optionTable.dimensions[1])]);
            var well = state.selectionWell(state.focused());
            if (well) {
                var img = well.image(cfg.imageType);
                ctx.transitioning = false;
                ctx.context.beginPath();
                ctx.context.rect(0, 0, this.imgScaledDim[0], this.imgScaledDim[1]);
                ctx.context.clip();
                if (img) {
                    ctx.picking = true;
                    ctx.drawImageClipped(img, [0, 0], [img.width, 0.5 * img.height], [0, 0], [this.wellScale * img.width, this.wellScale * 0.5 * img.height]);
                    ctx.picking = false;
                }
                // Population outline overlay.
                if (cfg.imagePopulationOverlay === "Phenotypes") {
                    ctx.save();
                    var allPopulations = this.state.populationSpace.allPopulations();
                    _.pairs(this.objectMaxRadi).forEach(function (p) {
                        //var obj = p[0];
                        var cs = p[1];
                        if (cs[3] >= 0) {
                            var x = _this.wellScale * cs[0];
                            var y = _this.wellScale * cs[1];
                            var rad = _this.wellScale * cs[2];
                            var population = allPopulations.byId(cs[3]);
                            if (population && rad > 1) {
                                ctx.strokeStyle(cfg.backgroundColor);
                                ctx.lineWidth(4);
                                ctx.strokeEllipse(x, y, rad, rad);
                                ctx.strokeStyle(population.color);
                                ctx.lineWidth(4);
                                ctx.strokeEllipse(x, y, rad - 1, rad - 1);
                            }
                        }
                    });
                    ctx.restore();
                }
                // Test object coordinates.
                var objects = state.objectInfo.value;
                var x = objects.columnVector("x");
                var y = objects.columnVector("y");
                var xRad = this.wellScale * cfg.objectViewImageRadius;
                var yRad = this.wellScale * cfg.objectViewImageRadius;
                var rI = state.focused().object === null ? -1 : objects.rowIndex[state.focused().object];
                var rX = rI >= 0 ? x[rI] : .5 * this.dimensions[0];
                var rY = rI >= 0 ? y[rI] : .5 * this.dimensions[1];
                ctx.strokeStyle(rI >= 0 ? cfg.backgroundColor : Color.NONE);
                ctx.lineWidth(4);
                ctx.strokeRect(this.wellScale * rX - xRad, this.wellScale * rY - yRad, 2 * xRad, 2 * yRad);
                ctx.strokeStyle(rI >= 0 ? cfg.baseSelected : Color.NONE);
                ctx.lineWidth(2);
                ctx.strokeRect(this.wellScale * rX - xRad, this.wellScale * rY - yRad, 2 * xRad, 2 * yRad);
                ctx.strokeStyle(cfg.baseDim);
                ctx.strokeRect(0, 0, this.imgScaledDim[0], this.imgScaledDim[1]);
                ctx.transitioning = true;
            }
            ctx.restore();
            //ctx.transitioning = true;
            // Well type button.
            //ctx.snippet(this.imageTypeOption);
            //ctx.snippet(this.overlayOption);
            ctx.snippet(this.optionTable);
            ctx.snippet(this.annotationTable);
        };
        WellDetailView.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            var object = enriched.closestWellObject(coordinates);
            interaction.selectedCoordinates.switchObject(object);
            enriched.conformSelectedCoordinates(interaction);
            interaction.pushView('well');
        };
        return WellDetailView;
    })(PlacedSnippet);
    /*class WellAnnotationTable extends List<List<Label>> {
        constructor(identifier: string, annotations: StringMap<string[]>, state: EnrichedState) {
            super(identifier,
                _.keys(annotations).sort().map(k => new WellAnnotationRow(identifier, k, annotations[k], state)),
                [0,0],
                [0,0],
                'vertical',
                state.configuration.annotationColumnSpace,
                'left');
        }
    }
    
    class WellAnnotationRow extends List<Label> {
        constructor(tableId: string, category: string, tags: string[], state: EnrichedState) {
            super(tableId + "_" + category,
                _.union(
                    [new Label(tableId + "_" + category + "_lbl", category, [0,0], state.configuration.annotationCategoryLabel, true)],
                    tags.map(tag => new AnnotationButton(category, tag, state))),
                [0,0],
                [0,0],
                'horizontal',
                state.configuration.annotationTagSpace,
                'left'
            );
        }
    }*/
    var WellAnnotationTable = (function (_super) {
        __extends(WellAnnotationTable, _super);
        function WellAnnotationTable(identifier, annotations, state) {
            _super.call(this, identifier, [
                new List("annTableLbls", WellAnnotationTable.annotationKeys(annotations).map(function (k) { return new Label("annTableLbl" + k, k.toLowerCase(), [0, 0], state.configuration.annotationCategoryLabel, false); }), [0, 0], [0, 0], 'vertical', state.configuration.annotationColumnSpace, 'right'),
                new List("annTableRows", WellAnnotationTable.annotationKeys(annotations).map(function (k) { return new WellAnnotationRow(identifier, k, annotations[k], state); }), [0, 0], [0, 0], 'vertical', state.configuration.annotationColumnSpace, 'left')
            ], [0, 0], [0, 0], 'horizontal', 2 * state.configuration.annotationColumnSpace);
        }
        WellAnnotationTable.annotationKeys = function (annotations) {
            return _.keys(annotations).sort(function (l, r) { return l.length - r.length; });
        };
        return WellAnnotationTable;
    })(List);
    var WellAnnotationRow = (function (_super) {
        __extends(WellAnnotationRow, _super);
        function WellAnnotationRow(tableId, category, tags, state) {
            _super.call(this, tableId + "_" + category, tags.map(function (tag) { return new AnnotationButton(category, tag, state); }), [0, 0], [0, 0], 'horizontal', state.configuration.annotationTagSpace, 'left');
        }
        return WellAnnotationRow;
    })(List);
    var AnnotationButton = (function (_super) {
        __extends(AnnotationButton, _super);
        function AnnotationButton(category, tag, state) {
            _super.call(this, "annBut_" + (category || "") + "_" + tag, tag, [0, 0], !category || state.isTagActive(tag) ? state.configuration.annotationSelectedLabel : state.configuration.annotationLabel, true);
            this.category = category;
            this.tag = tag;
        }
        AnnotationButton.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            interaction.selectedCoordinates.wellFilter = this.tag;
        };
        return AnnotationButton;
    })(Label);
    var ObjectDetailView = (function (_super) {
        __extends(ObjectDetailView, _super);
        function ObjectDetailView(object, state, topLeft) {
            if (topLeft === void 0) { topLeft = [0, 0]; }
            _super.call(this, "odv_" + object, topLeft);
            this.object = object;
            this.state = state;
            var cfg = state.configuration;
            this.focused = state.focused().object === object;
            this.dimensions = this.focused && !state.populationSpace.isExemplar(object) ? [cfg.splomInnerSize, cfg.splomInnerSize] : [cfg.clusterTileInnerSize, cfg.clusterTileInnerSize];
            this.updatePositions();
        }
        ObjectDetailView.prototype.paint = function (ctx) {
            var mod = this.state;
            var cfg = mod.configuration;
            //var size = [this.diameter, this.diameter];
            var imgRadius = cfg.objectViewImageRadius;
            var internalRadius = [imgRadius, imgRadius];
            var internalDiameter = Vector.mul(internalRadius, 2);
            ctx.save();
            ctx.translate(this.topLeft);
            //ctx.transitioning = false;
            ctx.picking = true;
            //var objectWells = mod.allObjectWells();
            var wellInfo = mod.objectWellInfo(this.object);
            //var well = mod.wellLocation()//objectWells.location(this.object);
            if (wellInfo) {
                var img = wellInfo.location.image(cfg.imageType === "None" ? null : cfg.imageType);
                var coordinates = wellInfo.coordinates; //objectWells.coordinates(this.object);
                //console.log("Object well location:");
                //console.log(wellInfo.location);
                if (img && coordinates) {
                    // Trunc cell coordinates to stay within image.
                    coordinates = [
                        Math.min(img.width - imgRadius, Math.max(imgRadius, coordinates[0])),
                        Math.min(.5 * img.height - imgRadius, Math.max(imgRadius, coordinates[1]))
                    ];
                    var internalTopLeft = Vector.subtract(coordinates, internalRadius);
                    ctx.drawImageClipped(img, internalTopLeft, internalDiameter, [0, 0], this.dimensions);
                    // Predicted population tag.
                    ctx.transitioning = false;
                    var predPop = mod.objectPredictedPopulation(this.object);
                    if (predPop) {
                        var width = .2 * this.dimensions[0];
                        var height = .2 * this.dimensions[1];
                        ctx.fillStyle(cfg.backgroundColor);
                        ctx.fillRect(0, 0, width, height);
                        ctx.fillStyle(predPop.color);
                        ctx.fillRect(0, 0, width - 1, height - 1);
                    }
                    ctx.transitioning = true;
                    // Focused highlight.
                    ctx.transitioning = false;
                    if (this.focused) {
                        ctx.strokeStyle(cfg.backgroundColor);
                        ctx.lineWidth(4);
                    }
                    else {
                        ctx.strokeStyle(Color.NONE);
                    }
                    ctx.transitioning = true;
                    ctx.strokeRect(0, 0, this.dimensions[0], this.dimensions[1]);
                    ctx.transitioning = false;
                    if (this.focused) {
                        ctx.strokeStyle(cfg.baseSelected);
                        ctx.lineWidth(2);
                    }
                    else {
                        ctx.strokeStyle(Color.NONE);
                    }
                    ctx.transitioning = true;
                    ctx.strokeRect(0, 0, this.dimensions[0], this.dimensions[1]);
                }
            }
            ctx.picking = false;
            //ctx.transitioning = true;
            ctx.restore();
            ctx.transitioning = false;
        };
        ObjectDetailView.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            //interaction.removeExemplar(this.object);
            //interaction.selectedCoordinates.object = this.object;
            interaction.selectedCoordinates.switchObject(this.object);
            enriched.conformSelectedCoordinates(interaction);
            // Remove exemplar status of object (on second click).
            if (this.focused)
                interaction.removeExemplar(this.object);
        };
        return ObjectDetailView;
    })(PlacedSnippet);
    var PlateIndex = (function (_super) {
        __extends(PlateIndex, _super);
        function PlateIndex(state) {
            _super.call(this, "pi", [0, 0]);
            this.state = state;
            var cfg = state.configuration;
            var datInfo = state.dataSetInfo.value;
            var focusPlateWidth = cfg.largeHeatMultiplier;
            var focusPlateHeight = focusPlateWidth + 1;
            var addedPlates = _.range(datInfo.plateCount);
            var initialStackCnt = Math.ceil(addedPlates.length / cfg.miniHeatColumnMax);
            var regularPlates = (initialStackCnt - focusPlateWidth) * cfg.miniHeatColumnMax;
            var plateStacks = []; //_.range(0, Math.ceil(addedPlates.length / cfg.miniHeatColumnMax)).map(c => []);
            addedPlates.forEach(function (p, pI) {
                // Regular plate goes to regular stack.
                var targetStack = -1;
                if (pI < regularPlates) {
                    targetStack = Math.floor(pI / cfg.miniHeatColumnMax);
                }
                else {
                    var pRI = pI - regularPlates;
                    var relStack = Math.floor((regularPlates + 1) / cfg.miniHeatColumnMax);
                    targetStack = relStack + Math.floor(pRI / (cfg.miniHeatColumnMax - focusPlateHeight));
                }
                var stack = plateStacks[targetStack];
                if (!stack) {
                    stack = [];
                    plateStacks[targetStack] = stack;
                }
                stack.push(p);
            });
            var stackLists = plateStacks.map(function (ps, psI) {
                var snippetStack = [];
                for (var i = 0; i < ps.length; i++) {
                    if (ps[i] === null) {
                        if (snippetStack[1]) {
                            var firstHeatmap = snippetStack[1];
                            snippetStack.push(new SubstitutePlateLabel("plateLblSubst_" + ps[i], "...", Vector.add(firstHeatmap.dimensions, [0, -2 * cfg.miniHeatSpace]), cfg.sideLabel));
                        }
                    }
                    else {
                        var prevP = ps[i - 1];
                        var p = ps[i];
                        var nextP = ps[i + 1];
                        var miniHeatMap = new PlateMiniHeatmap(p, state);
                        // Add top plate label.
                        if (prevP === null || !((i - 1) in ps)) {
                            snippetStack.push(new Label("plateLblTop_" + p, datInfo.plateLabels[p], [0, 0], cfg.sideLabel));
                        }
                        // Add heat map label.
                        snippetStack.push(miniHeatMap);
                        // Add bottom plate label.
                        if (nextP === null || !((i + 1) in ps)) {
                            snippetStack.push(new Label("plateLblBottom_" + p, datInfo.plateLabels[p], [0, 0], cfg.sideLabel));
                        }
                    }
                }
                return new List("pic_" + psI, snippetStack, [0, 0], [0, 0], 'vertical', cfg.miniHeatSpace, 'middle');
            });
            var colLists = new List("pic_", stackLists, [0, 0], [0, 0], 'horizontal', cfg.miniHeatSpace, 'right');
            //var heatMaps = _.range(0, datInfo.plateCount).map(pI => new PlateMiniHeatmap(pI, state));
            //var colCapacity = Math.ceil(datInfo.plateCount / cfg.miniHeatColumnCount);
            //var colMaps = _.range(0, cfg.miniHeatColumnCount).map(cI =>
            //    _.compact(_.range(0, colCapacity).map(rI => heatMaps[cI * colCapacity + rI])));
            //var colMaps = state.platePartition().map(pR => pR.map(pI => new PlateMiniHeatmap(pI, state)));
            /*var colPartitions = state.plateAnnotationPartition();
    
            var colLists = colPartitions.map((cP, cI) => {
                var addedPlates: number[] = [];
                for(var i = 0; i < cP.plates.length; i++) {
                    var prevP = cP.plates[i-1];
                    var p = cP.plates[i];
    
                    if(prevP < p - 1) addedPlates.push(null);   // Insert additional plate.
    
                    addedPlates.push(p);
                }
    
                var plateStacks = _.range(0, Math.ceil(addedPlates.length / cfg.miniHeatColumnMax)).map(c => []);
                addedPlates.forEach((p, pI) => plateStacks[Math.floor(pI / cfg.miniHeatColumnMax)].push(p));
    
                var stackLists = plateStacks.map((ps, psI) => {
                    var snippetStack: PlacedSnippet[] = [];
                    for(var i = 0; i < ps.length; i++) {
                        if(ps[i] === null) {
                            if(snippetStack[1]) { // Temporary fix.
                                var firstHeatmap = snippetStack[1];
                                snippetStack.push(new SubstitutePlateLabel("plateLblSubst_" + ps[i], "...",
                                    Vector.add(firstHeatmap.dimensions, [0, -2 * cfg.miniHeatSpace]), cfg.sideLabel));
                            }
                        } else {
                            var prevP = ps[i - 1];
                            var p = ps[i];
                            var nextP = ps[i + 1];
    
                            var miniHeatMap = new PlateMiniHeatmap(p, state);
    
                            // Add top plate label.
                            if (prevP === null || !((i-1) in ps)) {
                                snippetStack.push(new Label("plateLblTop_" + p, datInfo.plateLabels[p], [0, 0], cfg.sideLabel));
                            }
    
                            // Add heat map label.
                            snippetStack.push(miniHeatMap);
    
                            // Add bottom plate label.
                            if (nextP === null || !((i+1) in ps)) {
                                snippetStack.push(new Label("plateLblBottom_" + p, datInfo.plateLabels[p], [0, 0], cfg.sideLabel));
                            }
                        }
                    }
    
                    return new List(
                        "pic_" + cI + "_" + psI,
                        snippetStack,   //ps.map(p => new PlateMiniHeatmap(p, state)),
                        [0, 0], [0, 0],
                        'vertical',
                        cfg.miniHeatSpace,
                        'middle');
                });
    
                var stackWrappedLists = new List(
                    "pic_" + cI,
                    stackLists,
                    [0, 0], [0, 0],
                    'horizontal',
                    cfg.miniHeatSpace,
                    'left');
    
                var stackFooter = new List(
                    "picf_" + cI,
                    cP.tags.map(t => new AnnotationButton(null, t, state)),
                    [0,0], [0,0],
                    'vertical',
                    cfg.miniHeatSpace,
                    'middle'
                );
    
                return new List(
                    "tpic_" + cI,
                    [stackWrappedLists, stackFooter],
                    [0,0], [0,0],
                    'vertical',
                    2 * cfg.miniHeatSpace,
                    'middle'
                );
            });*/
            this.heatmapColumns = colLists; //new List("pics", colLists, [0,0], [0,0], 'horizontal', cfg.splomSpace, 'left');
            var focusedPlate = state.focused().plate;
            if (focusedPlate >= 0)
                this.selectedHeatmap = new TemplatePlate([0, 0], state);
            this.dimensions = this.heatmapColumns.dimensions;
            this.updatePositions();
        }
        PlateIndex.prototype.setTopLeft = function (topLeft) {
            _super.prototype.setTopLeft.call(this, topLeft);
            if (this.heatmapColumns)
                this.heatmapColumns.setTopLeft(topLeft);
            if (this.selectedHeatmap) {
                var cfg = this.state.configuration;
                this.selectedHeatmap.setTopLeft(Vector.add(this.topRight, [-this.selectedHeatmap.dimensions[0], cfg.sideLabel.font.size + cfg.miniHeatSpace]));
            }
        };
        PlateIndex.prototype.paint = function (context) {
            var state = this.state;
            var cfg = state.configuration;
            // Heat maps.
            context.snippet(this.heatmapColumns);
            context.snippet(this.selectedHeatmap);
        };
        PlateIndex.prototype.toString = function () {
            return "Plates";
        };
        return PlateIndex;
    })(PlacedSnippet);
    var SubstitutePlateLabel = (function (_super) {
        __extends(SubstitutePlateLabel, _super);
        function SubstitutePlateLabel(identifier, label, dimensions, style) {
            _super.call(this, identifier, label, [0, 0], style);
            if (dimensions !== null)
                this.setDimensions([this.dimensions[0], dimensions[1] - 2 * this.dimensions[1]]);
        }
        return SubstitutePlateLabel;
    })(Label);
    var PlateMiniHeatmap = (function (_super) {
        __extends(PlateMiniHeatmap, _super);
        function PlateMiniHeatmap(plateNumber, state) {
            _super.call(this, "mh_" + plateNumber, [0, 0]);
            this.plateNumber = plateNumber;
            this.state = state;
            var cfg = state.configuration;
            var info = state.dataSetInfo.value;
            var image = PlateMiniHeatmap.plateShareImage(state, plateNumber);
            this.shareImg = image.image;
            this.wellFilled = image.wellFilled;
            this.dimensions = [info.columnCount * cfg.miniHeatWellDiameter, info.rowCount * cfg.miniHeatWellDiameter];
            this.updatePositions();
        }
        PlateMiniHeatmap.prototype.paint = function (context) {
            var state = this.state;
            var cfg = state.configuration;
            context.save();
            context.translate(this.topLeft);
            context.transitioning = false;
            // Highlight background of a plate when it has a filled well.
            if (this.wellFilled) {
                context.fillStyle(cfg.lightSelected);
                context.fillRect(0, 0, this.dimensions[0], this.dimensions[1]);
            }
            // Outline.
            context.strokeStyle(cfg.baseDim);
            context.strokeRect(0, 0, this.dimensions[0], this.dimensions[1]);
            // Heat map image.
            context.drawImage(this.shareImg);
            // Plate highlight outline.
            if (state.focused().plate === this.plateNumber) {
                context.strokeStyle(cfg.backgroundColor);
                context.lineWidth(2);
                context.strokeRect(-1, -1, this.dimensions[0] + 2, this.dimensions[1] + 2);
                context.strokeStyle(cfg.baseSelected);
                context.lineWidth(1.5);
                context.strokeRect(-1, -1, this.dimensions[0] + 2, this.dimensions[1] + 2);
                // Well highlight dot.
                var well = state.focused().well;
                if (well) {
                    context.fillStyle(cfg.backgroundColor);
                    context.fillRect(well.column * cfg.miniHeatWellDiameter - 1, well.row * cfg.miniHeatWellDiameter - 1, cfg.miniHeatWellDiameter + 2, cfg.miniHeatWellDiameter + 2);
                    context.fillStyle(cfg.baseSelected);
                    context.fillRect(well.column * cfg.miniHeatWellDiameter - .5, well.row * cfg.miniHeatWellDiameter - .5, cfg.miniHeatWellDiameter + 1, cfg.miniHeatWellDiameter + 1);
                }
            }
            context.transitioning = true;
            // Normalized picking.
            context.scale(this.dimensions[0], this.dimensions[1]);
            context.picking = true;
            context.fillStyle(style.Color.NONE);
            context.fillRect(0, 0, 1, 1);
            context.picking = false;
            context.restore();
        };
        PlateMiniHeatmap.plateShareImage = function (model, plate) {
            var tag = "cimg_" + plate + "_" + model.populationSpace.activationString() + "_" + model.focused().wellFilter;
            var wellClusterShares = model.wellClusterShares.value;
            var plateShareImage = wellClusterShares[tag];
            if (!plateShareImage) {
                var cfg = model.configuration;
                var datInfo = model.dataSetInfo.value;
                var plateShares = model.wellScores()[plate] || [];
                var wellFilled = false;
                var imgWidth = datInfo.columnCount * cfg.miniHeatWellDiameter;
                var imgHeight = datInfo.rowCount * cfg.miniHeatWellDiameter;
                var image = view.View.renderToCanvas(imgWidth, imgHeight, function (ctx) {
                    for (var c = 0; c < datInfo.columnCount; c++) {
                        var cVals = plateShares[c] || [];
                        var cX = c * cfg.miniHeatWellDiameter;
                        for (var r = 0; r < datInfo.rowCount; r++) {
                            var val = cVals[r];
                            if (val >= 0)
                                wellFilled = true;
                            var cY = r * cfg.miniHeatWellDiameter;
                            ctx.fillStyle = BaseConfiguration.shareColorMap(val).toString();
                            ctx.fillRect(cX, cY, 2, 2);
                        }
                    }
                });
                plateShareImage = {
                    image: image,
                    wellFilled: wellFilled
                };
                wellClusterShares[tag] = plateShareImage;
            }
            return plateShareImage;
        };
        PlateMiniHeatmap.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            interaction.selectedCoordinates.switchPlate(this.plateNumber);
            interaction.selectedCoordinates.well = PlateMiniHeatmap.wellCoordinatesAt(coordinates, enriched);
            interaction.pushView('plates');
        };
        PlateMiniHeatmap.wellCoordinatesAt = function (mouseCoordinates, state) {
            var info = state.dataSetInfo.value;
            return new WellCoordinates(Math.round(mouseCoordinates[0] * (info.columnCount - 1)), Math.round(mouseCoordinates[1] * (info.rowCount - 1)));
        };
        return PlateMiniHeatmap;
    })(PlacedSnippet);
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
    })(Label);
    var ConfigurationOptions = (function (_super) {
        __extends(ConfigurationOptions, _super);
        function ConfigurationOptions(identifier, topLeft, targetState, targetField, targetMap) {
            _super.call(this, identifier, topLeft);
            this.targetState = targetState;
            this.targetField = targetField;
            this.targetMap = targetMap;
            var cfg = targetState.configuration;
            var baseStyle = new LabelStyle(cfg.annotationFont, cfg.baseDim, 'left', 'top');
            var selectedStyle = new LabelStyle(cfg.annotationFont, cfg.baseEmphasis, 'left', 'top');
            var buttonSnippets = _.pairs(targetMap).map(function (p, pI) {
                var label = p[0];
                var value = p[1];
                var style = cfg[targetField] === value || (!cfg[targetField] && pI === 0) ? selectedStyle : baseStyle; // Default to first option.
                return new ConfigurationButton(identifier + "_" + value, label, topLeft, targetField, value, style);
            });
            this.buttons = new List(identifier + "_lst", buttonSnippets, topLeft, [0, 0], 'horizontal', 5, 'top');
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
    })(PlacedSnippet);
    var GuideLabel = (function (_super) {
        __extends(GuideLabel, _super);
        function GuideLabel(identifier, text, position, circleCenter, circleRadius, state) {
            _super.call(this, "gdlbl_" + identifier, text, position, state.configuration.guideStyle);
            this.position = position;
            this.circleCenter = circleCenter;
            this.circleRadius = circleRadius;
            this.state = state;
        }
        GuideLabel.prototype.paint = function (context) {
            if (this.state.configuration.guideVisible) {
                _super.prototype.paint.call(this, context);
                context.save();
                var cfg = this.state.configuration;
                var circleAbsCenter = Vector.add(this.topLeft, this.circleCenter);
                circleAbsCenter[1] += 0.5 * this.dimensions[1];
                var connectorVector = Vector.mul(Vector.normalize(this.circleCenter), -1);
                var connectorEdge = Vector.add(circleAbsCenter, Vector.mul(connectorVector, this.circleRadius));
                var connectorOuter = Vector.add(connectorEdge, Vector.mul(connectorVector, 2 * this.circleRadius));
                //var connectorOuter = Vector.add(connectorEdge, Vector.mul(connectorVector, 2 * this.circleRadius));
                context.strokeStyle(cfg.backgroundColor);
                context.lineWidth(3.5);
                context.strokeEllipse(circleAbsCenter[0], circleAbsCenter[1], this.circleRadius, this.circleRadius);
                context.strokeLine(connectorEdge, connectorOuter);
                context.strokeStyle(cfg.guideStyle.color);
                context.lineWidth(1.5);
                context.strokeEllipse(circleAbsCenter[0], circleAbsCenter[1], this.circleRadius, this.circleRadius);
                context.strokeLine(connectorEdge, connectorOuter);
                context.restore();
            }
        };
        return GuideLabel;
    })(Label);
});
//# sourceMappingURL=overview.js.map