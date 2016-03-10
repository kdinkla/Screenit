/// <reference path="references.d.ts"/>

import jsts = require('jsts');

import model = require('./model');
import InteractionState = model.InteractionState;
import EnrichedState = model.EnrichedState;
import SelectionCoordinates = model.SelectionCoordinates;
import PopulationSpace = model.PopulationSpace;
import Population = model.Population;
import WellSelection = model.WellSelection;
import WellCoordinates = model.WellCoordinates;
import WellLocation = model.WellLocation;
import WellScore = model.WellScore;

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
import Polygon = snippet.Polygon;
import Line = snippet.Line;

import config = require('./configuration');
import BaseConfiguration = config.BaseConfiguration;
import NumberTableConfiguration = config.NumberTableConfiguration;

import math = require('./core/math');
import Vector = math.Vector;

import dataframe = require('./core/dataframe');
import DataFrame = dataframe.DataFrame;
import NumberFrame = dataframe.NumberFrame;

import collection = require('./core/collection');
import StringMap = collection.StringMap;

import style = require('./core/graphics/style');
import Color = style.Color;
import Font = style.Font;

// View identifiers and their constructors.
var viewConstructors: () => StringMap<any> = () => {
    return {
        'features':   FeatureHistogramTable,
        //'splom':      Splom,
        'exemplars':  ExemplarTable,
        'datasets':   DataSetList,
        'plates':     PlateIndex,
        //'plate':      JointWellPlates,
        'well':       WellView
    };
};

export class OverView extends View<EnrichedState> {
    panelColumns: List<PlacedSnippet>;

    constructor() {
        super("overView");
    }

    updateScene(state: EnrichedState) {
        var cfg = state.configuration;
        var constructors = viewConstructors();  // All panel constructors.

        // Active panels.
        var openPanels = model.viewCycle.map(ov =>
            new ColumnPanel(ov, new constructors[ov](state), state, state.openViews.has(ov)));
        this.panelColumns = new List("pnlCols", openPanels, [0,0], [0,0], 'horizontal', cfg.panelSpace, 'left');

        //console.log("State:");
        //console.log(state);
    }

    paint(c: ViewContext, state: EnrichedState) {
        var cfg = state.configuration;

        c.translate([.5, .5]);

        // Center panels.
        this.panelColumns.setTopLeft([
            Math.min(.5 * (this.dimensions()[0] - this.panelColumns.dimensions[0]),
                    this.dimensions()[0] - this.panelColumns.dimensions[0] - cfg.windowMargin),
            cfg.panelSpace
        ]);
        c.snippet(this.panelColumns);

        // Show data loading text, or filtering text.
        var isLoading = _.keys(state).filter(prp => state[prp] && _.isBoolean(state[prp]['converged'])).some(prp => !state[prp].converged);
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
    }
}

class ColumnPanel extends List<PlacedSnippet> {
    constructor(identifier: string,
                core: PlacedSnippet,
                state: EnrichedState,
                opened = false) {
        super("cp_" + identifier,
            _.union([new ColumnLabel(identifier, (<any>core['toString'])(opened), opened, state)], opened ? [core] : []), //[new Label("hdr_" + identifier, core.toString(), [0,0], state.configuration.panelHeaderLabel), core],
            [0,0],
            [0,0],
            'vertical',
            state.configuration.panelSpace,
            'middle');
    }
}

class ColumnLabel extends Label {
    constructor(public viewIdentifier: string, text: string, public opened: boolean, state: EnrichedState) {
        super("clLbl_" + viewIdentifier, text, [0,0],
                opened ? state.configuration.panelHeaderOpenLabel : state.configuration.panelHeaderLabel, true);

       if(!opened) {
           this.setDimensions([this.dimensions[1], this.dimensions[0]]);
       }
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        interaction.pushView(this.viewIdentifier);
    }

    paint(context: ViewContext) {
        context.picking = this.pickable;
        context.fillStyle(this.style.color);
        context.font(this.style.font.toString());

        context.save();
        context.translate(this.opened ? this.topLeft : Vector.add(this.topLeft, [0, this.dimensions[1]]));
        context.rotate(this.opened ? 0 : -.5 * Math.PI);
        var dY = 0;
        this.lines.forEach(l => {
            dY += this.style.font.size;
            context.fillText(l, 0, dY);
        });
        context.restore();
    }
}

class DataSetList extends List<PlacedSnippet> {
    constructor(public state: EnrichedState) {
        super("dataSetList",
            state.dataSets.value
                 .filter(ds => ds !== state.selectedCoordinates.dataSet)
                 .map(ds => new DataSetLabel(ds, state)),
            [0,0],
            [0,0],
            'vertical',
            state.configuration.featureCellSpace[0]
        );
    }

    toString() {
        return "Screen: " + this.state.selectedCoordinates.dataSet;
    }
}

class DataSetLabel extends Label {
    constructor(public dataSet: string, state: EnrichedState) {
        super("clLbl_" + dataSet, dataSet, [0,0], state.configuration.panelHeaderLabel, true);
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        interaction.switchToDataSet(this.dataSet);
        interaction.pushView('plates');
    }
}

class FeatureHistogramTable extends List<PlacedSnippet> {
    guide: GuideLabel;

    constructor(public state: EnrichedState) {
        super("ftrCols",
            [
                new FeatureList("ftrLbls", state, FeatureLabel, 'right'),
                new FeatureList("ftrHistos", state, FeatureHistogram),
                new FeatureParallelCoordinates(state),
                new Splom(state)
            ],
            [0,0],
            [0,0],
            'horizontal',
            state.configuration.featureCellSpace[0],
            'left'
        );

        if(this.state.populationSpace.features.length < 2) {
            this.guide = new GuideLabel(
                "ftr",
                "Click on a feature label to add it to the phenotype model space.",
                [0,0],
                [-80, 0],
                25,
                state);
        }
    }

    setTopLeft(topLeft: number[]) {
        super.setTopLeft(topLeft);
        if(this.guide) this.guide.setTopLeft(Vector.add(this.topRight, [15, 250]));
    }

    paint(context: ViewContext) {
        super.paint(context);
        context.snippet(this.guide);
    }

    toString() {
        return "Features";
    }
}

class FeatureList extends List<PlacedSnippet> {
    constructor(identifier: string,
                state: EnrichedState,
                construct: new (ftr: string, erState: EnrichedState) => PlacedSnippet,
                align: string = 'middle') {
        super(identifier,
            state.features.value.map(f => new construct(f, state)),
            [0,0],
            [0,0],
            'vertical',
            state.configuration.featureCellSpace[1],
            align
        );
    }
}

class FeatureLabel extends Label {
    constructor(public feature: string, state: EnrichedState) {
        super("ftrLbl" + feature,
            feature,
            [0,0],
            new LabelStyle(
                    state.configuration.featureFont,
                    state.populationSpace.features.has(feature) ?
                        state.configuration.base :
                        state.configuration.baseDim,
                    'left',
                    'top'),
            true);
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        interaction.populationSpace.features = enriched.populationSpace.features.toggle(this.feature);
        //interaction.pushView('splom');
    }
}

class FeatureHistogram extends PlacedSnippet {
    constructor(public feature: string, public state: EnrichedState) {
        super("ftrHst_" + feature);

        this.setDimensions(state.configuration.featureCellDimensions);
    }

