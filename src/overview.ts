/// <reference path="references.d.ts"/>

import jsts = require('jsts');

import model = require('./model');
import InteractionState = model.InteractionState;
import EnrichedState = model.EnrichedState;
import Clusters = model.Clusters;
import SelectionCoordinates = model.SelectionCoordinates;
import PopulationSpace = model.PopulationSpace;
import Population = model.Population;
import WellSelection = model.WellSelection;
import WellCoordinates = model.WellCoordinates;

import view = require('./core/graphics/view');
import View = view.View;
import ViewContext = view.ViewContext;
import Snippet = view.Snippet;
import ViewMouseEvent = view.ViewMouseEvent;

import snippet = require('./core/graphics/snippet');

import BaseSnippet = snippet.BaseSnippet;
import PlacedSnippet = snippet.PlacedSnippet;
import List = snippet.List;
import Background = snippet.Background;
import Rectangle = snippet.Rectangle;
import Label = snippet.Label;
import LabelStyle = snippet.LabelStyle;

import config = require('./configuration');
import BaseConfiguration = config.BaseConfiguration;
import NumberTableConfiguration = config.NumberTableConfiguration;

import math = require('./core/math');
import Vector = math.Vector;

import dataframe = require('./core/dataframe');
import DataFrame = dataframe.DataFrame;
import NumberFrame = dataframe.NumberFrame;

import style = require('./core/graphics/style');
import Color = style.Color;
import Font = style.Font;

export class OverView extends View<EnrichedState> {
    background: ActiveBackground;

    featureList: FeatureHistogramTable;
    splom: Splom;
    objectScatter: ObjectFeaturePlot;
    plateIndex: PlateIndex;
    templatePlate: Plate;
    wellDetailView: WellDetailView;
    hoveredObjectDetailView: ObjectDetailView;

    exemplarTable: ExemplarTable;

    constructor() {
        super("overView");
    }

    updateScene(mod: EnrichedState) {
        var cfg = mod.configuration;

        this.background = new ActiveBackground(cfg.backgroundColor);

        var rootTopLeft = [cfg.windowMargin, cfg.windowMargin + cfg.panelHeaderSpace + cfg.panelHeaderFont.size];  // + 2 * cfg.font.size];

        var ftrListTopLeft = rootTopLeft;
        this.featureList = new FeatureHistogramTable("ftrTable", ftrListTopLeft, mod);

        // Scatter plots.
        var splomScatterTopLeft = Vector.add(rootTopLeft, [this.featureList.dimensions[0] + cfg.panelSpace + 2 * cfg.splomSpace, 0]);
        this.splom = new Splom(splomScatterTopLeft, mod, cfg);
        var splomScatterTopRight = Vector.add(splomScatterTopLeft, [this.splom.dimensions()[0], 0]);

        var objScatterTopLeft = Vector.add(splomScatterTopRight, [-2 * cfg.splomSize, 2 * cfg.splomSize]);
        objScatterTopLeft = Vector.max(objScatterTopLeft, splomScatterTopLeft);

        this.objectScatter = new ObjectFeaturePlot(
            "mds2", "mds1",
            objScatterTopLeft, mod,
            cfg, cfg.scatterPlotSize, false,
            false, false, "Landscape of All Features");
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
        } else {
            var plateTopLeft = Vector.add(this.plateIndex.topRight, [cfg.panelSpace, 0]);
            this.templatePlate = new TemplatePlate(plateTopLeft, mod);
        }

        // Well detail view.
        if(mod.focused().well === null) {
            this.wellDetailView = null;
        } else {
            var wellDetailTopLeft = Vector.add(this.templatePlate.bottomLeft, [0, cfg.panelSpace]);  //[this.dimensions()[0] - cfg.wellViewMaxDim[0] - cfg.windowMargin, cfg.windowMargin];
            this.wellDetailView = new WellDetailView(wellDetailTopLeft, mod);
        }

        //console.log("Model:");
        //console.log(mod);
    }

    paint(c: ViewContext, iMod: EnrichedState) {
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
    }
}

class ActiveBackground extends Background {
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
}

function panelHeader(context: ViewContext, cfg: BaseConfiguration, text: string, color: Color = null) {
    context.save();
    context.translate([0, -cfg.panelHeaderSpace]);
    context.font(cfg.panelHeaderFont.toString());
    context.textAlign('center');
    context.fillStyle(color || cfg.panelHeaderColor);
    context.fillText(text);
    context.restore();
}

export class Splom extends BaseSnippet {
    plots: ObjectFeaturePlot[];

    private features: string[];

    constructor(public topLeft: number[],
                public model: EnrichedState,
                public configuration: BaseConfiguration) {
        super("splom");

        this.plots = [];
        var objectFeatures = model.objectInfo.value;
        this.features = model.populationSpace.features.elements;
        var colLen = this.features.length;
        for(var c1I = 0; c1I < colLen; c1I++) {
            var c1II = colLen - c1I - 1;
            var c1 = this.features[c1I];

            for(var c2I = 0; c2I < c1I; c2I++) {
                var c2II = colLen - c2I - 1;
                var c2 = this.features[c2I];

                if(c1 in objectFeatures.columnIndex && c2 in objectFeatures.columnIndex) {
                    this.plots.push(new ObjectFeaturePlot(
                        c1, c2,
                        Vector.add(this.topLeft, [c1II * configuration.splomSize, c2I * configuration.splomSize]),
                        model,
                        configuration,
                        configuration.splomInnerSize,
                        true,    // Cached!
                        c2I == 0,
                        c1II == 0
                    ));
                }
            }
        }
    }

