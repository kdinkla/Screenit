/// <reference path="references.d.ts"/>

import bacon = require('bacon');

import math = require('./core/math');
import Vector = math.Vector;
import Matrix = math.Matrix;

import style = require('./core/graphics/style');
import Color = style.Color;

import collection = require('./core/collection');
import NumberMap = collection.NumberMap;
import StringMap = collection.StringMap;
import Chain = collection.Chain;

import dataframe = require('./core/dataframe');
import DataFrame = dataframe.DataFrame;
import NumberFrame = dataframe.NumberFrame;

import data = require('./core/dataprovider');
import ProxyValue = data.ProxyValue;

import model = require('./core/graphics/model');
import AbstractModel = model.Model;

import controller = require('./core/graphics/controller');

import config = require('./configuration');
import BaseConfiguration = config.BaseConfiguration;

export var viewCycle = ['plates', 'plate', 'well', 'features', 'splom', 'exemplars'];

export class InteractionState implements AbstractModel {
    constructor(public populationSpace: PopulationSpace = new PopulationSpace(),
                public hoveredCoordinates = new SelectionCoordinates(),
                public selectedCoordinates = new SelectionCoordinates(),
                public openViews: Chain<string> = new Chain(['plates', 'exemplars']),
                public configuration: BaseConfiguration = new BaseConfiguration()) {
    }

    removeExemplar(object: number) {
        // Remove given exemplar from any population (should be a single population).
        this.populationSpace.populations.forEach(p => p.exemplars = p.exemplars.pull(object));
        if(this.hoveredCoordinates.object === object) this.hoveredCoordinates.object = null;
    }

    pushView(identifier: string) {
        var index = viewCycle.indexOf(identifier);
        this.openViews = new Chain([viewCycle[Math.max(0, index - 1)], viewCycle[index], 'exemplars']);
    }
}

// The object referred to below are part of a small sample (~1000).
export class EnrichedState extends InteractionState {
    allExemplars: Chain<number>;                        // All exemplars in population space.

    dataSetInfo: ProxyValue<DataSetInfo>;               // Data set specifications.
    features: ProxyValue<string[]>;                     // Available parameters.
    objectInfo: ProxyValue<NumberFrame>;                // All features for prime sample.
    objectHistograms: ProxyValue<HistogramMatrix>;      // 2D histograms for selected cluster and feature combinations.
    wellClusterShares: ProxyValue<WellClusterShares>;   // Cluster <-> well shares (normalized object count).
    featureHistograms: ProxyValue<FeatureHistograms>;
    objectFeatureValues: ProxyValue<NumberFrame>;       // All features of active objects.

    constructor(state: InteractionState) {
        super(state.populationSpace,
            state.hoveredCoordinates,
            state.selectedCoordinates,
            state.openViews,
            state.configuration);

        this.allExemplars = Chain.union<number>(this.populationSpace.populations.elements.map(p => p.exemplars));
        var focusedWell = this.focused();
        var addWellInfo = (dict) => {
            dict['column'] = focusedWell.well === null ? -1 : focusedWell.well.column;
            dict['row'] = focusedWell.well === null ? -1 : focusedWell.well.row;
            dict['plate'] = focusedWell.plate === null ? - 1 : focusedWell.plate;
        };

        var populationDict = this.populationSpace.toDict();
        var histogramDict = this.populationSpace.toDict();
        histogramDict['bins'] = state.configuration.splomInnerSize;

        var objectInfoDict = this.populationSpace.toDict();
        addWellInfo(objectInfoDict);

        var objectValuesDict = this.populationSpace.toDict(false);
        addWellInfo(objectValuesDict);

        this.dataSetInfo = new ProxyValue(
            "dataSetInfo",
            {},
            new DataSetInfo(), ds => new DataSetInfo(ds.plateLabels, ds.columnLabels, ds.rowLabels)
        );
        this.features = new ProxyValue(
            "features",
            {},
            []
        );
        this.objectInfo = new ProxyValue(
            "objectInfo",
            objectInfoDict,
            new NumberFrame(), o => new NumberFrame(o)
        );
        this.objectHistograms = new ProxyValue(
            "objectHistograms2D",
            histogramDict,
            new HistogramMatrix(), m => new HistogramMatrix(m)
        );
        this.wellClusterShares = new ProxyValue(
            "wellClusterShares",
            populationDict,
            new WellClusterShares(), s => new WellClusterShares(s)
        );
        this.featureHistograms = new ProxyValue(
            "featureHistograms",
            populationDict,
            new FeatureHistograms(), hs => new FeatureHistograms(hs)
        );
        this.objectFeatureValues = new ProxyValue(
            "objectFeatureValues",
            objectValuesDict,
            new NumberFrame(), vs => new NumberFrame(vs)
        );
    }

