/// <reference path="references.d.ts"/>
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define(["require", "exports", 'jsts', './model', './core/graphics/view', './core/graphics/snippet', './configuration', './core/math', './core/dataframe', './core/graphics/style'], function (require, exports, jsts, model, view, snippet, config, math, dataframe, style) {
    var WellCoordinates = model.WellCoordinates;
    var View = view.View;
    var BaseSnippet = snippet.BaseSnippet;
    var PlacedSnippet = snippet.PlacedSnippet;
    var List = snippet.List;
    var Background = snippet.Background;
    var Rectangle = snippet.Rectangle;
    var Label = snippet.Label;
    var LabelStyle = snippet.LabelStyle;
    var BaseConfiguration = config.BaseConfiguration;
    var Vector = math.Vector;
    var Color = style.Color;
    var OverView = (function (_super) {
        __extends(OverView, _super);
        function OverView() {
            _super.call(this, "overView");
        }
        OverView.prototype.updateScene = function (mod) {
            var cfg = mod.configuration;
            this.background = new ActiveBackground(cfg.backgroundColor);
            var rootTopLeft = [cfg.windowMargin, cfg.windowMargin + cfg.panelHeaderSpace + cfg.panelHeaderFont.size]; // + 2 * cfg.font.size];
            var ftrListTopLeft = rootTopLeft;
            this.featureList = new FeatureHistogramTable("ftrTable", ftrListTopLeft, mod);
            // Scatter plots.
            var splomScatterTopLeft = Vector.add(rootTopLeft, [this.featureList.dimensions[0] + cfg.panelSpace + 2 * cfg.splomSpace, 0]);
            this.splom = new Splom(splomScatterTopLeft, mod, cfg);
            var splomScatterTopRight = Vector.add(splomScatterTopLeft, [this.splom.dimensions()[0], 0]);
            var objScatterTopLeft = Vector.add(splomScatterTopRight, [-2 * cfg.splomSize, 2 * cfg.splomSize]);
            objScatterTopLeft = Vector.max(objScatterTopLeft, splomScatterTopLeft);
            if ("mds1" in mod.objectInfo.value.columnIndex && "mds2" in mod.objectInfo.value.columnIndex) {
                this.objectScatter = new ObjectFeaturePlot("mds2", "mds1", objScatterTopLeft, mod, cfg, cfg.scatterPlotSize, false, false, "Landscape of All Features");
            }
            else {
                this.objectScatter = null;
            }
            var objScatterBottomLeft = Vector.add(objScatterTopLeft, [0, cfg.splomSize + cfg.splomSpace]);
            var objScatterTopRight = Vector.add(objScatterTopLeft, [cfg.scatterPlotSize, 0]);
            var allScatterTopRight = [Math.max(splomScatterTopRight[0], objScatterTopRight[0]) - cfg.splomSpace, splomScatterTopRight[1]];
            // Population exemplar table.
            var exemplarTableTopLeft = Vector.add(allScatterTopRight, [cfg.panelSpace, 0]);
            this.exemplarTable = new ExemplarTable(exemplarTableTopLeft, mod);
            var plateIndexTopLeft = Vector.add(this.exemplarTable.topRight, [cfg.panelSpace, 0]);
            this.plateIndex = new PlateIndex(plateIndexTopLeft, mod);
            // Template (well selection) plate.
            if (mod.focused().plate === null) {
                this.templatePlate = null;
            }
            else {
                var plateTopLeft = Vector.add(this.plateIndex.topRight, [cfg.panelSpace, 0]);
                this.templatePlate = new TemplatePlate(plateTopLeft, mod);
            }
            // Well detail view.
            if (mod.focused().well === null) {
                this.wellDetailView = null;
            }
            else {
                var wellDetailTopLeft = Vector.add(this.templatePlate.bottomLeft, [0, cfg.panelSpace]); //[this.dimensions()[0] - cfg.wellViewMaxDim[0] - cfg.windowMargin, cfg.windowMargin];
                this.wellDetailView = new WellDetailView(wellDetailTopLeft, mod);
            }
            //console.log("Model:");
            //console.log(mod);
        };
        OverView.prototype.paint = function (c, iMod) {
            var cfg = iMod.configuration;
            //c.translate([0.5, 0.5]);
            c.snippet(new ActiveBackground(cfg.backgroundColor));
            // Scatter plots.
            c.snippet(this.featureList);
            c.snippet(this.objectScatter);
            c.snippet(this.hoveredObjectDetailView);
            // Distribution table.
            //c.snippet(this.clusterList);
            c.snippet(this.splom);
            c.snippet(this.exemplarTable);
            // Plate views.
            c.snippet(this.plateIndex);
            c.snippet(this.templatePlate);
            c.snippet(this.wellDetailView);
        };
        return OverView;
    })(View);
    exports.OverView = OverView;
    var ActiveBackground = (function (_super) {
        __extends(ActiveBackground, _super);
        function ActiveBackground(color) {
            _super.call(this, color);
        }
        ActiveBackground.prototype.paint = function (context) {
            context.transitioning = false;
            context.picking = true;
            _super.prototype.paint.call(this, context);
            context.picking = false;
        };
        ActiveBackground.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            interaction.hoveredCoordinates.population = null;
            interaction.selectedCoordinates.object = null;
            //interaction.selectedCoordinates.well = null;
            //interaction.selectedCoordinates.plate = null;
        };
        ActiveBackground.prototype.mouseMove = function (event, coordinates, enriched, interaction) {
            interaction.hoveredCoordinates.object = null;
            interaction.hoveredCoordinates.well = null;
            interaction.hoveredCoordinates.plate = null;
        };
        return ActiveBackground;
    })(Background);
    function panelHeader(context, cfg, text, color) {
        if (color === void 0) { color = null; }
        context.save();
        context.translate([0, -cfg.panelHeaderSpace]);
        context.font(cfg.panelHeaderFont.toString());
        context.textAlign('center');
        context.fillStyle(color || cfg.panelHeaderColor);
        context.fillText(text);
        context.restore();
    }
    var Splom = (function (_super) {
        __extends(Splom, _super);
        function Splom(topLeft, model, configuration) {
            _super.call(this, "splom");
            this.topLeft = topLeft;
            this.model = model;
            this.configuration = configuration;
            this.plots = [];
            var objectFeatures = model.objectInfo.value;
            this.features = model.populationSpace.features.elements;
            var colLen = this.features.length;
            for (var c1I = 0; c1I < colLen; c1I++) {
                var c1II = colLen - c1I - 1;
                var c1 = this.features[c1I];
                for (var c2I = 0; c2I < c1I; c2I++) {
                    var c2II = colLen - c2I - 1;
                    var c2 = this.features[c2I];
                    if (c1 in objectFeatures.columnIndex && c2 in objectFeatures.columnIndex) {
                        this.plots.push(new ObjectFeaturePlot(c1, c2, Vector.add(this.topLeft, [c1II * configuration.splomSize, c2I * configuration.splomSize]), model, configuration, configuration.splomInnerSize, c2I == 0, c1II == 0));
                    }
                }
            }
        }
        Splom.prototype.paint = function (context) {
            var mod = this.model;
            var cfg = mod.configuration;
            // Header.
            context.save();
            context.translate(this.topLeft);
            context.translate([0.5 * this.dimensions()[0], 0]);
            panelHeader(context, cfg, "Feature Space");
            context.restore();
            // Individual plots.
            context.snippets(this.plots);
        };
        // Total width and height.
        Splom.prototype.dimensions = function () {
            var cfg = this.model.configuration;
            var size = Math.max(0, this.model.populationSpace.features.length - 1) * this.configuration.splomSize;
            return [Math.max(size, cfg.splomSize + cfg.splomInnerSize), size];
        };
        return Splom;
    })(BaseSnippet);
    exports.Splom = Splom;
    var ObjectFeaturePlot = (function (_super) {
        __extends(ObjectFeaturePlot, _super);
        function ObjectFeaturePlot(feature1, feature2, topLeft, model, configuration, size, columnLabel, rowLabel, footerLabel) {
            var _this = this;
            if (columnLabel === void 0) { columnLabel = false; }
            if (rowLabel === void 0) { rowLabel = false; }
            if (footerLabel === void 0) { footerLabel = null; }
            _super.call(this, "objPlt_" + feature1 + ".." + feature2);
            this.feature1 = feature1;
            this.feature2 = feature2;
            this.topLeft = topLeft;
            this.model = model;
            this.configuration = configuration;
            this.size = size;
            this.columnLabel = columnLabel;
            this.rowLabel = rowLabel;
            this.footerLabel = footerLabel;
            // Cache heavy duty dot draw operations, optional.
            this.cachedBackground = model.objectHistograms.value[this.identifier]; //model.objectInfo.value[this.identifier];
            if (!this.cachedBackground) {
                this.cachedBackground = view.View.renderToCanvas(size, size, function (c) { return _this.paintDots(c); });
                model.objectHistograms.value[this.identifier] = this.cachedBackground;
            }
        }
        ObjectFeaturePlot.prototype.paintDots = function (context) {
            var mod = this.model;
            var cfg = this.configuration;
            var size = this.size;
            // Paint histograms, if available.
            var histograms = mod.objectHistograms.value.matricesFor(this.feature1, this.feature2);
            var pairHistos = _.pairs(histograms);
            if (pairHistos) {
                context.save();
                pairHistos.forEach(function (hP) {
                    var cK = hP[0];
                    var matrix = hP[1];
                    var population = mod.populationSpace.populations.byId(cK);
                    var coreColor = Number(cK) >= 0 ? population.color : cfg.base;
                    //context.fillStyle = Number(cK) >= 0 ? population.colorTrans : cfg.base;
                    matrix.forEach(function (c, xI) { return c.forEach(function (cell, yI) {
                        if (cell) {
                            context.fillStyle = coreColor.alpha(1 - 0.5 / cell);
                            context.fillRect(xI, size - yI, 1, 1);
                        }
                    }); });
                });
                context.restore();
            }
        };
        ObjectFeaturePlot.prototype.paint = function (context) {
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
            // Background rectangle.
            context.strokeStyle(cfg.baseVeryDim);
            context.strokeRect(0, 0, size, size);
            //context.context['imageSmoothingEnabled'] = false;
            context.drawImageScaled(this.cachedBackground, [0, 0], [this.size, this.size]);
            //context.context['imageSmoothingEnabled'] = true;
            context.transitioning = false;
            //context.transitioning = false;
            var objectFeatures = this.model.objectInfo.value;
            var x = objectFeatures.columnVector(this.feature1) || [];
            var y = objectFeatures.columnVector(this.feature2) || [];
            //var clstr = mod.clusters.value;
            // Large colored dots with halo for representatives.
            mod.populationSpace.populations.forEach(function (pop) { return pop.exemplars.forEach(function (ex) {
                //var cI = clstr.clusterMap[pop.identifier];
                //var color = cI >= 0 ? cfg.clusterColors[clstr.identifierIndex[cI]] : Color.NONE;
                var oI = objectFeatures.rowIndex[ex];
                ObjectFeaturePlot.drawBigDot(context, cfg, pop.color, x[oI] * size, (1 - y[oI]) * size);
            }); });
            // Color dot for hovered object.
            var focusedObject = mod.hoveredCoordinates.object;
            if (focusedObject !== null) {
                var oI = objectFeatures.rowIndex[focusedObject];
                ObjectFeaturePlot.drawBigDot(context, cfg, cfg.baseSelected, x[oI] * size, (1 - y[oI]) * size);
            }
            context.transitioning = true;
            // Labels.
            context.save();
            context.font(cfg.sideFont.string);
            context.textAlign('center');
            // Footer label for special plots.
            context.textBaseline('top');
            context.save();
            context.fillStyle(this.footerLabel ? cfg.base : style.Color.NONE);
            context.translate([.5 * this.size, this.size]);
            context.fillText(this.footerLabel, 0, 0);
            context.restore();
            // Column (top) label.
            context.textBaseline('bottom');
            context.save();
            context.fillStyle(this.columnLabel ? cfg.base : style.Color.NONE);
            context.translate([.5 * this.size, 0]);
            context.fillText(this.feature1, 0, 0);
            context.restore();
            // Row (left) label.
            context.save();
            context.fillStyle(this.rowLabel ? cfg.base : style.Color.NONE);
            context.translate([0, .5 * this.size]);
            context.rotate(-.5 * Math.PI);
            context.fillText(this.feature2, 0, 0);
            context.restore();
            context.restore();
            context.restore();
        };
        ObjectFeaturePlot.drawBigDot = function (context, cfg, color, x, y) {
            var rO = cfg.splomRepresentativeOuterDotRadius;
            var rI = cfg.splomRepresentativeInnerDotRadius;
            var rM = 0.5 * (rO + rI);
            context.fillStyle(cfg.backgroundColor);
            context.fillEllipse(x, y, rO, rO);
            context.fillStyle(style.Color.BLACK);
            context.fillEllipse(x, y, rM, rM);
            context.fillStyle(color);
            context.fillEllipse(x, y, rI, rI);
        };
        ObjectFeaturePlot.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            var invCs = [coordinates[0], 1 - coordinates[1]];
            var object = enriched.closestObject([this.feature1, this.feature2], invCs);
            // Toggle given exemplar for the focused population.
            // If no population is focused, create a new population for the exemplar, and focus the population.
            var popSpace = interaction.populationSpace;
            var population = popSpace.populations.byId(interaction.hoveredCoordinates.population);
            // Create and focus a new population if one is lacking.
            if (!population) {
                population = popSpace.createPopulation();
                interaction.hoveredCoordinates.population = population.identifier;
            }
            population.exemplars = population.exemplars.toggle(object);
        };
        ObjectFeaturePlot.prototype.mouseMove = function (event, coordinates, enriched, interaction) {
            var invCs = [coordinates[0], 1 - coordinates[1]];
            interaction.hoveredCoordinates.object = enriched.closestObject([this.feature1, this.feature2], invCs);
            enriched.conformHoveredCoordinates(interaction);
        };
        return ObjectFeaturePlot;
    })(BaseSnippet);
    exports.ObjectFeaturePlot = ObjectFeaturePlot;
    var ExemplarTable = (function (_super) {
        __extends(ExemplarTable, _super);
        function ExemplarTable(topLeft, state) {
            _super.call(this, "ExemplarStack", topLeft);
            this.state = state;
            var cfg = state.configuration;
            var colSnippets = this.state.populationSpace.populations.map(function (p) { return new ExemplarColumn(state, p); });
            this.columns = new List("ExemplarColumns", colSnippets, topLeft, [0, 0], 'horizontal', cfg.clusterTileSpace, 'left');
            var hoveredObjectDetailsTopLeft = this.columns.dimensions[1] > 0 ? Vector.add(this.columns.bottomLeft, [0, cfg.splomSpace]) : this.columns.topLeft;
            if (state.hoveredCoordinates.object !== null && !state.hoveredObjectIsExemplar()) {
                this.hoveredObjectDetailView = new ObjectDetailView(state.hoveredCoordinates.object, state, hoveredObjectDetailsTopLeft);
            }
            else {
                this.hoveredObjectDetailView = null;
            }
            this.dimensions = Vector.max(this.columns.dimensions, [cfg.splomInnerSize, cfg.splomInnerSize]);
            this.updatePositions();
        }
        ExemplarTable.prototype.paint = function (context) {
            var cfg = this.state.configuration;
            // Header.
            context.save();
            context.translate(this.topLeft);
            context.translate([0.5 * this.dimensions[0], 0]);
            panelHeader(context, cfg, "Exemplars");
            context.restore();
            context.snippet(this.columns);
            context.snippet(this.hoveredObjectDetailView);
            context.transitioning = false;
        };
        return ExemplarTable;
    })(PlacedSnippet);
    exports.ExemplarTable = ExemplarTable;
    var ExemplarColumn = (function (_super) {
        __extends(ExemplarColumn, _super);
        //exemplarDetails: List<ObjectDetailView>;
        function ExemplarColumn(state, population, topLeft) {
            if (topLeft === void 0) { topLeft = [0, 0]; }
            _super.call(this, "esc" + population.identifier, population.exemplars.map(function (ex) { return new ObjectDetailView(ex, state); }), topLeft, [state.configuration.clusterTileInnerSize, 0], 'vertical', state.configuration.clusterTileSpace, 'middle');
            this.state = state;
            this.population = population;
            this.topLeft = topLeft;
            //super("esc_" + population.identifier, );
            //var cfg = state.configuration;
            //var exemplarTiles = population.exemplars.map(ex => new ObjectDetailView(ex, state, cfg.clusterTileSize));
            //this.exemplarDetails = new List("exlst_" + population.identifier, exemplarTiles, topLeft, 'vertical', cfg.clusterTileSpace);
            //this.dimensions = this.exemplarDetails.dimensions;  // Guarantee width.
            //this.updatePositions();
        }
        ExemplarColumn.prototype.paint = function (context) {
            var state = this.state;
            var cfg = state.configuration;
            context.save();
            context.translate(this.topLeft);
            // Top header.
            context.save();
            var verticalFocusShift = state.hoveredCoordinates.population === this.population.identifier ? 0.5 * cfg.sideFont.size : 0;
            var tabHeight = verticalFocusShift + 1.5 * cfg.sideFont.size;
            // Pickable background.
            context.picking = true;
            context.fillStyle(Color.NONE);
            context.fillRect(0, -tabHeight, this.dimensions[0], this.dimensions[1] + tabHeight + cfg.splomSpace);
            context.picking = false;
            // Colored tab.
            context.fillStyle(this.population.colorTrans);
            context.fillRect(0, -tabHeight, this.dimensions[0], this.dimensions[1] + tabHeight); //tabHeight);
            context.font(cfg.sideFont.string);
            context.textBaseline('bottom');
            context.textAlign('center');
            context.fillStyle(cfg.base);
            //context.lineWidth(3);
            //context.strokeStyle(cfg.backgroundColor);
            // Label.
            context.translate([.5 * this.dimensions[0], -verticalFocusShift]);
            //context.strokeText(this.population.name, 0, 0);
            context.fillText(this.population.name, 0, 0);
            context.restore();
            context.restore();
            _super.prototype.paint.call(this, context);
        };
        ExemplarColumn.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            interaction.hoveredCoordinates.population = this.population.identifier;
        };
        ExemplarColumn.prototype.mouseMove = function (event, coordinates, enriched, interaction) {
            interaction.hoveredCoordinates.population = this.population.identifier;
        };
        return ExemplarColumn;
    })(List);
    exports.ExemplarColumn = ExemplarColumn;
    var NumberTable = (function (_super) {
        __extends(NumberTable, _super);
        function NumberTable(identifier, topLeft, frame, configuration) {
            _super.call(this, identifier);
            this.topLeft = topLeft;
            this.frame = frame;
            this.configuration = configuration;
            var accTopLeft = topLeft;
            if (configuration.visibleIndex) {
            }
            if (configuration.visibleHeader) {
                var headerStyle = new LabelStyle(configuration.font, configuration.fontColor, 'middle', 'middle');
                this.columnHeader = frame.columns.map(function (cL, i) { return new Label(identifier + "_c_" + cL, cL, Vector.add(accTopLeft, [(i + .5) * configuration.cellOuterDimensions[0], 0]), headerStyle); });
                accTopLeft = Vector.add(accTopLeft, [0, configuration.cellOuterDimensions[1]]);
            }
            // Number bars.
            var barsTopLeft = accTopLeft;
            this.bars = _.flatten(frame.zeroNormalizedMatrix.map(function (c, cI) { return c.map(function (val, rI) { return new Rectangle(identifier + "_" + cI + "_" + rI, Vector.add(barsTopLeft, [cI * configuration.cellOuterDimensions[0], configuration.cellSpace[1] + rI * configuration.cellOuterDimensions[1]]), [val * configuration.cellDimensions[0], configuration.cellDimensions[1]], configuration.fontColor); }); }));
            if (configuration.visibleIndex) {
                var indexStyle = new LabelStyle(configuration.font, configuration.fontColor, 'left', 'middle');
                this.rowIndex = frame.rows.map(function (rL, i) { return new Label(identifier + "_r_" + rL, rL, Vector.add(topLeft, [frame.columns.length * configuration.cellOuterDimensions[0], (i + .5) * configuration.cellOuterDimensions[1]]), indexStyle, true); });
            }
        }
        NumberTable.prototype.paint = function (context) {
            context.snippets(this.columnHeader);
            context.snippets(this.rowIndex);
            context.snippets(this.bars);
        };
        NumberTable.prototype.dimensions = function () {
            var cfg = this.configuration;
            return [(this.frame.columns.length + (this.configuration.visibleIndex ? 1 : 0)) * cfg.cellOuterDimensions[0], (this.frame.rows.length + (this.configuration.visibleHeader ? 1 : 0)) * cfg.cellOuterDimensions[1]];
        };
        return NumberTable;
    })(BaseSnippet);
    var FeatureLabel = (function (_super) {
        __extends(FeatureLabel, _super);
        function FeatureLabel(feature, position, style) {
            _super.call(this, feature, feature, position, style, true);
            this.feature = feature;
        }
        FeatureLabel.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            interaction.populationSpace.features = enriched.populationSpace.features.toggle(this.feature);
            //console.log("Mouse click: " + enriched.populationSpace.features.length);
        };
        return FeatureLabel;
    })(Label);
    var FeatureHistogramTable = (function (_super) {
        __extends(FeatureHistogramTable, _super);
        function FeatureHistogramTable(identifier, topLeft, state) {
            _super.call(this, identifier, topLeft);
            this.state = state;
            var features = state.features.value;
            var frames = state.featureHistograms.value.histograms;
            //var frame = state.featureHistograms.value.histograms['objects'];   //state.features.value;
            var cfg = state.configuration;
            var configuration = cfg.featureTable;
            var selected = state.populationSpace.features;
            var accTopLeft = topLeft;
            if (configuration.visibleIndex) {
                this.rowIndex = features.map(function (rL, i) {
                    var indexStyle = new LabelStyle(configuration.font, selected.has(rL) ? configuration.fontColor : cfg.baseDim, 'right', 'middle');
                    return new FeatureLabel(rL, Vector.add(topLeft, [configuration.cellOuterDimensions[0], (i + .5) * configuration.cellOuterDimensions[1]]), indexStyle);
                });
                accTopLeft = Vector.add(accTopLeft, [configuration.cellOuterDimensions[0] + cfg.splomSpace, 0]);
            }
            var barsTopLeft = accTopLeft;
            this.histograms = _.keys(frames).map(function (fK) {
                var frame = frames[fK];
                var frameCfg = _.clone(configuration);
                frameCfg.fontColor = fK === '-1' ? cfg.baseDim : state.populationSpace.populations.byId(fK).color;
                return features.filter(function (c) { return c in frame.columnIndex; }).map(function (c, cI) { return new Histogram(identifier + "_" + c, Vector.add(barsTopLeft, [0, configuration.cellSpace[1] + cI * configuration.cellOuterDimensions[1]]), frame.matrix[frame.columnIndex[c]], frameCfg); });
            });
            this.setDimensions([((configuration.visibleIndex ? 1 : 0) + 1) * configuration.cellOuterDimensions[0], (features.length + (configuration.visibleHeader ? 1 : 0)) * configuration.cellOuterDimensions[1]]);
            if (selected.length < 2) {
                this.guide = new GuideLabel("ftr", "Click on a feature label to add it to the phenotype model space.", Vector.add(this.topRight, [15, 250]), Vector.add(this.topLeft, [35, 250]), 25, state);
            }
        }
        FeatureHistogramTable.prototype.paint = function (context) {
            var cfg = this.state.configuration;
            // Header.
            context.save();
            context.translate(this.topLeft);
            context.translate([0.5 * this.dimensions[0], 0]);
            panelHeader(context, cfg, "Cell Features");
            context.restore();
            context.snippets(this.columnHeader);
            context.snippets(this.rowIndex);
            //context.snippets(this.histograms);
            this.histograms.forEach(function (hs) { return context.snippets(hs); });
            context.snippet(this.guide);
        };
        return FeatureHistogramTable;
    })(PlacedSnippet);
    var Histogram = (function (_super) {
        __extends(Histogram, _super);
        function Histogram(identifier, topLeft, normFrequencies, configuration) {
            _super.call(this, identifier);
            this.topLeft = topLeft;
            this.normFrequencies = normFrequencies;
            this.configuration = configuration;
        }
        Histogram.prototype.paint = function (context) {
            var cfg = this.configuration;
            context.save();
            context.translate(this.topLeft);
            context.strokeStyle(cfg.fontColor);
            var shrLen = this.normFrequencies.length - 1;
            for (var i = 0; i < shrLen; i++) {
                var x1 = i * cfg.cellDimensions[0] / shrLen;
                var x2 = (i + 1) * cfg.cellDimensions[0] / shrLen;
                var f1 = this.normFrequencies[i];
                var f2 = this.normFrequencies[i + 1];
                var y1 = (1 - f1) * cfg.cellDimensions[1];
                var y2 = (1 - f2) * cfg.cellDimensions[1];
                context.strokeLine([x1, y1], [x2, y2]);
            }
            context.restore();
        };
        return Histogram;
    })(BaseSnippet);
    var Plate = (function (_super) {
        __extends(Plate, _super);
        function Plate(id, topLeft, model) {
            _super.call(this, id, topLeft);
            this.model = model;
            var cfg = model.configuration;
            var info = model.dataSetInfo.value;
            this.setDimensions([info.columnCount * cfg.wellDiameter, info.rowCount * cfg.wellDiameter]);
        }
        Plate.prototype.paintWellOutlines = function (ctx) {
            var cfg = this.model.configuration;
            var info = this.model.dataSetInfo.value;
            var selection = this.model.focused();
            var clusterShares = this.model.wellClusterShares.value.wellIndex[selection.populationOrTotal()] || [];
            var wellShares = clusterShares[selection.plate] || [];
            // Well outlines.
            ctx.strokeStyle(cfg.baseMuted);
            for (var c = 0; c < info.columnCount; c++) {
                var x = c * cfg.wellDiameter;
                for (var r = 0; r < info.rowCount; r++) {
                    var y = r * cfg.wellDiameter;
                    if (wellShares[c] && wellShares[c][r] >= -1) {
                        ctx.fillStyle(BaseConfiguration.shareColorMap(wellShares[c][r]));
                        ctx.fillRect(x + .25, y + .25, cfg.wellDiameter - .5, cfg.wellDiameter - .5);
                    }
                    else {
                        ctx.strokeLine([x + .25, y + .25], [x + cfg.wellDiameter - .25, y + cfg.wellDiameter - .25]);
                        ctx.strokeLine([x + .25, y + cfg.wellDiameter - .25], [x + cfg.wellDiameter - .25, y + .25]);
                    }
                }
            }
        };
        Plate.prototype.paintWellLabels = function (ctx) {
            var cfg = this.model.configuration;
            var info = this.model.dataSetInfo.value;
            var lblY = 0; //info.rowCount * cfg.wellDiameter + cfg.plateColLabelMargin;
            var lblX = info.columnCount * cfg.wellDiameter + cfg.plateRowLabelMargin;
            ctx.save();
            // Column labels at the top.
            ctx.font(cfg.sideFont.string);
            ctx.fillStyle(cfg.base);
            ctx.textAlign('center');
            ctx.textBaseline('bottom');
            info.columnLabels.forEach(function (c, i) { return ctx.fillText(c, (i + .5) * cfg.wellDiameter, lblY); });
            // Row labels at the right.
            ctx.textAlign('left');
            ctx.textBaseline('middle');
            info.rowLabels.forEach(function (r, j) { return ctx.fillText(r, lblX, (j + .5) * cfg.wellDiameter); });
            ctx.restore();
        };
        return Plate;
    })(PlacedSnippet);
    var TemplatePlate = (function (_super) {
        __extends(TemplatePlate, _super);
        function TemplatePlate(topLeft, model) {
            _super.call(this, "tmpPlt", topLeft, model);
            this.model = model;
            var cfg = model.configuration;
            var gf = new jsts.geom.GeometryFactory();
            this.selectionOutlines = model.allWellSelections().map(function (ws) {
                // Tile per well.
                var wellTiles = ws.wells.map(function (wc) {
                    var topLeft = new jsts.geom.Coordinate(wc.column * cfg.wellDiameter, wc.row * cfg.wellDiameter);
                    var topRight = new jsts.geom.Coordinate((wc.column + 1) * cfg.wellDiameter, wc.row * cfg.wellDiameter);
                    var bottomRight = new jsts.geom.Coordinate((wc.column + 1) * cfg.wellDiameter, (wc.row + 1) * cfg.wellDiameter);
                    var bottomLeft = new jsts.geom.Coordinate(wc.column * cfg.wellDiameter, (wc.row + 1) * cfg.wellDiameter);
                    return gf.createPolygon(gf.createLinearRing([topLeft, topRight, bottomRight, bottomLeft, topLeft]), []);
                });
                return new jsts.operation.union.CascadedPolygonUnion(wellTiles).union();
            });
        }
        TemplatePlate.prototype.paint = function (context) {
            var cfg = this.model.configuration;
            var info = this.model.dataSetInfo.value;
            var focusedPlate = this.model.focused().plate;
            // Header.
            context.save();
            context.translate(this.topLeft);
            context.translate([0.5 * info.columnCount * cfg.wellDiameter, 0]);
            panelHeader(context, cfg, (focusedPlate === null ? "Plate Void" : "Plate " + info.plateLabels[focusedPlate]), cfg.baseSelected);
            context.restore();
            context.save();
            context.translate(this.topLeft);
            context.transitioning = false;
            //this.paintSelectionBody(ctx);
            this.paintWellOutlines(context);
            this.paintWellLabels(context);
            this.paintSelectionOutlines(context);
            // Well selection.
            context.scale(info.columnCount * cfg.wellDiameter, info.rowCount * cfg.wellDiameter);
            context.picking = true;
            context.fillStyle(Color.NONE);
            context.fillRect(0, 0, 1, 1);
            context.picking = false;
            context.transitioning = true;
            context.restore();
        };
        TemplatePlate.prototype.paintSelectionBody = function (ctx) {
            var cfg = this.model.configuration;
            var info = this.model.dataSetInfo.value;
            ctx.fillStyle(cfg.base.alpha(0.2));
            ctx.beginPath();
            this.selectionOutlines.forEach(function (so) { return TemplatePlate.geometryToPath(ctx, so); });
            ctx.fill();
        };
        TemplatePlate.prototype.paintSelectionOutlines = function (ctx) {
            var _this = this;
            var cfg = this.model.configuration;
            var info = this.model.dataSetInfo.value;
            this.selectionOutlines.forEach(function (so, i) {
                ctx.strokeStyle(cfg.backgroundColor);
                ctx.lineWidth(3.5);
                ctx.beginPath();
                TemplatePlate.geometryToPath(ctx, so);
                ctx.stroke();
                ctx.strokeStyle(_this.model.allWellSelections()[i].id === "Selected" ? cfg.baseSelected : cfg.base);
                ctx.lineWidth(2);
                ctx.beginPath();
                TemplatePlate.geometryToPath(ctx, so);
                ctx.stroke();
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
        TemplatePlate.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            var plate = this.model.focused().plate;
            if (plate !== null) {
                interaction.selectedCoordinates.plate = plate;
                interaction.selectedCoordinates.well = PlateMiniHeatmap.wellCoordinatesAt(coordinates, enriched);
            }
        };
        TemplatePlate.prototype.mouseMove = function (event, coordinates, enriched, interaction) {
            var plate = this.model.focused().plate;
            if (plate !== null) {
                interaction.hoveredCoordinates.plate = plate;
                interaction.hoveredCoordinates.well = PlateMiniHeatmap.wellCoordinatesAt(coordinates, enriched);
            }
        };
        TemplatePlate.geometryToPath = function (context, geometry) {
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
        TemplatePlate.hullToPath = function (context, geometry) {
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
        TemplatePlate.holesToPath = function (context, geometry) {
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
        TemplatePlate.trunc = function (bC, eC) {
            var bV = [bC.x, bC.y];
            var eV = [eC.x, eC.y];
            return Vector.add(bV, Vector.mul(Vector.normalize(Vector.subtract(eV, bV)), TemplatePlate.arcRad));
        };
        TemplatePlate.ringToPath = function (context, ring) {
            var cs = ring.getCoordinates();
            var mC = TemplatePlate.trunc(cs[0], cs[1]);
            context.moveTo(mC[0], mC[1]);
            for (var i = 1; i < cs.length; i++) {
                var cs0 = cs[i];
                var cs1 = cs[i + 1 === cs.length ? 1 : i + 1];
                context.arcTo(cs0.x, cs0.y, cs1.x, cs1.y, TemplatePlate.arcRad);
            }
            context.closePath();
        };
        /*static ringToPath(context: ViewContext, ring: jsts.geom.LineString) {
            var cs = ring.getCoordinates();
            context.moveTo(cs[0].x, cs[0].y);
            for (var i = 1; i < cs.length; i++) context.lineTo(cs[i].x, cs[i].y);
            context.closePath();
        }*/
        TemplatePlate.arcRad = 2;
        return TemplatePlate;
    })(Plate);
    /*class PlateIndex extends PlacedSnippet {
        private selectionSnippets: PlateIndexSelection[];
    
        constructor(public topLeft: number[], public model: EnrichedState) {
            super("pi", topLeft);
    
            this.selectionSnippets = model.allWellSelections().map((s, i) =>
                new PlateIndexSelection([i * model.configuration.plateIndexWidth(), 0], s, model));
    
            var cfg = model.configuration;
            var datInfo = model.dataSetInfo.value;
            this.dimensions = [model.allWellSelections().length * cfg.plateIndexWidth(), cfg.plateIndexSpace * datInfo.plateCount];
            this.updatePositions();
        }
    
        paint(ctx: ViewContext) {
            ctx.save();
    
            ctx.translate(this.topLeft);
            ctx.snippets(this.selectionSnippets);
            ctx.restore();
        }
    }*/
    var PlateIndexSelection = (function (_super) {
        __extends(PlateIndexSelection, _super);
        function PlateIndexSelection(topLeft, selection, model) {
            _super.call(this, "pi_" + selection.id, topLeft);
            this.topLeft = topLeft;
            this.selection = selection;
            this.model = model;
            var cfg = model.configuration;
            var info = model.dataSetInfo.value;
            this.dimensions = [cfg.plateIndexWidth(), cfg.plateIndexSpace * info.plateCount];
            this.updatePositions();
        }
        PlateIndexSelection.prototype.paint = function (ctx) {
            var mod = this.model;
            var cfg = mod.configuration;
            var info = mod.dataSetInfo.value;
            ctx.save();
            ctx.translate(this.topLeft);
            ctx.transitioning = false;
            ctx.save();
            ctx.font(cfg.sideFont.string);
            ctx.textAlign('left');
            ctx.textBaseline('top');
            ctx.fillStyle(cfg.base);
            //ctx.translate([.5 * cfg.plateIndexInnerHeight, -cfg.clusterTileSpace]);
            ctx.translate([1 * cfg.plateIndexInnerHeight, this.dimensions[1]]);
            ctx.rotate(.25 * Math.PI);
            ctx.fillText(this.selection.id);
            ctx.restore();
            ctx.save();
            ctx.scale(1, cfg.plateIndexSpace);
            ctx.picking = true;
            ctx.fillStyle(style.Color.NONE);
            ctx.fillRect(0, 0, cfg.plateIndexWidth(), info.plateCount);
            ctx.picking = false;
            ctx.restore();
            this.selection.plates.forEach(function (p) {
                for (var i = p[0]; i <= p[1]; i++) {
                    ctx.fillStyle(mod.focused().plate == i ? cfg.baseSelected : cfg.baseMuted);
                    ctx.fillRect(0, i * cfg.plateIndexSpace, cfg.plateIndexInnerHeight, cfg.plateWidth);
                }
            });
            //this.selection.plates.forEach(p => ctx.fillRect(cfg.plateIndexSpace * p[0], 0, cfg.plateIndexSpace * (p[1] - p[0] + 1), cfg.plateIndexInnerHeight));
            ctx.textAlign('left');
            ctx.textBaseline('alphabetic');
            ctx.restore();
        };
        return PlateIndexSelection;
    })(PlacedSnippet);
    var WellDetailView = (function (_super) {
        __extends(WellDetailView, _super);
        function WellDetailView(topLeft, state) {
            _super.call(this, "WellDetailView", topLeft);
            this.state = state;
            var cfg = state.configuration;
            this.setDimensions(cfg.wellViewMaxDim);
            var availableTypes = _.keys(state.availableImageTypes());
            var wellOptions = {};
            availableTypes.forEach(function (t) { return wellOptions[t] = t; });
            this.imageTypeOption = new ConfigurationOptions("WellDetailOptions", this.bottomLeft, state, "imageType", wellOptions);
            if (state.focused().object === null) {
                this.guide = new GuideLabel("well", "Hover over a cell to inspect it.", Vector.add(this.bottomRight, [-200, 25]), Vector.add(this.bottomRight, [-200, -50]), 20, state);
            }
        }
        WellDetailView.prototype.paint = function (ctx) {
            var state = this.state;
            var cfg = state.configuration;
            var focusedWell = state.focused().well;
            var info = state.dataSetInfo.value;
            // Header.
            ctx.save();
            ctx.translate(this.topLeft);
            ctx.translate([0.75 * this.dimensions[0], cfg.panelHeaderSpace - cfg.panelSpace]);
            panelHeader(ctx, cfg, (focusedWell === null ? "Well Void" : "Well " + info.columnLabels[focusedWell.column] + info.rowLabels[focusedWell.row]), cfg.baseSelected);
            ctx.restore();
            ctx.transitioning = false;
            ctx.save();
            ctx.translate(this.topLeft);
            var well = state.selectionWell(state.focused());
            if (well) {
                var img = well.image(cfg.imageType);
                if (img) {
                    var wellScale = Math.min(cfg.wellViewMaxDim[0] / img.width, 2 * cfg.wellViewMaxDim[1] / img.height);
                    ctx.picking = true;
                    ctx.drawImageClipped(img, [0, 0], [img.width, 0.5 * img.height], [0, 0], [wellScale * img.width, wellScale * 0.5 * img.height]);
                    ctx.picking = false;
                    // Test object coordinates.
                    var objects = state.objectInfo.value;
                    var x = objects.columnVector("x");
                    var y = objects.columnVector("y");
                    var xRad = wellScale * cfg.objectViewImageRadius;
                    var yRad = wellScale * cfg.objectViewImageRadius;
                    objects.rows.forEach(function (r, i) {
                        if (Number(r) === state.focused().object) {
                            ctx.strokeStyle(cfg.backgroundColor);
                            ctx.lineWidth(4);
                            ctx.strokeRect(wellScale * x[i] - xRad, wellScale * y[i] - yRad, 2 * xRad, 2 * yRad);
                            ctx.strokeStyle(cfg.baseSelected);
                            ctx.lineWidth(2);
                            ctx.strokeRect(wellScale * x[i] - xRad, wellScale * y[i] - yRad, 2 * xRad, 2 * yRad);
                        }
                    });
                }
            }
            ctx.restore();
            ctx.transitioning = true;
            // Well type button.
            ctx.snippet(this.imageTypeOption);
            ctx.snippet(this.guide);
        };
        WellDetailView.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            var object = enriched.closestWellObject(coordinates);
            // Toggle given exemplar for the focused population.
            // If no population is focused, create a new population for the exemplar, and focus the population.
            var popSpace = interaction.populationSpace;
            var population = popSpace.populations.byId(interaction.hoveredCoordinates.population);
            // Create and focus a new population if one is lacking.
            if (!population) {
                population = popSpace.createPopulation();
                interaction.hoveredCoordinates.population = population.identifier;
            }
            population.exemplars = population.exemplars.toggle(object);
        };
        WellDetailView.prototype.mouseMove = function (event, coordinates, enriched, interaction) {
            interaction.hoveredCoordinates.object = enriched.closestWellObject(coordinates);
            enriched.conformHoveredCoordinates(interaction);
        };
        return WellDetailView;
    })(PlacedSnippet);
    var ObjectDetailView = (function (_super) {
        __extends(ObjectDetailView, _super);
        function ObjectDetailView(object, state, topLeft) {
            if (topLeft === void 0) { topLeft = [0, 0]; }
            _super.call(this, "odv_" + object, topLeft);
            this.object = object;
            this.state = state;
            var cfg = state.configuration;
            this.focused = state.hoveredCoordinates.object === object;
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
                var img = wellInfo.location.image(cfg.imageType);
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
                    // Focused highlight.
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
            interaction.removeExemplar(this.object);
        };
        ObjectDetailView.prototype.mouseMove = function (event, coordinates, enriched, interaction) {
            interaction.hoveredCoordinates.object = this.object;
            enriched.conformHoveredCoordinates(interaction);
        };
        return ObjectDetailView;
    })(PlacedSnippet);
    var PlateIndex = (function (_super) {
        __extends(PlateIndex, _super);
        function PlateIndex(topLeft, state) {
            _super.call(this, "pi", topLeft);
            this.topLeft = topLeft;
            this.state = state;
            var cfg = state.configuration;
            var datInfo = state.dataSetInfo.value;
            var heatMaps = _.range(0, datInfo.plateCount).map(function (pI) { return new PlateMiniHeatmap([0, 0], pI, state); });
            var colCapacity = Math.ceil(datInfo.plateCount / cfg.miniHeatColumnCount);
            var colMaps = _.range(0, cfg.miniHeatColumnCount).map(function (cI) { return _.compact(_.range(0, colCapacity).map(function (rI) { return heatMaps[cI * colCapacity + rI]; })); });
            //var colMaps = _.range(0, cfg.miniHeatColumnCount).map(cI => new List("pic_" + cI, st))
            this.heatmapColumns = new List("pics", colMaps.map(function (c, cI) { return new List("pic_" + cI, c, [0, 0], [0, 0], 'vertical', cfg.miniHeatSpace); }), topLeft, [0, 0], 'horizontal', cfg.miniHeatSpace, 'left');
            this.dimensions = this.heatmapColumns.dimensions; // [model.allWellSelections().length * cfg.plateIndexWidth(), cfg.plateIndexSpace * datInfo.plateCount];
            this.updatePositions();
            if (state.focused().plate === null) {
                this.guide = new GuideLabel("plate", "Hover over a plate to inspect it and click to select it.", Vector.add(this.topRight, [10, 60]), Vector.add(this.topRight, [-10, 60]), 5, state);
            }
        }
        PlateIndex.prototype.paint = function (context) {
            var state = this.state;
            var cfg = state.configuration;
            var focusedPopulation = state.focused().population;
            // Header.
            context.save();
            context.translate(this.topLeft);
            context.translate([0.5 * this.dimensions[0], 0]);
            panelHeader(context, cfg, focusedPopulation === null ? "Cell Counts" : "Cell Ratio of " + state.populationSpace.populations.byId(focusedPopulation).name, focusedPopulation === null ? null : state.populationSpace.populations.byId(focusedPopulation).color);
            context.restore();
            // Heat maps.
            context.snippet(this.heatmapColumns);
            context.snippet(this.guide);
        };
        return PlateIndex;
    })(PlacedSnippet);
    var PlateMiniHeatmap = (function (_super) {
        __extends(PlateMiniHeatmap, _super);
        function PlateMiniHeatmap(topLeft, plateNumber, state) {
            _super.call(this, "mh_" + plateNumber, topLeft);
            this.topLeft = topLeft;
            this.plateNumber = plateNumber;
            this.state = state;
            var cfg = state.configuration;
            var info = state.dataSetInfo.value;
            var targetPopulation = state.focused().populationOrTotal();
            this.shareImg = PlateMiniHeatmap.plateShareImage(state, targetPopulation, plateNumber);
            this.dimensions = [info.columnCount * cfg.miniHeatWellDiameter, info.rowCount * cfg.miniHeatWellDiameter];
            this.updatePositions();
        }
        PlateMiniHeatmap.prototype.paint = function (context) {
            var state = this.state;
            var cfg = state.configuration;
            context.save();
            context.translate(this.topLeft);
            context.drawImage(this.shareImg);
            context.transitioning = false;
            // Plate highlight outline.
            if (state.focused().plate === this.plateNumber) {
                context.strokeStyle(cfg.baseSelected);
                context.lineWidth(1);
                context.strokeRect(-.5, -.5, this.dimensions[0] + 1, this.dimensions[1] + 1);
                // Well highlight dot.
                var well = state.focused().well;
                if (well) {
                    context.fillStyle(cfg.baseSelected);
                    context.fillRect(well.column * cfg.miniHeatWellDiameter, well.row * cfg.miniHeatWellDiameter, cfg.miniHeatWellDiameter, cfg.miniHeatWellDiameter);
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
        PlateMiniHeatmap.plateShareImage = function (model, clusterObject, plate) {
            var tag = "cimg_" + clusterObject + "_" + plate;
            var wellClusterShares = model.wellClusterShares.value;
            var plateShareImage = wellClusterShares[tag];
            if (!plateShareImage) {
                var cfg = model.configuration;
                var datInfo = model.dataSetInfo.value;
                var clusterShares = wellClusterShares.wellIndex[clusterObject] || [];
                var plateShares = clusterShares[plate] || [];
                var imgWidth = datInfo.columnCount * cfg.miniHeatWellDiameter;
                var imgHeight = datInfo.rowCount * cfg.miniHeatWellDiameter;
                plateShareImage = view.View.renderToCanvas(imgWidth, imgHeight, function (ctx) {
                    for (var c = 0; c < datInfo.columnCount; c++) {
                        var cVals = plateShares[c] || [];
                        var cX = c * cfg.miniHeatWellDiameter;
                        for (var r = 0; r < datInfo.rowCount; r++) {
                            var val = cVals[r]; // || 0;
                            var cY = r * cfg.miniHeatWellDiameter;
                            ctx.fillStyle = BaseConfiguration.shareColorMap(val).toString();
                            ctx.fillRect(cX, cY, 2, 2);
                        }
                    }
                });
                wellClusterShares[tag] = plateShareImage;
            }
            return plateShareImage;
        };
        PlateMiniHeatmap.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            interaction.selectedCoordinates.plate = this.plateNumber;
            interaction.selectedCoordinates.well = PlateMiniHeatmap.wellCoordinatesAt(coordinates, enriched);
        };
        PlateMiniHeatmap.prototype.mouseMove = function (event, coordinates, enriched, interaction) {
            interaction.hoveredCoordinates.plate = this.plateNumber;
            interaction.hoveredCoordinates.well = PlateMiniHeatmap.wellCoordinatesAt(coordinates, enriched);
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
            var baseStyle = new LabelStyle(cfg.sideFont, cfg.baseDim, 'left', 'top');
            var selectedStyle = new LabelStyle(cfg.sideFont, cfg.baseEmphasis, 'left', 'top');
            var buttonSnippets = _.pairs(targetMap).map(function (p, pI) {
                var label = p[0];
                var value = p[1];
                var style = cfg[targetField] === value || (!cfg[targetField] && pI === 0) ? selectedStyle : baseStyle; // Default to first option.
                return new ConfigurationButton(identifier + "_" + value, label, topLeft, targetField, value, style);
            });
            this.buttons = new List(identifier + "_lst", buttonSnippets, topLeft, [0, 0], 'horizontal', 5, 'top');
            this.setDimensions(this.buttons.dimensions);
        }
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
                var connectorVector = Vector.normalize(Vector.subtract(this.position, this.circleCenter));
                var connectorEdge = Vector.add(this.circleCenter, Vector.mul(connectorVector, this.circleRadius));
                var connectorOuter = Vector.add(connectorEdge, Vector.mul(connectorVector, 2 * this.circleRadius));
                context.strokeStyle(cfg.backgroundColor);
                context.lineWidth(3.5);
                context.strokeEllipse(this.circleCenter[0], this.circleCenter[1], this.circleRadius, this.circleRadius);
                context.strokeLine(connectorEdge, connectorOuter);
                context.strokeStyle(cfg.guideStyle.color);
                context.lineWidth(1.5);
                context.strokeEllipse(this.circleCenter[0], this.circleCenter[1], this.circleRadius, this.circleRadius);
                context.strokeLine(connectorEdge, connectorOuter);
                context.restore();
            }
        };
        return GuideLabel;
    })(Label);
});
//# sourceMappingURL=overview.js.map