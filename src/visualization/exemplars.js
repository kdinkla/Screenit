var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
define(["require", "exports", '../model', '../core/graphics/snippet', '../core/graphics/style', '../core/math'], function (require, exports, model_1, snippet_1, style_1, math_1) {
    "use strict";
    var ExemplarTable = (function (_super) {
        __extends(ExemplarTable, _super);
        function ExemplarTable(state) {
            _super.call(this, "ExemplarStack", [0, 0]);
            this.state = state;
            var cfg = state.configuration;
            var visiblePopulations = this.state.populationSpace.visiblePopulations().elements;
            // Main Label.
            var activeTypeLabel = new snippet_1.Label("ShownLbl", "Shown", [0, 0], state.configuration.subPanelHeaderLabel, true);
            // Labels of active types.
            var activeTypeLabels = new snippet_1.List("ActiveTypeLabels", visiblePopulations.map(function (p) { return new TypeLabel(p, state); }), [0, 0], [0, 0], 'horizontal', cfg.exemplarColumnSpace, 'left');
            var exemplarSelected = state.isExemplarSelected();
            var exemplarLabel = new snippet_1.Label("ExemplarLbl", "Exemplars", [0, 0], state.configuration.subPanelHeaderLabel, true);
            var columns = new snippet_1.List("ExemplarColumns", visiblePopulations.map(function (p) { return new ExemplarColumn(state, p); }), [0, 0], [0, 0], 'horizontal', cfg.exemplarColumnSpace, 'left');
            var selectedObjectDetailView = exemplarSelected ?
                new ObjectDetailView(state.focused().object, state, [0, 0]) :
                null;
            var segSnippets = _.compact([activeTypeLabel, activeTypeLabels, exemplarLabel, selectedObjectDetailView, columns]);
            var shownSegment = new snippet_1.List("ShownSegments", segSnippets, [0, 0], [0, 0], 'vertical', cfg.subPanelSpace);
            // Hidden types.
            var hiddenSegment = [];
            var hiddenTypeLabel = new snippet_1.Label("HiddenLbl", "Hidden", [0, 0], state.configuration.subPanelHeaderLabel, true);
            var hiddenTypeStack = new snippet_1.List("HiddenTypeColumn", _.union(state.populationSpace.inactivePopulations.elements.map(function (ip) { return new TypeLabel(ip, state); }), state.isExemplarSelected() ?
                [
                    new ExemplarAdditionButton(state.focused().object, state.populationSpace.allPopulations().byId(model_1.Population.POPULATION_UNCONFIDENT_NAME), state)
                ] : []), [0, 0], [cfg.clusterTileInnerSize, 0], 'vertical', cfg.exemplarColumnSpace, 'middle');
            hiddenSegment.push(new snippet_1.List("HiddenSegments", [hiddenTypeLabel, hiddenTypeStack], [0, 0], [0, 0], 'vertical', cfg.subPanelSpace));
            // Combine shown and hidden segment columns.
            this.segments = new snippet_1.List("TypeSegments", _.union([shownSegment], hiddenSegment), [0, 0], [0, 0], 'horizontal', cfg.subPanelSpace, 'left');
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
    }(snippet_1.PlacedSnippet));
    exports.ExemplarTable = ExemplarTable;
    var ExemplarAdditionButton = (function (_super) {
        __extends(ExemplarAdditionButton, _super);
        function ExemplarAdditionButton(object, population, state) {
            _super.call(this, "ExemplarLabel_" + population, [0, 0]);
            this.object = object;
            this.population = population;
            this.state = state;
            this.labelStyle = new snippet_1.LabelStyle(state.configuration.clusterAdditionLabel, state.populationColor(population));
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
            context.fillStyle(style_1.Color.NONE);
            context.fillRect(0, 0, this.dimensions[0], this.dimensions[1]);
            context.picking = false;
            context.translate(math_1.Vector.mul(this.dimensions, .5));
            context.translate([0, -1]);
            context.textBaseline('middle');
            context.textAlign('center');
            context.fillStyle(cfg.baseDim);
            // Distinguish between regular phenotype and cell count phenotype.
            context.fillStyle(cfg.base);
            if (this.population.identifier === model_1.Population.POPULATION_UNCONFIDENT_NAME) {
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
    }(snippet_1.PlacedSnippet));
    var ExemplarColumn = (function (_super) {
        __extends(ExemplarColumn, _super);
        function ExemplarColumn(state, population, topLeft) {
            if (topLeft === void 0) { topLeft = [0, 0]; }
            _super.call(this, "esc_" + population.identifier, _.union(state.isExemplarSelected() &&
                !population.predefined ?
                [new ExemplarAdditionButton(state.focused().object, population, state)] :
                [], population.exemplars.elements.map(function (ex) { return new ObjectDetailView(ex, state, [0, 0]); })), topLeft, [state.configuration.clusterTileInnerSize, 0], 'vertical', state.configuration.exemplarSpace, 'middle');
            this.state = state;
            this.population = population;
            this.topLeft = topLeft;
        }
        return ExemplarColumn;
    }(snippet_1.List));
    var ObjectDetailView = (function (_super) {
        __extends(ObjectDetailView, _super);
        function ObjectDetailView(object, state, topLeft) {
            if (topLeft === void 0) { topLeft = [0, 0]; }
            _super.call(this, "odv_" + object, topLeft);
            this.object = object;
            this.state = state;
            var cfg = state.configuration;
            this.focused = state.focused().object === object;
            this.dimensions = this.focused && !state.populationSpace.isExemplar(object) ?
                [cfg.splomInnerSize, cfg.splomInnerSize] :
                [cfg.clusterTileInnerSize, cfg.clusterTileInnerSize];
            this.updatePositions();
        }
        ObjectDetailView.prototype.paint = function (ctx) {
            var mod = this.state;
            var cfg = mod.configuration;
            var imgRadius = cfg.objectViewImageRadius;
            var internalRadius = [imgRadius, imgRadius];
            var internalDiameter = math_1.Vector.mul(internalRadius, 2);
            ctx.save();
            ctx.translate(this.topLeft);
            ctx.picking = true;
            var wellInfo = mod.objectWellInfo(this.object);
            if (wellInfo) {
                var img = wellInfo.location.image(cfg.imageType === "None" ? null : cfg.imageType);
                var coordinates = wellInfo.coordinates;
                if (img && coordinates) {
                    // Trunc cell coordinates to stay within image.
                    coordinates = [
                        Math.min(img.width - imgRadius, Math.max(imgRadius, coordinates[0])),
                        Math.min(.5 * img.height - imgRadius, Math.max(imgRadius, coordinates[1]))
                    ];
                    var internalTopLeft = math_1.Vector.subtract(coordinates, internalRadius);
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
                        ctx.strokeStyle(style_1.Color.NONE);
                    }
                    ctx.transitioning = true;
                    ctx.strokeRect(0, 0, this.dimensions[0], this.dimensions[1]);
                    ctx.transitioning = false;
                    if (this.focused) {
                        ctx.strokeStyle(cfg.baseSelected);
                        ctx.lineWidth(2);
                    }
                    else {
                        ctx.strokeStyle(style_1.Color.NONE);
                    }
                    ctx.transitioning = true;
                    ctx.strokeRect(0, 0, this.dimensions[0], this.dimensions[1]);
                }
            }
            ctx.picking = false;
            ctx.restore();
            ctx.transitioning = false;
        };
        ObjectDetailView.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            interaction.selectedCoordinates.switchObject(this.object);
            enriched.conformSelectedCoordinates(interaction);
            // Remove exemplar status of object (on second click).
            if (this.focused)
                interaction.removeExemplar(this.object);
        };
        return ObjectDetailView;
    }(snippet_1.PlacedSnippet));
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
            var canBeHidden = this.population.identifier !== model_1.Population.POPULATION_TOTAL_NAME;
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
                context.fillStyle(style_1.Color.NONE);
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
            context.translate(math_1.Vector.mul([cfg.clusterTileInnerSize, cfg.clusterTileInnerSize], .5));
            context.translate([0, -.5 * fontHeight * (this.tagLines.length - 1)]);
            this.tagLines.forEach(function (line, i) {
                context.strokeText(line, 0, i * fontHeight);
                context.fillText(line, 0, i * fontHeight);
            });
            context.restore();
            if (canBeHidden) {
                var actionLbl = this.state.populationSpace.populations.has(this.population) ?
                    'hide \u25B6' :
                    '\u25C0 show';
                context.fillStyle(cfg.baseDim);
                context.textBaseline('bottom');
                context.fillText(actionLbl, .5 * this.dimensions[0], this.dimensions[1]);
            }
            context.restore();
        };
        TypeLabel.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            interaction.populationSpace.toggle(this.population);
        };
        return TypeLabel;
    }(snippet_1.PlacedSnippet));
});
//# sourceMappingURL=exemplars.js.map