    cloneInteractionState() {
        return new InteractionState(
            collection.snapshot(this.populationSpace),
            collection.snapshot(this.hoveredCoordinates),
            collection.snapshot(this.selectedCoordinates),
            collection.snapshot(this.openViews),
            collection.snapshot(this.configuration)
        );
    }

    closestObject(features: string[], coordinates: number[]): number {
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
    }

    closestWellObject(coordinates: number[]): number {
        var bestIndex = -1;

        var tbl = this.objectInfo.value;
        if(tbl && coordinates) {
            var x = tbl.columnVector('x');
            var y = tbl.columnVector('y');
            var plate = tbl.columnVector('plate');
            var row = tbl.columnVector('row');
            var col = tbl.columnVector('column');

            var minDist = Number.MAX_VALUE;
            var focusedWell = this.focused();
            for(var i = 0; i < tbl.rows.length; i++) {
                if( plate[i] === focusedWell.plate &&
                    focusedWell.well && row[i] === focusedWell.well.row &&
                    col[i] === focusedWell.well.column) {
                    var csDist = Vector.distance(coordinates, [x[i], y[i]]);
                    if (csDist < minDist) {
                        minDist = csDist;
                        bestIndex = i;
                    }
                }
            }
        }

        return bestIndex >= 0 ? Number(tbl.rows[bestIndex]) : null;
    }

    // Well selections, including single focused well.
    allWellSelections() {
        var location = this.selectionWell(this.focused());
        var focusedWell = location ? [location.toWellSelection("Selected")] : [];
        return _.union(this.dataSetInfo.value.wellSelections, focusedWell);
    }

    // Focused coordinates.
    focused() {
        return this.selectedCoordinates;    //this.hoveredCoordinates.otherwise(this.selectedCoordinates);
    }

    // Population color, includes focused population highlight.
    populationColor(population: Population) {
        return this.focused().population === population.identifier ? this.configuration.highlight : population.color;
    }

    // Translucent population color, includes population highlight.
    populationColorTranslucent(population: Population) {
        return this.focused().population === population.identifier ? this.configuration.highlight : population.colorTrans;
    }

    // Complete, or correct, coordinates, from object level up to plate level.
    conformHoveredCoordinates(targetState: InteractionState) {
        var coordinates = targetState.hoveredCoordinates;
        if(coordinates !== null) {
            var wellInfo = this.objectWellInfo(coordinates.object);
            if (wellInfo) {
                var location = wellInfo.location;
                coordinates.well = location.coordinates();
                coordinates.plate = location.plate;
            }
        }
    }

    conformSelectedCoordinates(targetState: InteractionState) {
        var coordinates = targetState.selectedCoordinates;
        if(coordinates !== null) {
            var wellInfo = this.objectWellInfo(coordinates.object);
            if (wellInfo) {
                var location = wellInfo.location;
                coordinates.well = location.coordinates();
                coordinates.plate = location.plate;
            }
        }
    }

    hoveredObjectIsExemplar() {
        return this.focused().object !== null && this.allExemplars.has(this.focused().object);
    }

    selectionWell(selection: SelectionCoordinates) {
        return this.wellLocation(selection.well.column, selection.well.row, selection.plate);
    }

    objectWellInfo(object: number) {
        var result: {location: WellLocation; coordinates: number[]} = null;

        var table = this.objectInfo.value;
        if(object in table.rowIndex) {
            result = {
                location: this.wellLocation(table.cell("column", object), table.cell("row", object), table.cell("plate", object)),
                coordinates: [table.cell("x", object), table.cell("y", object)]
            }
        }

        return result;
    }

