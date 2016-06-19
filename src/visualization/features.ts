import { InteractionState, EnrichedState } from '../model';
import { BaseSnippet, PlacedSnippet, List, Label, LabelStyle } from '../core/graphics/snippet';
import { View, ViewMouseEvent, ViewContext, Snippet } from '../core/graphics/view';
import { Color } from '../core/graphics/style';
import { BaseConfiguration } from '../configuration';
import { Vector } from '../core/math';


export class FeatureHistogramTable extends List<PlacedSnippet> {
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

                            plainContext.lineTo(x1, y1);
                        }
                        plainContext.lineTo(this.dimensions[0], this.dimensions[1]);
                        if(fill) {
                            var fontColor = population.colorTrans;
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

        populations.forEach(p =>
            p.exemplars.elements.forEach(pE =>
                this.paintPolyLine(context, pE.toString(), state.populationColorTranslucent(p))));

        var focusedObject = state.focused().object;
        if(focusedObject !== null) {
            this.paintPolyLine(context, focusedObject.toString(), cfg.backgroundColor, 4);
            this.paintPolyLine(context, focusedObject.toString(), cfg.baseSelected, 2);
        }

        // Normalized pickable area.
        context.picking = true;
        context.scale(this.dimensions[0], this.dimensions[1]);
        context.fillStyle(Color.NONE);
        context.fillRect(0, 0, 1, 1);
        context.picking = false;

        context.transitioning = true;

        context.restore();
    }

    private paintPolyLine(context: ViewContext, object: string, color: Color, lineWidth = 1) {
        var state = this.state;
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

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        // Determine feature from list.
        var features = this.state.features.value;
        var featureIndex = Math.round(coordinates[1] * (features.length - 1));
        var feature = features[featureIndex];

        // Select exemplar with closest feature value.
        interaction.selectedCoordinates.object = enriched.closestFeatureObject(feature, coordinates[0]);
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
            this.cachedBackground = View.renderToCanvas(size, size, c => this.histogram2DtoImage(c));
            model.objectHistograms.value[this.identifier] = this.cachedBackground;
        }
    }

    histogram2DtoImage(context: CanvasRenderingContext2D) {
        var mod = this.model;
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
        context.fillStyle(Color.NONE);
        context.fillRect(0, 0, 1, 1);
        context.picking = false;

        context.restore();

        context.save();
        context.translate(this.topLeft);

        context.transitioning = false;

        context.drawImageScaled(this.cachedBackground, [0,0], [this.size, this.size]);

        var objectFeatures = this.model.objectInfo.value;
        var x = objectFeatures.columnVector(this.feature1) || [];
        var y = objectFeatures.columnVector(this.feature2) || [];

        // Large colored dots with halo for representatives.
        mod.populationSpace.populations.forEach(pop =>
            pop.exemplars.forEach(ex => {
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
        context.fillStyle(this.headerLabel ? cfg.base : Color.NONE);
        context.translate([.5 * this.size, 0]);
        context.fillText(this.headerLabel, 0, 0);
        context.restore();

        // Column (bottom) label.
        context.textBaseline('top');
        context.save();
        context.fillStyle(this.columnLabel ? cfg.base : Color.NONE);
        context.translate([.5 * this.size, this.size]);
        context.fillText(this.feature1, 0, 0);
        context.restore();

        // Row (left) label.
        context.textBaseline('bottom');
        context.save();
        context.fillStyle(this.rowLabel ? cfg.base : Color.NONE);
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