    paint(context: ViewContext) {
        var state = this.state;
        var cfg = state.configuration;
        var histograms = state.featureHistograms.value;
        var frames = histograms.histograms;
        var populations = state.populationSpace.populations.elements.filter(p => p.identifier.toString() in frames);
        var cacheTag = this.identifier + "_" + populations;

        var cachedImage = histograms[cacheTag];
        if(!cachedImage) {
            cachedImage = View.renderToCanvas(this.dimensions[0], this.dimensions[1], plainContext => {
                // Per population frame.
                var draw = (fill: boolean) => {
                    populations.forEach(population => {
                        var frame = frames[population.identifier];
                        var normFrequencies = frame.matrix[frame.columnIndex[this.feature]];

                        plainContext.beginPath();
                        var len = normFrequencies.length - 1;
                        var spanWidth = this.dimensions[0];
                        var spanHeight = this.dimensions[1] - 1;
                        plainContext.moveTo(0, this.dimensions[1]);
                        for (var i = 0; i <= len; i++) {
                            var x1 = i * spanWidth / len;
                            var f1 = normFrequencies[i];
                            var y1 = (1 - f1) * spanHeight;

                            //plainContext.fillRect(x1, y1, 1, 1);

                            plainContext.lineTo(x1, y1);
                        }
                        plainContext.lineTo(this.dimensions[0], this.dimensions[1]);
                        if(fill) {
                            var fontColor = population.colorTrans;   //population.colorTrans;
                            plainContext.fillStyle = fontColor.toString();
                            plainContext.fill();
                        }  else {
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
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        interaction.selectedCoordinates.switchProbe([this.feature], [coordinates[0]]);
    }
}

class FeatureParallelCoordinates extends PlacedSnippet {
    constructor(public state: EnrichedState) {
        super("ftrPrl_");

        var cfg = state.configuration;
        this.setDimensions([
            cfg.featureCellDimensions[0],
            state.features.value.length * (cfg.featureCellDimensions[1] + cfg.featureCellSpace[1]) - cfg.featureCellSpace[1]]);
    }

    paint(context: ViewContext) {
        var state = this.state;
        var cfg = state.configuration;

        var populations = this.state.populationSpace.populations.elements;

        context.save();
        context.translate(this.topLeft);

        context.transitioning = false;

        //var allObjects = state.objectInfo.value.rows;
        //var genStroke = new Color(0, 0, 0, 0.05);
        //allObjects.forEach(ob => this.paintPolyLine(context, ob.toString(), genStroke));

        populations.forEach(p =>
            p.exemplars.elements.forEach(pE =>
                this.paintPolyLine(context, pE.toString(), state.populationColorTranslucent(p))));

        var focusedObject = state.focused().object;
        if(focusedObject !== null) {
            this.paintPolyLine(context, focusedObject.toString(), cfg.backgroundColor, 4);
            this.paintPolyLine(context, focusedObject.toString(), cfg.baseSelected, 2);
        }

        context.transitioning = true;

        context.restore();
    }

    private paintPolyLine(context: ViewContext, object: string, color: Color, lineWidth = 1) {
        var state = this.state;
        //var cfg = state.configuration
        var features = state.features.value;
        var featureValues = state.objectFeatureValues.value;

        var width = this.dimensions[0];
        var height = this.dimensions[1];

        if(object in featureValues.rowIndex) {
            context.strokeStyle(color);
            context.lineWidth(lineWidth);
            context.context.lineJoin = 'round';
            context.beginPath();
            features.forEach((f, fI) => {
                var x = featureValues.cell(f, object) * width;
                var y = (fI + .5) * height / features.length;
                return fI > 0 ? context.lineTo(x, y) : context.moveTo(x, y);
            });
            context.stroke();
        }
    }
}

class Splom extends PlacedSnippet {
    plots: ObjectFeaturePlot[][];

    mdsPlot: ObjectFeaturePlot;

    constructor(public model: EnrichedState) {
        super("splom", [0, 0]);

        var cfg = model.configuration;
        var features = model.populationSpace.features.elements;

        // Model feature histograms.
        this.plots = features
            .map((f1, i1) => features.map((f2, i2) =>
                i1 < i2 ?
                    new ObjectFeaturePlot(f1, f2,
                        [0,0], model,
                        cfg, model.objectHistogramSize,
                        i2 === features.length - 1, i1 === 0) :
                        null));

        // Optional MDS plot.
        if(model.objectHistograms.value.matricesFor("mds0", "mds1")) {
            this.mdsPlot = new ObjectFeaturePlot(
                "mds0", "mds1",
                [0,0], model,
                cfg, model.objectHistogramSize,
                false, false,
                "Landscape");
        }

        var size = Math.max(1, features.length - 1) * model.objectHistogramSize;
        this.setDimensions([cfg.sideFont.size + size, size]);
    }

    setTopLeft(topLeft: number[]) {
        super.setTopLeft(topLeft);

        if(this.plots) {
            var cfg = this.model.configuration;
            var marginTopLeft = Vector.add(this.topLeft, [cfg.sideFont.size, 0]);
            this.plots.forEach((pC, pCI) => pC.forEach((p, pRI) => {
                var tPCI = Math.max(0, pCI);
                var t2PRI = Math.max(0, pRI - 1);

                if(p)
                    p.topLeft = Vector.add(marginTopLeft,
                        [pCI * this.model.objectHistogramSize + tPCI * cfg.splomSpace,
                            (pRI-1) * this.model.objectHistogramSize + t2PRI * cfg.splomSpace]);
            }));
        }

        if(this.mdsPlot) {
            var cfg = this.model.configuration;
            this.mdsPlot.topLeft = Vector.subtract(
                this.topRight,
                [this.model.objectHistogramSize - cfg.splomSpace, 0]
            );
        }
    }

    paint(context: ViewContext) {
        this.plots.map(plts => context.snippets(plts));
        context.snippet(this.mdsPlot);
    }

    toString() {
        return "Space";
    }
}

class ObjectFeaturePlot extends BaseSnippet implements Snippet {
    private cachedBackground: any;  // Cache image.

    constructor(public feature1: string,
                public feature2: string,
                public topLeft: number[],
                public model: EnrichedState,
                public configuration: BaseConfiguration,
                public size: number,
                public columnLabel: boolean = false,
                public rowLabel: boolean = false,
                public headerLabel: string = null) {
        super("objPlt_" + feature1 + ".." + feature2);

        // Cache for changing histograms and hovered population.
        var cachedBackgrounds = model.objectHistograms.value[this.identifier] || {};
        var focusPopulation = (model.focused().population || -1).toString();
        this.cachedBackground = cachedBackgrounds[focusPopulation];
        if(!this.cachedBackground) {
            this.cachedBackground = view.View.renderToCanvas(size, size, c => this.histogram2DtoImage(c));
            model.objectHistograms.value[this.identifier] = this.cachedBackground;
        }
    }

    histogram2DtoImage(context: CanvasRenderingContext2D) {
        var mod = this.model;
        var cfg = this.configuration;
        var size = this.size;

        // Paint histograms, if available.
        var histograms = mod.objectHistograms.value.matricesFor(this.feature1, this.feature2) || [];

        context.save();

        var populations = mod.populationSpace.populations.elements.filter(p => p.identifier in histograms);
        var popHistos = populations.map(p => histograms[p.identifier.toString()]);
        var firstHisto = popHistos[0];
        if(firstHisto) {
            firstHisto.forEach((c, xI) => c.forEach((cell, yI) => {
                var mPI = -1;   // Maximum population index.
                var mPV = 0;    // Maximum population value.
                popHistos.forEach((pH, pHI) => {
                    var pHV = pH[xI][yI];
                    if(pHV > mPV) {
                       mPI = pHI;
                       mPV = pHV;
                    }
                });

                if(mPV > 0) {
                    var highestPop = populations[mPI];
                    context.fillStyle = highestPop.color.darken(1 - 0.333 / mPV).toString();

                    if(mPV < 2)
                        context.fillRect(xI - .25, size - yI - .25, 1.5, 1.5);
                    else
                        context.fillRect(xI, size - yI, 1, 1);
                }
            }));
        }

        context.restore();
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

        context.transitioning = false;
        //context.transitioning = false;

        context.drawImageScaled(this.cachedBackground, [0,0], [this.size, this.size]);

        var objectFeatures = this.model.objectInfo.value;
        var x = objectFeatures.columnVector(this.feature1) || [];
        var y = objectFeatures.columnVector(this.feature2) || [];
        //var clstr = mod.clusters.value;

        // Large colored dots with halo for representatives.
        mod.populationSpace.populations.forEach(pop =>
            pop.exemplars.forEach(ex => {
                //var cI = clstr.clusterMap[pop.identifier];
                //var color = cI >= 0 ? cfg.clusterColors[clstr.identifierIndex[cI]] : Color.NONE;
                var oI = objectFeatures.rowIndex[ex];
                ObjectFeaturePlot.drawBigDot(context,
                    cfg, this.model.populationColor(pop) /*pop.color*/,
                    x[oI] * size, (1 - y[oI]) * size);
            })
        );

        // Color dot for hovered object.
        var focusedObject = mod.focused().object;
        if(focusedObject !== null) {
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
    }

    static drawBigDot(context: ViewContext, cfg: BaseConfiguration, color: Color, x: number, y: number, enlarge = false) {
        var rO = (enlarge ? 1.5 : 1) * cfg.splomRepresentativeOuterDotRadius;
        var rI = (enlarge ? 1.5 : 1) * cfg.splomRepresentativeInnerDotRadius;

        context.fillStyle(cfg.backgroundColor);
        context.fillEllipse(x, y, rO, rO);

        context.fillStyle(color);
        context.fillEllipse(x, y, rI, rI);
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        var invCs = [coordinates[0], 1 - coordinates[1]];   // Inverted y-axis.
        interaction.selectedCoordinates.switchProbe([this.feature1, this.feature2], invCs);
    }
}

class ExemplarTable extends PlacedSnippet {
    segments: List<PlacedSnippet>;

    constructor(public state: EnrichedState) {
        super("ExemplarStack", [0,0]);

        var cfg = state.configuration;

        //var activePopulations = this.state.populationSpace.populations.elements;
                                    //.filter(p => p.identifier > Population.POPULATION_ALL_NAME);

        var visiblePopulations = this.state.populationSpace.visiblePopulations().elements;

        // Main Label.
        var activeTypeLabel = new Label("ShownLbl", "Shown", [0,0], state.configuration.subPanelHeaderLabel, true);

        // Labels of active types.
        var activeTypeLabels = new List(
            "ActiveTypeLabels",
            visiblePopulations.map(p => new TypeLabel(p, state)),
            [0,0], [0,0],
            'horizontal',
            cfg.exemplarColumnSpace,
            'left'
        );

        var exemplarSelected = state.isExemplarSelected();

        var exemplarLabel = new Label("ExemplarLbl", "Exemplars", [0,0], state.configuration.subPanelHeaderLabel, true);
        var columns = new List("ExemplarColumns",
            visiblePopulations.map(p => new ExemplarColumn(state, p)),
            [0,0], [0,0],
            'horizontal',
            cfg.exemplarColumnSpace,
            'left');

        //var mainPopulations = _.union(
        //        activePopulations, [state.populationSpace.populations.byId(Population.POPULATION_TOTAL_NAME)]);

        //var transferLabel = new Label("PopulationTransfersLbl", "Abundance Score",
        //                                [0,0], state.configuration.subPanelHeaderLabel, true);
        //var transferButtons = new List("PopulationTransfers",
        //        mainPopulations.map((p, pI) => new PopulationTransferEdit(p, state, pI === 0)),
        //        [0,0], [0,0], 'horizontal', cfg.exemplarColumnSpace, 'left');

        var selectedObjectDetailView = exemplarSelected ?
                new ObjectDetailView(state.focused().object, state, [0,0]) :
                null;
        var segSnippets: PlacedSnippet[] = _.compact(
                [activeTypeLabel, activeTypeLabels, /*transferLabel, transferButtons,*/
                    exemplarLabel, selectedObjectDetailView, columns]);

        var shownSegment = new List("ShownSegments", segSnippets, [0,0], [0,0], 'vertical', cfg.subPanelSpace);

        // Hidden types.
        var hiddenSegment: PlacedSnippet[] = [];
        //if(state.populationSpace.inactivePopulations.length > 0) {
            var hiddenTypeLabel = new Label("HiddenLbl", "Hidden", [0, 0], state.configuration.subPanelHeaderLabel, true);
            var hiddenTypeStack = new List(
                "HiddenTypeColumn",
                _.union<PlacedSnippet>(state.populationSpace.inactivePopulations.elements.map(ip => new TypeLabel(ip, state)),
                        state.isExemplarSelected() ?
                            [
                                new ExemplarAdditionButton(
                                    state.focused().object,
                                    state.populationSpace.allPopulations().byId(Population.POPULATION_UNCONFIDENT_NAME),
                                    state)
                            ] : []
                ),
                [0, 0], [cfg.clusterTileInnerSize, 0],
                'vertical',
                cfg.exemplarColumnSpace,
                'middle'
            );
            hiddenSegment.push(new List(
                "HiddenSegments",
                [hiddenTypeLabel, hiddenTypeStack],
                [0, 0], [0, 0],
                'vertical', cfg.subPanelSpace)
            );
        //}

        // Combine shown and hidden segment columns.
        this.segments = new List(
            "TypeSegments",
            _.union([shownSegment], hiddenSegment),
            [0,0], [0,0],
            'horizontal', cfg.subPanelSpace, 'left');

        this.setDimensions(this.segments.dimensions);
    }

    setTopLeft(topLeft: number[]) {
        super.setTopLeft(topLeft);
        if(this.segments) this.segments.setTopLeft(topLeft);
    }

    paint(context: ViewContext) {
        context.snippet(this.segments);
    }

    toString() {
        return "Phenotypes";
    }
}

class ExemplarAdditionButton extends PlacedSnippet {
    labelStyle: LabelStyle;

    constructor(public object, public population: Population, public state: EnrichedState) {
        super("ExemplarLabel_" + population, [0,0]);

        this.labelStyle = new LabelStyle(state.configuration.clusterAdditionLabel, state.populationColor(population));

        var cfg = state.configuration;
        this.setDimensions([cfg.clusterTileInnerSize, cfg.clusterTileInnerSize]);
    }

    paint(context: ViewContext) {
        super.paint(context);

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
        if(this.population.identifier === Population.POPULATION_UNCONFIDENT_NAME) {
            context.font(cfg.sideFont.toString());
            context.textBaseline('bottom');
            context.fillText('New');
            context.textBaseline('top');
            context.fillText('Type');
        }
        // Cell count phenotype.
        else {
            context.font(this.labelStyle.font.toString());
            context.fillText('+');
        }
        context.restore();
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        interaction.populationSpace.addExemplar(this.object, this.population.identifier);
    }
}

class ExemplarHeader extends List<PlacedSnippet> {
    constructor(public state: EnrichedState,
                public population: Population,
                public topLeft = [0, 0]) {
        super(
            "esc_" + population.identifier,
            _.union<PlacedSnippet>(
                [new TypeLabel(population, state)]//,
                //population.exemplars.length > 0 ?
                //    [new ObjectDetailView(population.exemplars.elements[0], state, [0,0])] :
                //    []
            ),
            topLeft,
            [state.configuration.clusterTileInnerSize, 0],
            'vertical',
            state.configuration.exemplarSpace,
            'middle'
        );
    }
}

class ExemplarColumn extends List<PlacedSnippet> {
    constructor(public state: EnrichedState,
                public population: Population,
                public topLeft = [0, 0]) {
        super(
            "esc_" + population.identifier,
            _.union<PlacedSnippet>(
                state.isExemplarSelected() &&
                (!population.predefined /*|| population.identifier === Population.POPULATION_UNCONFIDENT_NAME*/) ?
                    [new ExemplarAdditionButton(state.focused().object, population, state)] :
                    [],
                population.exemplars.elements.map(ex => new ObjectDetailView(ex, state, [0,0]))
            ),
            topLeft,
            [state.configuration.clusterTileInnerSize, 0],
            'vertical',
            state.configuration.exemplarSpace,
            'middle'
        );
    }
}

class PopulationTransferEdit extends PlacedSnippet {
    private minZScoreLabel: string;
    private maxZScoreLabel: string;

    constructor(public population: Population, public state: EnrichedState, public leftMost: boolean = false) {
        super("TransferEdit_" + population.identifier, [0,0]);

        //var minScore = state.wellClusterShares.value.zScoresMin[population.identifier];
        //var maxScore = state.wellClusterShares.value.zScoresMax[population.identifier];
        this.minZScoreLabel = (-state.configuration.activationZScoreRange).toString();  //minScore < 0 ? minScore.toFixed(0) : '?';
        this.maxZScoreLabel = state.configuration.activationZScoreRange.toString();     //maxScore > 0 ? maxScore.toFixed(0) : '?';

        var cfg = state.configuration;
        this.setDimensions([cfg.transferPlotSize, cfg.transferPlotSize + cfg.transferFont.size]);
    }

    paint(context: ViewContext) {
        super.paint(context);

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
        context.strokeRect(0, 0, cfg.transferPlotSize, cfg.transferPlotSize)

        // Side axis labels.
        context.transitioning = false;

        // Left-most axis score labels.
        if(this.leftMost) {
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
            context.fillText('\u2193 \u03A3 score');
            context.restore();
        }

        context.transitioning = true;

        // Function curve.
        var funcPoint = (cs: number[]) => [.5 * (1 + cs[0]) * cfg.transferPlotSize, .5 * (1 - cs[1]) * cfg.transferPlotSize];

        context.strokeStyle(this.population.color);
        context.lineWidth(2);
        context.beginPath();
        var startPoint = funcPoint([-1, this.population.activate(-1)]);
        context.moveTo(startPoint[0], startPoint[1]);
        for(var x = 1; x <= cfg.transferPlotSize; x += 3) {
            var actInput = (2 * x / cfg.transferPlotSize) - 1;
            var pnt = funcPoint([actInput, this.population.activate(actInput)]);
            context.lineTo(pnt[0], pnt[1]);
        }
        var endPoint = funcPoint([1, this.population.activate(1)]);
        context.lineTo(endPoint[0], endPoint[1]);
        context.stroke();

        // Control points.
        context.fillStyle(this.population.color);
        this.population.activation.forEach(cP => {
            var pnt = funcPoint(cP);
            context.fillEllipse(pnt[0], pnt[1], 2, 2);
        });

        // Selected well point.
        var focus = this.state.focused();
        var wellShare = this.state.wellClusterShares.value.zScore(this.population.identifier, focus.plate, focus.well) || 0;
        context.fillStyle(cfg.baseSelected);
        var wellInput = Math.max(-1, Math.min(1, wellShare / cfg.activationZScoreRange));   // Bound to shown range.
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
        context.fillText(this.population.identifier === Population.POPULATION_TOTAL_NAME ?
            absWellShare + " cells" :
            (100 * absWellShare).toFixed(0) + "%",
            wellPnt[0],
            cfg.transferPlotSize
        );

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
        context.scale(.5 * cfg.transferPlotSize, -.5 * cfg.transferPlotSize)
        context.fillStyle(Color.NONE);
        context.fillRect(-1, -1, 2, 2);
        context.picking = false;

        context.restore();
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        // Control points.
        var controlPoints = interaction.populationSpace.populations.byId(this.population.identifier).activation;

        var closestIndex = -1;
        var minDistance = Number.MAX_VALUE;
        controlPoints.forEach((c, cI) => {
            var distance = Math.abs(c[0] - coordinates[0]);
            if(distance < minDistance) {
                closestIndex = cI;
                minDistance = distance;
            }
        });

        controlPoints[closestIndex] = coordinates;

        // Enforce control point x ordering.
        for(var i = 1; i < 3; i++) controlPoints[i][0] = Math.max(controlPoints[i][0], controlPoints[i-1][0]);
    }
}


class TypeLabel extends PlacedSnippet {
    private tagLines: string[];

    constructor(public population: Population, public state: EnrichedState) {
        super("lbl_" + population.identifier, [0,0]);

        this.tagLines = this.population.name.split("\n");

        var cfg = state.configuration;
        this.setDimensions([cfg.clusterTileInnerSize, cfg.clusterTileInnerSize + cfg.sideFont.size + 4]);
    }

    paint(context: ViewContext) {
        super.paint(context);

        var cfg = this.state.configuration;
        var canBeHidden = this.population.identifier !== Population.POPULATION_TOTAL_NAME;

        context.save();
        context.translate(this.topLeft);

        // Square colored inline and outline.
        if(canBeHidden) {
            context.strokeStyle(this.population.color);
            context.lineWidth(4);
            context.strokeRect(2, 2, cfg.clusterTileInnerSize - 4, cfg.clusterTileInnerSize - 4);
        }
        context.strokeStyle(cfg.baseDim);
        context.lineWidth(1);
        context.strokeRect(0, 0, cfg.clusterTileInnerSize, cfg.clusterTileInnerSize);

        // Picking support.
        if(canBeHidden) {
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
        this.tagLines.forEach((line, i) => {
            context.strokeText(line, 0, i * fontHeight);
            context.fillText(line, 0, i * fontHeight);
        });
        context.restore();

        if(canBeHidden) {
            var actionLbl = this.state.populationSpace.populations.has(this.population) ?
                'hide \u25B6' :
                '\u25C0 show';
            context.fillStyle(cfg.baseDim);
            context.textBaseline('bottom');
            context.fillText(actionLbl, .5 * this.dimensions[0], this.dimensions[1]);
        }

        context.restore();
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        //interaction.selectedCoordinates.population = this.population.identifier;
        interaction.populationSpace.toggle(this.population);
    }
}

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

class AbstractPlate extends PlacedSnippet {
    flatAnnotations: WellSelection[];

    columnIndices: number[];    // (Non-)pruned column indices.
    columnToIndex: number[];
    rowIndices: number[];       // (Non-)pruned column rows.
    rowToIndex: number[];

    wellDiameter: number;

    selectionOutlines: jsts.geom.Geometry[];
    selectionRims: jsts.geom.Geometry[];

    constructor(id: string,
                topLeft: number[],
                public state: EnrichedState,
                public columnLabels: boolean = true,
                public rowLabels: boolean = true,
                public prune: boolean = false) {
        super(id, topLeft);

        var cfg = state.configuration;
        var info = state.dataSetInfo.value;
        var plate = this.state.focused().plate;
        var annotations =  this.state.plateTargetAnnotations(plate);
        this.flatAnnotations = <WellSelection[]> _.flatten(_.values(annotations).map(ann => _.values(ann)));

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
        this.columnIndices.forEach((cI, i) => this.columnToIndex[cI] = i);
        this.rowToIndex = [];
        this.rowIndices.forEach((rI, i) => this.rowToIndex[rI] = i);

        // Adjust well diameter, based on number of selected columns and rows.
        this.wellDiameter = cfg.wellDiameter * Math.max(
                .5 * Math.min(
                    Math.floor(info.columnCount / this.columnIndices.length),
                    Math.floor(info.rowCount / this.rowIndices.length)),
                1);

        // Selection contours.
        var gf = new jsts.geom.GeometryFactory();
        var tileAt = (wc: WellCoordinates, dilation: number) => {
            var columnIndex = this.columnToIndex[wc.column];
            var rowIndex = this.rowToIndex[wc.row];

            var topLeft = new jsts.geom.Coordinate(
                    columnIndex * this.wellDiameter - dilation, rowIndex * this.wellDiameter - dilation);
            var topRight = new jsts.geom.Coordinate(
                    (columnIndex + 1) * this.wellDiameter + dilation, rowIndex * this.wellDiameter - dilation);
            var bottomRight = new jsts.geom.Coordinate(
                    (columnIndex + 1) * this.wellDiameter + dilation, (rowIndex + 1) * this.wellDiameter + dilation);
            var bottomLeft = new jsts.geom.Coordinate(
                    columnIndex * this.wellDiameter - dilation, (rowIndex + 1) * this.wellDiameter + dilation);

            return gf.createPolygon(gf.createLinearRing([topRight, topLeft, bottomLeft, bottomRight, topRight]), []);
        };
        this.selectionOutlines = this.flatAnnotations.map(ws => {
            // Tile per well.
            var wellTiles = ws.wells.map(wc => tileAt(wc, 0));
            var body = new jsts.operation.union.CascadedPolygonUnion(wellTiles).union();
            return body;    //body ? body.buffer(1, 3, 0) : null;
        });
        this.selectionRims = this.flatAnnotations.map(ws => {
            // Tile per well.
            var wellTiles = ws.wells.map(wc => tileAt(wc, .5));
            var body = new jsts.operation.union.CascadedPolygonUnion(wellTiles).union();
            return body;    //body ? body.buffer(1, 3, 0) : null;
        });

        this.setDimensions([this.columnIndices.length * this.wellDiameter, this.rowIndices.length * this.wellDiameter]);
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        var xIndex = Math.round(coordinates[0] * (this.columnIndices.length - 1));
        var yIndex = Math.round(coordinates[1] * (this.rowIndices.length - 1));

        if(xIndex in this.columnIndices && yIndex in this.rowIndices) {
            var postPruneCoordinates = new WellCoordinates(this.columnIndices[xIndex], this.rowIndices[yIndex]);
            interaction.selectedCoordinates.switchWell(postPruneCoordinates);
            interaction.pushView('plates');
        }
    }

    paint(context: ViewContext) {
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
    }

    paintWellLabels(ctx: ViewContext) {
        var cfg = this.state.configuration;
        var info = this.state.dataSetInfo.value;

        var lblX = -cfg.plateRowLabelMargin;    //this.columnIndices.length * this.wellDiameter + cfg.plateRowLabelMargin;
        var lblY = this.rowIndices.length * this.wellDiameter + cfg.plateColLabelMargin;

        ctx.save();

        ctx.font(cfg.sideFont.toString());
        var focused = this.state.focused();

        // Column labels at the top.
        if(this.columnLabels) {
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
            this.columnIndices.forEach(cI => {
                if(cI in columnColors) {
                    ctx.fillStyle(columnColors[cI]);
                    ctx.fillText(info.columnLabels[cI], (this.columnToIndex[cI] + .5) * this.wellDiameter, lblY);
                }
            });
        }

        // Row labels at the right.
        if(this.rowLabels) {
            ctx.textAlign('right');
            ctx.textBaseline('middle');
            this.rowIndices.forEach(rI => {
                if(rI in rowColors) {
                    ctx.fillStyle(rowColors[rI]);
                    ctx.fillText(info.rowLabels[rI], lblX, (this.rowToIndex[rI] + .5) * this.wellDiameter);
                }
            });
        }

        ctx.restore();
    }

    paintSelectionBody(ctx: ViewContext) {
        var cfg = this.state.configuration;
        var info = this.state.dataSetInfo.value;

        ctx.fillStyle(cfg.base.alpha(0.2));
        ctx.beginPath();
        this.selectionOutlines.forEach(so => TemplatePlate.geometryToPath(ctx, so));
        ctx.fill();
    }

    paintSelectionOutlines(ctx: ViewContext) {
        var cfg = this.state.configuration;
        var info = this.state.dataSetInfo.value;

        this.selectionOutlines.forEach((so, i) => {
            ctx.strokeStyle(cfg.backgroundColor);
            ctx.lineWidth(2);
            ctx.beginPath();
            TemplatePlate.geometryToPath(ctx, so);  //this.selectionRims[i]);
            ctx.stroke();

            if(this.flatAnnotations[i].category === "Selected") {
                ctx.fillStyle(cfg.baseSelected);
                ctx.beginPath();
                TemplatePlate.geometryToPath(ctx, so);
                ctx.fill();
            } else {
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

    static ringToPath(context: ViewContext, ring: jsts.geom.LineString) {
        var cs = ring.getCoordinates();
        context.moveTo(cs[0].x, cs[0].y);
        for (var i = 1; i < cs.length; i++) context.lineTo(cs[i].x, cs[i].y);
        context.closePath();
    }

    /*private static arcRad = 4;
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
    }*/
}

class TemplatePlate extends AbstractPlate {
    constructor(topLeft: number[], public model: EnrichedState) {
        super("tmpPlt", topLeft, model);
    }

    paint(context: ViewContext) {
        context.save();
        context.translate(this.topLeft);
        context.transitioning = false;

        this.paintWells(context);

        context.transitioning = true;
        context.restore();

        super.paint(context);
    }

    paintWells(ctx: ViewContext) {
        var cfg = this.model.configuration;
        var info = this.model.dataSetInfo.value;
        var selection = this.model.focused();
        var wellShares = this.model.wellScores()[selection.plate] || [];

        // Well outlines.
        ctx.strokeStyle(cfg.baseDim);
        for(var c = 0; c < info.columnCount; c++) {
            var x = c * cfg.wellDiameter;

            for(var r = 0; r < info.rowCount; r++) {
                var y = r * cfg.wellDiameter;
                //ctx.strokeRect(x, y, this.wellDiameter, this.wellDiameter);

                if(wellShares[c] && wellShares[c][r] >= -1) {
                    ctx.fillStyle(BaseConfiguration.shareColorMap(wellShares[c][r]));
                    ctx.fillRect(x + .25, y + .25, this.wellDiameter - .5, this.wellDiameter - .5);
                } else {
                    //ctx.strokeLine([x + .25, y + .25], [x + cfg.wellDiameter - .25, y + cfg.wellDiameter - .25]);
                    //ctx.strokeLine([x + .25, y + cfg.wellDiameter - .25], [x + cfg.wellDiameter - .25, y + .25]);
                }
            }
        }
    }
}

class FlowerPlate extends AbstractPlate {
    constructor(topLeft: number[], public state: EnrichedState) {
        super("flwPlt", topLeft, state, true, true, true);
    }

    paint(context: ViewContext) {
        // Selections behind well flowers.
        super.paint(context);

        context.save();
        context.translate(this.topLeft);
        context.transitioning = false;

        this.paintWells(context);

        context.transitioning = true;
        context.restore();
    }

    paintWells(ctx: ViewContext) {
        var cfg = this.state.configuration;
        var info = this.state.dataSetInfo.value;

        ctx.save();

        // Population abundance flowers.
        //for(var c = 0; c < info.columnCount; c++)
        //    for(var r = 0; r < info.rowCount; r++)
        //        this.paintPopulationFlower(ctx, c, r);
        this.columnIndices.forEach(cI => this.rowIndices.forEach(rI => this.paintPopulationFlower(ctx, cI, rI)));

        ctx.restore();
    }

    // Population abundance flower.
    paintPopulationFlower(ctx: ViewContext, column: number, row: number) {
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

        var maxObjectCount = wellClusterShares.maxPlateObjectCount[selection.plate];    //wellClusterShares.maxObjectCount;
        var normObjectCellCount = Math.sqrt(maxObjectCount);

        // Draw flower slice
        var populations = this.state.populationSpace.allPopulations().elements.filter(p => p.exemplars.length > 0);
        populations.forEach((p, pI) => {
            var clusterShares = this.state.wellClusterShares.value.wellIndex[p.identifier] || [];
            var wellShares = clusterShares[selection.plate] || [];
            var columnShares = wellShares[column] || [];
            var share = columnShares[row];

            ctx.fillStyle(this.state.populationColor(p));
            ctx.strokeStyle(cfg.baseEmphasis);
            ctx.lineWidth(.5);

            if(share >= 0 && cellCount >= 0) {
                var beginRad = 0.5 * Math.PI + 2 * Math.PI * pI / populations.length;
                var endRad = 0.5 * Math.PI + 2 * Math.PI * (pI + 1) / populations.length;

                var normWellCount = Math.sqrt(share * cellCount) / normObjectCellCount;

                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.arc(x, y, normWellCount * 0.5 * this.wellDiameter, beginRad, endRad);
                ctx.lineTo(x, y);

                ctx.fill();

                ctx.stroke();
            }
        });
    }
}

class JointWellPlates extends List<AbstractPlate> {
    constructor(public state: EnrichedState) {
        super("jntPlt",
            [new TemplatePlate([0,0], state), new FlowerPlate([0,0], state)],
            [0,0], [0,0],
            'vertical',
            state.configuration.panelHeaderSpace);
    }

    toString() {
        var focusedPlate = this.state.focused().plate;
        return "Plate " + this.state.dataSetInfo.value.plateLabels[focusedPlate];
    }
}

class WellView extends List<PlacedSnippet> {
    constructor(public state: EnrichedState) {
        super("WellView",
            [new WellListView(state), new WellDetailView(state)],
            [0,0], [0,0],
            'horizontal',
            state.configuration.subPanelSpace,
            'left');
    }

    toString(opened?: boolean) {
        var wellFilter = this.state.selectedCoordinates.wellFilter;
        return "Wells" + (opened ?
                ": " + (wellFilter.length > 0 ? wellFilter : "\<press key\>") :
                "");
    }
}

class WellListView extends List<PlacedSnippet> {
    constructor(public state: EnrichedState) {
        super("WellDetailView",
                [WellListView.transferButtons(state),
                 WellListView.tableColumns(state)],
                [0,0], [0,0],
                'vertical',
                state.configuration.subPanelSpace,
                'right'
        );
    }

    static tableColumns(state: EnrichedState) {
        var columns = ['plate', 'column', 'row']
                    .map<PlacedSnippet>(field => new WellLocationList(field, WellListView.composeWells(state), state))
                    .concat(new WellAbundanceList(state, WellListView.composeWells(state), WellListView.buttonsWidth(state)));
        return new List(
            "WellDetailColumns",
            columns,
            [0,0], [0,0],
            'horizontal',
            state.configuration.listColumnSpace,
            'left');
    }

    static buttonsWidth(state: EnrichedState) {
        var cfg = state.configuration;
        var pCnt = state.populationSpace.populations.length;
        return pCnt * cfg.transferPlotSize + (pCnt - 1) * cfg.exemplarColumnSpace;
    }

    static transferButtons(state: EnrichedState) {
        var cfg = state.configuration;

        var mainPopulations = _.union(
            state.populationSpace.visiblePopulations().elements,
            [state.populationSpace.populations.byId(Population.POPULATION_TOTAL_NAME)]
        );

        //var transferLabel = new Label("PopulationTransfersLbl", "Score", [0,0], cfg.subPanelHeaderLabel, true);
        var transferButtons = new List("PopulationTransfers",
               //_.union<PlacedSnippet>([transferLabel],
                    mainPopulations.map((p, pI) => new PopulationTransferEdit(p, state, pI === 0)), //),
                [0,0], [0,0], 'horizontal', cfg.exemplarColumnSpace, 'left');

        return transferButtons;
    }

    static composeWells(state: EnrichedState) {
        return state.topWells();
    }
}

class WellLocationList extends List<Label> {
    constructor(field: string, wells: WellScore[], public state: EnrichedState) {
        super("WL_" + field,
            wells.map(well => new WellLocationLabel(well.location, field, state)),
            [0,0], [0,0],
            'vertical',
            state.configuration.listWellSpace,
            'middle');
    }

    /*static label(location: WellLocation, field: string, state: EnrichedState) {
        var fieldTag = state.dataSetInfo.value[field + "Labels"][location[field]];
        return new Label(
            "WL_" + field + "_" + location.toString(),
            fieldTag,
            [0,0],
            location.equals(state.selectedCoordinates.location()) ?
                state.configuration.selectedSideLabel :
                state.configuration.sideLabel
        );
    }*/
}

class WellLocationLabel extends Label {
    constructor(public location: WellLocation, field: string, state: EnrichedState) {
        super("WL_" + field + "_" + location.toString(),
            state.dataSetInfo.value[field + "Labels"][location[field]],
            [0,0],
            location.equals(state.selectedCoordinates.location()) ?
                state.configuration.selectedSideLabel :
                state.configuration.sideLabel,
            true);
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[],
               enriched: EnrichedState, interaction: InteractionState) {
        interaction.selectedCoordinates.switchLocation(this.location);
    }
}

class WellAbundanceList extends PlacedSnippet {
    private wellHeight: number;
    private populationAreaWidth: number;
    private populationAreas: Polygon[];

    private cntMin: number;
    private cntMax: number;
    private cntLine: Line;

    private abundanceShareMax: number;

    constructor(public state: EnrichedState, public wells: WellScore[], width: number) {
        super("WellAbundances");

        var cfg = state.configuration;
        this.wellHeight = cfg.listWellLabel.font.size + cfg.listWellSpace;

        this.setDimensions([
            width,
            wells.length * this.wellHeight
        ]);

        this.createPopulationAreas();
    }

    createPopulationAreas() {
        var cfg = this.state.configuration;
        var clusterShares = this.state.wellClusterShares.value;
        var populations = this.state.populationSpace.visiblePopulations().elements;

        // Per well, population.
        var shares: number[][] = populations.map(p => this.wells.map(well =>
                                    clusterShares.share(p.identifier, well.location)));

        // Cumulative share, first column is padding.
        var cumulativeShares: number[][] = [this.wells.map(w => 0)];
        populations.forEach((p, i) => cumulativeShares.push(Vector.add(cumulativeShares[i], shares[i])));

        // Normalize cumulative shares to [0, max.cum. share].
        this.abundanceShareMax = _.max(cumulativeShares[cumulativeShares.length - 1]);
        cumulativeShares = cumulativeShares.map(pS => pS.map(s => s / this.abundanceShareMax));

        this.populationAreaWidth = this.dimensions[0] - cfg.transferPlotSize - cfg.exemplarColumnSpace;
        this.populationAreas = populations.map((p, pI) => {
            var listCs = (cI: number) => {
                var midCoordinates = cumulativeShares[cI].map((wShs, wI) => {
                    var y = (wI + .5) * this.wellHeight;
                    var x = wShs * this.populationAreaWidth;
                    return [x, y];
                });

                // Extend ends to close list.
                if(midCoordinates.length > 0)
                    midCoordinates = [[midCoordinates[0][0], 0]]
                        .concat(midCoordinates)
                        .concat([[midCoordinates[midCoordinates.length - 1][0],
                                 midCoordinates.length * this.wellHeight]]);

                return midCoordinates;
            };

            var preList = listCs(pI);
            var postList = listCs(pI + 1).reverse();
            var totalList = preList.concat(postList);

            return new Polygon("WellListArea_" + p.identifier, totalList, p.color, cfg.backgroundColor, false);
        });

        // Object count (total population).
        var counts = this.wells.map(w => clusterShares.share(Population.POPULATION_TOTAL_NAME, w.location));
        if(counts) {
            this.cntMin = 0;
            this.cntMax = clusterShares.maxObjectCount;
            var cntDelta = (this.cntMax - this.cntMin);
            var cntWidth = cfg.transferPlotSize;

            var cntListCs = counts.map((cnt, wI) => {
                var y = (wI + .5) * this.wellHeight;
                var x = cntWidth * (cnt - this.cntMin) / cntDelta;
                return [x, y];
            });

            // Extend ends to close list.
            if(cntListCs.length > 0)
                cntListCs = [[cntListCs[0][0], 0]]
                    .concat(cntListCs)
                    .concat([[cntListCs[cntListCs.length - 1][0],
                             cntListCs.length * this.wellHeight]]);

            this.cntLine = new Line("WellCountLine", cntListCs, Population.POPULATION_TOTAL_COLOR, false);
        }
    }

    paint(context: ViewContext) {
        var cfg = this.state.configuration;

        context.save();
        context.translate(this.topLeft);
        context.snippets(this.populationAreas);

        // Origin demarcation.
        context.strokeStyle(cfg.baseDim);
        context.font(cfg.transferFont.toString());
        var demarcLength = this.dimensions[1] + 2;

        // Minimum abundance (0%) at left.
        context.textAlign('left');
        context.textBaseline('top');
        context.fillText("0", 0, this.dimensions[1]);
        context.strokeLine([0,0], [0,demarcLength]);

        // Abundance label.
        context.textAlign('left');
        context.textBaseline('top');
        context.fillText('% abundance', 0, this.dimensions[1] + cfg.transferFont.size);

        // Maximum abundance at right.
        context.textAlign('right');
        context.textBaseline('top');
        context.fillText((this.abundanceShareMax * 100).toFixed(0), this.populationAreaWidth, this.dimensions[1]);
        context.strokeLine([this.populationAreaWidth,0], [this.populationAreaWidth,demarcLength]);

        // Move to cell part.
        context.translate([this.populationAreaWidth + cfg.exemplarColumnSpace, 0]);

        // Minimum cells at left.
        context.textAlign('left');
        context.textBaseline('top');
        context.fillText(this.cntMin.toString(), 0, this.dimensions[1]);
        context.strokeLine([0,0], [0,demarcLength]);

        // Cell label.
        context.textAlign('left');
        context.textBaseline('top');
        context.fillText('# cells', 0, this.dimensions[1] + cfg.transferFont.size);

        // Maximum cells at right.
        context.textAlign('right');
        context.textBaseline('top');
        context.fillText(this.cntMax.toString(), cfg.transferPlotSize, this.dimensions[1]);
        context.strokeLine([cfg.transferPlotSize,0], [cfg.transferPlotSize,demarcLength]);

        // Count plot.
        context.snippet(this.cntLine);

        context.restore();
    }
}

class WellDetailView extends PlacedSnippet {
    imageTypeOption: ConfigurationOptions;
    overlayOption: ConfigurationOptions;
    optionTable: List<PlacedSnippet>;

    annotationTable: WellAnnotationTable;
    objectMaxRadi: StringMap<number[]>;

    imgDim: number[];
    wellScale: number;
    imgScaledDim: number[];

    constructor(public state: EnrichedState) {
        super("WellDetailView", [0,0]);

        var cfg = state.configuration;

        this.imgDim = state.dataSetInfo.value.imageDimensions;
        this.wellScale = Math.min(1, cfg.wellViewMaxWidth / this.imgDim[0]);
        this.imgScaledDim = Vector.mul(this.imgDim, this.wellScale);

        this.setDimensions(this.imgScaledDim);

        var availableTypes = _.keys(state.availableImageTypes());
        var wellOptions: StringMap<string> = {};
        availableTypes.forEach(t => wellOptions[t] = t);
        this.overlayOption = new ConfigurationOptions(
            "WellOverlayOptions",
            [0,0],
            state,
            "imagePopulationOverlay",
            {None: "None", Phenotypes: "Phenotypes"}
        );
        this.imageTypeOption = new ConfigurationOptions(
            "WellDetailOptions",
            [0,0],
            state,
            "imageType",
            wellOptions);
        var options = new List(
            "wellOptions",
            [this.overlayOption, this.imageTypeOption],
            [0,0], [0,0],
            'vertical',
            cfg.annotationColumnSpace,
            'left'
        );
        var optionLabels = new List(
            "wellOptionLabels",
            ["overlay", "image"].map(lbl => new Label("opt_" + lbl, lbl, [0,0], cfg.annotationCategoryLabel)),
            [0,0], [0,0],
            'vertical',
            cfg.annotationColumnSpace,
            'right'
        );
        this.optionTable = new List(
            "wellOptionTable",
            [optionLabels, options],
            [0,0], [0,0],
            'horizontal',
            2 * cfg.annotationColumnSpace
        );

        var focused = state.focused();
        this.annotationTable = new WellAnnotationTable(
            "focusedAnnotations",
            state.wellAnnotations.value.annotationsAt(focused.plate, focused.well), state
        );

        // Generate predicted population outlines.
        this.computePopulationOutlines();
    }

    setTopLeft(topLeft: number[]) {
        super.setTopLeft(topLeft);

        if(this.optionTable && this.annotationTable) {
            var annotationHeight = this.annotationTable.dimensions[1];
            var optionsHeight = this.optionTable.dimensions[1];
            var maxHeight = Math.max(annotationHeight, optionsHeight);

            this.annotationTable.setTopLeft(Vector.add(
                    this.topLeft, [0, maxHeight - annotationHeight]));
            this.optionTable.setTopLeft(Vector.add(
                    this.topRight,
                    [-this.optionTable.dimensions[0], maxHeight - optionsHeight]));
        }
    }

    private computePopulationOutlines() {
        this.objectMaxRadi = this.state.objectInfo.value["wellOutlines"];

        if(!this.objectMaxRadi) {
            var objectCoordinates = this.state.focusedWellCoordinates();

            this.objectMaxRadi = {};
            _.pairs(objectCoordinates).forEach(p =>
                this.objectMaxRadi[p[0]] = [
                    p[1][0],
                    p[1][1],
                    Math.min(this.state.configuration.wellViewMaxObjectRadius,
                        0.5 * _.min(_.pairs(objectCoordinates).map(sp =>
                            p[0] === sp[0] ? Number.POSITIVE_INFINITY : Vector.distance(p[1], sp[1])))) - 5,
                    this.state.objectInfo.value.cell("population", p[0])
                ]
            );

            this.state.objectInfo.value["wellOutlines"] = this.objectMaxRadi;  //this.outlines;
        }
    }

    paint(ctx: ViewContext) {
        var state = this.state;
        var cfg = state.configuration;

        //ctx.transitioning = false;
        ctx.save();
        ctx.translate(this.topLeft);
        ctx.translate([0,
            2 * cfg.annotationColumnSpace +  Math.max(this.annotationTable.dimensions[1], this.optionTable.dimensions[1])
        ]);

        var well = state.selectionWell(state.focused());
        if(well) {
            var img = well.image(cfg.imageType);

            ctx.transitioning = false;

            ctx.context.beginPath();
            ctx.context.rect(0, 0, this.imgScaledDim[0], this.imgScaledDim[1]);
            ctx.context.clip();

            if(img) {
                ctx.picking = true;
                ctx.drawImageClipped(
                    img,
                    [0, 0], [img.width, 0.5 * img.height],
                    [0, 0], [this.wellScale * img.width, this.wellScale * 0.5 * img.height]);
                ctx.picking = false;
            }

            // Population outline overlay.
            if(cfg.imagePopulationOverlay === "Phenotypes") {
                ctx.save();
                var allPopulations = this.state.populationSpace.allPopulations();
                _.pairs(this.objectMaxRadi).forEach(p => {
                    //var obj = p[0];
                    var cs = p[1];
                    if (cs[3] >= 0) {
                        var x = this.wellScale * cs[0];
                        var y = this.wellScale * cs[1];
                        var rad = this.wellScale * cs[2];
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
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[],
               enriched: EnrichedState, interaction: InteractionState) {
        var object = enriched.closestWellObject(coordinates);

        interaction.selectedCoordinates.switchObject(object);
        enriched.conformSelectedCoordinates(interaction);

        interaction.pushView('well');
    }
}

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

class WellAnnotationTable extends List<List<Label>> {
    constructor(identifier: string, annotations: StringMap<string[]>, state: EnrichedState) {
        super(identifier,
            [
            new List(
                "annTableLbls",
                WellAnnotationTable.annotationKeys(annotations).map(k =>
                    new Label("annTableLbl" + k, k.toLowerCase(), [0,0], state.configuration.annotationCategoryLabel, false)),
                [0,0], [0,0],
                'vertical',
                state.configuration.annotationColumnSpace,
                'right'),
            new List(
                "annTableRows",
                WellAnnotationTable.annotationKeys(annotations).map(k =>
                    new WellAnnotationRow(identifier, k, annotations[k], state)),
                [0,0], [0,0],
                'vertical',
                state.configuration.annotationColumnSpace,
                'left')
            ],
            [0,0], [0,0],
            'horizontal',
            2 * state.configuration.annotationColumnSpace);
    }

    static annotationKeys(annotations: StringMap<string[]>) {
        return _.keys(annotations).sort((l, r) => l.length - r.length);
    }
}

class WellAnnotationRow extends List<Label> {
    constructor(tableId: string, category: string, tags: string[], state: EnrichedState) {
        super(tableId + "_" + category,
            tags.map(tag => new AnnotationButton(category, tag, state)),
            [0,0],
            [0,0],
            'horizontal',
            state.configuration.annotationTagSpace,
            'left'
        );
    }
}

class AnnotationButton extends Label {
    constructor(public category: string,
                public tag: string,
                state: EnrichedState) {
        super(
            "annBut_" + (category || "") + "_" + tag,
            tag,
            [0,0],
            !category || state.isTagActive(tag) ?
                state.configuration.annotationSelectedLabel :
                state.configuration.annotationLabel,
            true);
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        interaction.selectedCoordinates.wellFilter = this.tag;
    }
}

class ObjectDetailView extends PlacedSnippet {
    private focused: boolean;

    constructor(public object: number,
                public state: EnrichedState,
                topLeft = [0, 0]) {
        super("odv_" + object, topLeft);

        var cfg = state.configuration;
        this.focused = state.focused().object === object;
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

        //var objectWells = mod.allObjectWells();
        var wellInfo = mod.objectWellInfo(this.object);

        //var well = mod.wellLocation()//objectWells.location(this.object);
        if(wellInfo) {
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
                if(predPop) {
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
                if(this.focused) {
                    ctx.strokeStyle(cfg.backgroundColor);
                    ctx.lineWidth(4);
                } else {
                    ctx.strokeStyle(Color.NONE);
                }
                ctx.transitioning = true;
                ctx.strokeRect(0, 0, this.dimensions[0], this.dimensions[1]);

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
        //interaction.removeExemplar(this.object);
        //interaction.selectedCoordinates.object = this.object;
        interaction.selectedCoordinates.switchObject(this.object);
        enriched.conformSelectedCoordinates(interaction);

        // Remove exemplar status of object (on second click).
        if(this.focused) interaction.removeExemplar(this.object);
    }

    /*mouseMove(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        interaction.hoveredCoordinates.object = this.object;
        interaction.hoveredCoordinates.population = this.targetPopulation;
        enriched.conformHoveredCoordinates(interaction);
    }*/
}

class PlateIndex extends PlacedSnippet {
    private heatmapColumns: List<PlacedSnippet>;
    private selectedHeatmap: TemplatePlate;

    constructor(public state: EnrichedState) {
        super("pi", [0,0]);

        var cfg = state.configuration;
        var datInfo = state.dataSetInfo.value;

        var focusPlateWidth = cfg.largeHeatMultiplier;
        var focusPlateHeight = focusPlateWidth + 1;

        var addedPlates = _.range(datInfo.plateCount);

        var initialStackCnt = Math.ceil(addedPlates.length / cfg.miniHeatColumnMax);
        var regularPlates = (initialStackCnt - focusPlateWidth) * cfg.miniHeatColumnMax;

        var plateStacks = [];   //_.range(0, Math.ceil(addedPlates.length / cfg.miniHeatColumnMax)).map(c => []);
        addedPlates.forEach((p, pI) => {
            // Regular plate goes to regular stack.
            var targetStack = -1;
            if(pI < regularPlates) {
                targetStack = Math.floor(pI / cfg.miniHeatColumnMax);
            }
            // Shortened stack.
            else {
                var pRI = pI - regularPlates;
                var relStack = Math.floor((regularPlates + 1) / cfg.miniHeatColumnMax);
                targetStack = relStack + Math.floor(pRI / (cfg.miniHeatColumnMax - focusPlateHeight));
            }

            var stack = plateStacks[targetStack];
            if(!stack) {
                stack = [];
                plateStacks[targetStack] = stack;
            }
            stack.push(p);
        });

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
                "pic_" + psI,
                snippetStack,   //ps.map(p => new PlateMiniHeatmap(p, state)),
                [0, 0], [0, 0],
                'vertical',
                cfg.miniHeatSpace,
                'middle');
        });

        var colLists = new List(
            "pic_",
            stackLists,
            [0, 0], [0, 0],
            'horizontal',
            cfg.miniHeatSpace,
            'right');

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
        if(focusedPlate >= 0) this.selectedHeatmap = new TemplatePlate([0,0], state);

        this.dimensions = this.heatmapColumns.dimensions;
        this.updatePositions();
    }

    setTopLeft(topLeft: number[]) {
        super.setTopLeft(topLeft);

        if(this.heatmapColumns)
            this.heatmapColumns.setTopLeft(topLeft);
        if(this.selectedHeatmap) {
            var cfg = this.state.configuration;

            this.selectedHeatmap.setTopLeft(Vector.add(this.topRight,
                [-this.selectedHeatmap.dimensions[0], cfg.sideLabel.font.size + cfg.miniHeatSpace]));
        }
    }

    paint(context: ViewContext) {
        var state = this.state;
        var cfg = state.configuration;

        // Heat maps.
        context.snippet(this.heatmapColumns);
        context.snippet(this.selectedHeatmap);
    }

    toString() {
        return "Plates";
    }
}

class SubstitutePlateLabel extends Label {
    constructor(identifier: string,
                label: string,
                dimensions: number[],
                style: LabelStyle) {
        super(identifier, label, [0,0], style);

        if(dimensions !== null)
            this.setDimensions([this.dimensions[0], dimensions[1] - 2 * this.dimensions[1]]);
    }
}

class PlateMiniHeatmap extends PlacedSnippet {
    private shareImg: any;
    private wellFilled: boolean;

    constructor(public plateNumber: number, public state: EnrichedState) {
        super("mh_" + plateNumber, [0,0]);

        var cfg = state.configuration;
        var info = state.dataSetInfo.value;

        var image = PlateMiniHeatmap.plateShareImage(state, plateNumber);
        this.shareImg = image.image;
        this.wellFilled = image.wellFilled;

        this.dimensions = [info.columnCount * cfg.miniHeatWellDiameter, info.rowCount * cfg.miniHeatWellDiameter];
        this.updatePositions();
    }

    paint(context: ViewContext) {
        var state = this.state;
        var cfg = state.configuration;

        context.save();
        context.translate(this.topLeft);

        context.transitioning = false;

        // Highlight background of a plate when it has a filled well.
        if(this.wellFilled) {
            context.fillStyle(cfg.lightSelected);
            context.fillRect(0, 0, this.dimensions[0], this.dimensions[1]);
        }

        // Outline.
        context.strokeStyle(cfg.baseDim);
        context.strokeRect(0, 0, this.dimensions[0], this.dimensions[1]);

        // Heat map image.
        context.drawImage(this.shareImg);

        // Plate highlight outline.
        if(state.focused().plate === this.plateNumber) {
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
                context.fillRect(well.column * cfg.miniHeatWellDiameter - 1, well.row * cfg.miniHeatWellDiameter - 1,
                                 cfg.miniHeatWellDiameter + 2, cfg.miniHeatWellDiameter + 2);

                context.fillStyle(cfg.baseSelected);
                context.fillRect(well.column * cfg.miniHeatWellDiameter - .5, well.row * cfg.miniHeatWellDiameter - .5,
                                 cfg.miniHeatWellDiameter + 1, cfg.miniHeatWellDiameter + 1);
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

    static plateShareImage(model: EnrichedState, plate: number): {image: any; wellFilled: boolean} {
        var tag = "cimg_" + plate + "_" + model.populationSpace.activationString() + "_" + model.focused().wellFilter;
        var wellClusterShares = model.wellClusterShares.value;
        var plateShareImage = wellClusterShares[tag];

        if(!plateShareImage) {
            var cfg = model.configuration;
            var datInfo = model.dataSetInfo.value;
            var plateShares = model.wellScores()[plate] || [];
            var wellFilled = false;

            var imgWidth = datInfo.columnCount * cfg.miniHeatWellDiameter;
            var imgHeight = datInfo.rowCount * cfg.miniHeatWellDiameter;
            var image = view.View.renderToCanvas(imgWidth, imgHeight, ctx => {
                for(var c = 0; c < datInfo.columnCount; c++) {
                    var cVals = plateShares[c] || [];
                    var cX = c * cfg.miniHeatWellDiameter;

                    for(var r = 0; r < datInfo.rowCount; r++) {
                        var val = cVals[r];
                        if(val >= 0) wellFilled = true;
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
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        interaction.selectedCoordinates.switchPlate(this.plateNumber);
        interaction.selectedCoordinates.well = PlateMiniHeatmap.wellCoordinatesAt(coordinates, enriched);

        interaction.pushView('plates');
    }
    static wellCoordinatesAt(mouseCoordinates: number[], state: EnrichedState) {
        var info = state.dataSetInfo.value;

        return new WellCoordinates(
            Math.round(mouseCoordinates[0] * (info.columnCount - 1)),
            Math.round(mouseCoordinates[1] * (info.rowCount - 1))
        );
    }
}

class ConfigurationButton extends Label {
    constructor(identifier: string,
                text: string,
                position: number[],
                public targetField: string,
                public targetValue: any,
                style: LabelStyle) {
        super(identifier, text, position, style, true);
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        interaction.configuration[this.targetField] = this.targetValue;
    }
}

class ConfigurationOptions extends PlacedSnippet {
    buttons: List<ConfigurationButton>;

    constructor(identifier: string,
                topLeft: number[],
                public targetState: InteractionState,
                public targetField: string,
                public targetMap: StringMap<any>) {
        super(identifier, topLeft);

        var cfg = targetState.configuration;
        var baseStyle: LabelStyle = new LabelStyle(cfg.annotationFont, cfg.baseDim, 'left', 'top');
        var selectedStyle: LabelStyle = new LabelStyle(cfg.annotationFont, cfg.baseEmphasis, 'left', 'top');

        var buttonSnippets = _.pairs(targetMap).map((p, pI) => {
            var label = p[0];
            var value = p[1];
            var style = cfg[targetField] === value || (!cfg[targetField] && pI === 0) ? selectedStyle : baseStyle; // Default to first option.

            return new ConfigurationButton(identifier + "_" + value, label, topLeft, targetField, value, style);
        });

        this.buttons = new List(identifier + "_lst", buttonSnippets, topLeft, [0, 0], 'horizontal', 5, 'top');
        this.setDimensions(this.buttons.dimensions);
    }

    setTopLeft(topLeft: number[]) {
        super.setTopLeft(topLeft);

        if(this.buttons) this.buttons.setTopLeft(topLeft);
    }

    paint(context: ViewContext) {
        context.snippet(this.buttons);
    }
}

class GuideLabel extends Label {

    constructor(identifier: string,
                text: string,
                public position: number[],
                public circleCenter: number[],
                public circleRadius: number,
                public state: InteractionState) {
        super("gdlbl_" + identifier, text, position, state.configuration.guideStyle);
    }

    paint(context: ViewContext) {
        if(this.state.configuration.guideVisible) {
            super.paint(context);

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
    }
}