    wellLocation(column: number, row: number, plate: number) {
        var objectTable = this.objectInfo.value;

        var locationMap: StringMap<WellLocation> = objectTable['wellLocations'];
        if(!locationMap) {
            locationMap = {};

            var imageURLs = this.availableImageTypes();

            var plateVec = objectTable.columnVector('plate');
            var columnVec = objectTable.columnVector('column');
            var rowVec = objectTable.columnVector('row');

            if(plateVec && columnVec && rowVec) {
                for (var i = 0; i < plateVec.length; i++) {
                    var plateObj = plateVec[i];
                    var columnObj = columnVec[i];
                    var rowObj = rowVec[i];

                    var imgMap:StringMap<string> = {};
                    _.pairs(imageURLs).forEach((p, cnI) => imgMap[p[0]] = <any>objectTable.columnVector(p[1])[i]);
                    locationMap[columnObj + "_" + rowObj + "_" + plateObj] = new WellLocation(columnObj, rowObj, plateObj, imgMap);
                }
                objectTable['wellLocations'] = locationMap;
            }
        }

        return locationMap[column + "_" + row + "_" + plate] || new WellLocation(column, row, plate);
    }

    availableImageTypes() {
        var result: StringMap<string> = {};

        var columns = this.objectInfo.value.columns.filter(c => _.startsWith(c, "img_"));
        columns.forEach(c => result[c.slice(4)] = c);

        return result;
    }

    // Get range of all plates.
    plates() {
        var plateCount = this.dataSetInfo.converged ? this.dataSetInfo.value.plateCount : 0;
        return _.range(plateCount);
    }

    // Well scores, by population activation functions.
    private wellScs: number[][][] = null;
    wellScores(): number[][][] {
        if(!this.wellScs) {
            var shares = this.wellClusterShares.value;

            var populations = this.populationSpace.populations.elements.filter(p => p.identifier in shares.zScores);
            if(populations.length > 0) {
                this.wellScs = shares.zScores[populations[0].identifier].map(plt => plt.map(col => col.map(v => 0)));

                populations.forEach(population => {
                    var pop = population.identifier;
                    var minZ = shares.zScoresMin[pop];
                    var maxZ = shares.zScoresMax[pop];

                    shares.zScores[pop].forEach((plt, pltI) => plt.forEach((col, colI) => col.forEach((val, rowI) => {
                        var normZ = val <= 0 ? val / Math.abs(minZ) : val / maxZ;
                        this.wellScs[pltI][colI][rowI] += population.activate(normZ);
                    })));
                });

                // Normalize all scores.
                var flatScores = _.flattenDeep<number>(this.wellScs);
                var minScore = _.min(flatScores);
                var maxScore = _.max(flatScores);

                var delta = maxScore - minScore;
                this.wellScs = this.wellScs.map(plt => plt.map(col => col.map(val => (val - minScore) / delta)));
            }
        }

        return this.wellScs || [];
    }

    // Column partition ordering of plates by score (TODO: by population/count vector.)
    platePartition() {
        // Compute score from total cell count, for now.
        var datasetInfo = this.dataSetInfo.value;
        var wellShares = this.wellClusterShares.value;
        //var objectCount = wellShares.wellIndex[(this.focused().population || Population.POPULATION_TOTAL_NAME).toString()];

        // Plate score by id.
        var plateRange = this.plates();
        //var plateScores = plateRange.map(i => i); // Stick to in-order partition in case of no well shares.
        var platesOrdered = _.clone(plateRange);

        // Shares have been loaded.
        var plateScores: number[];
        var wellScores = this.wellScores();
        if(wellScores) {
            // If target vector is not specified: take maximum object count of each plate.
            //if(_.keys(this.populationScoreVector).length === 0) {
            //    objectCount.forEach((pS, pI) => plateScores[pI] = _.max<number>(pS.map(cS => _.max<number>(cS))));
            //} else {
            //    var popKeys = _.keys(this.populationScoreVector);
            //    var populationMatrices = _.compact(popKeys.map(k => wellShares[k]));
            //    var targetVector = popKeys.map(p => this.populationScoreVector[p]);

            //    plateRange.forEach(plate => plateScores[plate] = this.plateScore(targetVector, populationMatrices));
            //}

            plateScores = plateRange.map(plate => _.max(_.flatten(wellScores[plate])));
        } else {
            plateScores = plateRange.map(i => i);
        }

        // Order plate range by score.
        platesOrdered = platesOrdered.sort((p1, p2) => plateScores[p1] - plateScores[p2]);

        var datInfo = this.dataSetInfo.value;
        var cfg = this.configuration;
        var colCapacity = Math.ceil(datInfo.plateCount / cfg.miniHeatColumnCount);
        var colMaps = _.range(0, cfg.miniHeatColumnCount).map(cI =>
            _.compact(_.range(0, colCapacity).map(rI => platesOrdered[cI * colCapacity + rI])).sort((p1, p2) => p1 - p2));

        return colMaps;
    }

