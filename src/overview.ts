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

import collection = require('./core/collection');
import StringMap = collection.StringMap;

import style = require('./core/graphics/style');
import Color = style.Color;
import Font = style.Font;

// View identifiers and their constructors.
var viewConstructors: () => StringMap<any> = () => {
    return {
        'features':   FeatureHistogramTable,
        'splom':      Splom,
        'exemplars':  ExemplarTable,
        'datasets':   DataSetList,
        'plates':     PlateIndex,
        'plate':      JointWellPlates,
        'well':       WellDetailView
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

        //console.log("Model:");
        //console.log(mod);
    }

    paint(c: ViewContext, iMod: EnrichedState) {
        var cfg = iMod.configuration;
        var dim = this.dimensions();

        //c.context.clearRect(0, 0, dim[0], dim[1]);

        // Center panels.
        var topLeft = Vector.mul(Vector.subtract(this.dimensions(), this.panelColumns.dimensions), .5);
        //this.panelColumns.setTopLeft(topLeft);

        this.panelColumns.setTopLeft([
            Math.min(.5 * (this.dimensions()[0] - this.panelColumns.dimensions[0]),
                    this.dimensions()[0] - this.panelColumns.dimensions[0] - cfg.windowMargin),
            cfg.panelSpace    //Math.min()//topLeft[1]
        ]);
        c.snippet(this.panelColumns);

        // Show data loading text.
        var isLoading = _.keys(iMod).filter(prp => iMod[prp] && _.isBoolean(iMod[prp]['converged'])).some(prp => !iMod[prp].converged);
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
    }
}

