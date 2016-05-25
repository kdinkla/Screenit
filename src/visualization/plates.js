var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
define(["require", "exports", 'jsts', '../model', '../core/graphics/snippet', '../core/graphics/view', '../configuration', '../core/graphics/style', '../core/math'], function (require, exports, jsts, model_1, snippet_1, view_1, configuration_1, style_1, math_1) {
    "use strict";
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
            var plateStacks = [];
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
                            snippetStack.push(new SubstitutePlateLabel("plateLblSubst_" + ps[i], "...", math_1.Vector.add(firstHeatmap.dimensions, [0, -2 * cfg.miniHeatSpace]), cfg.sideLabel));
                        }
                    }
                    else {
                        var prevP = ps[i - 1];
                        var p = ps[i];
                        var nextP = ps[i + 1];
                        var miniHeatMap = new PlateMiniHeatmap(p, state);
                        // Add top plate label.
                        if (prevP === null || !((i - 1) in ps)) {
                            snippetStack.push(new snippet_1.Label("plateLblTop_" + p, datInfo.plateLabels[p], [0, 0], cfg.sideLabel));
                        }
                        // Add heat map label.
                        snippetStack.push(miniHeatMap);
                        // Add bottom plate label.
                        if (nextP === null || !((i + 1) in ps)) {
                            snippetStack.push(new snippet_1.Label("plateLblBottom_" + p, datInfo.plateLabels[p], [0, 0], cfg.sideLabel));
                        }
                    }
                }
                return new snippet_1.List("pic_" + psI, snippetStack, [0, 0], [0, 0], 'vertical', cfg.miniHeatSpace, 'middle');
            });
            var colLists = new snippet_1.List("pic_", stackLists, [0, 0], [0, 0], 'horizontal', cfg.miniHeatSpace, 'right');
            this.heatmapColumns = colLists;
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
                this.selectedHeatmap.setTopLeft(math_1.Vector.add(this.topRight, [-this.selectedHeatmap.dimensions[0], cfg.sideLabel.font.size + cfg.miniHeatSpace]));
            }
        };
        PlateIndex.prototype.paint = function (context) {
            // Heat maps.
            context.snippet(this.heatmapColumns);
            context.snippet(this.selectedHeatmap);
        };
        PlateIndex.prototype.toString = function () {
            return "Plates";
        };
        return PlateIndex;
    }(snippet_1.PlacedSnippet));
    exports.PlateIndex = PlateIndex;
    var SubstitutePlateLabel = (function (_super) {
        __extends(SubstitutePlateLabel, _super);
        function SubstitutePlateLabel(identifier, label, dimensions, style) {
            _super.call(this, identifier, label, [0, 0], style);
            if (dimensions !== null)
                this.setDimensions([this.dimensions[0], dimensions[1] - 2 * this.dimensions[1]]);
        }
        return SubstitutePlateLabel;
    }(snippet_1.Label));
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
            context.fillStyle(style_1.Color.NONE);
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
                var image = view_1.View.renderToCanvas(imgWidth, imgHeight, function (ctx) {
                    for (var c = 0; c < datInfo.columnCount; c++) {
                        var cVals = plateShares[c] || [];
                        var cX = c * cfg.miniHeatWellDiameter;
                        for (var r = 0; r < datInfo.rowCount; r++) {
                            var val = cVals[r];
                            if (val >= 0)
                                wellFilled = true;
                            var cY = r * cfg.miniHeatWellDiameter;
                            ctx.fillStyle = configuration_1.BaseConfiguration.shareColorMap(val).toString();
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
            return new model_1.WellCoordinates(Math.round(mouseCoordinates[0] * (info.columnCount - 1)), Math.round(mouseCoordinates[1] * (info.rowCount - 1)));
        };
        return PlateMiniHeatmap;
    }(snippet_1.PlacedSnippet));
    var AbstractPlate = (function (_super) {
        __extends(AbstractPlate, _super);
        function AbstractPlate(id, topLeft, state, columnLabels, rowLabels) {
            var _this = this;
            if (columnLabels === void 0) { columnLabels = true; }
            if (rowLabels === void 0) { rowLabels = true; }
            _super.call(this, id, topLeft);
            this.state = state;
            this.columnLabels = columnLabels;
            this.rowLabels = rowLabels;
            var cfg = state.configuration;
            var info = state.dataSetInfo.value;
            var plate = this.state.focused().plate;
            var annotations = this.state.plateTargetAnnotations(plate);
            this.flatAnnotations = _.flatten(_.values(annotations).map(function (ann) { return _.values(ann); }));
            this.columnIndices = _.range(0, info.columnCount);
            this.rowIndices = _.range(0, info.rowCount);
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
                return body;
            });
            this.selectionRims = this.flatAnnotations.map(function (ws) {
                // Tile per well.
                var wellTiles = ws.wells.map(function (wc) { return tileAt(wc, .5); });
                var body = new jsts.operation.union.CascadedPolygonUnion(wellTiles).union();
                return body;
            });
            this.setDimensions([this.columnIndices.length * this.wellDiameter, this.rowIndices.length * this.wellDiameter]);
        }
        AbstractPlate.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            var xIndex = Math.round(coordinates[0] * (this.columnIndices.length - 1));
            var yIndex = Math.round(coordinates[1] * (this.rowIndices.length - 1));
            if (xIndex in this.columnIndices && yIndex in this.rowIndices) {
                var postPruneCoordinates = new model_1.WellCoordinates(this.columnIndices[xIndex], this.rowIndices[yIndex]);
                interaction.selectedCoordinates.switchWell(postPruneCoordinates);
                interaction.pushView('plates');
            }
        };
        AbstractPlate.prototype.paint = function (context) {
            var cfg = this.state.configuration;
            context.save();
            context.translate(this.topLeft);
            context.transitioning = false;
            // Paint selection outline.
            context.strokeStyle(cfg.baseSelected);
            context.lineWidth(2);
            context.strokeRect(-1.5, -1.5, this.dimensions[0] + 3, this.dimensions[1] + 3);
            this.paintWellLabels(context);
            this.paintSelectionOutlines(context);
            // Well selection.
            context.scale(this.columnIndices.length * this.wellDiameter, this.rowIndices.length * this.wellDiameter);
            context.picking = true;
            context.fillStyle(style_1.Color.NONE);
            context.fillRect(0, 0, 1, 1);
            context.picking = false;
            context.transitioning = true;
            context.restore();
        };
        AbstractPlate.prototype.paintWellLabels = function (ctx) {
            var _this = this;
            var cfg = this.state.configuration;
            var info = this.state.dataSetInfo.value;
            var lblX = -cfg.plateRowLabelMargin;
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
            ctx.fillStyle(cfg.base.alpha(0.2));
            ctx.beginPath();
            this.selectionOutlines.forEach(function (so) { return TemplatePlate.geometryToPath(ctx, so); });
            ctx.fill();
        };
        AbstractPlate.prototype.paintSelectionOutlines = function (ctx) {
            var _this = this;
            var cfg = this.state.configuration;
            this.selectionOutlines.forEach(function (so, i) {
                ctx.strokeStyle(cfg.backgroundColor);
                ctx.lineWidth(2);
                ctx.beginPath();
                TemplatePlate.geometryToPath(ctx, so);
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
                    // All rings as paths.
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
    }(snippet_1.PlacedSnippet));
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
                    if (wellShares[c] && wellShares[c][r] >= -1) {
                        ctx.fillStyle(configuration_1.BaseConfiguration.shareColorMap(wellShares[c][r]));
                        ctx.fillRect(x + .25, y + .25, this.wellDiameter - .5, this.wellDiameter - .5);
                    }
                }
            }
        };
        return TemplatePlate;
    }(AbstractPlate));
});
//# sourceMappingURL=plates.js.map