    /*private plateScore(targetVector: number[], populationMatrices: number[][][], colCount: number, rowCount: number) {
        var result: number = 0;

        // Compute cosine similarity for all wells.
        var wellCompositions: number[] = [];

        populationMatrices.forEach((p, pI) =>
            p.forEach((c, cI) =>
                c.forEach((r, rI) => {

                })
            )
        );

        return result;
    }*/
}

// Populations and their feature space.
export class PopulationSpace {
    constructor(public features: Chain<string> = new Chain<string>(), // Feature axes of space to model in.
                public populations: Chain<Population> = new Chain<Population>()) {
        this.conformPopulations();
    }

    private conformPopulations() {
        this.populations = this.populations.filter(p => p.exemplars.length > 0);   // Remove any empty populations.
        this.createPopulation();    // Add one empty population at end.
    }

    // Add given object to given population.
    addExemplar(object: number, population: number) {
        var target = this.populations.byId(population);
        target.exemplars = target.exemplars.push(object);
        this.conformPopulations();
    }

    // Create a new population.
    createPopulation() {
        // Choose an available nominal color.
        var takenColors = this.populations.map(p => p.color);
        var availableColors = new Chain(Color.colorMapNominal8);
        var freeColors = Chain.difference(availableColors, takenColors);
        var color = freeColors.length > 0 ? freeColors.elements[0] : Color.BLACK;

        var population = new Population(null, "Tag", new Chain<number>(), color);
        this.populations = this.populations.push(population);

        return population;
    }

    // Dictionary for communicating population description.
    toDict(includeFeatures = true) {
        var exemplars = {};
        this.populations.filter(p => p.exemplars.length > 0).forEach(p => exemplars[p.identifier] = _.clone(p.exemplars.elements)); // DO NOT REMOVE!
        return includeFeatures ?
            { features: this.features.elements, exemplars: exemplars } :
            { exemplars: exemplars };
    }

    // Whether given object is an exemplar.
    isExemplar(object: number) {
        return this.populations.elements.some(p => p.exemplars.has(object));
    }

    // Population activation function as a string.
    activationString() {
        return this.populations.elements.map(p =>
            p.identifier + ":[" +
                p.activation.map(cs => cs.join(",")).join(";") +
            "]").join(",");
    }
}

// Population.
export class Population {
    public static POPULATION_TOTAL_NAME = 'objects';

    private static POPULATION_ID_COUNTER = 1;

    colorTrans: Color;

    constructor(public identifier: number = null,
                public name: string = null,
                public exemplars = new Chain<number>(),
                public color = Color.NONE,
                public activation: number[][] = [[-1, 0], [0, 0], [1, 1]]) {
        if(identifier === null) this.identifier = Population.POPULATION_ID_COUNTER++;
        if(name === null) this.name = this.identifier.toString();

        this.colorTrans = color.alpha(0.333);
    }

    toString() {
        return this.identifier.toString();
    }

    // Abundance activation function, for input domain [-1, 1].
    activate(abundance: number) {
        var low = this.activation[0];
        var mid = this.activation[1];
        var high = this.activation[2];

        var result: number;

        if(abundance <= low[0]) {
            result = low[1];
        } else if(abundance <= mid[0]) {
            var segX = abundance - low[0];
            var periodX = (segX / (mid[0] - low[0])) * Math.PI;
            var spanY = mid[1] - low[1];
            result = low[1] + .5 * spanY * (1 - Math.cos(periodX));
        } else if(abundance <= high[0]) {
            var segX = abundance - mid[0];
            var periodX = (segX / (high[0] - mid[0])) * Math.PI;
            var spanY = high[1] - mid[1];
            result = mid[1] + .5 * spanY * (1 - Math.cos(periodX));
        } else {
            result = high[1];
        }

        return result;
    }
}