    paint(context: ViewContext) {
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
    }

    // Total width and height.
    dimensions() {
        var cfg = this.model.configuration;
        var size = Math.max(0, this.model.populationSpace.features.length - 1) * this.configuration.splomSize;
        return [Math.max(size, cfg.splomSize + cfg.splomInnerSize), size];
    }
}

export class ObjectFeaturePlot extends BaseSnippet implements Snippet {
    private cachedBackground: any;  // Cache image.

    constructor(public feature1: string,
                public feature2: string,
                public topLeft: number[],
                public model: EnrichedState,
                public configuration: BaseConfiguration,
                public size: number,
                public cached: boolean = false,
                public columnLabel: boolean = false,
                public rowLabel: boolean = false,
                public footerLabel: string = null) {
        super("objPlt_" + feature1 + ".." + feature2);

        this.cached = true;

        // Cache heavy duty dot draw operations, optional.
        if(this.cached) {
            this.cachedBackground = model.objectInfo.value[this.identifier];  //model.objectInfo.value[this.identifier];
            if(!this.cachedBackground) {
                this.cachedBackground = view.View.renderToCanvas(size, size, c => this.paintDots(c));
                model.objectInfo.value[this.identifier] = this.cachedBackground;
            }
        }
    }

    paintDots(context: CanvasRenderingContext2D) {
        var mod = this.model;
        var cfg = this.configuration;
        var size = this.size;

        // Paint histograms, if available.
        /*var histograms = mod.objectHistograms.value.matricesByFeaturePair(this.feature1, this.feature2);
        if(_.keys(histograms).length > 0) {
            context.save();

            console.log("Start paint histogram of " + this.feature1 + " and " + this.feature2);
            var clusters = _.keys(histograms);
            clusters.forEach(cK => {
                var population = mod.populationSpace.populations.byId(cK);
                var matrix = histograms[cK];

                context.fillStyle = Number(cK) >= 0 ? population.color : cfg.base;
                matrix.forEach((c, xI) => c.forEach((cell, yI) => {
                    if(cell) context.fillRect(xI, yI, 1, 1);
                }));

                console.log("Paint histogram of: " + cK);
            });
            console.log("Finished paint histogram of " + this.feature1 + " and " + this.feature2);

            context.restore();
        } else {*/
            context.save();

            var objectFeatures = this.model.objectInfo.value;
            var x = objectFeatures.columnVector(this.feature1) || []; //objectFeatures.normalizedColumnVector(this.feature1) || [];
            var y = objectFeatures.columnVector(this.feature2) || []; //objectFeatures.normalizedColumnVector(this.feature2) || [];
            var cluster = objectFeatures.columnVector('population') || [];

            // Large colored dots for background.
            var r = cfg.splomClusterRadius;
            //var clstr = mod.clusters.value;
            for (var i = 0; i < x.length; i++) {
                //var objId = objectFeatures.rows[i];
                var pI = cluster[i];    //clstr.clusterMap[objId];
                var population = mod.populationSpace.populations.byId(pI);
                var color = population ? population.colorTrans : Color.NONE; //pI >= 0 ? cfg.clusterTransparentColors[clstr.identifierIndex[pI]] : Color.NONE;
                context.fillStyle = color.toString();
                this.paintOfflineDot(context, x[i] * size, (1 - y[i]) * size, r, r);
                //context.fillEllipse(x[i] * size, y[i] * size, r, r);
            }

            // Plain dots for density.
            r = cfg.splomDotRadius;
            context.fillStyle = cfg.splomDotDensityColor.toString();
            for (var i = 0; i < x.length; i++) {
                this.paintOfflineDot(context, x[i] * size, (1 - y[i]) * size, r, r);
                //context.fillEllipse(x[i] * size, y[i] * size, r, r);
            }

            context.restore();
        //}
    }

    private paintOfflineDot(context: CanvasRenderingContext2D, cx: number, cy: number, rw: number, rh: number) {
        context.beginPath();
        context['ellipse'](cx, cy, rw, rh, 0, 2 * Math.PI, false);
        context.fill();
    }

