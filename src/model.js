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
    exports.viewCycle = ['datasets', 'plates', 'plate', 'well', 'features', 'splom', 'exemplars'];
    var InteractionState = (function () {
        function InteractionState(populationSpace, hoveredCoordinates, selectedCoordinates, openViews, configuration) {
            if (populationSpace === void 0) { populationSpace = null; }
            if (hoveredCoordinates === void 0) { hoveredCoordinates = null; }
            if (selectedCoordinates === void 0) { selectedCoordinates = null; }
            if (openViews === void 0) { openViews = null; }
            if (configuration === void 0) { configuration = null; }
            this.populationSpace = populationSpace;
            this.hoveredCoordinates = hoveredCoordinates;
            this.selectedCoordinates = selectedCoordinates;
            this.openViews = openViews;
            this.configuration = configuration;
            if (populationSpace == null)
                this.switchToDataSet('CellMorph'); // Default to Cell Morph data set.
        }
        InteractionState.prototype.switchToDataSet = function (dataSet) {
            this.populationSpace = new PopulationSpace();
            this.hoveredCoordinates = new SelectionCoordinates();
            this.selectedCoordinates = new SelectionCoordinates();
            this.openViews = new Chain(['plates', 'exemplars']);
            this.configuration = new BaseConfiguration();
            this.selectedCoordinates.dataSet = dataSet;
        };
        InteractionState.prototype.removeExemplar = function (object) {
            // Remove given exemplar from any population (should be a single population).
            this.populationSpace.removeExemplar(object);
            if (this.hoveredCoordinates.object === object)
                this.hoveredCoordinates.object = null;
        };
        InteractionState.prototype.pushView = function (identifier) {
            var index = exports.viewCycle.indexOf(identifier);
            this.openViews = new Chain([exports.viewCycle[Math.max(0, index - 1)], exports.viewCycle[index], 'exemplars']);
        };
        InteractionState.prototype.toJSON = function () {
            return JSON.stringify(_.pick(this, ['populationSpace', 'hoveredCoordinates', 'selectedCoordinates', 'openViews']));
        };
        InteractionState.fromJSON = function (data) {
            return new InteractionState(PopulationSpace.fromJSON(data['populationSpace']), SelectionCoordinates.fromJSON(data['hoveredCoordinates']), SelectionCoordinates.fromJSON(data['selectedCoordinates']), Chain.fromJSON(data['openViews']), new BaseConfiguration());
        };
        return InteractionState;
    })();
    exports.InteractionState = InteractionState;
    var EnrichedState = (function (_super) {
        __extends(EnrichedState, _super);
        function EnrichedState(state) {
            _super.call(this, state.populationSpace, state.hoveredCoordinates, state.selectedCoordinates, state.openViews, state.configuration);
            // Well scores, by population activation functions.
            this.wellScs = null;
            this.allExemplars = this.populationSpace.allExemplars();
            var dataSet = this.selectedCoordinates.dataSet;
            var populationDict = this.populationSpace.toDict();
            populationDict['dataSet'] = dataSet;
            var histogramDict = this.populationSpace.toDict();
            histogramDict['dataSet'] = dataSet;
            histogramDict['bins'] = state.configuration.splomInnerSize;
            var focusedWell = this.focused();
            var addObjectInfo = function (dict) {
                dict['dataSet'] = dataSet;
                dict['column'] = focusedWell.well === null ? -1 : focusedWell.well.column;
                dict['row'] = focusedWell.well === null ? -1 : focusedWell.well.row;
                dict['plate'] = focusedWell.plate === null ? -1 : focusedWell.plate;
                dict['probes'] = {};
                state.selectedCoordinates.probeColumns.forEach(function (c, cI) { return dict['probes'][c] = state.selectedCoordinates.probeCoordinates[cI]; });
            };
            var objectInfoDict = this.populationSpace.toDict();
            addObjectInfo(objectInfoDict);
            var objectValuesDict = this.populationSpace.toDict(false);
            addObjectInfo(objectValuesDict);
            this.dataSets = new ProxyValue("dataSetList", {}, []);
            this.dataSetInfo = new ProxyValue("dataSetInfo", { dataSet: dataSet }, new DataSetInfo(), function (ds) { return new DataSetInfo(ds.plateLabels, ds.columnLabels, ds.rowLabels); });
            this.features = new ProxyValue("features", { dataSet: dataSet }, []);
            this.objectInfo = new ProxyValue("objectInfo", objectInfoDict, new NumberFrame(), function (o) { return new NumberFrame(o); });
            this.objectHistograms = new ProxyValue("objectHistograms2D", histogramDict, new HistogramMatrix(), function (m) { return new HistogramMatrix(m); });
            this.wellClusterShares = new ProxyValue("wellClusterShares", populationDict, new WellClusterShares(), function (s) { return new WellClusterShares(s); });
            this.featureHistograms = new ProxyValue("featureHistograms", populationDict, new FeatureHistograms(), function (hs) { return new FeatureHistograms(hs); });
            this.objectFeatureValues = new ProxyValue("objectFeatureValues", objectValuesDict, new NumberFrame(), function (vs) { return new NumberFrame(vs); });
        }
        EnrichedState.prototype.cloneInteractionState = function () {
            return new InteractionState(collection.snapshot(this.populationSpace), collection.snapshot(this.hoveredCoordinates), collection.snapshot(this.selectedCoordinates), collection.snapshot(this.openViews), collection.snapshot(this.configuration));
        };
        /*closestObject(features: string[], coordinates: number[]): number {
            var bestIndex = -1;
    
            var tbl = this.objectInfo.value;
            if(features[0] in tbl.columnIndex && features[1] in tbl.columnIndex && coordinates) {
                var xColI = tbl.columnIndex[features[0]];
                var yColI = tbl.columnIndex[features[1]];
                var x = tbl.normalizedMatrix[xColI];
                var y = tbl.normalizedMatrix[yColI];
    
                var minDist = Number.MAX_VALUE;
                for(var i = 0; i < tbl.rows.length; i++) {
                    var csDist = Vector.distance(coordinates, [x[i], y[i]]);
                    if (csDist < minDist) {
                        minDist = csDist;
                        bestIndex = i;
                    }
                }
            }
    
            return bestIndex >= 0 ? Number(tbl.rows[bestIndex]) : null;
        }*/
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
            var _this = this;
            // Focus probed object if no other object is selected, if available.
            if (this.selectedCoordinates.object === null && this.selectedCoordinates.probeColumns.length > 0 && this.objectInfo && this.objectInfo.converged) {
                var objInfo = this.objectInfo.value;
                var probeCandidates = objInfo.rows.filter(function (obj) {
                    var objNr = Number(obj);
                    return !(objInfo.cell("plate", obj) === _this.selectedCoordinates.plate && objInfo.cell("column", obj) === _this.selectedCoordinates.well.column && objInfo.cell("row", obj) === _this.selectedCoordinates.well.row) && !_this.allExemplars.has(Number(objNr));
                });
                // Found a probe candidate.
                if (probeCandidates.length > 0) {
                    this.selectedCoordinates.object = Number(probeCandidates[0]);
                    // Conform rest of selection (plate, etc.) to newly selected object.
                    this.conformSelectedCoordinates(this);
                }
            }
            return this.selectedCoordinates;
        };
        // Population color, includes focused population highlight.
        EnrichedState.prototype.populationColor = function (population) {
            var focus = this.focused();
            return focus && focus.population === population.identifier ? this.configuration.highlight : population.color;
        };
        // Translucent population color, includes population highlight.
        EnrichedState.prototype.populationColorTranslucent = function (population) {
            var focus = this.focused();
            return focus && focus.population === population.identifier ? this.configuration.highlight : population.colorTrans;
        };
        // Complete, or correct, coordinates, from object level up to plate level.
        /*conformHoveredCoordinates(targetState: InteractionState) {
            var coordinates = targetState.hoveredCoordinates;
            if(coordinates !== null) {
                var wellInfo = this.objectWellInfo(coordinates.object);
                if (wellInfo) {
                    var location = wellInfo.location;
                    coordinates.well = location.coordinates();
                    coordinates.plate = location.plate;
                }
            }
        }*/
        EnrichedState.prototype.conformSelectedCoordinates = function (targetState) {
            var coordinates = targetState.selectedCoordinates;
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
            return this.focused().object !== null && this.allExemplars.has(this.focused().object);
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
        // Get range of all plates.
        EnrichedState.prototype.plates = function () {
            var plateCount = this.dataSetInfo.converged ? this.dataSetInfo.value.plateCount : 0;
            return _.range(plateCount);
        };
        EnrichedState.prototype.wellScores = function () {
            var _this = this;
            if (!this.wellScs) {
                var shares = this.wellClusterShares.value;
                var populations = this.populationSpace.populations.elements.filter(function (p) { return p.identifier in shares.zScores; });
                if (populations.length > 0) {
                    // Initialize empty score arrays.
                    this.wellScs = shares.zScores[populations[0].identifier].map(function (plt) { return plt.map(function (col) { return col.map(function (v) { return 0; }); }); });
                    populations.forEach(function (population) {
                        var pop = population.identifier;
                        var minZ = shares.zScoresMin[pop];
                        var maxZ = shares.zScoresMax[pop];
                        shares.zScores[pop].forEach(function (plt, pltI) { return plt.forEach(function (col, colI) { return col.forEach(function (val, rowI) {
                            var normZ = val <= 0 ? val / Math.abs(minZ) : val / maxZ;
                            _this.wellScs[pltI][colI][rowI] += population.activate(normZ);
                        }); }); });
                    });
                    // Normalize all scores.
                    var flatScores = _.flattenDeep(this.wellScs);
                    var minScore = _.min(flatScores);
                    var maxScore = _.max(flatScores);
                    var delta = maxScore - minScore;
                    this.wellScs = this.wellScs.map(function (plt) { return plt.map(function (col) { return col.map(function (val) { return (val - minScore) / delta; }); }); });
                }
            }
            return this.wellScs || [];
        };
        // Column partition ordering of plates by score (TODO: by population/count vector.)
        EnrichedState.prototype.platePartition = function () {
            // Compute score from total cell count, for now.
            var datasetInfo = this.dataSetInfo.value;
            var wellShares = this.wellClusterShares.value;
            //var objectCount = wellShares.wellIndex[(this.focused().population || Population.POPULATION_TOTAL_NAME).toString()];
            // Plate score by id.
            var plateRange = this.plates();
            //var plateScores = plateRange.map(i => i); // Stick to in-order partition in case of no well shares.
            var platesOrdered = _.clone(plateRange);
            // Shares have been loaded.
            var plateScores;
            var wellScores = this.wellScores();
            if (wellScores) {
                // If target vector is not specified: take maximum object count of each plate.
                //if(_.keys(this.populationScoreVector).length === 0) {
                //    objectCount.forEach((pS, pI) => plateScores[pI] = _.max<number>(pS.map(cS => _.max<number>(cS))));
                //} else {
                //    var popKeys = _.keys(this.populationScoreVector);
                //    var populationMatrices = _.compact(popKeys.map(k => wellShares[k]));
                //    var targetVector = popKeys.map(p => this.populationScoreVector[p]);
                //    plateRange.forEach(plate => plateScores[plate] = this.plateScore(targetVector, populationMatrices));
                //}
                plateScores = plateRange.map(function (plate) { return _.max(_.flatten(wellScores[plate])); });
            }
            else {
                plateScores = plateRange.map(function (i) { return i; });
            }
            // Order plate range by score.
            platesOrdered = platesOrdered.sort(function (p1, p2) { return plateScores[p1] - plateScores[p2]; });
            var datInfo = this.dataSetInfo.value;
            var cfg = this.configuration;
            var colCapacity = Math.ceil(datInfo.plateCount / cfg.miniHeatColumnCount);
            var colMaps = _.range(0, cfg.miniHeatColumnCount).map(function (cI) { return _.compact(_.range(0, colCapacity).map(function (rI) { return platesOrdered[cI * colCapacity + rI]; })).sort(function (p1, p2) { return p1 - p2; }); });
            return colMaps;
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
            // Total cell count population.
            var totalPop = new Population(Population.POPULATION_TOTAL_NAME, "Cell Count", new Chain(), Population.POPULATION_TOTAL_COLOR);
            totalPop.activation = [[-1, 0], [0, 1], [1, 1]];
            this.populations = this.populations.push(totalPop);
            this.conformPopulations();
        }
        PopulationSpace.prototype.conformPopulations = function () {
            this.populations = this.populations.filter(function (p) { return p.exemplars.length > 0 || p.identifier === Population.POPULATION_TOTAL_NAME; }); // Remove any empty populations.
            // If an exemplar has been added to total cell population, then transfer to new population.
            var totalPopulation = this.populations.byId(Population.POPULATION_TOTAL_NAME);
            if (totalPopulation.exemplars.length > 0) {
                this.createPopulation().exemplars = totalPopulation.exemplars.clone();
                totalPopulation.exemplars = new Chain();
            }
            //this.createPopulation();    // Add one empty population at end.
        };
        // Add given object to given population.
        PopulationSpace.prototype.addExemplar = function (object, population) {
            var target = this.populations.byId(population);
            target.exemplars = target.exemplars.push(object);
            this.conformPopulations();
        };
        // Remove given object from any population.
        PopulationSpace.prototype.removeExemplar = function (object) {
            this.populations.forEach(function (p) { return p.exemplars = p.exemplars.pull(object); });
            this.conformPopulations();
        };
        // Create a new population.
        PopulationSpace.prototype.createPopulation = function () {
            // Choose an available nominal color.
            var takenColors = this.populations.map(function (p) { return p.color; });
            var availableColors = new Chain(Color.colorMapNominal8);
            var freeColors = Chain.difference(availableColors, takenColors);
            var color = freeColors.length > 0 ? freeColors.elements[0] : Color.WHITE;
            var population = new Population(null, "Tag", new Chain(), color);
            this.populations = this.populations.push(population);
            return population;
        };
        // Dictionary for communicating population description.
        PopulationSpace.prototype.toDict = function (includeFeatures) {
            if (includeFeatures === void 0) { includeFeatures = true; }
            var exemplars = {};
            this.populations.filter(function (p) { return p.exemplars.length > 0; }).forEach(function (p) { return exemplars[p.identifier] = _.clone(p.exemplars.elements); }); // DO NOT REMOVE!
            return includeFeatures ? { features: this.features.elements, exemplars: exemplars } : { exemplars: exemplars };
        };
        // Whether given object is an exemplar.
        PopulationSpace.prototype.isExemplar = function (object) {
            return this.populations.elements.some(function (p) { return p.exemplars.has(object); });
        };
        // Population activation function as a string.
        PopulationSpace.prototype.activationString = function () {
            return this.populations.elements.map(function (p) { return p.identifier + ":[" + p.activation.map(function (cs) { return cs.join(","); }).join(";") + "]"; }).join(",");
        };
        // Return all exemplars of populations.
        PopulationSpace.prototype.allExemplars = function () {
            return Chain.union(this.populations.elements.map(function (p) { return p.exemplars; }));
        };
        PopulationSpace.fromJSON = function (data) {
            return new PopulationSpace(Chain.fromJSON(data['features']), new Chain(data['populations']['elements'].map(function (p) { return Population.fromJSON(p); })));
        };
        return PopulationSpace;
    })();
    exports.PopulationSpace = PopulationSpace;
    // Population.
    var Population = (function () {
        function Population(identifier, name, exemplars, color, activation) {
            if (identifier === void 0) { identifier = null; }
            if (name === void 0) { name = null; }
            if (exemplars === void 0) { exemplars = new Chain(); }
            if (color === void 0) { color = Color.NONE; }
            if (activation === void 0) { activation = [[-1, 0], [0, 0], [1, 0]]; }
            this.identifier = identifier;
            this.name = name;
            this.exemplars = exemplars;
            this.color = color;
            this.activation = activation;
            if (identifier === null)
                this.identifier = Population.POPULATION_ID_COUNTER++;
            if (name === null)
                this.name = this.identifier.toString();
            this.colorTrans = color.alpha(0.5);
        }
        Population.prototype.toString = function () {
            return this.identifier.toString();
        };
        // Abundance activation function, for input domain [-1, 1].
        Population.prototype.activate = function (abundance) {
            var low = this.activation[0];
            var mid = this.activation[1];
            var high = this.activation[2];
            var result;
            if (abundance <= low[0]) {
                result = low[1];
            }
            else if (abundance <= mid[0]) {
                var segX = abundance - low[0];
                var periodX = (segX / (mid[0] - low[0])) * Math.PI;
                var spanY = mid[1] - low[1];
                result = low[1] + .5 * spanY * (1 - Math.cos(periodX));
            }
            else if (abundance <= high[0]) {
                var segX = abundance - mid[0];
                var periodX = (segX / (high[0] - mid[0])) * Math.PI;
                var spanY = high[1] - mid[1];
                result = mid[1] + .5 * spanY * (1 - Math.cos(periodX));
            }
            else {
                result = high[1];
            }
            return result;
        };
        Population.fromJSON = function (data) {
            return new Population(data['identifier'], data['name'], Chain.fromJSON(data['exemplars']), Color.fromJSON(data['color']), data['activation']);
        };
        Population.POPULATION_TOTAL_NAME = 0; // All cell population (for cell count purposes).
        Population.POPULATION_ALL_NAME = 1; // Population code in case of no known phenotypes.
        Population.POPULATION_TOTAL_COLOR = new Color(150, 150, 150);
        Population.POPULATION_ID_COUNTER = 2; // 0 and 1 are reserved for above population identifiers
        return Population;
    })();
    exports.Population = Population;
    // Field selection coordinates.
    var SelectionCoordinates = (function () {
        function SelectionCoordinates(dataSet, population, // Population id.
            object, // Object (e.g. cell) id.
            well, // Well coordinates (column, row).
            plate, // Plate id.
            probeColumns, probeCoordinates) {
            if (dataSet === void 0) { dataSet = null; }
            if (population === void 0) { population = null; }
            if (object === void 0) { object = null; }
            if (well === void 0) { well = new WellCoordinates(0, 0); }
            if (plate === void 0) { plate = 0; }
            if (probeColumns === void 0) { probeColumns = []; }
            if (probeCoordinates === void 0) { probeCoordinates = []; }
            this.dataSet = dataSet;
            this.population = population;
            this.object = object;
            this.well = well;
            this.plate = plate;
            this.probeColumns = probeColumns;
            this.probeCoordinates = probeCoordinates;
        }
        // Correct for missing values with given coordinates.
        SelectionCoordinates.prototype.otherwise = function (that) {
            return new SelectionCoordinates(this.dataSet === null ? that.dataSet : this.dataSet, this.population === null ? that.population : this.population, this.object === null ? that.object : this.object, this.well === null ? that.well : this.well, this.plate === null ? that.plate : this.plate);
        };
        // Selected population, or total population fallback.
        SelectionCoordinates.prototype.populationOrTotal = function () {
            return this.population || Population.POPULATION_TOTAL_NAME;
        };
        SelectionCoordinates.prototype.switchProbe = function (features, coordinates) {
            this.probeColumns = features;
            this.probeCoordinates = coordinates;
            this.object = null;
        };
        SelectionCoordinates.prototype.switchObject = function (object) {
            this.object = object;
            this.probeColumns = [];
            this.probeCoordinates = [];
        };
        SelectionCoordinates.prototype.switchPlate = function (plate) {
            this.plate = plate;
            this.object = null;
            this.probeColumns = [];
            this.probeCoordinates = [];
        };
        SelectionCoordinates.prototype.switchWell = function (well) {
            this.well = well;
            this.probeColumns = [];
            this.probeCoordinates = [];
        };
        SelectionCoordinates.fromJSON = function (data) {
            return new SelectionCoordinates(data['dataSet'], data['population'], data['object'], WellCoordinates.fromJSON(data['well']), data['plate'], data['probeColumns'], data['probeCoordinates']);
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
            //delete this.wellIndex[0];
            this.maxPlateObjectCount = (this.wellIndex[Population.POPULATION_TOTAL_NAME] || []).map(function (plt) { return _.max(_.flattenDeep(plt)); });
            // Missing wells have zero of everything.
            //this.wellIndex = this.wellIndex.map(p => p.map(plt => plt.map(col => Vector.invalidToZero(col))));
            // Share statistics.
            this.shareStatistics = this.wellIndex.map(function (pShares) { return math.statistics(Vector.invalidToZero(_.flattenDeep(pShares))); });
            // z-scores of all wells, indexed by population, plate, column, and row.
            this.zScores = [];
            this.wellIndex.forEach(function (pS, pI) { return _this.zScores[pI] = pS.map(function (plS) { return plS.map(function (cS) { return cS.map(function (s) { return (s - _this.shareStatistics[pI].mean) / _this.shareStatistics[pI].standardDeviation; }); }); }); });
            this.zScoresMin = [];
            this.zScoresMax = [];
            this.zScores.forEach(function (p, pI) {
                _this.zScoresMin[pI] = _.min(_.flattenDeep(p));
                _this.zScoresMax[pI] = _.max(_.flattenDeep(p));
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
    //export class Clusters {
    //    static CLUSTER_PREAMBLE = "c_";
    //
    //    identifiers: number[];              // Cluster representative identifiers.
    //    identifierIndex: StringMap<number>; // Cluster indices.
    //    members: number[][];                // Cluster member identifiers (of small sub-sample).
    //
    //    constructor(public clusterMap: StringMap<number> = {}) {
    //        this.identifiers = _.uniq(_.values(clusterMap).map(c => Number(c)));
    //
    //        // Check for no cluster case (-1 cluster).
    //        if(this.identifiers.length > 0 && this.identifiers[0] > -1) {
    //            this.identifierIndex = {};
    //            this.identifiers.forEach((id, I) => this.identifierIndex[id] = I);
    //            this.members = [];
    //            this.identifiers.forEach(c => this.members[c] = []);
    //            _.pairs(clusterMap).forEach((p) => this.members[p[1]].push(p[0]));
    //        }
    //    }
    //}
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
            if (column === void 0) { column = null; }
            if (row === void 0) { row = null; }
            this.column = column;
            this.row = row;
        }
        WellCoordinates.fromJSON = function (data) {
            return new WellCoordinates(data['column'], data['row']);
        };
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