// Field selection coordinates.
export class SelectionCoordinates {
    constructor(public population: number = null,                           // Population id.
                public object: number = null,                               // Object (e.g. cell) id.
                public well: WellCoordinates = new WellCoordinates(0, 0),   // Well coordinates (column, row).
                public plate: number = 0) {                                 // Plate id.
    }

    // Correct for missing values with given coordinates.
    otherwise(that: SelectionCoordinates) {
        return new SelectionCoordinates(
            this.population === null ? that.population : this.population,
            this.object === null ? that.object : this.object,
            this.well === null ? that.well : this.well,
            this.plate === null ? that.plate : this.plate);
    }

    // Selected population, or total population fallback.
    populationOrTotal(): any {
        return this.population || Population.POPULATION_TOTAL_NAME;
    }
}

export class DataSetInfo {
    plateCount: number;
    columnCount: number;
    rowCount: number;

    wellSelections: WellSelection[];

    constructor(public plateLabels: string[] = [],
                public columnLabels: string[] = [],
                public rowLabels: string[] = []) {
        this.plateCount = plateLabels.length;
        this.columnCount = columnLabels.length;
        this.rowCount = rowLabels.length;

        // Well selection placeholder; complete selection and control wells, for now.
        this.wellSelections = [
            //new WellSelection("All", [[0, this.plateCount-1]], WellCoordinates.allWells(this.columnCount, this.rowCount)),
            //new WellSelection("Control", [[0, this.plateCount-1]], WellCoordinates.rowWells(this.columnCount, [0]))  // First two columns.
        ];
    }
}

export class WellClusterShares extends NumberFrame {
    wellIndex: number[][][][];  // Index by cluster name (object nr), plate nr, col nr, row nr.
    maxObjectCount: number;     // Maximum number of objects for all wells.
    maxPlateObjectCount: number[];  // Maximum number of objects per plate.

    shareStatistics: { mean: number; standardDeviation: number }[];   // Share mean and standard deviation per population.
    zScores: number[][][][];    // z-scores of all wells, indexed by population, plate, column, and row.
    zScoresMin: number[];       // z-score minimum across all wells, indexed by population.
    zScoresMax: number[];       // z-score maximum across all wells, indexed by population.

    constructor(dictionary: any = {}) {
        super(dictionary);

        this.wellIndex = [];
        this.maxObjectCount = 0;
        this.columns.forEach(c => {
            var cI = this.columnIndex[c];
            var col = this.matrix[cI];

            this.rows.forEach(r => {
                var val = col[this.rowIndex[r]];
                var localI = r.split('_').map(i => Number(i));
                this.inject(val, this.wellIndex, _.flatten<any>([[c], localI]));
            });
        });

        this.maxPlateObjectCount = (this.wellIndex[Population.POPULATION_TOTAL_NAME] || [])
                                    .map(plt => _.max(<number[]>_.flattenDeep<number>(plt)));

        // Missing wells have zero of everything.
        //this.wellIndex = this.wellIndex.map(p => p.map(plt => plt.map(col => Vector.invalidToZero(col))));

        // Share statistics.
        this.shareStatistics = this.wellIndex.map(pShares => math.statistics(
            Vector.invalidToZero(<number[]>_.flattenDeep<number>(pShares))));

        // z-scores of all wells, indexed by population, plate, column, and row.
        this.zScores = this.wellIndex.map((pS, pI) => pS.map(plS => plS.map(cS =>
                                        cS.map(s => (s - this.shareStatistics[pI].mean) /
                                                    this.shareStatistics[pI].standardDeviation))));
        this.zScoresMin = this.zScores.map(p => _.min(<number[]>_.flattenDeep<number>(p)));
        this.zScoresMax = this.zScores.map(p => _.max(<number[]>_.flattenDeep<number>(p)));
    }