    paint(context: ViewContext) {
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

        context.transitioning = false;
        if(this.cached) {
            //context.context['imageSmoothingEnabled'] = false;
            context.drawImageScaled(this.cachedBackground, [0, 0], [this.size, this.size]);
            //context.context['imageSmoothingEnabled'] = true;
        } else {
            this.paintDots(context.context);
        }

        //context.transitioning = false;

        var objectFeatures = this.model.objectInfo.value;
        var x = objectFeatures.normalizedColumnVector(this.feature1) || [];
        var y = objectFeatures.normalizedColumnVector(this.feature2) || [];
        //var clstr = mod.clusters.value;

        // Large colored dots with halo for representatives.
        mod.populationSpace.populations.forEach(pop =>
            pop.exemplars.forEach(ex => {
                //var cI = clstr.clusterMap[pop.identifier];
                //var color = cI >= 0 ? cfg.clusterColors[clstr.identifierIndex[cI]] : Color.NONE;
                var oI = objectFeatures.rowIndex[ex];
                ObjectFeaturePlot.drawBigDot(context, cfg, pop.color, x[oI] * size, (1 - y[oI]) * size);
            })
        );

        // Color dot for hovered object.
        var focusedObject = mod.hoveredCoordinates.object;
        if(focusedObject !== null) {
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
    }

    static drawBigDot(context: ViewContext, cfg: BaseConfiguration, color: Color, x: number, y: number) {
        var rO = cfg.splomRepresentativeOuterDotRadius;
        var rI = cfg.splomRepresentativeInnerDotRadius;
        var rM = 0.5 * (rO + rI);

        context.fillStyle(cfg.backgroundColor);
        context.fillEllipse(x, y, rO, rO);

        context.fillStyle(style.Color.BLACK);
        context.fillEllipse(x, y, rM, rM);

        context.fillStyle(color);
        context.fillEllipse(x, y, rI, rI);
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        var invCs = [coordinates[0], 1 - coordinates[1]];
        var object = enriched.closestObject([this.feature1, this.feature2], invCs);

        // Toggle given exemplar for the focused population.
        // If no population is focused, create a new population for the exemplar, and focus the population.
        var popSpace = interaction.populationSpace;
        var population = popSpace.populations.byId(interaction.hoveredCoordinates.population);

        // Create and focus a new population if one is lacking.
        if(!population) {
            population = popSpace.createPopulation();
            interaction.hoveredCoordinates.population = population.identifier;
        }

        population.exemplars = population.exemplars.toggle(object);
    }

    mouseMove(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        var invCs = [coordinates[0], 1 - coordinates[1]];
        interaction.hoveredCoordinates.object = enriched.closestObject([this.feature1, this.feature2], invCs);
        enriched.conformHoveredCoordinates(interaction);
    }
}

export class ExemplarTable extends PlacedSnippet {
    columns: List<ExemplarColumn>;
    hoveredObjectDetailView: ObjectDetailView;

    constructor(topLeft: number[],
                public state: EnrichedState) {
        super("ExemplarStack", topLeft);

        var cfg = state.configuration;
        var colSnippets = this.state.populationSpace.populations.map(p => new ExemplarColumn(state, p));
        this.columns = new List("ExemplarColumns", colSnippets, topLeft, [0, 0], 'horizontal', cfg.clusterTileSpace, 'left');

        var hoveredObjectDetailsTopLeft = this.columns.dimensions[1] > 0 ?
            Vector.add(this.columns.bottomLeft, [0, cfg.splomSpace]) :
            this.columns.topLeft;
        if(state.hoveredCoordinates.object !== null && !state.hoveredObjectIsExemplar()) {
            this.hoveredObjectDetailView = new ObjectDetailView(
                state.hoveredCoordinates.object, state, hoveredObjectDetailsTopLeft);
        } else {
            this.hoveredObjectDetailView = null;
        }

        this.dimensions = Vector.max(this.columns.dimensions, [cfg.splomInnerSize, cfg.splomInnerSize]);
        this.updatePositions();
    }

    paint(context: ViewContext) {
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
    }
}

export class ExemplarColumn extends List<ObjectDetailView> {
    //exemplarDetails: List<ObjectDetailView>;

    constructor(public state: EnrichedState,
                public population: Population,
                public topLeft = [0, 0]) {
        super(
            "esc" + population.identifier,
            population.exemplars.map(ex => new ObjectDetailView(ex, state)),    //, state.configuration.clusterTileSize)),
            topLeft,
            [state.configuration.clusterTileInnerSize, 0],
            'vertical',
            state.configuration.clusterTileSpace,
            'middle'
        );
        //super("esc_" + population.identifier, );

        //var cfg = state.configuration;

        //var exemplarTiles = population.exemplars.map(ex => new ObjectDetailView(ex, state, cfg.clusterTileSize));
        //this.exemplarDetails = new List("exlst_" + population.identifier, exemplarTiles, topLeft, 'vertical', cfg.clusterTileSpace);

        //this.dimensions = this.exemplarDetails.dimensions;  // Guarantee width.
        //this.updatePositions();
    }

    paint(context: ViewContext) {
        var state = this.state;
        var cfg = state.configuration;

        context.save();
        context.translate(this.topLeft);

        // Top header.
        context.save();

        var verticalFocusShift = state.hoveredCoordinates.population === this.population.identifier ?
            0.5 * cfg.sideFont.size :
            0;

        var tabHeight = verticalFocusShift + 1.5 * cfg.sideFont.size;

        // Pickable background.
        context.picking = true;
        context.fillStyle(Color.NONE);
        context.fillRect(0, -tabHeight, this.dimensions[0], this.dimensions[1] + tabHeight + cfg.splomSpace);
        context.picking = false;

        // Colored tab.
        context.fillStyle(this.population.colorTrans);
        context.fillRect(0, -tabHeight, this.dimensions[0], this.dimensions[1] + tabHeight);   //tabHeight);

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

        super.paint(context);
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        interaction.hoveredCoordinates.population = this.population.identifier;
    }

