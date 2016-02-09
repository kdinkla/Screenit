/// <reference path="references.d.ts"/>
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define(["require", "exports", './core/math', './core/graphics/style', './core/collection', './core/dataframe', './core/dataprovider', './configuration'], function (require, exports, math, style, collection, dataframe, data, config) {
    var Vector = math.Vector;
    var Color = style.Color;
    var Chain = collection.Chain;
    var DataFrame = dataframe.DataFrame;
    var NumberFrame = dataframe.NumberFrame;
    var ProxyValue = data.ProxyValue;
    var BaseConfiguration = config.BaseConfiguration;
    var InteractionState = (function () {
        function InteractionState(populationSpace, hoveredCoordinates, selectedCoordinates, openViews, configuration) {
            if (populationSpace === void 0) { populationSpace = new PopulationSpace(); }
            if (hoveredCoordinates === void 0) { hoveredCoordinates = new SelectionCoordinates(); }
            if (selectedCoordinates === void 0) { selectedCoordinates = new SelectionCoordinates(); }
            if (openViews === void 0) { openViews = new Chain(['plates']); }
            if (configuration === void 0) { configuration = new BaseConfiguration(); }
            this.populationSpace = populationSpace;
            this.hoveredCoordinates = hoveredCoordinates;
            this.selectedCoordinates = selectedCoordinates;
            this.openViews = openViews;
            this.configuration = configuration;
        }
        InteractionState.prototype.removeExemplar = function (object) {
            // Remove given exemplar from any population (should be a single population).
            this.populationSpace.populations.forEach(function (p) { return p.exemplars = p.exemplars.pull(object); });
            // Remove empty populations.
            //this.populationSpace.populations = this.populationSpace.populations.filter(p => p.length > 0);
            if (this.hoveredCoordinates.object === object)
                this.hoveredCoordinates.object = null;
        };
        InteractionState.prototype.pushView = function (identifier) {
            this.openViews = this.openViews.push(identifier); //this.openViews.toggle(identifier);
            this.openViews = new Chain(_.takeRight(this.openViews.elements, 3)); // Limit number of open views.
        };
        return InteractionState;
    })();
    exports.InteractionState = InteractionState;
    // The object referred to below are part of a small sample (~1000).
    var EnrichedState = (function (_super) {
        __extends(EnrichedState, _super);
        function EnrichedState(state) {
            _super.call(this, state.populationSpace, state.hoveredCoordinates, state.selectedCoordinates, state.openViews, state.configuration);
            this.allExemplars = Chain.union(this.populationSpace.populations.elements.map(function (p) { return p.exemplars; }));
            var focusedWell = this.focused();
            var addWellInfo = function (dict) {
                dict['column'] = focusedWell.well === null ? -1 : focusedWell.well.column;
                dict['row'] = focusedWell.well === null ? -1 : focusedWell.well.row;
                dict['plate'] = focusedWell.plate === null ? -1 : focusedWell.plate;
            };
            var populationDict = this.populationSpace.toDict();
            var histogramDict = this.populationSpace.toDict();
            histogramDict['bins'] = state.configuration.splomInnerSize;
            var objectInfoDict = this.populationSpace.toDict();
            addWellInfo(objectInfoDict);
            var objectValuesDict = this.populationSpace.toDict(false);
            addWellInfo(objectValuesDict);
            this.dataSetInfo = new ProxyValue("dataSetInfo", {}, new DataSetInfo(), function (ds) { return new DataSetInfo(ds.plateLabels, ds.columnLabels, ds.rowLabels); });
            this.features = new ProxyValue("features", {}, []);
            this.objectInfo = new ProxyValue("objectInfo", objectInfoDict, new NumberFrame(), function (o) { return new NumberFrame(o); });
            this.objectHistograms = new ProxyValue("objectHistograms2D", histogramDict, new HistogramMatrix(), function (m) { return new HistogramMatrix(m); });
            this.wellClusterShares = new ProxyValue("wellClusterShares", populationDict, new WellClusterShares(), function (s) { return new WellClusterShares(s); });
            this.featureHistograms = new ProxyValue("featureHistograms", populationDict, new FeatureHistograms(), function (hs) { return new FeatureHistograms(hs); });
            this.objectFeatureValues = new ProxyValue("objectFeatureValues", objectValuesDict, new NumberFrame(), function (vs) { return new NumberFrame(vs); });
            console.log("Object feature values:");
            console.log(this.objectFeatureValues.value);
        }
        EnrichedState.prototype.cloneInteractionState = function () {
            return new InteractionState(collection.snapshot(this.populationSpace), collection.snapshot(this.hoveredCoordinates), collection.snapshot(this.selectedCoordinates), collection.snapshot(this.openViews), collection.snapshot(this.configuration));
        };
        EnrichedState.prototype.closestObject = function (features, coordinates) {
            var bestIndex = -1;
            var tbl = this.objectInfo.value;
            if (features[0] in tbl.columnIndex && features[1] in tbl.columnIndex && coordinates) {
                var xColI = tbl.columnIndex[features[0]];
                var yColI = tbl.columnIndex[features[1]];
                var x = tbl.normalizedMatrix[xColI];
                var y = tbl.normalizedMatrix[yColI];
                var minDist = Number.MAX_VALUE;
                for (var i = 0; i < tbl.rows.length; i++) {
                    var csDist = Vector.distance(coordinates, [x[i], y[i]]);
                    if (csDist < minDist) {
                        minDist = csDist;
                        bestIndex = i;
                    }
                }
            }
            return bestIndex >= 0 ? Number(tbl.rows[bestIndex]) : null;
        };
        EnrichedState.prototype.closestWellObject = function (coordinates) {
            var bestIndex = -1;
            var tbl = this.objectInfo.value;
            if (tbl && coordinates) {
                var x = tbl.columnVector('x');
                var y = tbl.columnVector('y');
                var plate = tbl.columnVector('plate');
                var row = tbl.columnVector('row');
                var col = tbl.columnVector('column');
                var minDist = Number.MAX_VALUE;
                var focusedWell = this.focused();
                for (var i = 0; i < tbl.rows.length; i++) {
                    if (plate[i] === focusedWell.plate && focusedWell.well && row[i] === focusedWell.well.row && col[i] === focusedWell.well.column) {
                        var csDist = Vector.distance(coordinates, [x[i], y[i]]);
                        if (csDist < minDist) {
                            minDist = csDist;
                            bestIndex = i;
                        }
                    }
                }
            }
            return bestIndex >= 0 ? Number(tbl.rows[bestIndex]) : null;
        };
        // Well selections, including single focused well.
        EnrichedState.prototype.allWellSelections = function () {
            var location = this.selectionWell(this.focused());
            var focusedWell = location ? [location.toWellSelection("Selected")] : [];
            return _.union(this.dataSetInfo.value.wellSelections, focusedWell);
        };
        // Focused coordinates.
        EnrichedState.prototype.focused = function () {
            return this.hoveredCoordinates.otherwise(this.selectedCoordinates);
        };
        // Population color, includes focused population highlight.
        EnrichedState.prototype.populationColor = function (population) {
            return this.focused().population === population.identifier ? this.configuration.highlight : population.color;
        };
        // Translucent population color, includes population highlight.
        EnrichedState.prototype.populationColorTranslucent = function (population) {
            return this.focused().population === population.identifier ? this.configuration.highlight : population.colorTrans;
        };
        // Complete, or correct, coordinates, from object level up to plate level.
        EnrichedState.prototype.conformHoveredCoordinates = function (targetState) {
            var coordinates = targetState.hoveredCoordinates;
            if (coordinates !== null) {
                var wellInfo = this.objectWellInfo(coordinates.object);
                if (wellInfo) {
                    var location = wellInfo.location;
                    coordinates.well = location.coordinates();
                    coordinates.plate = location.plate;
                }
            }
        };
        EnrichedState.prototype.hoveredObjectIsExemplar = function () {
            return this.hoveredCoordinates.object !== null && this.allExemplars.has(this.hoveredCoordinates.object);
        };
        EnrichedState.prototype.selectionWell = function (selection) {
            return this.wellLocation(selection.well.column, selection.well.row, selection.plate);
        };
        EnrichedState.prototype.objectWellInfo = function (object) {
            var result = null;
            var table = this.objectInfo.value;
            if (object in table.rowIndex) {
                result = {
                    location: this.wellLocation(table.cell("column", object), table.cell("row", object), table.cell("plate", object)),
                    coordinates: [table.cell("x", object), table.cell("y", object)]
                };
            }
            return result;
        };
        EnrichedState.prototype.wellLocation = function (column, row, plate) {
            var objectTable = this.objectInfo.value;
            var locationMap = objectTable['wellLocations'];
            if (!locationMap) {
                locationMap = {};
                var imageURLs = this.availableImageTypes();
                var plateVec = objectTable.columnVector('plate');
                var columnVec = objectTable.columnVector('column');
                var rowVec = objectTable.columnVector('row');
                if (plateVec && columnVec && rowVec) {
                    for (var i = 0; i < plateVec.length; i++) {
                        var plateObj = plateVec[i];
                        var columnObj = columnVec[i];
                        var rowObj = rowVec[i];
                        var imgMap = {};
                        _.pairs(imageURLs).forEach(function (p, cnI) { return imgMap[p[0]] = objectTable.columnVector(p[1])[i]; });
                        locationMap[columnObj + "_" + rowObj + "_" + plateObj] = new WellLocation(columnObj, rowObj, plateObj, imgMap);
                    }
                    objectTable['wellLocations'] = locationMap;
                }
            }
            return locationMap[column + "_" + row + "_" + plate] || new WellLocation(column, row, plate);
        };
        EnrichedState.prototype.availableImageTypes = function () {
            var result = {};
            var columns = this.objectInfo.value.columns.filter(function (c) { return _.startsWith(c, "img_"); });
            columns.forEach(function (c) { return result[c.slice(4)] = c; });
            return result;
        };
        return EnrichedState;
    })(InteractionState);
    exports.EnrichedState = EnrichedState;
    // Populations and their feature space.
    var PopulationSpace = (function () {
        function PopulationSpace(features, // Feature axes of space to model in.
            populations) {
            if (features === void 0) { features = new Chain(); }
            if (populations === void 0) { populations = new Chain(); }
            this.features = features;
            this.populations = populations;
        }
        // Create a new population.
        PopulationSpace.prototype.createPopulation = function () {
            // Choose an available nominal color.
            var takenColors = this.populations.map(function (p) { return p.color; });
            var availableColors = new Chain(Color.colorMapNominal8);
            var freeColors = Chain.difference(availableColors, takenColors);
            var color = freeColors.length > 0 ? freeColors.elements[0] : Color.BLACK;
            var population = new Population(null, "Tag", new Chain(), color);
            this.populations = this.populations.push(population);
            return population;
        };
        // Dictionary for communicating population description.
        PopulationSpace.prototype.toDict = function (includeFeatures) {
            if (includeFeatures === void 0) { includeFeatures = true; }
            var exemplars = {};
            this.populations.forEach(function (p) { return exemplars[p.identifier] = _.clone(p.exemplars.elements); }); // DO NOT REMOVE!
            return includeFeatures ? { features: this.features.elements, exemplars: exemplars } : { exemplars: exemplars };
        };
        // Whether given object is an exemplar.
        PopulationSpace.prototype.isExemplar = function (object) {
            return this.populations.elements.some(function (p) { return p.exemplars.has(object); });
        };
        return PopulationSpace;
    })();
    exports.PopulationSpace = PopulationSpace;
    // Population.
    var Population = (function () {
        function Population(identifier, name, exemplars, color) {
            if (identifier === void 0) { identifier = null; }
            if (name === void 0) { name = null; }
            if (exemplars === void 0) { exemplars = new Chain(); }
            if (color === void 0) { color = Color.NONE; }
            this.identifier = identifier;
            this.name = name;
            this.exemplars = exemplars;
            this.color = color;
            if (identifier === null)
                this.identifier = Population.POPULATION_ID_COUNTER++;
            if (name === null)
                this.name = this.identifier.toString();
            this.colorTrans = color.alpha(0.25);
        }
        /*toNumber() {
            return this.identifier;
        }*/
        Population.prototype.toString = function () {
            return this.identifier.toString();
        };
        Population.POPULATION_TOTAL_NAME = 'objects';
        Population.POPULATION_ID_COUNTER = 1;
        return Population;
    })();
    exports.Population = Population;
    // Field selection coordinates.
    var SelectionCoordinates = (function () {
        function SelectionCoordinates(population, // Population id.
            object, // Object (e.g. cell) id.
            well, // Well coordinates (column, row).
            plate) {
            if (population === void 0) { population = null; }
            if (object === void 0) { object = null; }
            if (well === void 0) { well = new WellCoordinates(0, 0); }
            if (plate === void 0) { plate = 0; }
            this.population = population;
            this.object = object;
            this.well = well;
            this.plate = plate;
        }
        // Correct for missing values with given coordinates.
        SelectionCoordinates.prototype.otherwise = function (that) {
            return new SelectionCoordinates(this.population === null ? that.population : this.population, this.object === null ? that.object : this.object, this.well === null ? that.well : this.well, this.plate === null ? that.plate : this.plate);
        };
        // Selected population, or total population fallback.
        SelectionCoordinates.prototype.populationOrTotal = function () {
            return this.population || Population.POPULATION_TOTAL_NAME;
        };
        return SelectionCoordinates;
    })();
    exports.SelectionCoordinates = SelectionCoordinates;
    var DataSetInfo = (function () {
        function DataSetInfo(plateLabels, columnLabels, rowLabels) {
            if (plateLabels === void 0) { plateLabels = []; }
            if (columnLabels === void 0) { columnLabels = []; }
            if (rowLabels === void 0) { rowLabels = []; }
            this.plateLabels = plateLabels;
            this.columnLabels = columnLabels;
            this.rowLabels = rowLabels;
            this.plateCount = plateLabels.length;
            this.columnCount = columnLabels.length;
            this.rowCount = rowLabels.length;
            // Well selection placeholder; complete selection and control wells, for now.
            this.wellSelections = [
            ];
        }
        return DataSetInfo;
    })();
    exports.DataSetInfo = DataSetInfo;
    var WellClusterShares = (function (_super) {
        __extends(WellClusterShares, _super);
        function WellClusterShares(dictionary) {
            var _this = this;
            if (dictionary === void 0) { dictionary = {}; }
            _super.call(this, dictionary);
            this.wellIndex = [];
            this.maxObjectCount = 0;
            this.columns.forEach(function (c) {
                var cI = _this.columnIndex[c];
                var col = _this.matrix[cI];
                _this.rows.forEach(function (r) {
                    var val = col[_this.rowIndex[r]];
                    var localI = r.split('_').map(function (i) { return Number(i); });
                    _this.inject(val, _this.wellIndex, _.flatten([[c], localI]));
                });
            });
        }
        WellClusterShares.prototype.inject = function (value, subIndex, indices) {
            var nextIndex = _.head(indices);
            var remainder = _.tail(indices);
            if (indices.length == 1) {
                subIndex[nextIndex] = value;
                this.maxObjectCount = Math.max(this.maxObjectCount, value);
            }
            else {
                var targetIndex = subIndex[nextIndex];
                if (!targetIndex) {
                    targetIndex = [];
                    subIndex[nextIndex] = targetIndex;
                }
                this.inject(value, targetIndex, remainder);
            }
        };
        return WellClusterShares;
    })(NumberFrame);
    exports.WellClusterShares = WellClusterShares;
    var Clusters = (function () {
        function Clusters(clusterMap) {
            var _this = this;
            if (clusterMap === void 0) { clusterMap = {}; }
            this.clusterMap = clusterMap;
            this.identifiers = _.uniq(_.values(clusterMap).map(function (c) { return Number(c); }));
            // Check for no cluster case (-1 cluster).
            if (this.identifiers.length > 0 && this.identifiers[0] > -1) {
                this.identifierIndex = {};
                this.identifiers.forEach(function (id, I) { return _this.identifierIndex[id] = I; });
                this.members = [];
                this.identifiers.forEach(function (c) { return _this.members[c] = []; });
                _.pairs(clusterMap).forEach(function (p) { return _this.members[p[1]].push(p[0]); });
            }
        }
        Clusters.CLUSTER_PREAMBLE = "c_";
        return Clusters;
    })();
    exports.Clusters = Clusters;
    var FeatureHistograms = (function () {
        function FeatureHistograms(dict) {
            var _this = this;
            if (dict === void 0) { dict = {}; }
            this.histograms = {};
            _.keys(dict).map(function (k) { return _this.histograms[k] = new DataFrame(dict[k]).normalize(); }); //.transpose().normalize(false, true));
        }
        return FeatureHistograms;
    })();
    exports.FeatureHistograms = FeatureHistograms;
    // Wells by column and row coordinates.
    var WellCoordinates = (function () {
        function WellCoordinates(column, row) {
            this.column = column;
            this.row = row;
        }
        // Generate the coordinates of all wells on a plate.
        WellCoordinates.allWells = function (columnCount, rowCount) {
            return _.flatten(_.range(0, columnCount).map(function (c) { return _.range(0, rowCount).map(function (r) { return new WellCoordinates(c, r); }); }));
        };
        // Generate the coordinates of all wells for the given row indices.
        WellCoordinates.rowWells = function (columnCount, rows) {
            return _.flatten(_.range(0, columnCount).map(function (c) { return rows.map(function (r) { return new WellCoordinates(c, r); }); }));
        };
        // Generate the coordinates of all wells for the given column indices.
        WellCoordinates.columnWells = function (columns, rowCount) {
            return _.flatten(columns.map(function (c) { return _.range(0, rowCount).map(function (r) { return new WellCoordinates(c, r); }); }));
        };
        return WellCoordinates;
    })();
    exports.WellCoordinates = WellCoordinates;
    // Well by plate, column, and row coordinates.
    var WellLocation = (function (_super) {
        __extends(WellLocation, _super);
        function WellLocation(column, row, plate, imageURLs) {
            if (imageURLs === void 0) { imageURLs = {}; }
            _super.call(this, column, row);
            this.plate = plate;
            this.imageURLs = imageURLs;
            this.imgArrived = null;
        }
        WellLocation.prototype.toString = function () {
            return this.column.toString() + "." + this.row.toString() + "." + this.plate.toString();
        };
        WellLocation.prototype.equals = function (that) {
            return this.column === that.column && this.row === that.row && this.plate === that.plate;
        };
        // This (singular) location as a well selection.
        WellLocation.prototype.toWellSelection = function (id) {
            return new WellSelection(id, [[this.plate, this.plate]], [new WellCoordinates(this.column, this.row)]);
        };
        // Well column and row coordinates. Excludes plate coordinate.
        WellLocation.prototype.coordinates = function () {
            return new WellCoordinates(this.column, this.row);
        };
        WellLocation.prototype.image = function (type) {
            var _this = this;
            if (type === void 0) { type = null; }
            // Default to first image type.
            if (type === null)
                type = _.keys(this.imageURLs)[0];
            if (this.imgArrived !== type && this.imageURLs[type]) {
                this.img = new Image();
                this.img.onload = function () { return _this.imgArrived = type; };
                this.img.src = this.imageURLs[type];
            }
            return this.imgArrived ? this.img : null;
        };
        return WellLocation;
    })(WellCoordinates);
    exports.WellLocation = WellLocation;
    var WellSelection = (function () {
        function WellSelection(id, plates, // Plate ranges, or individual indices as singleton arrays.
            wells) {
            this.id = id;
            this.plates = plates;
            this.wells = wells;
        }
        return WellSelection;
    })();
    exports.WellSelection = WellSelection;
    var HistogramMatrix = (function () {
        function HistogramMatrix(matrixMap) {
            if (matrixMap === void 0) { matrixMap = {}; }
            this.matrices = matrixMap;
        }
        HistogramMatrix.prototype.matricesFor = function (xFeature, yFeature) {
            return (this.matrices[xFeature] || {})[yFeature] || null;
        };
        return HistogramMatrix;
    })();
    exports.HistogramMatrix = HistogramMatrix;
});
//# sourceMappingURL=model.js.map