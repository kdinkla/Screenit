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
    var BaseConfiguration = config.BaseConfiguration;
    var Vector = math.Vector;
    var Color = style.Color;
    // View identifiers and their constructors.
    var viewConstructors = function () {
        return {
            'features': FeatureHistogramTable,
            'splom': Splom,
            'exemplars': ExemplarTable,
            'plates': PlateIndex,
            'plate': JointWellPlates,
            'well': WellDetailView
        };
    };
    var OverView = (function (_super) {
        __extends(OverView, _super);
        function OverView() {
            _super.call(this, "overView");
        }
        OverView.prototype.updateScene = function (state) {
            var cfg = state.configuration;
            //this.background = new ActiveBackground(cfg.backgroundColor);
            var rootTopLeft = [cfg.windowMargin, cfg.windowMargin];
            // All panel constructors.
            var constructors = viewConstructors();
            // Active panels.
            var panels = state.openViews.elements.map(function (ov) { return new ColumnPanel(ov, new constructors[ov](state), state, true); });
            // All panel options.
            var closedPanels = _.difference(model.viewCycle, state.openViews.elements).map(function (ov) { return new ColumnPanel(ov, new constructors[ov](state), state, false); });
            var closedList = new List("pnlClsCols", closedPanels, [0, 0], [0, 0], 'vertical', cfg.panelSpace, 'right');
            this.panelColumns = new List("pnlCols", _.union([closedList], panels), rootTopLeft, [0, 0], 'horizontal', cfg.panelSpace, 'left');
            //console.log("Model:");
            //console.log(mod);
        };
        OverView.prototype.paint = function (c, iMod) {
            var cfg = iMod.configuration;
            var dim = this.dimensions();
            c.context.clearRect(0, 0, dim[0], dim[1]);
            //c.snippet(new ActiveBackground(cfg.backgroundColor));
            // Center panels.
            var topLeft = Vector.mul(Vector.subtract(this.dimensions(), this.panelColumns.dimensions), .5);
            //this.panelColumns.setTopLeft(topLeft);
            this.panelColumns.setTopLeft([
                Math.min(.5 * (this.dimensions()[0] - this.panelColumns.dimensions[0]), this.dimensions()[0] - this.panelColumns.dimensions[0] - cfg.windowMargin),
                topLeft[1]
            ]);
            c.snippet(this.panelColumns);
            // Show data loading text.
            var isLoading = _.keys(iMod).filter(function (prp) { return 'converged' in iMod[prp]; }).some(function (prp) { return !iMod[prp].converged; });
            var secondsMod = Math.round(Date.now() / 1000) % 3;
            c.save();
            c.fillStyle(isLoading ? cfg.baseEmphasis : Color.NONE);
            c.strokeStyle(isLoading ? cfg.backgroundColor : Color.NONE);
            c.lineWidth(3);
            c.font(cfg.bigGuideStyle.font.toString());
            c.textBaseline('bottom');
            c.textAlign('left');
            var compTxt = 'Computing' + (secondsMod === 1 ? '.' : secondsMod === 2 ? '..' : '...');
            c.translate([.5 * this.dimensions()[0] - 20, this.dimensions()[1] - cfg.windowMargin]);
            c.strokeText(compTxt);
            c.fillText(compTxt);
            c.restore();
        };
        return OverView;
    })(View);
    exports.OverView = OverView;
    /*class ActiveBackground extends Background {
        constructor(color: Color) {
            super(color);
        }
    
        paint(context: ViewContext) {
            context.transitioning = false;
            context.picking = true;
            super.paint(context);
            context.picking = false;
        }
    
        mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
            interaction.hoveredCoordinates.population = null;
    
            interaction.selectedCoordinates.object = null;
            //interaction.selectedCoordinates.well = null;
            //interaction.selectedCoordinates.plate = null;
        }
    
        mouseMove(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
            interaction.hoveredCoordinates.object = null;
            interaction.hoveredCoordinates.well = null;
            interaction.hoveredCoordinates.plate = null;
        }
    }*/
    var ColumnPanel = (function (_super) {
        __extends(ColumnPanel, _super);
        function ColumnPanel(identifier, core, state, opened) {
            if (opened === void 0) { opened = false; }
            _super.call(this, "cp_" + identifier, _.union([new ColumnLabel(identifier, core.toString(), state)], opened ? [core] : []), [0, 0], [0, 0], 'vertical', state.configuration.panelSpace, 'middle');
            this.core = core;
            this.state = state;
            this.opened = opened;
        }
        return ColumnPanel;
    })(List);
    var ColumnLabel = (function (_super) {
        __extends(ColumnLabel, _super);
        function ColumnLabel(viewIdentifier, text, state) {
            _super.call(this, "clLbl_" + viewIdentifier, text, [0, 0], state.configuration.panelHeaderLabel, true);
            this.viewIdentifier = viewIdentifier;
        }
        ColumnLabel.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            interaction.pushView(this.viewIdentifier);
        };
        return ColumnLabel;
    })(Label);
    var FeatureHistogramTable = (function (_super) {
        __extends(FeatureHistogramTable, _super);
        function FeatureHistogramTable(state) {
            _super.call(this, "ftrCols", [
                new FeatureList("ftrLbls", state, FeatureLabel, 'right'),
                new FeatureList("ftrHistos", state, FeatureHistogram),
                new FeatureParallelCoordinates(state)
            ], [0, 0], [0, 0], 'horizontal', state.configuration.featureCellSpace[0]);
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
            interaction.pushView('splom');
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
            var focusedPopulation = state.focused().population;
            var histograms = state.featureHistograms.value;
            var frames = state.featureHistograms.value.histograms;
            var cacheTag = this.identifier + "_" + focusedPopulation;
            var cachedImage = histograms[cacheTag];
            if (!cachedImage) {
                cachedImage = View.renderToCanvas(this.dimensions[0], this.dimensions[1], function (plainContext) {
                    _.keys(frames).map(function (fK, fI) {
                        var frame = frames[fK];
                        var normFrequencies = frame.matrix[frame.columnIndex[_this.feature]];
                        var fontColor = fK === '-1' ? cfg.baseDim : _this.state.populationColorTranslucent(_this.state.populationSpace.populations.byId(fK));
                        plainContext.fillStyle = fontColor.toString();
                        //plainContext.beginPath();
                        var len = normFrequencies.length - 1;
                        var spanWidth = _this.dimensions[0] - 1;
                        var spanHeight = _this.dimensions[1] - 1;
                        for (var i = 0; i <= len; i++) {
                            var x1 = i * spanWidth / len;
                            var f1 = normFrequencies[i];
                            var y1 = (1 - f1) * spanHeight;
                            plainContext.fillRect(x1, y1, 1, 1);
                        }
                        //plainContext.stroke();
                    });
                });
                histograms[cacheTag] = cachedImage;
            }
            context.save();
            context.translate(this.topLeft);
            context.drawImage(cachedImage);
            context.restore();
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
            this.plots = features.map(function (f1, i1) { return features.map(function (f2, i2) { return i1 < i2 ? new ObjectFeaturePlot(f1, f2, [0, 0], model, cfg, cfg.splomInnerSize, i2 === features.length - 1, i1 === 0) : null; }); });
            var size = cfg.sideFont.size + Math.max(0, this.model.populationSpace.features.length - 1) * cfg.splomSize;
            this.setDimensions([Math.max(size, cfg.splomSize + cfg.splomInnerSize), size]);
        }
        Splom.prototype.setTopLeft = function (topLeft) {
            _super.prototype.setTopLeft.call(this, topLeft);
            if (this.plots) {
                var configuration = this.model.configuration;
                var marginTopLeft = Vector.add(this.topLeft, [configuration.sideFont.size, 0]);
                this.plots.forEach(function (pC, pCI) { return pC.forEach(function (p, pRI) {
                    if (p)
                        p.topLeft = Vector.add(marginTopLeft, [pCI * configuration.splomSize, (pRI - 1) * configuration.splomSize]);
                }); });
            }
        };
        Splom.prototype.paint = function (context) {
            this.plots.map(function (plts) { return context.snippets(plts); });
        };
        Splom.prototype.toString = function () {
            return "Space";
        };
        return Splom;
    })(PlacedSnippet);
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
            // Cache for changing histograms and hovered population.
            var cachedBackgrounds = model.objectHistograms.value[this.identifier] || {};
            var focusPopulation = (model.focused().population || -1).toString();
            this.cachedBackground = cachedBackgrounds[focusPopulation]; //model.objectInfo.value[this.identifier];
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
            var histograms = mod.objectHistograms.value.matricesFor(this.feature1, this.feature2);
            var pairHistos = _.pairs(histograms);
            if (pairHistos) {
                context.save();
                var focusedPopulation = mod.focused().population;
                pairHistos.forEach(function (hP) {
                    var cK = hP[0];
                    var matrix = hP[1];
                    var population = mod.populationSpace.populations.byId(cK);
                    var focused = !(Number(cK) >= 0) || focusedPopulation === Number(cK);
                    var coreColor = Number(cK) >= 0 ? mod.populationColorTranslucent(population) : cfg.base;
                    matrix.forEach(function (c, xI) { return c.forEach(function (cell, yI) {
                        if ((focused && cell) || (!focused && (cell === 2 || cell === 3))) {
                            context.fillStyle = coreColor; //coreColor.alpha(1 - 0.5 / cell);
                            context.fillRect(xI, size - yI, 1, 1);
                        }
                    }); });
                });
                context.restore();
            }
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
            // Background rectangle.
            context.strokeStyle(cfg.baseVeryDim);
            context.strokeRect(0, 0, size, size);
            context.drawImageScaled(this.cachedBackground, [0, 0], [this.size, this.size]);
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
                ObjectFeaturePlot.drawBigDot(context, cfg, _this.model.populationColor(pop), x[oI] * size, (1 - y[oI]) * size);
            }); });
            // Color dot for hovered object.
            var focusedObject = mod.focused().object;
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
        ObjectFeaturePlot.drawBigDot = function (context, cfg, color, x, y) {
            var rO = cfg.splomRepresentativeOuterDotRadius;
            var rI = cfg.splomRepresentativeInnerDotRadius;
            //var rM = 0.5 * (rO + rI);
            context.fillStyle(cfg.backgroundColor);
            context.fillEllipse(x, y, rO, rO);
            //context.fillStyle(style.Color.BLACK);
            //context.fillEllipse(x, y, rM, rM);
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
        return ObjectFeaturePlot;
    })(BaseSnippet);
    var ExemplarTable = (function (_super) {
        __extends(ExemplarTable, _super);
        function ExemplarTable(state) {
            _super.call(this, "ExemplarStack", [0, 0]);
            this.state = state;
            var cfg = state.configuration;
            var colSnippets = this.state.populationSpace.populations.elements.map(function (p) { return new ExemplarColumn(state, p); });
            var columns = new List("ExemplarColumns", colSnippets, [0, 0], [0, 0], 'horizontal', cfg.clusterTileSpace, 'left');
            var exemplarSelected = state.focused().object !== null && !state.hoveredObjectIsExemplar();
            var additionButtons = exemplarSelected ? new List("ExemplarAdditionButton", this.state.populationSpace.populations.elements.map(function (p) { return new ExemplarAdditionButton(state.focused().object, p, state); }), [0, 0], [0, 0], 'horizontal', cfg.clusterTileSpace, 'left') : null;
            var selectedObjectDetailView = exemplarSelected ? new ObjectDetailView(state.focused().object, state, [0, 0]) : null;
            var segSnippets = _.compact([columns, additionButtons, selectedObjectDetailView]);
            this.segments = new List("ExemplarSegments", segSnippets, [0, 0], [0, 0], 'vertical', cfg.panelSpace);
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
            context.font(this.labelStyle.font.toString());
            context.fillText('+');
            context.restore();
        };
        ExemplarAdditionButton.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            interaction.populationSpace.addExemplar(this.object, this.population.identifier);
            //var population = interaction.populationSpace.populations.byId(this.population.identifier);
            //population.exemplars = population.exemplars.push(this.object);
        };
        return ExemplarAdditionButton;
    })(PlacedSnippet);
    var ExemplarColumn = (function (_super) {
        __extends(ExemplarColumn, _super);
        function ExemplarColumn(state, population, topLeft) {
            if (topLeft === void 0) { topLeft = [0, 0]; }
            _super.call(this, "esc_" + population.identifier, _.union([new ExemplarLabel(population, state)], population.exemplars.elements.map(function (ex) { return new ObjectDetailView(ex, state, [0, 0]); })), topLeft, [state.configuration.clusterTileInnerSize, 0], 'vertical', state.configuration.exemplarSpace, 'middle');
            this.state = state;
            this.population = population;
            this.topLeft = topLeft;
        }
        ExemplarColumn.prototype.paint = function (context) {
            var state = this.state;
            var cfg = state.configuration;
            context.save();
            context.translate(this.topLeft);
            /*var verticalFocusShift = state.hoveredCoordinates.population === this.population.identifier ?
                    cfg.sideFont.size :
                    0;*/
            //var tabHeight = verticalFocusShift;// + 1.5 * cfg.sideFont.size;
            // Pickable background.
            //context.picking = true;
            //context.fillStyle(Color.NONE);
            //context.fillRect(0, 0, this.dimensions[0], this.dimensions[1] - state.configuration.clusterLabel.font.size /* + tabHeight +*/);
            //context.picking = false;
            // Colored tab.
            //context.fillStyle(state.populationColor(this.population));  //this.population.colorTrans);
            //context.fillRect(0, 0, this.dimensions[0], this.dimensions[1] - state.configuration.clusterLabel.font.size); // + tabHeight);
            // Label.
            /*context.font(cfg.sideFont.string);
            context.textBaseline('top');
            context.textAlign('center');
            context.fillStyle(cfg.base);
            context.fillText(this.population.name, .5 * this.dimensions[0], this.dimensions[1] + verticalFocusShift);*/
            context.restore();
            _super.prototype.paint.call(this, context);
        };
        return ExemplarColumn;
    })(List);
    var ExemplarLabel = (function (_super) {
        __extends(ExemplarLabel, _super);
        function ExemplarLabel(population, state) {
            _super.call(this, "lbl_" + population.identifier, population.name, [0, 0], state.focused().population === population.identifier ? state.configuration.clusterSelectedLabel : state.configuration.clusterLabel, true);
            this.population = population;
            this.state = state;
            this.setDimensions([state.configuration.clusterTileInnerSize, this.dimensions[1]]);
        }
        ExemplarLabel.prototype.paint = function (context) {
            var state = this.state;
            context.save();
            context.translate(this.topLeft);
            context.picking = true;
            context.fillStyle(state.populationColor(this.population));
            context.fillRect(0, 0, state.configuration.clusterTileInnerSize, this.dimensions[1]);
            context.restore();
        };
        ExemplarLabel.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            interaction.selectedCoordinates.population = this.population.identifier;
            //interaction.hoveredCoordinates.population = this.population.identifier;
            //interaction.pushView('plates');
        };
        return ExemplarLabel;
    })(Label);
    var AbstractPlate = (function (_super) {
        __extends(AbstractPlate, _super);
        function AbstractPlate(id, topLeft, state, columnLabels, rowLabels) {
            if (columnLabels === void 0) { columnLabels = true; }
            if (rowLabels === void 0) { rowLabels = true; }
            _super.call(this, id, topLeft);
            this.state = state;
            this.columnLabels = columnLabels;
            this.rowLabels = rowLabels;
            var cfg = state.configuration;
            var gf = new jsts.geom.GeometryFactory();
            this.selectionOutlines = state.allWellSelections().map(function (ws) {
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
            var info = state.dataSetInfo.value;
            this.setDimensions([info.columnCount * cfg.wellDiameter + cfg.plateColLabelMargin + cfg.sideFont.width("000"), info.rowCount * cfg.wellDiameter + cfg.plateRowLabelMargin + cfg.sideFont.size + 4]);
        }
        AbstractPlate.prototype.paint = function (context) {
            var cfg = this.state.configuration;
            var info = this.state.dataSetInfo.value;
            context.save();
            context.translate(this.topLeft);
            context.transitioning = false;
            //this.paintSelectionBody(ctx);
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
        AbstractPlate.prototype.paintWellLabels = function (ctx) {
            var cfg = this.state.configuration;
            var info = this.state.dataSetInfo.value;
            var lblY = info.rowCount * cfg.wellDiameter + cfg.plateColLabelMargin;
            var lblX = info.columnCount * cfg.wellDiameter + cfg.plateRowLabelMargin;
            ctx.save();
            ctx.font(cfg.sideFont.string);
            ctx.fillStyle(cfg.base);
            // Column labels at the top.
            if (this.columnLabels) {
                ctx.textAlign('center');
                ctx.textBaseline('top');
                info.columnLabels.forEach(function (c, i) { return ctx.fillText(c, (i + .5) * cfg.wellDiameter, lblY); });
            }
            // Row labels at the right.
            if (this.rowLabels) {
                ctx.textAlign('left');
                ctx.textBaseline('middle');
                info.rowLabels.forEach(function (r, j) { return ctx.fillText(r, lblX, (j + .5) * cfg.wellDiameter); });
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
                ctx.lineWidth(3.5);
                ctx.beginPath();
                TemplatePlate.geometryToPath(ctx, so);
                ctx.stroke();
                ctx.strokeStyle(_this.state.allWellSelections()[i].id === "Selected" ? cfg.baseSelected : cfg.base);
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
        AbstractPlate.trunc = function (bC, eC) {
            var bV = [bC.x, bC.y];
            var eV = [eC.x, eC.y];
            return Vector.add(bV, Vector.mul(Vector.normalize(Vector.subtract(eV, bV)), TemplatePlate.arcRad));
        };
        AbstractPlate.ringToPath = function (context, ring) {
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
        AbstractPlate.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            var plate = this.state.focused().plate;
            if (plate !== null) {
                interaction.selectedCoordinates.plate = plate;
                interaction.selectedCoordinates.well = PlateMiniHeatmap.wellCoordinatesAt(coordinates, enriched);
                interaction.pushView('well');
            }
        };
        /*static ringToPath(context: ViewContext, ring: jsts.geom.LineString) {
            var cs = ring.getCoordinates();
            context.moveTo(cs[0].x, cs[0].y);
            for (var i = 1; i < cs.length; i++) context.lineTo(cs[i].x, cs[i].y);
            context.closePath();
        }*/
        AbstractPlate.arcRad = 2;
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
        return TemplatePlate;
    })(AbstractPlate);
    var FlowerPlate = (function (_super) {
        __extends(FlowerPlate, _super);
        function FlowerPlate(topLeft, state) {
            _super.call(this, "flwPlt", topLeft, state, false);
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
            var cfg = this.state.configuration;
            var info = this.state.dataSetInfo.value;
            ctx.save();
            for (var c = 0; c < info.columnCount; c++)
                for (var r = 0; r < info.rowCount; r++)
                    this.paintPopulationFlower(ctx, c, r);
            ctx.restore();
        };
        // Population abundance flower.
        FlowerPlate.prototype.paintPopulationFlower = function (ctx, column, row) {
            var _this = this;
            var cfg = this.state.configuration;
            var selection = this.state.focused();
            var x = (column + .5) * cfg.wellDiameter;
            var y = (row + .5) * cfg.wellDiameter;
            // Fetch total cellCount.
            var wellClusterShares = this.state.wellClusterShares.value;
            var totalPopulation = wellClusterShares.wellIndex[Population.POPULATION_TOTAL_NAME] || [];
            var totalWellShares = totalPopulation[selection.plate] || [];
            var totalColumnShares = totalWellShares[column] || [];
            var cellCount = totalColumnShares[row];
            var maxObjectCount = wellClusterShares.maxObjectCount;
            var normObjectCellCount = Math.sqrt(maxObjectCount);
            // Draw flower slice
            var populations = this.state.populationSpace.populations.elements;
            populations.forEach(function (p, pI) {
                var clusterShares = _this.state.wellClusterShares.value.wellIndex[p.identifier] || [];
                var wellShares = clusterShares[selection.plate] || [];
                var columnShares = wellShares[column] || [];
                var share = columnShares[row];
                ctx.fillStyle(_this.state.populationColor(p));
                ctx.strokeStyle(cfg.backgroundColor);
                ctx.lineWidth(.25);
                if (share >= 0 && cellCount >= 0) {
                    var beginRad = 0.25 * Math.PI + 2 * Math.PI * pI / populations.length;
                    var endRad = 0.25 * Math.PI + 2 * Math.PI * (pI + 1) / populations.length;
                    var normWellCount = Math.sqrt(share * cellCount) / normObjectCellCount;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.arc(x, y, normWellCount * cfg.wellRadius, beginRad, endRad);
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
            _super.call(this, "jntPlt", [new TemplatePlate([0, 0], state), new FlowerPlate([0, 0], state)]);
            this.state = state;
        }
        JointWellPlates.prototype.toString = function () {
            var focusedPlate = this.state.focused().plate;
            return "Plate " + this.state.dataSetInfo.value.plateLabels[focusedPlate];
        };
        return JointWellPlates;
    })(List);
    var WellDetailView = (function (_super) {
        __extends(WellDetailView, _super);
        function WellDetailView(state) {
            _super.call(this, "WellDetailView", []);
            this.state = state;
            var cfg = state.configuration;
            this.setDimensions([cfg.wellViewMaxWidth, cfg.wellViewMaxWidth]); //(cfg.wellViewMaxDim);
            var availableTypes = _.keys(state.availableImageTypes());
            var wellOptions = {};
            availableTypes.forEach(function (t) { return wellOptions[t] = t; });
            this.imageTypeOption = new ConfigurationOptions("WellDetailOptions", [0, 0], state, "imageType", wellOptions);
            if (state.focused().object === null) {
                this.guide = new GuideLabel("well", "Hover over a cell to inspect it.", [0, 0], [0, -75], 20, state);
            }
        }
        WellDetailView.prototype.setTopLeft = function (topLeft) {
            _super.prototype.setTopLeft.call(this, topLeft);
            if (this.imageTypeOption)
                this.imageTypeOption.setTopLeft(this.bottomLeft);
            if (this.guide)
                this.guide.setTopLeft(Vector.add(this.bottomRight, [-200, 25]));
        };
        WellDetailView.prototype.paint = function (ctx) {
            var state = this.state;
            var cfg = state.configuration;
            //ctx.transitioning = false;
            ctx.save();
            ctx.translate(this.topLeft);
            var well = state.selectionWell(state.focused());
            if (well) {
                var img = well.image(cfg.imageType);
                if (img) {
                    ctx.transitioning = false;
                    var wellScale = Math.min(1, cfg.wellViewMaxWidth / img.width); //Math.min(cfg.wellViewMaxDim[0] / img.width, 2 * cfg.wellViewMaxDim[1] / img.height);
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
                    ctx.transitioning = true;
                }
            }
            ctx.restore();
            //ctx.transitioning = true;
            // Well type button.
            ctx.snippet(this.imageTypeOption);
            ctx.snippet(this.guide);
        };
        WellDetailView.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            var object = enriched.closestWellObject(coordinates);
            interaction.selectedCoordinates.object = object;
            enriched.conformSelectedCoordinates(interaction);
            // Toggle given exemplar for the focused population.
            // If no population is focused, create a new population for the exemplar, and focus the population.
            /*var popSpace = interaction.populationSpace;
            var population = popSpace.populations.byId(interaction.hoveredCoordinates.population);
    
            // Create and focus a new population if one is lacking.
            if(!population) {
                population = popSpace.createPopulation();
                interaction.hoveredCoordinates.population = population.identifier;
            }
    
            population.exemplars = population.exemplars.toggle(object);*/
            //interaction.pushView('exemplars');
            //interaction.pushView('features');
        };
        /*mouseMove(event: ViewMouseEvent, coordinates: number[],
                  enriched: EnrichedState, interaction: InteractionState) {
            interaction.hoveredCoordinates.object = enriched.closestWellObject(coordinates);
            enriched.conformHoveredCoordinates(interaction);
        }*/
        WellDetailView.prototype.toString = function () {
            var info = this.state.dataSetInfo.value;
            var focusedWell = this.state.focused().well;
            return "Well " + info.columnLabels[focusedWell.column] + info.rowLabels[focusedWell.row];
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
            interaction.selectedCoordinates.object = this.object;
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
            //var datInfo = state.dataSetInfo.value;
            //var heatMaps = _.range(0, datInfo.plateCount).map(pI => );
            /*var colCapacity = Math.ceil(datInfo.plateCount / cfg.miniHeatColumnCount);
            var colMaps = _.range(0, cfg.miniHeatColumnCount).map(cI =>
                _.compact(_.range(0, colCapacity).map(rI => heatMaps[cI * colCapacity + rI])));*/
            var colMaps = state.platePartition().map(function (pR) { return pR.map(function (pI) { return new PlateMiniHeatmap(pI, state); }); });
            this.heatmapColumns = new List("pics", colMaps.map(function (c, cI) { return new List("pic_" + cI, c, [0, 0], [0, 0], 'vertical', cfg.miniHeatSpace); }), [0, 0], [0, 0], 'horizontal', 2 * cfg.miniHeatSpace, 'left');
            this.dimensions = this.heatmapColumns.dimensions;
            this.updatePositions();
            if (state.focused().plate === null) {
                this.guide = new GuideLabel("plate", "Hover over a plate to inspect it and click to select it.", [0, 0], [-20, 0], 5, state);
            }
        }
        PlateIndex.prototype.setTopLeft = function (topLeft) {
            _super.prototype.setTopLeft.call(this, topLeft);
            if (this.heatmapColumns)
                this.heatmapColumns.setTopLeft(topLeft);
            if (this.guide)
                this.guide.setTopLeft(Vector.add(this.topRight, [10, 60]));
        };
        PlateIndex.prototype.paint = function (context) {
            var state = this.state;
            var cfg = state.configuration;
            var focusedPopulation = state.focused().population;
            // Header.
            /*context.save();
            context.translate(this.topLeft);
            context.translate([0.5 * this.dimensions[0], 0]);
            panelHeader(context, cfg, focusedPopulation === null ?
                "Cell Counts" :
                "Cell Ratio of " + state.populationSpace.populations.byId(focusedPopulation).name,
                focusedPopulation === null ? null : state.populationSpace.populations.byId(focusedPopulation).color);
            context.restore();*/
            // Heat maps.
            context.snippet(this.heatmapColumns);
            context.snippet(this.guide);
        };
        PlateIndex.prototype.toString = function () {
            return "Plates";
        };
        return PlateIndex;
    })(PlacedSnippet);
    var PlateMiniHeatmap = (function (_super) {
        __extends(PlateMiniHeatmap, _super);
        function PlateMiniHeatmap(plateNumber, state) {
            _super.call(this, "mh_" + plateNumber, [0, 0]);
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
            //interaction.selectedCoordinates.well = PlateMiniHeatmap.wellCoordinatesAt(coordinates, enriched);
            interaction.pushView('plate');
        };
        /*mouseMove(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
            interaction.hoveredCoordinates.plate = this.plateNumber;
            //interaction.hoveredCoordinates.well = PlateMiniHeatmap.wellCoordinatesAt(coordinates, enriched);
        }*/
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