    mouseMove(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        interaction.hoveredCoordinates.population = this.population.identifier;
    }
}

class NumberTable extends BaseSnippet {
    columnHeader: Label[];
    rowIndex: Label[];
    bars: Rectangle[];

    constructor(identifier: string,
                public topLeft: number[],
                public frame: NumberFrame,
                public configuration: NumberTableConfiguration) {
        super(identifier);

        var accTopLeft = topLeft;
        if(configuration.visibleIndex) {
            //accTopLeft = Vector.add(accTopLeft, [configuration.cellOuterDimensions[0], 0]);
        }

        if(configuration.visibleHeader) {
            var headerStyle = new LabelStyle(configuration.font, configuration.fontColor, 'middle', 'middle');
            this.columnHeader = frame.columns.map((cL, i) =>
                new Label(identifier + "_c_" + cL, cL, Vector.add(accTopLeft, [(i + .5) * configuration.cellOuterDimensions[0], 0]), headerStyle));
            accTopLeft = Vector.add(accTopLeft, [0, configuration.cellOuterDimensions[1]]);
        }

        // Number bars.
        var barsTopLeft = accTopLeft;
        this.bars = _.flatten(frame.zeroNormalizedMatrix.map((c, cI) => c.map((val, rI) =>
            new Rectangle(identifier + "_" + cI + "_" + rI,
                                Vector.add(barsTopLeft, [cI * configuration.cellOuterDimensions[0],
                                            configuration.cellSpace[1] + rI * configuration.cellOuterDimensions[1]]),
                                [val * configuration.cellDimensions[0], configuration.cellDimensions[1]],
                                configuration.fontColor)
        )));

        if(configuration.visibleIndex) {
            var indexStyle = new LabelStyle(configuration.font, configuration.fontColor, 'left', 'middle');
            this.rowIndex = frame.rows.map((rL, i) =>
                new Label(
                    identifier + "_r_" + rL,
                    rL,
                    Vector.add(topLeft, [frame.columns.length * configuration.cellOuterDimensions[0], (i + .5) * configuration.cellOuterDimensions[1]]),
                    indexStyle,
                    true)
            );
            //accTopLeft = Vector.add(accTopLeft, [0, frame.columns.length * configuration.cellDimensions[1]]);
        }
    }

    paint(context: ViewContext) {
        context.snippets(this.columnHeader);
        context.snippets(this.rowIndex);
        context.snippets(this.bars);
    }

    dimensions() {
        var cfg = this.configuration;
        return [(this.frame.columns.length + (this.configuration.visibleIndex ? 1 : 0)) * cfg.cellOuterDimensions[0],
                (this.frame.rows.length + (this.configuration.visibleHeader ? 1 : 0)) * cfg.cellOuterDimensions[1]];
    }
}

class FeatureLabel extends Label {

    constructor(public feature: string,
                position: number[],
                style: LabelStyle) {
        super(feature, feature, position, style, true);
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        interaction.populationSpace.features = enriched.populationSpace.features.toggle(this.feature);
        //console.log("Mouse click: " + enriched.populationSpace.features.length);
    }
}

class FeatureHistogramTable extends PlacedSnippet {
    columnHeader: Label[];
    rowIndex: Label[];
    histograms: Histogram[][];

    constructor(identifier: string,
                topLeft: number[],
                public state: EnrichedState) {
        super(identifier, topLeft);

        var features = state.features.value.columns;
        var frames = state.featureHistograms.value.histograms;
        //var frame = state.featureHistograms.value.histograms['objects'];   //state.features.value;
        var cfg = state.configuration;
        var configuration = cfg.featureTable;
        var selected = state.populationSpace.features;

        var accTopLeft = topLeft;

        if(configuration.visibleIndex) {
            this.rowIndex = features.map((rL, i) => {
                var indexStyle = new LabelStyle(
                    configuration.font,
                    selected.has(rL) ? configuration.fontColor : cfg.baseDim,
                    'right',
                    'middle');

                return new FeatureLabel(
                    rL,
                    Vector.add(topLeft,
                        [configuration.cellOuterDimensions[0], (i + .5) * configuration.cellOuterDimensions[1]]),
                        indexStyle);
            });
            accTopLeft = Vector.add(accTopLeft, [configuration.cellOuterDimensions[0] + cfg.splomSpace, 0]);
        }

        var barsTopLeft = accTopLeft;

        this.histograms = _.keys(frames).map(fK => {
            var frame = frames[fK];

            var frameCfg = _.clone(configuration);
            frameCfg.fontColor = fK === '-1' ? cfg.baseDim : state.populationSpace.populations.byId(fK).color;

            return features.filter(c => c in frame.columnIndex).map((c, cI) =>
                new Histogram(
                    identifier + "_" + c,
                    Vector.add(barsTopLeft, [0, configuration.cellSpace[1] + cI * configuration.cellOuterDimensions[1]]),
                    frame.matrix[frame.columnIndex[c]],
                    frameCfg));
        });

        this.setDimensions([((configuration.visibleIndex ? 1 : 0) + 1) * configuration.cellOuterDimensions[0],
                            (features.length + (configuration.visibleHeader ? 1 : 0)) * configuration.cellOuterDimensions[1]]);
    }