    private inject(value: number, subIndex: any, indices: any[]) {
        var nextIndex = _.head(indices);
        var remainder = _.tail(indices);

        if(indices.length == 1) {
            subIndex[nextIndex] = value;
            this.maxObjectCount = Math.max(this.maxObjectCount, value);
        } else {
            var targetIndex = subIndex[nextIndex];
            if(!targetIndex) {
                targetIndex = [];
                subIndex[nextIndex] = targetIndex;
            }
            this.inject(value, targetIndex, remainder);
        }
    }
}

export class Clusters {
    static CLUSTER_PREAMBLE = "c_";

    identifiers: number[];              // Cluster representative identifiers.
    identifierIndex: StringMap<number>; // Cluster indices.
    members: number[][];                // Cluster member identifiers (of small sub-sample).

    constructor(public clusterMap: StringMap<number> = {}) {
        this.identifiers = _.uniq(_.values(clusterMap).map(c => Number(c)));

        // Check for no cluster case (-1 cluster).
        if(this.identifiers.length > 0 && this.identifiers[0] > -1) {
            this.identifierIndex = {};
            this.identifiers.forEach((id, I) => this.identifierIndex[id] = I);
            this.members = [];
            this.identifiers.forEach(c => this.members[c] = []);
            _.pairs(clusterMap).forEach((p) => this.members[p[1]].push(p[0]));
        }
    }
}

export class FeatureHistograms {
    histograms: StringMap<DataFrame<number>>;

    constructor(dict: {} = {}) {
        this.histograms = {};
        _.keys(dict).map(k => this.histograms[k] = new DataFrame(dict[k]).normalize()); //.transpose().normalize(false, true));
    }
}

// Wells by column and row coordinates.
export class WellCoordinates {
    constructor(public column: number, public row: number) {}

    // Generate the coordinates of all wells on a plate.
    static allWells(columnCount: number, rowCount: number) {
        return _.flatten(_.range(0, columnCount).map(c => _.range(0, rowCount).map(r => new WellCoordinates(c, r))));
    }

    // Generate the coordinates of all wells for the given row indices.
    static rowWells(columnCount: number, rows: number[]) {
        return _.flatten(_.range(0, columnCount).map(c => rows.map(r => new WellCoordinates(c, r))));
    }

    // Generate the coordinates of all wells for the given column indices.
    static columnWells(columns: number[], rowCount) {
        return _.flatten(columns.map(c => _.range(0, rowCount).map(r => new WellCoordinates(c, r))));
    }
}

// Well by plate, column, and row coordinates.
export class WellLocation extends WellCoordinates {
    private img: any;

    constructor(column: number,
                row: number,
                public plate: number,
                public imageURLs: StringMap<string> = {}) {
        super(column, row);
    }

    toString() {
        return this.column.toString() + "." + this.row.toString() + "." + this.plate.toString();
    }

    equals(that: WellLocation) {
        return this.column === that.column && this.row === that.row && this.plate === that.plate;
    }

    // This (singular) location as a well selection.
    toWellSelection(id: string) {
        return new WellSelection(id, [[this.plate, this.plate]], [new WellCoordinates(this.column, this.row)]);
    }

    // Well column and row coordinates. Excludes plate coordinate.
    coordinates() {
        return new WellCoordinates(this.column, this.row);
    }

    private imgArrived: string = null;
    image(type: string = null) {
        // Default to first image type.
        if(type === null) type = _.keys(this.imageURLs)[0];

        if(this.imgArrived !== type && this.imageURLs[type]) {
            this.img = new Image();
            this.img.onload = () => this.imgArrived = type;
            this.img.src = this.imageURLs[type];
        }

        return this.imgArrived ? this.img : null;
    }
}

export class WellSelection {
    constructor(public id: string,
                public plates: number[][],  // Plate ranges, or individual indices as singleton arrays.
                public wells: WellCoordinates[]
    ) {}
}

export class HistogramMatrix {
    matrices: StringMap<StringMap<number[][][]>>;   // Histogram per feature pair, per cluster
    constructor(matrixMap: {} = {}) {
        this.matrices = <any>matrixMap;
    }

    matricesFor(xFeature: string, yFeature: string) {
        return (this.matrices[xFeature] || {})[yFeature] || null;
    }
}