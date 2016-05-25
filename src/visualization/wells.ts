import { InteractionState, EnrichedState, Population, WellScore, WellLocation } from '../model';
import { PlacedSnippet, List, Label, Line, Polygon } from '../core/graphics/snippet';
import { ViewMouseEvent, ViewContext } from '../core/graphics/view';
import { ConfigurationOptions } from './configuration';
import { StringMap } from '../core/collection';
import { Color } from '../core/graphics/style';
import { Vector } from '../core/math';

export class WellView extends List<PlacedSnippet> {
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
        return "Wells" + (opened ? ": " + (wellFilter.length > 0 ? wellFilter : "\<press key\>") : "");
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

        var transferButtons = new List("PopulationTransfers",
            mainPopulations.map((p, pI) => new PopulationTransferEdit(p, state, pI === 0)),
            [0,0], [0,0], 'horizontal', cfg.exemplarColumnSpace, 'left');

        return transferButtons;
    }

    static composeWells(state: EnrichedState) {
        return state.topWells();
    }
}

class PopulationTransferEdit extends PlacedSnippet {
    private minZScoreLabel: string;
    private maxZScoreLabel: string;

    constructor(public population: Population, public state: EnrichedState, public leftMost: boolean = false) {
        super("TransferEdit_" + population.identifier, [0,0]);

        this.minZScoreLabel = (-state.configuration.activationZScoreRange).toString();
        this.maxZScoreLabel = state.configuration.activationZScoreRange.toString();

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
        context.strokeRect(0, 0, cfg.transferPlotSize, cfg.transferPlotSize);

        // Side axis labels.
        context.transitioning = false;

        // Left-most axis score labels.
        if(this.leftMost) {
            context.fillStyle(cfg.base);
            context.font(cfg.transferFont.toString());
            context.textAlign('right');
            context.textBaseline('middle');
            context.fillText('1  ', 0, 3);
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
        var funcPoint = (cs: number[]) =>
            [.5 * (1 + cs[0]) * cfg.transferPlotSize, .5 * (1 - cs[1]) * cfg.transferPlotSize];

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

class WellLocationList extends List<Label> {
    constructor(field: string, wells: WellScore[], public state: EnrichedState) {
        super("WL_" + field,
            wells.map(well => new WellLocationLabel(well.location, field, state)),
            [0,0], [0,0],
            'vertical',
            state.configuration.listWellSpace,
            'middle');
    }
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

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
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
        context.fillText('% share', 0, this.dimensions[1] + cfg.transferFont.size);

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

            this.state.objectInfo.value["wellOutlines"] = this.objectMaxRadi;
        }
    }

    paint(ctx: ViewContext) {
        var state = this.state;
        var cfg = state.configuration;

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

        // Well type button.
        ctx.snippet(this.optionTable);
        ctx.snippet(this.annotationTable);
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        var object = enriched.closestWellObject(coordinates);

        interaction.selectedCoordinates.switchObject(object);
        enriched.conformSelectedCoordinates(interaction);

        interaction.pushView('well');
    }
}

class WellAnnotationTable extends List<PlacedSnippet> {
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