    paint(context: ViewContext) {
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
        this.histograms.forEach(hs => context.snippets(hs));
    }
}

class Histogram extends BaseSnippet {

    constructor(identifier: string,
                public topLeft: number[],
                public normFrequencies: number[],
                public configuration: NumberTableConfiguration) {
        super(identifier);
    }

    paint(context: ViewContext) {
        var cfg = this.configuration;

        context.save();
        context.translate(this.topLeft);

        context.strokeStyle(cfg.fontColor);
        var shrLen = this.normFrequencies.length - 1;
        for(var i = 0; i < shrLen; i++) {
            var x1 = i * cfg.cellDimensions[0] / shrLen;
            var x2 = (i + 1) * cfg.cellDimensions[0] / shrLen;
            var f1 = this.normFrequencies[i];
            var f2 = this.normFrequencies[i + 1];
            var y1 = (1 - f1) * cfg.cellDimensions[1];
            var y2 = (1 - f2) * cfg.cellDimensions[1];

            context.strokeLine(x1, y1, x2, y2);
        }

        context.restore();
    }
}

class Plate extends PlacedSnippet {
    constructor(id: string,
                topLeft: number[],
                public model: EnrichedState) {
        super(id, topLeft);

        var cfg = model.configuration;
        var info = model.dataSetInfo.value;
        this.setDimensions([info.columnCount * cfg.wellDiameter, info.rowCount * cfg.wellDiameter]);
    }

    paintWellOutlines(ctx: ViewContext) {
        var cfg = this.model.configuration;
        var info = this.model.dataSetInfo.value;
        var selection = this.model.focused();
        var clusterShares = this.model.wellClusterShares.value.wellIndex[selection.populationOrTotal()] || [];
        var wellShares = clusterShares[selection.plate] || [];

        // Well outlines.
        ctx.strokeStyle(cfg.baseMuted);
        for(var c = 0; c < info.columnCount; c++) {
            var x = c * cfg.wellDiameter;

            for(var r = 0; r < info.rowCount; r++) {
                var y = r * cfg.wellDiameter;

                if(wellShares[c] && wellShares[c][r] >= -1) {
                    ctx.fillStyle(BaseConfiguration.shareColorMap(wellShares[c][r]));
                    ctx.fillRect(x + .25, y + .25, cfg.wellDiameter - .5, cfg.wellDiameter - .5);
                } else {
                    ctx.strokeLine(x + .25, y + .25, x + cfg.wellDiameter - .25, y + cfg.wellDiameter - .25);
                    ctx.strokeLine(x + .25, y + cfg.wellDiameter - .25, x + cfg.wellDiameter - .25, y + .25);
                }
            }
        }
    }

    paintWellLabels(ctx: ViewContext) {
        var cfg = this.model.configuration;
        var info = this.model.dataSetInfo.value;

        var lblY = 0;   //info.rowCount * cfg.wellDiameter + cfg.plateColLabelMargin;
        var lblX = info.columnCount * cfg.wellDiameter + cfg.plateRowLabelMargin;

        ctx.save();

        // Column labels at the top.
        ctx.font(cfg.sideFont.string);
        ctx.fillStyle(cfg.base);
        ctx.textAlign('center');
        ctx.textBaseline('bottom');
        info.columnLabels.forEach((c, i) => ctx.fillText(c, (i+.5) * cfg.wellDiameter, lblY));

        // Row labels at the right.
        ctx.textAlign('left');
        ctx.textBaseline('middle');
        info.rowLabels.forEach((r, j) => ctx.fillText(r, lblX, (j+.5) * cfg.wellDiameter));

        ctx.restore();
    }
}

class TemplatePlate extends Plate {
    selectionOutlines: jsts.geom.Geometry[];

    constructor(topLeft: number[], public model: EnrichedState) {
        super("tmpPlt", topLeft, model);

        var cfg = model.configuration;

        var gf = new jsts.geom.GeometryFactory();
        this.selectionOutlines = model.allWellSelections().map(ws => {
            // Tile per well.
            var wellTiles = ws.wells.map(wc => {
                var topLeft = new jsts.geom.Coordinate(wc.column * cfg.wellDiameter, wc.row * cfg.wellDiameter);
                var topRight = new jsts.geom.Coordinate((wc.column + 1) * cfg.wellDiameter, wc.row * cfg.wellDiameter);
                var bottomRight = new jsts.geom.Coordinate((wc.column + 1) * cfg.wellDiameter, (wc.row + 1) * cfg.wellDiameter);
                var bottomLeft = new jsts.geom.Coordinate(wc.column * cfg.wellDiameter, (wc.row + 1) * cfg.wellDiameter);

                return gf.createPolygon(gf.createLinearRing([topLeft, topRight, bottomRight, bottomLeft, topLeft]), []);
            });

            return new jsts.operation.union.CascadedPolygonUnion(wellTiles).union();
        });
    }

