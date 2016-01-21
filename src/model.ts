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

export class InteractionState implements AbstractModel {
    constructor(public populationSpace: PopulationSpace = new PopulationSpace(),
                public hoveredCoordinates = new SelectionCoordinates(),
                public selectedCoordinates = new SelectionCoordinates(),
                public configuration: BaseConfiguration = new BaseConfiguration()) {

    }

    removeExemplar(object: number) {
        this.populationSpace.populations.forEach(p => p.exemplars = p.exemplars.pull(object));
        if(this.hoveredCoordinates.object === object) this.hoveredCoordinates.object = null;
    }
}

// The object referred to below are part of a small sample (~1000).
export class EnrichedState extends InteractionState {
    allExemplars: Chain<number>;                        // All exemplars in population space.

    dataSetInfo: ProxyValue<DataSetInfo>;               // Data set specifications.
    features: ProxyValue<DataFrame<number>>;            // Available parameters.
    featureHistograms: ProxyValue<FeatureHistograms>;
    objectInfo: ProxyValue<NumberFrame>;                // All features for prime sample.
    //objectHistograms: ProxyValue<HistogramMatrix>;      // 2D histograms for selected cluster and feature combinations.
    wellClusterShares: ProxyValue<WellClusterShares>;   // Cluster <-> well shares (normalized object count).

    constructor(state: InteractionState) {
        super(state.populationSpace,
              state.hoveredCoordinates,
              state.selectedCoordinates,
              state.configuration);

        this.allExemplars = Chain.union<number>(this.populationSpace.populations.map(p => p.exemplars));
        var focusedWell = this.focused();

        var populationDict = this.populationSpace.toDict();
        var histogramDict = this.populationSpace.toDict();
        histogramDict['bins'] = state.configuration.splomInnerSize;

        var objectInfoDict = this.populationSpace.toDict();
        objectInfoDict['column'] = focusedWell.well === null ? -1 : focusedWell.well.column;
        objectInfoDict['row'] = focusedWell.well === null ? -1 : focusedWell.well.row;
        objectInfoDict['plate'] = focusedWell.plate === null ? - 1 : focusedWell.plate;

        this.dataSetInfo = new ProxyValue(
            "dataSetInfo",
            {},
            new DataSetInfo(), ds => new DataSetInfo(ds.plateLabels, ds.columnLabels, ds.rowLabels)
        );
        this.features = new ProxyValue(
            "features",
            {},
            new DataFrame<number>(), f => new DataFrame(f).transpose().normalize(false, true)
        );
        this.objectInfo = new ProxyValue(
            "objectInfo",
            objectInfoDict,
            new NumberFrame(), o => new NumberFrame(o)
        );
        /*this.objectHistograms = new ProxyValue(
            "objectHistograms2D",
            histogramDict,
            new HistogramMatrix(), m => new HistogramMatrix(m)
        );*/
        this.featureHistograms = new ProxyValue(
            "featureHistograms",
            populationDict,
            new FeatureHistograms(), hs => new FeatureHistograms(hs)
        );
        this.wellClusterShares = new ProxyValue(
            "wellClusterShares",
            populationDict,
            new WellClusterShares(), s => new WellClusterShares(s)
        );
    }

    cloneInteractionState() {
        return new InteractionState(
            collection.snapshot(this.populationSpace),
            collection.snapshot(this.hoveredCoordinates),
            collection.snapshot(this.selectedCoordinates),
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
            var row = tbl.columnVector('well_row');
            var col = tbl.columnVector('well_col');

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
        var location = this.focused().wellLocation();
        var focusedWell = location ? [location.toWellSelection("Selected")] : [];
        return _.union(this.dataSetInfo.value.wellSelections, focusedWell);
    }

    // Focused coordinates.
    focused() {
        //this.makeConsistent(this.hoveredCoordinates);
        return this.hoveredCoordinates.otherwise(this.selectedCoordinates);
    }

    // Complete, or correct, coordinates, from object level up to plate level.
    conformHoveredCoordinates(targetState: InteractionState) {
        if(targetState.hoveredCoordinates !== null) {
            var location = this.allObjectWells().location(targetState.hoveredCoordinates.object);
            if (location) {
                targetState.hoveredCoordinates.well = location.coordinates();
                targetState.hoveredCoordinates.plate = location.plate;
            }
        }
    }

    hoveredObjectIsExemplar() {
        return this.hoveredCoordinates.object !== null && this.allExemplars.has(this.hoveredCoordinates.object);
    }

    /*private allObjInfo: NumberFrame = null;
    allObjectInfo() {
        if(!this.allObjInfo) {
            this.allObjInfo = new NumberFrame(this.wellObjectInfo.value.join(this.objectInfo.value).toDict());  //this.objectInfo.value.join(this.wellObjectInfo.value).toDict());
        }
        return this.allObjInfo;
    }*/

    allObjectWells() {
        return new ObjectWells(this.objectInfo.value);
    }
}

// Populations and their feature space.
export class PopulationSpace {
    constructor(public features: Chain<string> = new Chain<string>(), // Feature axes of space to model in.
                public populations: Chain<Population> = new Chain<Population>()) {
    }

