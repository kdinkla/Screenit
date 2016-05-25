import { InteractionState, EnrichedState, Population } from '../model';
import { PlacedSnippet, List, Label, LabelStyle } from '../core/graphics/snippet';
import { ViewMouseEvent, ViewContext } from '../core/graphics/view';
import { Color } from '../core/graphics/style';
import { Vector } from '../core/math';

export class ExemplarTable extends PlacedSnippet {
    segments: List<PlacedSnippet>;

    constructor(public state: EnrichedState) {
        super("ExemplarStack", [0,0]);

        var cfg = state.configuration;
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

        var selectedObjectDetailView = exemplarSelected ?
            new ObjectDetailView(state.focused().object, state, [0,0]) :
            null;
        var segSnippets: PlacedSnippet[] = _.compact(
            [activeTypeLabel, activeTypeLabels, exemplarLabel, selectedObjectDetailView, columns]);

        var shownSegment = new List("ShownSegments", segSnippets, [0,0], [0,0], 'vertical', cfg.subPanelSpace);

        // Hidden types.
        var hiddenSegment: PlacedSnippet[] = [];
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

class ExemplarColumn extends List<PlacedSnippet> {
    constructor(public state: EnrichedState,
                public population: Population,
                public topLeft = [0, 0]) {
        super(
            "esc_" + population.identifier,
            _.union<PlacedSnippet>(
                state.isExemplarSelected() &&
                !population.predefined ?
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
        var imgRadius = cfg.objectViewImageRadius;
        var internalRadius = [imgRadius, imgRadius];
        var internalDiameter = Vector.mul(internalRadius, 2);

        ctx.save();
        ctx.translate(this.topLeft);
        ctx.picking = true;

        var wellInfo = mod.objectWellInfo(this.object);

        if(wellInfo) {
            var img = wellInfo.location.image(cfg.imageType === "None" ? null : cfg.imageType);
            var coordinates = wellInfo.coordinates;

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
        ctx.restore();

        ctx.transitioning = false;
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        interaction.selectedCoordinates.switchObject(this.object);
        enriched.conformSelectedCoordinates(interaction);

        // Remove exemplar status of object (on second click).
        if(this.focused) interaction.removeExemplar(this.object);
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
        interaction.populationSpace.toggle(this.population);
    }
}