    paint(context: ViewContext) {
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
    }

    paintSelectionBody(ctx: ViewContext) {
        var cfg = this.model.configuration;
        var info = this.model.dataSetInfo.value;

        ctx.fillStyle(cfg.base.alpha(0.2));
        ctx.beginPath();
        this.selectionOutlines.forEach(so => TemplatePlate.geometryToPath(ctx, so));
        ctx.fill();
    }

    paintSelectionOutlines(ctx: ViewContext) {
        var cfg = this.model.configuration;
        var info = this.model.dataSetInfo.value;

        this.selectionOutlines.forEach((so, i) => {
            ctx.strokeStyle(cfg.backgroundColor);
            ctx.lineWidth(3.5);
            ctx.beginPath();
            TemplatePlate.geometryToPath(ctx, so);
            ctx.stroke();

            ctx.strokeStyle(this.model.allWellSelections()[i].id === "Selected" ? cfg.baseSelected : cfg.base);
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
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        var plate = this.model.focused().plate;
        if(plate !== null) {
            interaction.selectedCoordinates.plate = plate;
            interaction.selectedCoordinates.well = PlateMiniHeatmap.wellCoordinatesAt(coordinates, enriched);
        }
    }

    mouseMove(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        var plate = this.model.focused().plate;
        if(plate !== null) {
            interaction.hoveredCoordinates.plate = plate;
            interaction.hoveredCoordinates.well = PlateMiniHeatmap.wellCoordinatesAt(coordinates, enriched);
        }
    }

    static geometryToPath(context: ViewContext, geometry: jsts.geom.Geometry) {
        if(!geometry) return;

        // Collection.
        if (geometry.getNumGeometries() > 1) {
            for (var i = 0; i < geometry.getNumGeometries(); i++) {
                TemplatePlate.geometryToPath(context, geometry.getGeometryN(i));
            }
        }
        // Polygon.
        else if(geometry.getNumGeometries() > 0) {
            var polygon = <jsts.geom.Polygon> geometry;
            var extRing = polygon.getExteriorRing();

            if (extRing.getCoordinates().length > 2) {
                // All rings as paths.
                TemplatePlate.ringToPath(context, extRing);
                for (var i = 0; i < polygon.getNumInteriorRing(); i++) {
                    TemplatePlate.ringToPath(context, polygon.getInteriorRingN(i));
                }
            }
        }
    }

    static hullToPath(context: ViewContext, geometry: jsts.geom.Geometry) {
        if(!geometry) return;

        // Collection.
        if (geometry.getNumGeometries() > 1) {
            for (var i = 0; i < geometry.getNumGeometries(); i++) {
                TemplatePlate.hullToPath(context, geometry.getGeometryN(i));
            }
        }
        // Polygon.
        else if(geometry.getNumGeometries() > 0) {
            var polygon = <jsts.geom.Polygon> geometry;
            var extRing = polygon.getExteriorRing();
            if(extRing.getCoordinates().length > 2) {
                // All rings as paths.
                TemplatePlate.ringToPath(context, extRing);
            }
        }
    }

    static holesToPath(context: ViewContext, geometry: jsts.geom.Geometry) {
        if(!geometry) return;

        // Collection.
        if (geometry.getNumGeometries() > 1) {
            for (var i = 0; i < geometry.getNumGeometries(); i++) {
                TemplatePlate.holesToPath(context, geometry.getGeometryN(i));
            }
        }
        // Polygon.
        else if(geometry.getNumGeometries() > 0) {
            var polygon = <jsts.geom.Polygon> geometry;
            var extRing = polygon.getExteriorRing();
            if(extRing.getCoordinates().length > 2) {
                // All rings as paths.
                for (var i = 0; i < polygon.getNumInteriorRing(); i++) {
                    TemplatePlate.ringToPath(context, polygon.getInteriorRingN(i));
                }
            }
        }
    }

    /*static ringToPath(context: ViewContext, ring: jsts.geom.LineString) {
        var cs = ring.getCoordinates();
        context.moveTo(cs[0].x, cs[0].y);
        for (var i = 1; i < cs.length; i++) context.lineTo(cs[i].x, cs[i].y);
        context.closePath();
    }*/

    private static arcRad = 2;
    private static trunc(bC: jsts.geom.Coordinate, eC: jsts.geom.Coordinate) {
        var bV = [bC.x, bC.y];
        var eV = [eC.x, eC.y];
        return Vector.add(bV, Vector.mul(Vector.normalize(Vector.subtract(eV, bV)), TemplatePlate.arcRad));
    }

    static ringToPath(context: ViewContext, ring: jsts.geom.LineString) {
        var cs = ring.getCoordinates();
        var mC = TemplatePlate.trunc(cs[0], cs[1]);
        context.moveTo(mC[0], mC[1]);
        for (var i = 1; i < cs.length; i++) {
            var cs0 = cs[i];
            var cs1 = cs[i+1 === cs.length ? 1 : i+1];
            context.arcTo(cs0.x, cs0.y, cs1.x, cs1.y, TemplatePlate.arcRad);
        }
        context.closePath();
    }
}

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

class PlateIndexSelection extends PlacedSnippet {
    constructor(public topLeft: number[],
                public selection: WellSelection,
                public model: EnrichedState) {
        super("pi_" + selection.id, topLeft);

        var cfg = model.configuration;
        var info = model.dataSetInfo.value;

        this.dimensions = [cfg.plateIndexWidth(), cfg.plateIndexSpace * info.plateCount];
        this.updatePositions();
    }

    paint(ctx: ViewContext) {
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

        this.selection.plates.forEach(p => {
            for(var i = p[0]; i <= p[1]; i++) {
                ctx.fillStyle(mod.focused().plate == i ? cfg.baseSelected : cfg.baseMuted);
                ctx.fillRect(0, i * cfg.plateIndexSpace, cfg.plateIndexInnerHeight, cfg.plateWidth);
            }
        });

        //this.selection.plates.forEach(p => ctx.fillRect(cfg.plateIndexSpace * p[0], 0, cfg.plateIndexSpace * (p[1] - p[0] + 1), cfg.plateIndexInnerHeight));

        ctx.textAlign('left');
        ctx.textBaseline('alphabetic');
        ctx.restore();
    }
}

class WellDetailView extends PlacedSnippet {
    constructor(topLeft: number[],
                public state: EnrichedState) {
        super("WellDetailView", topLeft);

        var cfg = state.configuration;
        this.setDimensions(cfg.wellViewMaxDim);
    }

    paint(ctx: ViewContext) {
        var state = this.state;
        var cfg = state.configuration;
        var focusedWell = state.focused().well;
        var info = state.dataSetInfo.value;

        // Header.
        ctx.save();
        ctx.translate(this.topLeft);
        ctx.translate([0.75 * this.dimensions[0], cfg.panelHeaderSpace - cfg.panelSpace]);
        panelHeader(ctx, cfg, (focusedWell === null ?
            "Well Void" :
            "Well " + info.columnLabels[focusedWell.column] + info.rowLabels[focusedWell.row]), cfg.baseSelected);
        ctx.restore();

        ctx.transitioning = false;
        ctx.save();
        ctx.translate(this.topLeft);

        var well = state.focused().wellLocation();
        if(well) {
            var img = well.image();
            if (img) {
                var wellScale = Math.min(cfg.wellViewMaxDim[0] / img.width, 2 * cfg.wellViewMaxDim[1] / img.height);
                ctx.picking = true;
                ctx.drawImageClipped(
                    img,
                    [0, 0], [img.width, 0.5 * img.height],
                    [0, 0], [wellScale * img.width, wellScale * 0.5 * img.height]);
                ctx.picking = false;

                // Test object coordinates.
                var objects = state.objectInfo.value;   //state.wellObjectInfo.value;
                var x = objects.columnVector("x");
                var y = objects.columnVector("y");
                var xRad = wellScale * cfg.objectViewImageRadius;
                var yRad = wellScale * cfg.objectViewImageRadius;
                objects.rows.forEach((r, i) => {
                    if(Number(r) === state.focused().object) {
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
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[],
               enriched: EnrichedState, interaction: InteractionState) {
        var object = enriched.closestWellObject(coordinates);

        // Toggle given exemplar for the focused population.
        // If no population is focused, create a new population for the exemplar, and focus the population.
        var popSpace = interaction.populationSpace;
        var population = popSpace.populations.byId(interaction.hoveredCoordinates.population);

        // Create and focus a new population if one is lacking.
        if(!population) {
            population = popSpace.createPopulation();
            interaction.hoveredCoordinates.population = population.identifier;
        }

        population.exemplars = population.exemplars.toggle(object);
    }

    mouseMove(event: ViewMouseEvent, coordinates: number[],
              enriched: EnrichedState, interaction: InteractionState) {
        interaction.hoveredCoordinates.object = enriched.closestWellObject(coordinates);
        enriched.conformHoveredCoordinates(interaction);
    }
}

class ObjectDetailView extends PlacedSnippet {
    private focused: boolean;

    constructor(public object: number,
                public state: EnrichedState,
                topLeft = [0, 0]) {
        super("odv_" + object, topLeft);

        var cfg = state.configuration;
        this.focused = state.hoveredCoordinates.object === object;
        this.dimensions = this.focused && !state.populationSpace.isExemplar(object) ?
            [cfg.splomInnerSize, cfg.splomInnerSize] :
            [cfg.clusterTileInnerSize, cfg.clusterTileInnerSize];

        this.updatePositions();
    }

    paint(ctx: ViewContext) {
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

        var objectWells = mod.allObjectWells();
        var well = objectWells.location(this.object);
        if(well) {
            var img = well.image();
            var coordinates = objectWells.coordinates(this.object);

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
                if(this.focused) {
                    ctx.strokeStyle(cfg.baseSelected);
                    ctx.lineWidth(2);
                } else {
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
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        interaction.removeExemplar(this.object);
    }

    mouseMove(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        interaction.hoveredCoordinates.object = this.object;
        enriched.conformHoveredCoordinates(interaction);
    }
}

class PlateIndex extends PlacedSnippet {
    private heatmapColumns: List<List<PlateMiniHeatmap>>;

    constructor(public topLeft: number[], public state: EnrichedState) {
        super("pi", topLeft);

        var cfg = state.configuration;
        var datInfo = state.dataSetInfo.value;

        var heatMaps = _.range(0, datInfo.plateCount).map(pI => new PlateMiniHeatmap([0,0], pI, state));
        var colCapacity = Math.ceil(datInfo.plateCount / cfg.miniHeatColumnCount);
        var colMaps = _.range(0, cfg.miniHeatColumnCount).map(cI =>
            _.compact(_.range(0, colCapacity).map(rI => heatMaps[cI * colCapacity + rI])));

        //var colMaps = _.range(0, cfg.miniHeatColumnCount).map(cI => new List("pic_" + cI, st))

        this.heatmapColumns = new List("pics",
            colMaps.map((c, cI) => new List("pic_" + cI, c, [0,0], [0,0], 'vertical', cfg.miniHeatSpace)),
            topLeft, [0,0], 'horizontal', cfg.miniHeatSpace, 'left'
        );

        this.dimensions = this.heatmapColumns.dimensions; // [model.allWellSelections().length * cfg.plateIndexWidth(), cfg.plateIndexSpace * datInfo.plateCount];
        this.updatePositions();
    }

    paint(context: ViewContext) {
        var state = this.state;
        var cfg = state.configuration;
        var focusedPopulation = state.focused().population;

        // Header.
        context.save();
        context.translate(this.topLeft);
        context.translate([0.5 * this.dimensions[0], 0]);
        panelHeader(context, cfg, focusedPopulation === null ?
            "Cell Counts" :
            "Cell Ratio of " + state.populationSpace.populations.byId(focusedPopulation).name,
            focusedPopulation === null ? null : state.populationSpace.populations.byId(focusedPopulation).color);
        context.restore();

        // Heat maps.
        context.snippet(this.heatmapColumns);
    }
}

class PlateMiniHeatmap extends PlacedSnippet {
    private shareImg: any;

    constructor(public topLeft: number[],
                public plateNumber: number,
                public state: EnrichedState) {
        super("mh_" + plateNumber, topLeft);

        var cfg = state.configuration;
        var info = state.dataSetInfo.value;
        var targetPopulation = state.focused().populationOrTotal();

        this.shareImg = PlateMiniHeatmap.plateShareImage(state, targetPopulation, plateNumber);

        this.dimensions = [info.columnCount * cfg.miniHeatWellDiameter, info.rowCount * cfg.miniHeatWellDiameter];
        this.updatePositions();
    }

    paint(context: ViewContext) {
        var state = this.state;
        var cfg = state.configuration;

        context.save();
        context.translate(this.topLeft);
        context.drawImage(this.shareImg);

        context.transitioning = false;
        // Plate highlight outline.
        if(state.focused().plate === this.plateNumber) {
            context.strokeStyle(cfg.baseSelected);
            context.lineWidth(1);
            context.strokeRect(-.5, -.5, this.dimensions[0] + 1, this.dimensions[1] + 1);

            // Well highlight dot.
            var well = state.focused().well;
            if (well) {
                context.fillStyle(cfg.baseSelected);
                context.fillRect(well.column * cfg.miniHeatWellDiameter, well.row * cfg.miniHeatWellDiameter,
                    cfg.miniHeatWellDiameter, cfg.miniHeatWellDiameter);
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
    }

    static plateShareImage(model: EnrichedState, clusterObject: any, plate: number) {
        var tag = "cimg_" + clusterObject + "_" + plate;
        var wellClusterShares = model.wellClusterShares.value;
        var plateShareImage = wellClusterShares[tag];

        if(!plateShareImage) {
            var cfg = model.configuration;
            var datInfo = model.dataSetInfo.value;
            var clusterShares = wellClusterShares.wellIndex[clusterObject] || [];
            var plateShares = clusterShares[plate] || [];

            var imgWidth = datInfo.columnCount * cfg.miniHeatWellDiameter;
            var imgHeight = datInfo.rowCount * cfg.miniHeatWellDiameter;
            plateShareImage =
                view.View.renderToCanvas(imgWidth, imgHeight, ctx => {
                    for(var c = 0; c < datInfo.columnCount; c++) {
                        var cVals = plateShares[c] || [];
                        var cX = c * cfg.miniHeatWellDiameter;
                        for(var r = 0; r < datInfo.rowCount; r++) {
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
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        interaction.selectedCoordinates.plate = this.plateNumber;
        interaction.selectedCoordinates.well = PlateMiniHeatmap.wellCoordinatesAt(coordinates, enriched);
    }

    mouseMove(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        interaction.hoveredCoordinates.plate = this.plateNumber;
        interaction.hoveredCoordinates.well = PlateMiniHeatmap.wellCoordinatesAt(coordinates, enriched);
    }

    static wellCoordinatesAt(mouseCoordinates: number[], state: EnrichedState) {
        var info = state.dataSetInfo.value;

        return new WellCoordinates(
            Math.round(mouseCoordinates[0] * (info.columnCount - 1)),
            Math.round(mouseCoordinates[1] * (info.rowCount - 1))
        );
    }
}