    // Create a new population.
    createPopulation() {
        // Choose an available nominal color.
        var takenColors = new Chain(this.populations.map(p => p.color));
        var availableColors = new Chain(Color.colorMapNominal12);
        var freeColors = Chain.difference(availableColors, takenColors);
        var color = freeColors.length > 0 ? freeColors.elements[0] : Color.BLACK;

        var population = new Population(null, "Tag", new Chain<number>(), color);
        this.populations = this.populations.push(population);

        return population;
    }

    // Dictionary for communicating population description.
    toDict() {
        var exemplars = {};
        this.populations.forEach(p => exemplars[p.identifier] = p.exemplars.elements); // DO NOT REMOVE!
        return { features: this.features.elements, exemplars: exemplars };
    }

    // Whether given object is an exemplar.
    isExemplar(object: number) {
        return this.populations.elements.some(p => p.exemplars.has(object));
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
                public color = Color.NONE) {
        if(identifier === null) this.identifier = Population.POPULATION_ID_COUNTER++;
        if(name === null) this.name = this.identifier.toString();

        this.colorTrans = color.alpha(0.5);
    }

    /*toNumber() {
        return this.identifier;
    }*/

    toString() {
        return this.identifier.toString();
    }
}

// Field selection coordinates.
export class SelectionCoordinates {
    constructor(public population: number = null,    // Population id.
                public object: number = null,        // Object (e.g. cell) id.
                public well: WellCoordinates = null, // Well coordinates (column, row).
                public plate: number = null) {       // Plate id.
    }

    // Correct for missing values with given coordinates.
    otherwise(that: SelectionCoordinates) {
        return new SelectionCoordinates(
            this.population === null ? that.population : this.population,
            this.object === null ? that.object : this.object,
            this.well === null ? that.well : this.well,
            this.plate === null ? that.plate : this.plate);
    }

    // Well location. Returns null if it is invalid.
    private static cachedLocation: WellLocation = null;
    wellLocation() {
        var location: WellLocation = null;

        if(this.well !== null && this.plate !== null) {
            location = new WellLocation(this.well.column, this.well.row, this.plate);

            if (SelectionCoordinates.cachedLocation !== null && SelectionCoordinates.cachedLocation.equals(location)) {
                location = SelectionCoordinates.cachedLocation;
            } else {
                SelectionCoordinates.cachedLocation = location;
            }
        }

        return location;
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
            new WellSelection("Control", [[0, this.plateCount-1]], WellCoordinates.rowWells(this.columnCount, [0]))  // First two columns.
        ];
    }
}

export class ObjectWells {
    private wellLocations: WellLocation[];

    constructor(public frame: DataFrame<any>) {
        if(!frame['wellLocations']) {
            var locations = [];
            frame['wellLocations'] = locations;
            frame.rows.forEach(r => {
                var columnI = frame.columnIndex["well_col"];
                var rowI = frame.columnIndex["well_row"];
                var plateI = frame.columnIndex["plate"];
                var rI = frame.rowIndex[r];

                locations[r] = new WellLocation(
                    frame.matrix[columnI][rI],
                    frame.matrix[rowI][rI],
                    frame.matrix[plateI][rI]
                );
            });
        }
    }

    location(object: number) {
        return this.frame['wellLocations'][object];
    }

    // Coordinates in well image.
    coordinates(object: number) {
        var xI = this.frame.columnIndex["x"];
        var yI = this.frame.columnIndex["y"];
        var rI = this.frame.rowIndex[object];
        return [
            this.frame.matrix[xI][rI],
            this.frame.matrix[yI][rI]
        ];
    }
}