class ColumnPanel extends List<PlacedSnippet> {
    constructor(identifier: string,
                core: PlacedSnippet,
                state: EnrichedState,
                opened = false) {
        super("cp_" + identifier,
            _.union([new ColumnLabel(identifier, core.toString(), opened, state)], opened ? [core] : []), //[new Label("hdr_" + identifier, core.toString(), [0,0], state.configuration.panelHeaderLabel), core],
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
        return "Screen " + this.state.selectedCoordinates.dataSet;
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
                new FeatureParallelCoordinates(state)
            ],
            [0,0],
            [0,0],
            'horizontal',
            state.configuration.featureCellSpace[0]
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
        interaction.pushView('splom');
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
        var focusedPopulation = state.focused().population;
        var histograms = state.featureHistograms.value;
        var frames = state.featureHistograms.value.histograms;
        var cacheTag = this.identifier + "_" + focusedPopulation;

        var cachedImage = histograms[cacheTag];
        if(!cachedImage) {
            cachedImage = View.renderToCanvas(this.dimensions[0], this.dimensions[1], plainContext => {
                _.keys(frames).map((fK, fI) => {
                    var frame = frames[fK];
                    var normFrequencies = frame.matrix[frame.columnIndex[this.feature]];
                    var fontColor = fK === '-1' ?
                        cfg.baseDim :
                        this.state.populationColorTranslucent(this.state.populationSpace.populations.byId(fK));

                    plainContext.fillStyle = fontColor.toString();
                    //plainContext.beginPath();
                    var len = normFrequencies.length - 1;
                    var spanWidth = this.dimensions[0] - 1;
                    var spanHeight = this.dimensions[1] - 1;
                    for(var i = 0; i <= len; i++) {
                        var x1 = i * spanWidth / len;
                        var f1 = normFrequencies[i];
                        var y1 = (1 - f1) * spanHeight;

                        plainContext.fillRect(x1, y1, 1, 1);


                        //if(i > 0)
                        //    plainContext.lineTo(x1, y1);
                        //else
                        //    plainContext.moveTo(x1, y1);
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

    constructor(public model: EnrichedState) {
        super("splom", [0, 0]);

        var cfg = model.configuration;
        var features = model.populationSpace.features.elements;

        this.plots = features
            .map((f1, i1) => features.map((f2, i2) =>
                i1 < i2 ?
                    new ObjectFeaturePlot(f1, f2, [0,0], model, cfg, cfg.splomInnerSize, i2 === features.length - 1, i1 === 0):
                    null));

        var size = cfg.sideFont.size + Math.max(0, this.model.populationSpace.features.length - 1) * cfg.splomSize;
        this.setDimensions([Math.max(size, cfg.splomSize + cfg.splomInnerSize), size]);
    }

    setTopLeft(topLeft: number[]) {
        super.setTopLeft(topLeft);

        if(this.plots) {
            var configuration = this.model.configuration;
            var marginTopLeft = Vector.add(this.topLeft, [configuration.sideFont.size, 0]);
            this.plots.forEach((pC, pCI) => pC.forEach((p, pRI) => {
                if(p) p.topLeft = Vector.add(marginTopLeft, [pCI * configuration.splomSize, (pRI-1) * configuration.splomSize])
            }));
        }
    }

    paint(context: ViewContext) {
        this.plots.map(plts => context.snippets(plts));
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
                public footerLabel: string = null) {
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
        var histograms = mod.objectHistograms.value.matricesFor(this.feature1, this.feature2);
        var pairHistos = _.pairs(histograms);
        if(pairHistos) {
            context.save();

            var focusedPopulation = mod.focused().population;
            pairHistos.forEach(hP => {
                var cK = hP[0];
                var matrix = hP[1];
                var population = mod.populationSpace.populations.byId(cK);
                var focused = !(Number(cK) >= 0) || focusedPopulation === Number(cK);

                var coreColor = Number(cK) >= 0 ? mod.populationColorTranslucent(population) : cfg.base;
                matrix.forEach((c, xI) => c.forEach((cell, yI) => {
                    if((focused && cell) || (!focused && (cell === 2 || cell === 3))) {
                        context.fillStyle = coreColor;
                        context.fillRect(xI, size - yI, 1, 1);
                    }
                }));
            });

            context.restore();
        }
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

        context.drawImageScaled(this.cachedBackground, [0,0], [this.size, this.size]);

        context.transitioning = false;
        //context.transitioning = false;

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
}

class ExemplarTable extends PlacedSnippet {
    segments: List<PlacedSnippet>;

    constructor(public state: EnrichedState) {
        super("ExemplarStack", [0,0]);

        var cfg = state.configuration;
        var colSnippets = this.state.populationSpace.populations.elements.map(p => new ExemplarColumn(state, p));

        var exemplarLabel = new Label("ExemplarLbl", "Exemplars", [0,0], state.configuration.subPanelHeaderLabel, true);
        var columns = new List("ExemplarColumns", colSnippets, [0,0], [0,0], 'horizontal', cfg.exemplarColumnSpace, 'left');

        var exemplarSelected = state.focused().object !== null && !state.hoveredObjectIsExemplar();

        var additionButtons = exemplarSelected ?
            new List("ExemplarAdditions",
                    this.state.populationSpace.populations.elements
                        .map(p => new ExemplarAdditionButton(state.focused().object, p, state)),
                    [0,0], [0,0], 'horizontal', cfg.exemplarColumnSpace, 'left') :
                null;

        var transferLabel = new Label("PopulationTransfersLbl", "Well Score", [0,0], state.configuration.subPanelHeaderLabel, true);
        var transferButtons = new List("PopulationTransfers",
                this.state.populationSpace.populations.elements
                    .map(p => new PopulationTransferEdit(p, state)),
                [0,0], [0,0], 'horizontal', cfg.exemplarColumnSpace, 'left');

        var selectedObjectDetailView = exemplarSelected ?
                new ObjectDetailView(state.focused().object, state, [0,0]) :
                null;
        var segSnippets: PlacedSnippet[] = _.compact(
                [transferLabel, transferButtons, exemplarLabel, columns, additionButtons, selectedObjectDetailView]);
        this.segments = new List("ExemplarSegments", segSnippets, [0,0], [0,0], 'vertical', cfg.subPanelSpace);

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
        context.font(this.labelStyle.font.toString());
        context.fillText('+');
        context.restore();
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        interaction.populationSpace.addExemplar(this.object, this.population.identifier);
    }
}

class ExemplarColumn extends List<PlacedSnippet> {
    constructor(public state: EnrichedState,
                public population: Population,
                public topLeft = [0, 0]) {
        super(
            "esc_" + population.identifier,
            _.union<PlacedSnippet>(
                [new ExemplarLabel(population, state)],
                population.exemplars.elements.map(ex => new ObjectDetailView(ex, state, [0,0]))
            ),
            topLeft,
            [state.configuration.clusterTileInnerSize, 0],
            'vertical',
            state.configuration.exemplarSpace,
            'middle'
        );
    }

    paint(context: ViewContext) {
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

        super.paint(context);
    }
}

class PopulationTransferEdit extends PlacedSnippet {
    constructor(public population: Population, public state: EnrichedState) {
        super("TransferEdit_" + population.identifier, [0,0]);

        var cfg = state.configuration;
        this.setDimensions([cfg.clusterTileInnerSize, cfg.clusterTileInnerSize]);
    }

    paint(context: ViewContext) {
        super.paint(context);

        var cfg = this.state.configuration;
        var center = Vector.mul(this.dimensions, .5);

        context.save();
        context.translate(this.topLeft);

        // Internal axes.
        context.strokeStyle(cfg.baseVeryDim);
        context.strokeLine([center[0], 0], [center[0], this.dimensions[1]]);
        context.strokeLine([0, center[1]], [this.dimensions[1], center[1]]);

        // Outlines.
        context.strokeStyle(cfg.baseDim);
        context.strokeRect(0, 0, this.dimensions[0], this.dimensions[1]);

        var funcPoint = (cs: number[]) => [.5 * (1 + cs[0]) * this.dimensions[0], .5 * (1 - cs[1]) * this.dimensions[1]];

        // Function curve.
        context.strokeStyle(this.population.color);
        context.lineWidth(2);
        context.beginPath();
        var startPoint = funcPoint([-1, this.population.activate(-1)]);
        context.moveTo(startPoint[0], startPoint[1]);
        for(var x = 1; x <= this.dimensions[0]; x += 3) {
            var actInput = (2 * x / this.dimensions[0]) - 1;
            var pnt = funcPoint([actInput, this.population.activate(actInput)]);
            context.lineTo(pnt[0], pnt[1]);
        }
        context.stroke();

        // Control points.
        context.fillStyle(this.population.color);
        this.population.activation.forEach(cP => {
            var pnt = funcPoint(cP);
            context.fillEllipse(pnt[0], pnt[1], 2, 2);
        });

        context.picking = true;
        context.translate(Vector.mul(this.dimensions, 0.5));
        context.scale(.5 * this.dimensions[0], -.5 * this.dimensions[1])
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
            var distance = Math.abs(c[0] - coordinates[0]); //Vector.distance(c, coordinates);
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

class ExemplarLabel extends Label {
    constructor(public population: Population,
                public state: EnrichedState) {
        super("lbl_" + population.identifier,
            population.name,
            [0,0],
            state.focused().population === population.identifier ?
                state.configuration.clusterSelectedLabel :
                state.configuration.clusterLabel,
            true);

        this.setDimensions([state.configuration.clusterTileInnerSize, this.dimensions[1]]);
    }

    paint(context: ViewContext) {
        var state = this.state;

        context.save();
        context.translate(this.topLeft);
        context.picking = true;

        context.fillStyle(state.populationColor(this.population));
        context.fillRect(0, 0, state.configuration.clusterTileInnerSize, this.dimensions[1]);

        context.restore();
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        interaction.selectedCoordinates.population = this.population.identifier;
    }
}

class AbstractPlate extends PlacedSnippet {
    selectionOutlines: jsts.geom.Geometry[];

    constructor(id: string, topLeft: number[],
                public state: EnrichedState,
                public columnLabels: boolean = true,
                public rowLabels: boolean = true) {
        super(id, topLeft);

        var cfg = state.configuration;

        var gf = new jsts.geom.GeometryFactory();
        this.selectionOutlines = state.allWellSelections().map(ws => {
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

        var info = state.dataSetInfo.value;
        this.setDimensions([info.columnCount * cfg.wellDiameter + cfg.plateColLabelMargin + cfg.sideFont.width("000"),
                            info.rowCount * cfg.wellDiameter + cfg.plateRowLabelMargin + cfg.sideFont.size + 4]);
    }

    paint(context: ViewContext) {
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
    }

    paintWellLabels(ctx: ViewContext) {
        var cfg = this.state.configuration;
        var info = this.state.dataSetInfo.value;

        var lblY = info.rowCount * cfg.wellDiameter + cfg.plateColLabelMargin;
        var lblX = info.columnCount * cfg.wellDiameter + cfg.plateRowLabelMargin;

        ctx.save();

        ctx.font(cfg.sideFont.string);
        ctx.fillStyle(cfg.base);

        // Column labels at the top.
        if(this.columnLabels) {
            ctx.textAlign('center');
            ctx.textBaseline('top');
            info.columnLabels.forEach((c, i) => ctx.fillText(c, (i + .5) * cfg.wellDiameter, lblY));
        }

        // Row labels at the right.
        if(this.rowLabels) {
            ctx.textAlign('left');
            ctx.textBaseline('middle');
            info.rowLabels.forEach((r, j) => ctx.fillText(r, lblX, (j + .5) * cfg.wellDiameter));
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
            ctx.lineWidth(3.5);
            ctx.beginPath();
            TemplatePlate.geometryToPath(ctx, so);
            ctx.stroke();

            ctx.strokeStyle(this.state.allWellSelections()[i].id === "Selected" ? cfg.baseSelected : cfg.base);
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

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        var plate = this.state.focused().plate;
        if(plate !== null) {
            interaction.selectedCoordinates.plate = plate;
            interaction.selectedCoordinates.well = PlateMiniHeatmap.wellCoordinatesAt(coordinates, enriched);
            interaction.pushView('well');
        }
    }

    /*mouseMove(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        var plate = this.state.focused().plate;
        if(plate !== null) {
            interaction.hoveredCoordinates.plate = plate;
            interaction.hoveredCoordinates.well = PlateMiniHeatmap.wellCoordinatesAt(coordinates, enriched);
        }
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
        var clusterShares = this.model.wellClusterShares.value.wellIndex[selection.populationOrTotal()] || [];
        //var wellShares = clusterShares[selection.plate] || [];
        var wellShares = this.model.wellScores()[selection.plate] || [];

        // Well outlines.
        ctx.strokeStyle(cfg.baseDim);
        for(var c = 0; c < info.columnCount; c++) {
            var x = c * cfg.wellDiameter;

            for(var r = 0; r < info.rowCount; r++) {
                var y = r * cfg.wellDiameter;

                if(wellShares[c] && wellShares[c][r] >= -1) {
                    ctx.fillStyle(BaseConfiguration.shareColorMap(wellShares[c][r]));
                    ctx.fillRect(x + .25, y + .25, cfg.wellDiameter - .5, cfg.wellDiameter - .5);
                } else {
                    ctx.strokeRect(x + 1, y + 1, cfg.wellDiameter - 2, cfg.wellDiameter - 2);
                    //ctx.strokeLine([x + .25, y + .25], [x + cfg.wellDiameter - .25, y + cfg.wellDiameter - .25]);
                    //ctx.strokeLine([x + .25, y + cfg.wellDiameter - .25], [x + cfg.wellDiameter - .25, y + .25]);
                }
            }
        }
    }
}

class FlowerPlate extends AbstractPlate {
    constructor(topLeft: number[], public state: EnrichedState) {
        super("flwPlt", topLeft, state, false);
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
        for(var c = 0; c < info.columnCount; c++)
            for(var r = 0; r < info.rowCount; r++)
                this.paintPopulationFlower(ctx, c, r);

        ctx.restore();
    }

    // Population abundance flower.
    paintPopulationFlower(ctx: ViewContext, column: number, row: number) {
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

        var maxObjectCount = wellClusterShares.maxPlateObjectCount[selection.plate];    //wellClusterShares.maxObjectCount;
        var normObjectCellCount = Math.sqrt(maxObjectCount);

        // Draw flower slice
        var populations = this.state.populationSpace.populations.elements.filter(p => p.exemplars.length > 0);
        populations.forEach((p, pI) => {
            var clusterShares = this.state.wellClusterShares.value.wellIndex[p.identifier] || [];
            var wellShares = clusterShares[selection.plate] || [];
            var columnShares = wellShares[column] || [];
            var share = columnShares[row];

            ctx.fillStyle(this.state.populationColor(p));
            ctx.strokeStyle(cfg.backgroundColor);
            ctx.lineWidth(.25);

            if(share >= 0 && cellCount >= 0) {
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
    }
}

class JointWellPlates extends List<AbstractPlate> {
    constructor(public state: EnrichedState) {
        super("jntPlt", [new TemplatePlate([0,0], state), new FlowerPlate([0,0], state)]);
    }

    toString() {
        var focusedPlate = this.state.focused().plate;
        return "Plate " + this.state.dataSetInfo.value.plateLabels[focusedPlate];
    }
}

class WellDetailView extends PlacedSnippet {
    imageTypeOption: ConfigurationOptions;

    guide: GuideLabel;

    constructor(public state: EnrichedState) {
        super("WellDetailView", []);

        var cfg = state.configuration;
        this.setDimensions([cfg.wellViewMaxWidth, cfg.wellViewMaxWidth]);      //(cfg.wellViewMaxDim);

        var availableTypes = _.keys(state.availableImageTypes());
        var wellOptions: StringMap<string> = {};
        availableTypes.forEach(t => wellOptions[t] = t);
        this.imageTypeOption = new ConfigurationOptions(
            "WellDetailOptions",
            [0,0],
            state,
            "imageType",
            wellOptions);

        if(state.focused().object === null) {
            this.guide = new GuideLabel(
                "well",
                "Hover over a cell to inspect it.",
                [0,0],
                [0, -75],
                20,
                state
            );
        }
    }

    setTopLeft(topLeft: number[]) {
        super.setTopLeft(topLeft);

        if(this.imageTypeOption)
            this.imageTypeOption.setTopLeft(Vector.add(this.topLeft, [0, .75 * this.dimensions[1] + 10]));  //this.bottomLeft);
        if(this.guide)
            this.guide.setTopLeft(Vector.add(this.bottomRight, [-200, 25]));
    }

    paint(ctx: ViewContext) {
        var state = this.state;
        var cfg = state.configuration;

        //ctx.transitioning = false;
        ctx.save();
        ctx.translate(this.topLeft);

        var well = state.selectionWell(state.focused());
        if(well) {
            var img = well.image(cfg.imageType);
            if (img) {
                ctx.transitioning = false;

                var wellScale = Math.min(1, cfg.wellViewMaxWidth / img.width);   //Math.min(cfg.wellViewMaxDim[0] / img.width, 2 * cfg.wellViewMaxDim[1] / img.height);
                ctx.picking = true;
                ctx.drawImageClipped(
                    img,
                    [0, 0], [img.width, 0.5 * img.height],
                    [0, 0], [wellScale * img.width, wellScale * 0.5 * img.height]);
                ctx.picking = false;

                // Test object coordinates.
                var objects = state.objectInfo.value;
                var x = objects.columnVector("x");
                var y = objects.columnVector("y");
                var xRad = wellScale * cfg.objectViewImageRadius;
                var yRad = wellScale * cfg.objectViewImageRadius;
                var rI = state.focused().object === null ? -1 : objects.rowIndex[state.focused().object];
                var rX = rI >= 0 ? x[rI] : .5 * this.dimensions[0];
                var rY = rI >= 0 ? y[rI] : .5 * this.dimensions[1];

                ctx.strokeStyle(rI >= 0 ? cfg.backgroundColor : Color.NONE);
                ctx.lineWidth(4);
                ctx.strokeRect(wellScale * rX - xRad, wellScale * rY - yRad, 2 * xRad, 2 * yRad);
                ctx.strokeStyle(rI >= 0 ? cfg.baseSelected : Color.NONE);
                ctx.lineWidth(2);
                ctx.strokeRect(wellScale * rX - xRad, wellScale * rY - yRad, 2 * xRad, 2 * yRad);

                ctx.transitioning = true;
            }
        }

        ctx.restore();
        //ctx.transitioning = true;

        // Well type button.
        ctx.snippet(this.imageTypeOption);

        ctx.snippet(this.guide);
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[],
               enriched: EnrichedState, interaction: InteractionState) {
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
    }

    /*mouseMove(event: ViewMouseEvent, coordinates: number[],
              enriched: EnrichedState, interaction: InteractionState) {
        interaction.hoveredCoordinates.object = enriched.closestWellObject(coordinates);
        enriched.conformHoveredCoordinates(interaction);
    }*/

    toString() {
        var info = this.state.dataSetInfo.value;
        var focusedWell = this.state.focused().well;
        return "Well " + info.columnLabels[focusedWell.column] + info.rowLabels[focusedWell.row];
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
        interaction.selectedCoordinates.object = this.object;
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
    private heatmapColumns: List<List<PlateMiniHeatmap>>;
    private guide: GuideLabel;

    constructor(public state: EnrichedState) {
        super("pi", [0,0]);

        var cfg = state.configuration;
        var datInfo = state.dataSetInfo.value;

        var heatMaps = _.range(0, datInfo.plateCount).map(pI => new PlateMiniHeatmap(pI, state));
        var colCapacity = Math.ceil(datInfo.plateCount / cfg.miniHeatColumnCount);
        var colMaps = _.range(0, cfg.miniHeatColumnCount).map(cI =>
            _.compact(_.range(0, colCapacity).map(rI => heatMaps[cI * colCapacity + rI])));

        //var colMaps = state.platePartition().map(pR => pR.map(pI => new PlateMiniHeatmap(pI, state)));

        this.heatmapColumns = new List("pics",
            colMaps.map((c, cI) => new List("pic_" + cI, c, [0,0], [0,0], 'vertical', cfg.miniHeatSpace)),
            [0,0], [0,0], 'horizontal', 2 * cfg.miniHeatSpace, 'left'
        );

        this.dimensions = this.heatmapColumns.dimensions;
        this.updatePositions();

        if(state.focused().plate === null) {
            this.guide = new GuideLabel(
                "plate",
                "Hover over a plate to inspect it and click to select it.",
                [0,0],
                [-20,0],
                5,
                state);
        }
    }

    setTopLeft(topLeft: number[]) {
        super.setTopLeft(topLeft);

        if(this.heatmapColumns) this.heatmapColumns.setTopLeft(topLeft);
        if(this.guide) this.guide.setTopLeft(Vector.add(this.topRight, [10,60]));
    }

    paint(context: ViewContext) {
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
    }

    toString() {
        return "Plates";
    }
}

class PlateMiniHeatmap extends PlacedSnippet {
    private shareImg: any;

    constructor(public plateNumber: number, public state: EnrichedState) {
        super("mh_" + plateNumber, [0,0]);

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

        // Outline, in case of no share data.
        context.strokeStyle(cfg.baseDim);
        context.strokeRect(.5, .5, this.dimensions[0] - .5, this.dimensions[1] - .5);

        // Heat map image.
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
        var tag = "cimg_" + plate + "_" + model.populationSpace.activationString(); //"cimg_" + clusterObject + "_" + plate;
        var wellClusterShares = model.wellClusterShares.value;
        var plateShareImage = wellClusterShares[tag];

        if(!plateShareImage) {
            var cfg = model.configuration;
            var datInfo = model.dataSetInfo.value;
            //var clusterShares = wellClusterShares.wellIndex[clusterObject] || [];
            //var plateShares = clusterShares[plate] || [];
            var plateShares = model.wellScores()[plate] || [];

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
        //interaction.selectedCoordinates.well = PlateMiniHeatmap.wellCoordinatesAt(coordinates, enriched);

        interaction.pushView('plate');
    }

    /*mouseMove(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        interaction.hoveredCoordinates.plate = this.plateNumber;
        //interaction.hoveredCoordinates.well = PlateMiniHeatmap.wellCoordinatesAt(coordinates, enriched);
    }*/

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
        var baseStyle: LabelStyle = new LabelStyle(cfg.sideFont, cfg.baseDim, 'left', 'top');
        var selectedStyle: LabelStyle = new LabelStyle(cfg.sideFont, cfg.baseEmphasis, 'left', 'top');

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