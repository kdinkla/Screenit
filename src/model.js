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
        function InteractionState(populationSpace, hoveredCoordinates, selectedCoordinates, configuration) {
            if (populationSpace === void 0) { populationSpace = new PopulationSpace(); }
            if (hoveredCoordinates === void 0) { hoveredCoordinates = new SelectionCoordinates(); }
            if (selectedCoordinates === void 0) { selectedCoordinates = new SelectionCoordinates(); }
            if (configuration === void 0) { configuration = new BaseConfiguration(); }
            this.populationSpace = populationSpace;
            this.hoveredCoordinates = hoveredCoordinates;
            this.selectedCoordinates = selectedCoordinates;
            this.configuration = configuration;
        }
        InteractionState.prototype.removeExemplar = function (object) {
            this.populationSpace.populations.forEach(function (p) { return p.exemplars = p.exemplars.pull(object); });
            if (this.hoveredCoordinates.object === object)
                this.hoveredCoordinates.object = null;
        };
        return InteractionState;
    })();
    exports.InteractionState = InteractionState;
    // The object referred to below are part of a small sample (~1000).
    var EnrichedState = (function (_super) {
        __extends(EnrichedState, _super);
        function EnrichedState(state) {
            _super.call(this, state.populationSpace, state.hoveredCoordinates, state.selectedCoordinates, state.configuration);
            this.allExemplars = Chain.union(this.populationSpace.populations.map(function (p) { return p.exemplars; }));
            var focusedWell = this.focused();
            var populationDict = this.populationSpace.toDict();
            var histogramDict = this.populationSpace.toDict();
            histogramDict['bins'] = state.configuration.splomInnerSize;
            var objectInfoDict = this.populationSpace.toDict();
            objectInfoDict['column'] = focusedWell.well === null ? -1 : focusedWell.well.column;
            objectInfoDict['row'] = focusedWell.well === null ? -1 : focusedWell.well.row;
            objectInfoDict['plate'] = focusedWell.plate === null ? -1 : focusedWell.plate;
            this.dataSetInfo = new ProxyValue("dataSetInfo", {}, new DataSetInfo(), function (ds) { return new DataSetInfo(ds.plateLabels, ds.columnLabels, ds.rowLabels); });
            this.features = new ProxyValue("features", {}, new DataFrame(), function (f) { return new DataFrame(f).transpose().normalize(false, true); });
            this.objectInfo = new ProxyValue("objectInfo", objectInfoDict, new NumberFrame(), function (o) { return new NumberFrame(o); });
            /*this.objectHistograms = new ProxyValue(
                "objectHistograms2D",
                histogramDict,
                new HistogramMatrix(), m => new HistogramMatrix(m)
            );*/
            this.featureHistograms = new ProxyValue("featureHistograms", populationDict, new FeatureHistograms(), function (hs) { return new FeatureHistograms(hs); });
            this.wellClusterShares = new ProxyValue("wellClusterShares", populationDict, new WellClusterShares(), function (s) { return new WellClusterShares(s); });
        }
        EnrichedState.prototype.cloneInteractionState = function () {
            return new InteractionState(collection.snapshot(this.populationSpace), collection.snapshot(this.hoveredCoordinates), collection.snapshot(this.selectedCoordinates), collection.snapshot(this.configuration));
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
                var row = tbl.columnVector('well_row');
                var col = tbl.columnVector('well_col');
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
            var location = this.focused().wellLocation();
            var focusedWell = location ? [location.toWellSelection("Selected")] : [];
            return _.union(this.dataSetInfo.value.wellSelections, focusedWell);
        };
        // Focused coordinates.
        EnrichedState.prototype.focused = function () {
            //this.makeConsistent(this.hoveredCoordinates);
            return this.hoveredCoordinates.otherwise(this.selectedCoordinates);
        };
        // Complete, or correct, coordinates, from object level up to plate level.
        EnrichedState.prototype.conformHoveredCoordinates = function (targetState) {
            if (targetState.hoveredCoordinates !== null) {
                var location = this.allObjectWells().location(targetState.hoveredCoordinates.object);
                if (location) {
                    targetState.hoveredCoordinates.well = location.coordinates();
                    targetState.hoveredCoordinates.plate = location.plate;
                }
            }
        };
        EnrichedState.prototype.hoveredObjectIsExemplar = function () {
            return this.hoveredCoordinates.object !== null && this.allExemplars.has(this.hoveredCoordinates.object);
        };
        /*private allObjInfo: NumberFrame = null;
        allObjectInfo() {
            if(!this.allObjInfo) {
                this.allObjInfo = new NumberFrame(this.wellObjectInfo.value.join(this.objectInfo.value).toDict());  //this.objectInfo.value.join(this.wellObjectInfo.value).toDict());
            }
            return this.allObjInfo;
        }*/
        EnrichedState.prototype.allObjectWells = function () {
            return new ObjectWells(this.objectInfo.value);
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
            var takenColors = new Chain(this.populations.map(function (p) { return p.color; }));
            var availableColors = new Chain(Color.colorMapNominal12);
            var freeColors = Chain.difference(availableColors, takenColors);
            var color = freeColors.length > 0 ? freeColors.elements[0] : Color.BLACK;
            var population = new Population(null, "Tag", new Chain(), color);
            this.populations = this.populations.push(population);
            return population;
        };
        // Dictionary for communicating population description.
        PopulationSpace.prototype.toDict = function () {
            var exemplars = {};
            this.populations.forEach(function (p) { return exemplars[p.identifier] = p.exemplars.elements; }); // DO NOT REMOVE!
            return { features: this.features.elements, exemplars: exemplars };
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
            this.colorTrans = color.alpha(0.5);
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
            if (well === void 0) { well = null; }
            if (plate === void 0) { plate = null; }
            this.population = population;
            this.object = object;
            this.well = well;
            this.plate = plate;
        }
        // Correct for missing values with given coordinates.
        SelectionCoordinates.prototype.otherwise = function (that) {
            return new SelectionCoordinates(this.population === null ? that.population : this.population, this.object === null ? that.object : this.object, this.well === null ? that.well : this.well, this.plate === null ? that.plate : this.plate);
        };
        SelectionCoordinates.prototype.wellLocation = function () {
            var location = null;
            if (this.well !== null && this.plate !== null) {
                location = new WellLocation(this.well.column, this.well.row, this.plate);
                if (SelectionCoordinates.cachedLocation !== null && SelectionCoordinates.cachedLocation.equals(location)) {
                    location = SelectionCoordinates.cachedLocation;
                }
                else {
                    SelectionCoordinates.cachedLocation = location;
                }
            }
            return location;
        };
        // Selected population, or total population fallback.
        SelectionCoordinates.prototype.populationOrTotal = function () {
            return this.population || Population.POPULATION_TOTAL_NAME;
        };
        // Well location. Returns null if it is invalid.
        SelectionCoordinates.cachedLocation = null;
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
                new WellSelection("Control", [[0, this.plateCount - 1]], WellCoordinates.rowWells(this.columnCount, [0]))
            ];
        }
        return DataSetInfo;
    })();
    exports.DataSetInfo = DataSetInfo;
    var ObjectWells = (function () {
        function ObjectWells(frame) {
            this.frame = frame;
            if (!frame['wellLocations']) {
                var locations = [];
                frame['wellLocations'] = locations;
                frame.rows.forEach(function (r) {
                    var columnI = frame.columnIndex["well_col"];
                    var rowI = frame.columnIndex["well_row"];
                    var plateI = frame.columnIndex["plate"];
                    var rI = frame.rowIndex[r];
                    locations[r] = new WellLocation(frame.matrix[columnI][rI], frame.matrix[rowI][rI], frame.matrix[plateI][rI]);
                });
            }
        }
        ObjectWells.prototype.location = function (object) {
            return this.frame['wellLocations'][object];
        };
        // Coordinates in well image.
        ObjectWells.prototype.coordinates = function (object) {
            var xI = this.frame.columnIndex["x"];
            var yI = this.frame.columnIndex["y"];
            var rI = this.frame.rowIndex[object];
            return [
                this.frame.matrix[xI][rI],
                this.frame.matrix[yI][rI]
            ];
        };
        return ObjectWells;
    })();
    exports.ObjectWells = ObjectWells;
    var WellClusterShares = (function (_super) {
        __extends(WellClusterShares, _super);
        function WellClusterShares(dictionary) {
            var _this = this;
            if (dictionary === void 0) { dictionary = {}; }
            _super.call(this, dictionary);
            this.wellIndex = [];
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
            _.keys(dict).map(function (k) { return _this.histograms[k] = new DataFrame(dict[k]).transpose().normalize(false, true); });
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
        function WellLocation(column, row, plate) {
            _super.call(this, column, row);
            this.plate = plate;
            this.imgArrived = false;
        }
        WellLocation.prototype.toString = function () {
            return this.column.toString() + "." + this.row.toString() + "." + this.plate.toString();
        };
        /*toJSON() {
            return {
                column: this.column,
                row: this.row,
                plate: this.plate
            };
        }*/
        WellLocation.prototype.equals = function (that) {
            return this.column === that.column && this.row === that.row && this.plate === that.plate;
        };
        // This (singular) location as a well selection.
        WellLocation.prototype.toWellSelection = function (id) {
            return new WellSelection(id, [[this.plate, this.plate]], [new WellCoordinates(this.column, this.row)]);
        };
        /*// Location for the given plate.
        forPlate(plate: number) {
            return new WellLocation(this.column, this.row, plate);
        }
    
        // Location for the given column and row coordinates.
        forCoordinates(column: number, row: number) {
            return new WellLocation(column, row, this.plate);
        }*/
        // Well column and row coordinates. Excludes plate coordinate.
        WellLocation.prototype.coordinates = function () {
            return new WellCoordinates(this.column, this.row);
        };
        WellLocation.zfill = function (num, len) {
            return (Array(len).join("0") + num).slice(-len);
        };
        WellLocation.prototype.imageURL = function () {
            var plateTag = WellLocation.plateTags[this.plate];
            var wellTag = plateTag + WellLocation.columnTags[this.column] + WellLocation.rowTags[this.row];
            return "http://www.ebi.ac.uk/huber-srv/cellmorph/view/" + plateTag + "/" + wellTag + "/" + wellTag + "_seg.jpeg";
            //return "dataset/images/" + plateTag + "/" + wellTag + "/" + wellTag + "_seg.jpeg";
        };
        WellLocation.prototype.image = function () {
            var _this = this;
            if (!this.img) {
                this.img = new Image();
                this.img.onload = function () { return _this.imgArrived = true; };
                this.img.src = this.imageURL();
            }
            return this.imgArrived ? this.img : null;
        };
        WellLocation.plateTags = _.range(1, 69).map(function (i) { return "HT" + WellLocation.zfill(i, 2); });
        WellLocation.columnTags = 'ABCDEFGHIJKLMNOP'.split('');
        WellLocation.rowTags = _.range(4, 25).map(function (i) { return WellLocation.zfill(i, 3); });
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
            var _this = this;
            if (matrixMap === void 0) { matrixMap = {}; }
            this.matrices = [];
            _.keys(matrixMap).forEach(function (kC) {
                var cNr = Number(kC);
                var ftrMatrices = matrixMap[kC];
                console.log("Cluster key: " + kC);
                if (!(cNr in _this.matrices)) {
                    _this.matrices[cNr] = {};
                }
                _.keys(ftrMatrices).forEach(function (kF) {
                    var ftrs = kF.split("..");
                    if (!(ftrs[0] in _this.matrices[cNr])) {
                        _this.matrices[cNr][ftrs[0]] = {};
                    }
                    _this.matrices[cNr][ftrs[0]][ftrs[1]] = ftrMatrices[kF];
                });
            });
            console.log("Received new histogram matrix:");
            console.log(matrixMap);
        }
        // Get matrix for given population id and feature pair.
        HistogramMatrix.prototype.matrix = function (cluster, feature1, feature2) {
            var clusterMatrices = this.matrices[cluster] || {};
            var matrix = null;
            if (feature1 in clusterMatrices) {
                matrix = clusterMatrices[feature1][feature2] || null;
            }
            else if (feature2 in clusterMatrices) {
                matrix = clusterMatrices[feature2][feature1] || null;
            }
            return matrix;
        };
        // Matrices by feature pair.
        HistogramMatrix.prototype.matricesByFeaturePair = function (feature1, feature2) {
            var _this = this;
            var result = {};
            _.keys(this.matrices).forEach(function (kC) {
                var cNr = Number(kC);
                var mat = _this.matrix(cNr, feature1, feature2);
                if (mat)
                    result[cNr] = mat;
            });
            return result;
        };
        return HistogramMatrix;
    })();
    exports.HistogramMatrix = HistogramMatrix;
});
//# sourceMappingURL=model.js.map