export class WellClusterShares extends NumberFrame {
    wellIndex: number[][][][];  // Index by cluster name (object nr), plate nr, col nr, row nr.

    constructor(dictionary: any = {}) {
        super(dictionary);

        this.wellIndex = [];
        this.columns.forEach(c => {
            var cI = this.columnIndex[c];
            var col = this.matrix[cI];

            this.rows.forEach(r => {
                var val = col[this.rowIndex[r]];
                var localI = r.split('_').map(i => Number(i));
                this.inject(val, this.wellIndex, _.flatten<any>([[c], localI]));
            });
        });
    }

    private inject(value: number, subIndex: any, indices: any[]) {
        var nextIndex = _.head(indices);
        var remainder = _.tail(indices);

        if(indices.length == 1) {
            subIndex[nextIndex] = value;
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
        _.keys(dict).map(k => this.histograms[k] = new DataFrame(dict[k]).transpose().normalize(false, true));
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
                public plate: number) {
        super(column, row);
    }

    toString() {
        return this.column.toString() + "." + this.row.toString() + "." + this.plate.toString();
    }

    /*toJSON() {
        return {
            column: this.column,
            row: this.row,
            plate: this.plate
        };
    }*/

    equals(that: WellLocation) {
        return this.column === that.column && this.row === that.row && this.plate === that.plate;
    }

    // This (singular) location as a well selection.
    toWellSelection(id: string) {
        return new WellSelection(id, [[this.plate, this.plate]], [new WellCoordinates(this.column, this.row)]);
    }

    /*// Location for the given plate.
    forPlate(plate: number) {
        return new WellLocation(this.column, this.row, plate);
    }

    // Location for the given column and row coordinates.
    forCoordinates(column: number, row: number) {
        return new WellLocation(column, row, this.plate);
    }*/

    // Well column and row coordinates. Excludes plate coordinate.
    coordinates() {
        return new WellCoordinates(this.column, this.row);
    }

    static zfill(num: number, len: number) {
        return (Array(len).join("0") + num).slice(-len);
    }

    static plateTags = _.range(1, 69).map(i => "HT" + WellLocation.zfill(i, 2));
    static columnTags = 'ABCDEFGHIJKLMNOP'.split('');
    static rowTags = _.range(4, 25).map(i => WellLocation.zfill(i, 3));

    private imageURL() {
        var plateTag = WellLocation.plateTags[this.plate];
        var wellTag = plateTag + WellLocation.columnTags[this.column] + WellLocation.rowTags[this.row];
        return "dataset/images/" + plateTag + "/" + wellTag + "/" + wellTag + "_seg.jpeg";
    }

    private imgArrived = false;
    image() {
        if(!this.img) {
            this.img = new Image();
            this.img.onload = () => this.imgArrived = true;
            this.img.src = this.imageURL();
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
    matrices: StringMap<StringMap<number[][]>>[];   // Histogram per cluster, per feature pair.
    constructor(matrixMap: {} = {}) {
        this.matrices = [];

        _.keys(matrixMap).forEach(kC => {
            var cNr = Number(kC);
            var ftrMatrices = matrixMap[kC];

            console.log("Cluster key: " + kC);

            if(!(cNr in this.matrices)) {
                this.matrices[cNr] = {};
            }

            _.keys(ftrMatrices).forEach(kF => {
                var ftrs = kF.split("..");
                if(!(ftrs[0] in this.matrices[cNr])) {
                    this.matrices[cNr][ftrs[0]] = {};
                }
                this.matrices[cNr][ftrs[0]][ftrs[1]] = ftrMatrices[kF];
            });
        });

        console.log("Received new histogram matrix:");
        console.log(matrixMap);
    }

    // Get matrix for given population id and feature pair.
    matrix(cluster: number, feature1: string, feature2: string) {
        var clusterMatrices = this.matrices[cluster] || {};

        var matrix: number[][] = null;
        if(feature1 in clusterMatrices) {
            matrix = clusterMatrices[feature1][feature2] || null;
        } else if (feature2 in clusterMatrices) {
            matrix = clusterMatrices[feature2][feature1] || null;
        }

        return matrix;
    }

    // Matrices by feature pair.
    matricesByFeaturePair(feature1: string, feature2: string) {
        var result = {};

        _.keys(this.matrices).forEach(kC => {
            var cNr = Number(kC);
            var mat = this.matrix(cNr, feature1, feature2);
            if(mat) result[cNr] = mat;
        });

        return result;
    }
}