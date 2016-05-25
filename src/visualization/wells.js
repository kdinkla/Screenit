var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
define(["require", "exports", '../model', '../core/graphics/snippet', './configuration', '../core/graphics/style', '../core/math'], function (require, exports, model_1, snippet_1, configuration_1, style_1, math_1) {
    "use strict";
    var WellView = (function (_super) {
        __extends(WellView, _super);
        function WellView(state) {
            _super.call(this, "WellView", [new WellListView(state), new WellDetailView(state)], [0, 0], [0, 0], 'horizontal', state.configuration.subPanelSpace, 'left');
            this.state = state;
        }
        WellView.prototype.toString = function (opened) {
            var wellFilter = this.state.selectedCoordinates.wellFilter;
            return "Wells" + (opened ? ": " + (wellFilter.length > 0 ? wellFilter : "\<press key\>") : "");
        };
        return WellView;
    }(snippet_1.List));
    exports.WellView = WellView;
    var WellListView = (function (_super) {
        __extends(WellListView, _super);
        function WellListView(state) {
            _super.call(this, "WellDetailView", [WellListView.transferButtons(state),
                WellListView.tableColumns(state)], [0, 0], [0, 0], 'vertical', state.configuration.subPanelSpace, 'right');
            this.state = state;
        }
        WellListView.tableColumns = function (state) {
            var columns = ['plate', 'column', 'row']
                .map(function (field) { return new WellLocationList(field, WellListView.composeWells(state), state); })
                .concat(new WellAbundanceList(state, WellListView.composeWells(state), WellListView.buttonsWidth(state)));
            return new snippet_1.List("WellDetailColumns", columns, [0, 0], [0, 0], 'horizontal', state.configuration.listColumnSpace, 'left');
        };
        WellListView.buttonsWidth = function (state) {
            var cfg = state.configuration;
            var pCnt = state.populationSpace.populations.length;
            return pCnt * cfg.transferPlotSize + (pCnt - 1) * cfg.exemplarColumnSpace;
        };
        WellListView.transferButtons = function (state) {
            var cfg = state.configuration;
            var mainPopulations = _.union(state.populationSpace.visiblePopulations().elements, [state.populationSpace.populations.byId(model_1.Population.POPULATION_TOTAL_NAME)]);
            var transferButtons = new snippet_1.List("PopulationTransfers", mainPopulations.map(function (p, pI) { return new PopulationTransferEdit(p, state, pI === 0); }), [0, 0], [0, 0], 'horizontal', cfg.exemplarColumnSpace, 'left');
            return transferButtons;
        };
        WellListView.composeWells = function (state) {
            return state.topWells();
        };
        return WellListView;
    }(snippet_1.List));
    var PopulationTransferEdit = (function (_super) {
        __extends(PopulationTransferEdit, _super);
        function PopulationTransferEdit(population, state, leftMost) {
            if (leftMost === void 0) { leftMost = false; }
            _super.call(this, "TransferEdit_" + population.identifier, [0, 0]);
            this.population = population;
            this.state = state;
            this.leftMost = leftMost;
            this.minZScoreLabel = (-state.configuration.activationZScoreRange).toString();
            this.maxZScoreLabel = state.configuration.activationZScoreRange.toString();
            var cfg = state.configuration;
            this.setDimensions([cfg.transferPlotSize, cfg.transferPlotSize + cfg.transferFont.size]);
        }
        PopulationTransferEdit.prototype.paint = function (context) {
            _super.prototype.paint.call(this, context);
            var cfg = this.state.configuration;
            var center = math_1.Vector.mul([cfg.transferPlotSize, cfg.transferPlotSize], .5);
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
            if (this.leftMost) {
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
            var funcPoint = function (cs) {
                return [.5 * (1 + cs[0]) * cfg.transferPlotSize, .5 * (1 - cs[1]) * cfg.transferPlotSize];
            };
            context.strokeStyle(this.population.color);
            context.lineWidth(2);
            context.beginPath();
            var startPoint = funcPoint([-1, this.population.activate(-1)]);
            context.moveTo(startPoint[0], startPoint[1]);
            for (var x = 1; x <= cfg.transferPlotSize; x += 3) {
                var actInput = (2 * x / cfg.transferPlotSize) - 1;
                var pnt = funcPoint([actInput, this.population.activate(actInput)]);
                context.lineTo(pnt[0], pnt[1]);
            }
            var endPoint = funcPoint([1, this.population.activate(1)]);
            context.lineTo(endPoint[0], endPoint[1]);
            context.stroke();
            // Control points.
            context.fillStyle(this.population.color);
            this.population.activation.forEach(function (cP) {
                var pnt = funcPoint(cP);
                context.fillEllipse(pnt[0], pnt[1], 2, 2);
            });
            // Selected well point.
            var focus = this.state.focused();
            var wellShare = this.state.wellClusterShares.value.zScore(this.population.identifier, focus.plate, focus.well) || 0;
            context.fillStyle(cfg.baseSelected);
            var wellInput = Math.max(-1, Math.min(1, wellShare / cfg.activationZScoreRange)); // Bound to shown range.
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
            context.fillText(this.population.identifier === model_1.Population.POPULATION_TOTAL_NAME ?
                absWellShare + " cells" :
                (100 * absWellShare).toFixed(0) + "%", wellPnt[0], cfg.transferPlotSize);
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
            context.translate(math_1.Vector.mul([cfg.transferPlotSize, cfg.transferPlotSize], 0.5));
            context.scale(.5 * cfg.transferPlotSize, -.5 * cfg.transferPlotSize);
            context.fillStyle(style_1.Color.NONE);
            context.fillRect(-1, -1, 2, 2);
            context.picking = false;
            context.restore();
        };
        PopulationTransferEdit.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            // Control points.
            var controlPoints = interaction.populationSpace.populations.byId(this.population.identifier).activation;
            var closestIndex = -1;
            var minDistance = Number.MAX_VALUE;
            controlPoints.forEach(function (c, cI) {
                var distance = Math.abs(c[0] - coordinates[0]);
                if (distance < minDistance) {
                    closestIndex = cI;
                    minDistance = distance;
                }
            });
            controlPoints[closestIndex] = coordinates;
            // Enforce control point x ordering.
            for (var i = 1; i < 3; i++)
                controlPoints[i][0] = Math.max(controlPoints[i][0], controlPoints[i - 1][0]);
        };
        return PopulationTransferEdit;
    }(snippet_1.PlacedSnippet));
    var WellLocationList = (function (_super) {
        __extends(WellLocationList, _super);
        function WellLocationList(field, wells, state) {
            _super.call(this, "WL_" + field, wells.map(function (well) { return new WellLocationLabel(well.location, field, state); }), [0, 0], [0, 0], 'vertical', state.configuration.listWellSpace, 'middle');
            this.state = state;
        }
        return WellLocationList;
    }(snippet_1.List));
    var WellLocationLabel = (function (_super) {
        __extends(WellLocationLabel, _super);
        function WellLocationLabel(location, field, state) {
            _super.call(this, "WL_" + field + "_" + location.toString(), state.dataSetInfo.value[field + "Labels"][location[field]], [0, 0], location.equals(state.selectedCoordinates.location()) ?
                state.configuration.selectedSideLabel :
                state.configuration.sideLabel, true);
            this.location = location;
        }
        WellLocationLabel.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            interaction.selectedCoordinates.switchLocation(this.location);
        };
        return WellLocationLabel;
    }(snippet_1.Label));
    var WellAbundanceList = (function (_super) {
        __extends(WellAbundanceList, _super);
        function WellAbundanceList(state, wells, width) {
            _super.call(this, "WellAbundances");
            this.state = state;
            this.wells = wells;
            var cfg = state.configuration;
            this.wellHeight = cfg.listWellLabel.font.size + cfg.listWellSpace;
            this.setDimensions([
                width,
                wells.length * this.wellHeight
            ]);
            this.createPopulationAreas();
        }
        WellAbundanceList.prototype.createPopulationAreas = function () {
            var _this = this;
            var cfg = this.state.configuration;
            var clusterShares = this.state.wellClusterShares.value;
            var populations = this.state.populationSpace.visiblePopulations().elements;
            // Per well, population.
            var shares = populations.map(function (p) { return _this.wells.map(function (well) {
                return clusterShares.share(p.identifier, well.location);
            }); });
            // Cumulative share, first column is padding.
            var cumulativeShares = [this.wells.map(function (w) { return 0; })];
            populations.forEach(function (p, i) { return cumulativeShares.push(math_1.Vector.add(cumulativeShares[i], shares[i])); });
            // Normalize cumulative shares to [0, max.cum. share].
            this.abundanceShareMax = _.max(cumulativeShares[cumulativeShares.length - 1]);
            cumulativeShares = cumulativeShares.map(function (pS) { return pS.map(function (s) { return s / _this.abundanceShareMax; }); });
            this.populationAreaWidth = this.dimensions[0] - cfg.transferPlotSize - cfg.exemplarColumnSpace;
            this.populationAreas = populations.map(function (p, pI) {
                var listCs = function (cI) {
                    var midCoordinates = cumulativeShares[cI].map(function (wShs, wI) {
                        var y = (wI + .5) * _this.wellHeight;
                        var x = wShs * _this.populationAreaWidth;
                        return [x, y];
                    });
                    // Extend ends to close list.
                    if (midCoordinates.length > 0)
                        midCoordinates = [[midCoordinates[0][0], 0]]
                            .concat(midCoordinates)
                            .concat([[midCoordinates[midCoordinates.length - 1][0],
                                midCoordinates.length * _this.wellHeight]]);
                    return midCoordinates;
                };
                var preList = listCs(pI);
                var postList = listCs(pI + 1).reverse();
                var totalList = preList.concat(postList);
                return new snippet_1.Polygon("WellListArea_" + p.identifier, totalList, p.color, cfg.backgroundColor, false);
            });
            // Object count (total population).
            var counts = this.wells.map(function (w) { return clusterShares.share(model_1.Population.POPULATION_TOTAL_NAME, w.location); });
            if (counts) {
                this.cntMin = 0;
                this.cntMax = clusterShares.maxObjectCount;
                var cntDelta = (this.cntMax - this.cntMin);
                var cntWidth = cfg.transferPlotSize;
                var cntListCs = counts.map(function (cnt, wI) {
                    var y = (wI + .5) * _this.wellHeight;
                    var x = cntWidth * (cnt - _this.cntMin) / cntDelta;
                    return [x, y];
                });
                // Extend ends to close list.
                if (cntListCs.length > 0)
                    cntListCs = [[cntListCs[0][0], 0]]
                        .concat(cntListCs)
                        .concat([[cntListCs[cntListCs.length - 1][0],
                            cntListCs.length * this.wellHeight]]);
                this.cntLine = new snippet_1.Line("WellCountLine", cntListCs, model_1.Population.POPULATION_TOTAL_COLOR, false);
            }
        };
        WellAbundanceList.prototype.paint = function (context) {
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
            context.strokeLine([0, 0], [0, demarcLength]);
            // Abundance label.
            context.textAlign('left');
            context.textBaseline('top');
            context.fillText('% share', 0, this.dimensions[1] + cfg.transferFont.size);
            // Maximum abundance at right.
            context.textAlign('right');
            context.textBaseline('top');
            context.fillText((this.abundanceShareMax * 100).toFixed(0), this.populationAreaWidth, this.dimensions[1]);
            context.strokeLine([this.populationAreaWidth, 0], [this.populationAreaWidth, demarcLength]);
            // Move to cell part.
            context.translate([this.populationAreaWidth + cfg.exemplarColumnSpace, 0]);
            // Minimum cells at left.
            context.textAlign('left');
            context.textBaseline('top');
            context.fillText(this.cntMin.toString(), 0, this.dimensions[1]);
            context.strokeLine([0, 0], [0, demarcLength]);
            // Cell label.
            context.textAlign('left');
            context.textBaseline('top');
            context.fillText('# cells', 0, this.dimensions[1] + cfg.transferFont.size);
            // Maximum cells at right.
            context.textAlign('right');
            context.textBaseline('top');
            context.fillText(this.cntMax.toString(), cfg.transferPlotSize, this.dimensions[1]);
            context.strokeLine([cfg.transferPlotSize, 0], [cfg.transferPlotSize, demarcLength]);
            // Count plot.
            context.snippet(this.cntLine);
            context.restore();
        };
        return WellAbundanceList;
    }(snippet_1.PlacedSnippet));
    var WellDetailView = (function (_super) {
        __extends(WellDetailView, _super);
        function WellDetailView(state) {
            _super.call(this, "WellDetailView", [0, 0]);
            this.state = state;
            var cfg = state.configuration;
            this.imgDim = state.dataSetInfo.value.imageDimensions;
            this.wellScale = Math.min(1, cfg.wellViewMaxWidth / this.imgDim[0]);
            this.imgScaledDim = math_1.Vector.mul(this.imgDim, this.wellScale);
            this.setDimensions(this.imgScaledDim);
            var availableTypes = _.keys(state.availableImageTypes());
            var wellOptions = {};
            availableTypes.forEach(function (t) { return wellOptions[t] = t; });
            this.overlayOption = new configuration_1.ConfigurationOptions("WellOverlayOptions", [0, 0], state, "imagePopulationOverlay", { None: "None", Phenotypes: "Phenotypes" });
            this.imageTypeOption = new configuration_1.ConfigurationOptions("WellDetailOptions", [0, 0], state, "imageType", wellOptions);
            var options = new snippet_1.List("wellOptions", [this.overlayOption, this.imageTypeOption], [0, 0], [0, 0], 'vertical', cfg.annotationColumnSpace, 'left');
            var optionLabels = new snippet_1.List("wellOptionLabels", ["overlay", "image"].map(function (lbl) { return new snippet_1.Label("opt_" + lbl, lbl, [0, 0], cfg.annotationCategoryLabel); }), [0, 0], [0, 0], 'vertical', cfg.annotationColumnSpace, 'right');
            this.optionTable = new snippet_1.List("wellOptionTable", [optionLabels, options], [0, 0], [0, 0], 'horizontal', 2 * cfg.annotationColumnSpace);
            var focused = state.focused();
            this.annotationTable = new WellAnnotationTable("focusedAnnotations", state.wellAnnotations.value.annotationsAt(focused.plate, focused.well), state);
            // Generate predicted population outlines.
            this.computePopulationOutlines();
        }
        WellDetailView.prototype.setTopLeft = function (topLeft) {
            _super.prototype.setTopLeft.call(this, topLeft);
            if (this.optionTable && this.annotationTable) {
                var annotationHeight = this.annotationTable.dimensions[1];
                var optionsHeight = this.optionTable.dimensions[1];
                var maxHeight = Math.max(annotationHeight, optionsHeight);
                this.annotationTable.setTopLeft(math_1.Vector.add(this.topLeft, [0, maxHeight - annotationHeight]));
                this.optionTable.setTopLeft(math_1.Vector.add(this.topRight, [-this.optionTable.dimensions[0], maxHeight - optionsHeight]));
            }
        };
        WellDetailView.prototype.computePopulationOutlines = function () {
            var _this = this;
            this.objectMaxRadi = this.state.objectInfo.value["wellOutlines"];
            if (!this.objectMaxRadi) {
                var objectCoordinates = this.state.focusedWellCoordinates();
                this.objectMaxRadi = {};
                _.pairs(objectCoordinates).forEach(function (p) {
                    return _this.objectMaxRadi[p[0]] = [
                        p[1][0],
                        p[1][1],
                        Math.min(_this.state.configuration.wellViewMaxObjectRadius, 0.5 * _.min(_.pairs(objectCoordinates).map(function (sp) {
                            return p[0] === sp[0] ? Number.POSITIVE_INFINITY : math_1.Vector.distance(p[1], sp[1]);
                        }))) - 5,
                        _this.state.objectInfo.value.cell("population", p[0])
                    ];
                });
                this.state.objectInfo.value["wellOutlines"] = this.objectMaxRadi;
            }
        };
        WellDetailView.prototype.paint = function (ctx) {
            var _this = this;
            var state = this.state;
            var cfg = state.configuration;
            ctx.save();
            ctx.translate(this.topLeft);
            ctx.translate([0,
                2 * cfg.annotationColumnSpace + Math.max(this.annotationTable.dimensions[1], this.optionTable.dimensions[1])
            ]);
            var well = state.selectionWell(state.focused());
            if (well) {
                var img = well.image(cfg.imageType);
                ctx.transitioning = false;
                ctx.context.beginPath();
                ctx.context.rect(0, 0, this.imgScaledDim[0], this.imgScaledDim[1]);
                ctx.context.clip();
                if (img) {
                    ctx.picking = true;
                    ctx.drawImageClipped(img, [0, 0], [img.width, 0.5 * img.height], [0, 0], [this.wellScale * img.width, this.wellScale * 0.5 * img.height]);
                    ctx.picking = false;
                }
                // Population outline overlay.
                if (cfg.imagePopulationOverlay === "Phenotypes") {
                    ctx.save();
                    var allPopulations = this.state.populationSpace.allPopulations();
                    _.pairs(this.objectMaxRadi).forEach(function (p) {
                        var cs = p[1];
                        if (cs[3] >= 0) {
                            var x = _this.wellScale * cs[0];
                            var y = _this.wellScale * cs[1];
                            var rad = _this.wellScale * cs[2];
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
                ctx.strokeStyle(rI >= 0 ? cfg.backgroundColor : style_1.Color.NONE);
                ctx.lineWidth(4);
                ctx.strokeRect(this.wellScale * rX - xRad, this.wellScale * rY - yRad, 2 * xRad, 2 * yRad);
                ctx.strokeStyle(rI >= 0 ? cfg.baseSelected : style_1.Color.NONE);
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
        };
        WellDetailView.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            var object = enriched.closestWellObject(coordinates);
            interaction.selectedCoordinates.switchObject(object);
            enriched.conformSelectedCoordinates(interaction);
            interaction.pushView('well');
        };
        return WellDetailView;
    }(snippet_1.PlacedSnippet));
    var WellAnnotationTable = (function (_super) {
        __extends(WellAnnotationTable, _super);
        function WellAnnotationTable(identifier, annotations, state) {
            _super.call(this, identifier, [
                new snippet_1.List("annTableLbls", WellAnnotationTable.annotationKeys(annotations).map(function (k) {
                    return new snippet_1.Label("annTableLbl" + k, k.toLowerCase(), [0, 0], state.configuration.annotationCategoryLabel, false);
                }), [0, 0], [0, 0], 'vertical', state.configuration.annotationColumnSpace, 'right'),
                new snippet_1.List("annTableRows", WellAnnotationTable.annotationKeys(annotations).map(function (k) {
                    return new WellAnnotationRow(identifier, k, annotations[k], state);
                }), [0, 0], [0, 0], 'vertical', state.configuration.annotationColumnSpace, 'left')
            ], [0, 0], [0, 0], 'horizontal', 2 * state.configuration.annotationColumnSpace);
        }
        WellAnnotationTable.annotationKeys = function (annotations) {
            return _.keys(annotations).sort(function (l, r) { return l.length - r.length; });
        };
        return WellAnnotationTable;
    }(snippet_1.List));
    var WellAnnotationRow = (function (_super) {
        __extends(WellAnnotationRow, _super);
        function WellAnnotationRow(tableId, category, tags, state) {
            _super.call(this, tableId + "_" + category, tags.map(function (tag) { return new AnnotationButton(category, tag, state); }), [0, 0], [0, 0], 'horizontal', state.configuration.annotationTagSpace, 'left');
        }
        return WellAnnotationRow;
    }(snippet_1.List));
    var AnnotationButton = (function (_super) {
        __extends(AnnotationButton, _super);
        function AnnotationButton(category, tag, state) {
            _super.call(this, "annBut_" + (category || "") + "_" + tag, tag, [0, 0], !category || state.isTagActive(tag) ?
                state.configuration.annotationSelectedLabel :
                state.configuration.annotationLabel, true);
            this.category = category;
            this.tag = tag;
        }
        AnnotationButton.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            interaction.selectedCoordinates.wellFilter = this.tag;
        };
        return AnnotationButton;
    }(snippet_1.Label));
});
//# sourceMappingURL=wells.js.map