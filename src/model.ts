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

export var viewCycle = ['datasets', 'plates', 'plate', 'well', 'features', 'splom', 'exemplars'];

export class InteractionState implements AbstractModel {
    constructor(public populationSpace: PopulationSpace = null,
                public hoveredCoordinates: SelectionCoordinates = null,
                public selectedCoordinates: SelectionCoordinates = null,
                public openViews: Chain<string> = null,
                public configuration: BaseConfiguration = null) {
        if(populationSpace == null) this.switchToDataSet('CellMorph');  // Default to Cell Morph data set.
    }

    switchToDataSet(dataSet: string) {
        this.populationSpace = new PopulationSpace();
        this.hoveredCoordinates = new SelectionCoordinates();
        this.selectedCoordinates = new SelectionCoordinates();
        this.openViews = new Chain(['plates', 'exemplars']);
        this.configuration = new BaseConfiguration();
        this.selectedCoordinates.dataSet = dataSet;

    }

    removeExemplar(object: number) {
        // Remove given exemplar from any population (should be a single population).
        this.populationSpace.removeExemplar(object);
        if(this.hoveredCoordinates.object === object) this.hoveredCoordinates.object = null;
    }

    pushView(identifier: string) {
        var index = viewCycle.indexOf(identifier);
        this.openViews = new Chain([viewCycle[Math.max(0, index - 1)], viewCycle[index], 'exemplars']);
    }

    toggleAnnotation(category: string, tag: string) {
        var annotations = this.selectedCoordinates.wellAnnotations;
        // Specific category is targeted; toggle its tag.
        if(category) {
            annotations[category] = _.contains(annotations[category], tag) ?
                _.difference(annotations[category], [tag]) :
                _.union(annotations[category], [tag]);
        }
        // Otherwise, remove from all categories.
        else {
            _.keys(annotations).forEach(k => annotations[k] = annotations[k].filter(annTag => annTag !== tag));
        }
    }

    toJSON() {
        return JSON.stringify(_.pick(this, ['populationSpace', 'hoveredCoordinates', 'selectedCoordinates', 'openViews']));
    }

    static fromJSON(data: {}) {
        return new InteractionState(
            PopulationSpace.fromJSON(data['populationSpace']),
            SelectionCoordinates.fromJSON(data['hoveredCoordinates']),
            SelectionCoordinates.fromJSON(data['selectedCoordinates']),
            Chain.fromJSON<string>(data['openViews']),
            new BaseConfiguration()
        );
    }
}

export class EnrichedState extends InteractionState {
    allExemplars: Chain<number>;                        // All exemplars in population space.

    dataSets: ProxyValue<string[]>;                     // Available data sets.
    dataSetInfo: ProxyValue<DataSetInfo>;               // Data set specifications.
    wellAnnotations: ProxyValue<WellAnnotations>;       // Well annotation tags, listed by category.
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

        this.allExemplars = this.populationSpace.allExemplars();

        var dataSet = this.selectedCoordinates.dataSet;
        var populationDict = this.populationSpace.toDict();
        populationDict['dataSet'] = dataSet;
        var histogramDict = this.populationSpace.toDict();
        histogramDict['dataSet'] = dataSet;
        histogramDict['bins'] = state.configuration.splomInnerSize;

        var focusedWell = this.focused();
        var addObjectInfo = (dict) => {
            dict['dataSet'] = dataSet;
            dict['column'] = focusedWell.well === null ? -1 : focusedWell.well.column;
            dict['row'] = focusedWell.well === null ? -1 : focusedWell.well.row;
            dict['plate'] = focusedWell.plate === null ? - 1 : focusedWell.plate;
            dict['probes'] = {};
            state.selectedCoordinates.probeColumns.forEach((c, cI) =>
                dict['probes'][c] = state.selectedCoordinates.probeCoordinates[cI]);
        };

        var objectInfoDict = this.populationSpace.toDict();
        addObjectInfo(objectInfoDict);
        var objectValuesDict = this.populationSpace.toDict(false);
        addObjectInfo(objectValuesDict);

        this.dataSets = new ProxyValue(
            "dataSetList",
            {},
            []
        );
        this.dataSetInfo = new ProxyValue(
            "dataSetInfo",
            {dataSet: dataSet},
            new DataSetInfo(), ds => new DataSetInfo(ds.plateLabels, ds.columnLabels, ds.rowLabels)
        );
        this.wellAnnotations = new ProxyValue(
            "wellAnnotations",
            {dataSet: dataSet},
            new WellAnnotations(), wa => new WellAnnotations(wa)
        );
        this.features = new ProxyValue(
            "features",
            {dataSet: dataSet},
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
            histogramDict,
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

    // Focused coordinates.
    focused() {
        // Focus probed object if no other object is selected, if available.
        if(this.selectedCoordinates.object === null &&
            this.selectedCoordinates.probeColumns.length > 0 &&
            this.objectInfo &&
            this.objectInfo.converged) {
            var objInfo = this.objectInfo.value;

            var probeCandidates = objInfo.rows.filter(obj => {
                var objNr = Number(obj);
                return !(objInfo.cell("plate", obj) === this.selectedCoordinates.plate &&
                         objInfo.cell("column", obj) === this.selectedCoordinates.well.column &&
                        objInfo.cell("row", obj) === this.selectedCoordinates.well.row) &&
                        !this.allExemplars.has(Number(objNr));
            });

            // Found a probe candidate.
            if(probeCandidates.length > 0) {
                this.selectedCoordinates.object = Number(probeCandidates[0]);

                // Conform rest of selection (plate, etc.) to newly selected object.
                this.conformSelectedCoordinates(this);
            }
        }

        return this.selectedCoordinates;
    }

    // Population color, includes focused population highlight.
    populationColor(population: Population) {
        var focus = this.focused();
        return !population || (focus && focus.population === population.identifier) ?
            this.configuration.highlight :
            population.color;
    }

    // Translucent population color, includes population highlight.
    populationColorTranslucent(population: Population) {
        var focus = this.focused();
        return !population || (focus && focus.population === population.identifier) ?
            this.configuration.highlight :
            population.colorTrans;
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
                // Initialize empty score arrays.
                this.wellScs = shares.zScores[populations[0].identifier].map(plt => plt.map(col => col.map(v => 0)));

                populations.forEach(population => {
                    var pop = population.identifier;

                    shares.zScores[pop].forEach((plt, pltI) => plt.forEach((col, colI) => col.forEach((val, rowI) => {
                        var normZ = val / this.configuration.activationZScoreRange;
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

    plateAnnotationPartition(): { tags: string[]; plates: number[] }[] {
        // Plate score by id.
        var plateRange = this.plates();
        //var plateScores = plateRange.map(i => i); // Stick to in-order partition in case of no well shares.
        //var platesOrdered = _.clone(plateRange);

        // Focused annotations.
        /*var allTargetPlateSelections = plateRange.map(p => this.plateTargetAnnotations(p));

        // Bin plates by annotations.
        var bins: StringMap<{ annotations: string[]; plates: number[] }> = {};
        allTargetPlateSelections.forEach((sel, p) => {
            var tags = _.uniq(_.flatten(_.values(sel).map(tags =>
                            _.keys(tags).filter(t => tags[t].wells.length > 0))).sort(), true);
            var binKey = tags.join(",");
            if(!(binKey in bins)) bins[binKey] = { annotations: tags, plates: <number[]>[] };
            bins[binKey].plates.push(p);
        });

        return <any>_.values(bins);*/

        var focusTags = new Chain<string>(<any>_.flatten(_.values(this.focused().wellAnnotations)));
        var plateTags = this.wellAnnotations.value.plateTags;
        var bins: StringMap<{ tags: string[]; plates: number[] }> = {};
        plateRange.forEach(p => {
            var tags: Chain<string> = plateTags[p] || new Chain<string>();
            var matchTags = _.intersection(focusTags.elements, tags.elements);    ///Chain.intersection<string>([focusTags, tags]);
            var binKey = matchTags.join(",");
            if(!(binKey in bins)) bins[binKey] = { tags: matchTags, plates: [] };
            bins[binKey].plates.push(p);
        });

        return <any> _.values(bins);
    }

    // Plate annotations as well selections, returned as a map of annotation category and tag.
    plateTargetAnnotations(plate: number) {
        var dataInfo = this.dataSetInfo.value;
        var wellAnnotations = this.wellAnnotations.value;
        var focusAnnotations = this.focused().wellAnnotations;

        var selections: StringMap<StringMap<WellSelection>> = {};
        _.keys(focusAnnotations).forEach(cat => {
            selections[cat] = {};
            focusAnnotations[cat].forEach(tag =>
                    selections[cat][tag] = new WellSelection(cat, tag, plate, [])
            );
        });
        dataInfo.columnLabels.forEach((c, cI) =>
            dataInfo.rowLabels.forEach((r, rI) => {
                var wellCoordinates = new WellCoordinates(cI, rI);
                var annotations = wellAnnotations.annotationsAt(plate, wellCoordinates);

                _.keys(annotations).forEach(cat => annotations[cat].forEach(tag => {
                    if (cat in selections && tag in selections[cat])
                        selections[cat][tag].wells.push(wellCoordinates);
                }));
            })
        );

        // Add focused well.
        selections["Selected"] = {};
        selections["Selected"]["Selected"] = new WellSelection("Selected", "Selected", plate, [this.focused().well]);

        return selections;
    }
}

// Populations and their feature space.
export class PopulationSpace {
    constructor(public features: Chain<string> = new Chain<string>(), // Feature axes of space to model in.
                public populations: Chain<Population> = new Chain<Population>()) {
        // Total cell count population.
        var totalPop = new Population(Population.POPULATION_TOTAL_NAME, "Cell Count",
                            new Chain<number>(), Population.POPULATION_TOTAL_COLOR);
        totalPop.activation = [[-1, 0], [0, 1], [1, 1]];
        this.populations = this.populations.push(totalPop);
        this.conformPopulations();
    }

    private conformPopulations() {
        this.populations = this.populations.filter(p => p.exemplars.length > 0 ||
                                                    p.identifier === Population.POPULATION_TOTAL_NAME);   // Remove any empty populations.

        // If an exemplar has been added to total cell population, then transfer to new population.
        var totalPopulation = this.populations.byId(Population.POPULATION_TOTAL_NAME);
        if(totalPopulation.exemplars.length > 0) {
            this.createPopulation().exemplars = totalPopulation.exemplars.clone();
            totalPopulation.exemplars = new Chain<number>();
        }
        //this.createPopulation();    // Add one empty population at end.
    }

    // Add given object to given population.
    addExemplar(object: number, population: number) {
        var target = this.populations.byId(population);
        target.exemplars = target.exemplars.push(object);
        this.conformPopulations();
    }

    // Remove given object from any population.
    removeExemplar(object: number) {
        this.populations.forEach(p => p.exemplars = p.exemplars.pull(object));
        this.conformPopulations();
    }

    // Create a new population.
    createPopulation() {
        // Choose an available nominal color.
        var takenColors = this.populations.map(p => p.color);
        var availableColors = new Chain(Color.colorMapNominal8);
        var freeColors = Chain.difference(availableColors, takenColors);
        var color = freeColors.length > 0 ? freeColors.elements[0] : Color.WHITE;

        var population = new Population(null, "Tag", new Chain<number>(), color);
        this.populations = this.populations.push(population);

        return population;
    }

    // Dictionary for communicating population description.
    toDict(includeFeatures = true) {
        var exemplars = {};
        this.populations.filter(p => p.exemplars.length > 0)
            .forEach(p => exemplars[p.identifier] = _.clone(p.exemplars.elements)); // DO NOT REMOVE!
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

    // Return all exemplars of populations.
    allExemplars() {
        return Chain.union<number>(this.populations.elements.map(p => p.exemplars));
    }

    static fromJSON(data: {}) {
        return new PopulationSpace(
            Chain.fromJSON<string>(data['features']),
            new Chain<Population>(data['populations']['elements'].map(p => Population.fromJSON(p)))
        );
    }
}

// Population.
export class Population {
    public static POPULATION_TOTAL_NAME = 0;    // All cell population (for cell count purposes).
    public static POPULATION_ALL_NAME = 1;      // Population code in case of no known phenotypes.
    public static POPULATION_TOTAL_COLOR = new Color(150, 150, 150);

    private static POPULATION_ID_COUNTER = 2;   // 0 and 1 are reserved for above population identifiers

    colorTrans: Color;

    constructor(public identifier: number = null,
                public name: string = null,
                public exemplars = new Chain<number>(),
                public color = Color.NONE,
                public activation: number[][] = [[-1, 0], [0, 0], [1, 0]]) {
        if(identifier === null) this.identifier = Population.POPULATION_ID_COUNTER++;
        if(name === null) this.name = this.identifier.toString();

        this.colorTrans = color.alpha(0.5);
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

    static fromJSON(data: {}) {
        return new Population(
            data['identifier'],
            data['name'],
            Chain.fromJSON<number>(data['exemplars']),
            Color.fromJSON(data['color']),
            data['activation']
        );
    }
}

// Field selection coordinates.
export class SelectionCoordinates {
    constructor(public dataSet: string = null,
                public population: number = null,                           // Population id.
                public object: number = null,                               // Object (e.g. cell) id.
                public well: WellCoordinates = new WellCoordinates(0, 0),   // Well coordinates (column, row).
                public plate: number = 0,                                   // Plate id.
                public probeColumns: string[] = [],                         // Object query by coordinate columns.
                public probeCoordinates: number[] = [],                     // Object query by coordinates.
                public wellAnnotations: StringMap<string[]> = {}) {         // Selected well annotations.
    }

    // Correct for missing values with given coordinates.
    otherwise(that: SelectionCoordinates) {
        return new SelectionCoordinates(
            this.dataSet === null ? that.dataSet : this.dataSet,
            this.population === null ? that.population : this.population,
            this.object === null ? that.object : this.object,
            this.well === null ? that.well : this.well,
            this.plate === null ? that.plate : this.plate);
    }

    // Selected population, or total population fallback.
    populationOrTotal(): any {
        return this.population || Population.POPULATION_TOTAL_NAME;
    }

    switchProbe(features: string[], coordinates: number[]) {
        this.probeColumns = features;
        this.probeCoordinates = coordinates;
        this.object = null;
    }

    switchObject(object: number) {
        this.object = object;
        this.probeColumns = [];
        this.probeCoordinates = [];
    }

    switchPlate(plate: number) {
        this.plate = plate;
        this.object = null;
        this.probeColumns = [];
        this.probeCoordinates = [];
    }

    switchWell(well: WellCoordinates) {
        this.well = well;
        this.probeColumns = [];
        this.probeCoordinates = [];
    }

    static fromJSON(data: {}) {
        return new SelectionCoordinates(
            data['dataSet'],
            data['population'],
            data['object'],
            WellCoordinates.fromJSON(data['well']),
            data['plate'],
            data['probeColumns'],
            data['probeCoordinates'],
            data['wellAnnotations']
        );
    }
}

export class DataSetInfo {
    plateCount: number;
    columnCount: number;
    rowCount: number;

    //wellSelections: WellSelection[];

    constructor(public plateLabels: string[] = [],
                public columnLabels: string[] = [],
                public rowLabels: string[] = []) {
        this.plateCount = plateLabels.length;
        this.columnCount = columnLabels.length;
        this.rowCount = rowLabels.length;

        // Well selection placeholder; complete selection and control wells, for now.
        //this.wellSelections = [
            //new WellSelection("All", [[0, this.plateCount-1]], WellCoordinates.allWells(this.columnCount, this.rowCount)),
            //new WellSelection("Control", [[0, this.plateCount-1]], WellCoordinates.rowWells(this.columnCount, [0]))  // First two columns.
        //];
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
        //delete this.wellIndex[0];

        this.maxPlateObjectCount = (this.wellIndex[Population.POPULATION_TOTAL_NAME] || [])
                                    .map(plt => _.max(<number[]>_.flattenDeep<number>(plt)));

        // Missing wells have zero of everything.
        //this.wellIndex = this.wellIndex.map(p => p.map(plt => plt.map(col => Vector.invalidToZero(col))));

        // Share statistics.
        this.shareStatistics = this.wellIndex.map(pShares => math.statistics(
            Vector.invalidToZero(<number[]>_.flattenDeep<number>(pShares))));

        // z-scores of all wells, indexed by population, plate, column, and row.
        this.zScores = [];
        this.wellIndex.forEach((pS, pI) => this.zScores[pI] = pS.map(plS => plS.map(cS =>
                                        cS.map(s => (s - this.shareStatistics[pI].mean) /
                                                    this.shareStatistics[pI].standardDeviation))));
        this.zScoresMin = [];
        this.zScoresMax = [];
        this.zScores.forEach((p, pI) => {
            this.zScoresMin[pI] = _.min(<number[]>_.flattenDeep<number>(p));
            this.zScoresMax[pI] = _.max(<number[]>_.flattenDeep<number>(p));
        });
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

    // Retrieve zScore, returns null if not available.
    zScore(population: number, plate: number, well: WellCoordinates) {
        return (((this.zScores[population] || [])[plate] || [])[well.column] || [])[well.row] || null;
    }
}

export class WellAnnotations extends DataFrame<string[]> {
    static ANNOTATION_SPLIT = "|";

    plateTags: Chain<string>[];

    constructor(dictionary: any = {}) {
        super(dictionary);

        this.computePlateAnnotations();
    }

    // Return dictionary of annotations for given plate and well coordinates.
    annotationsAt(plate: number, coordinates: WellCoordinates) {
        var rowIndex = this.rowIndex[plate + "_" + coordinates.column + "_" + coordinates.row];
        var dict: StringMap<string[]> = {};
        if(rowIndex >= 0) this.columns.forEach(c => dict[c] = this.matrix[this.columnIndex[c]][rowIndex]);
        return dict;
    }

    private computePlateAnnotations() {
        this.plateTags = [];

        // Accumulate plate annotations by scanning all rows.
        this.rows.forEach((row) => {
            var parts = row.split('_');
            var plate = Number(parts[0]);
            //var column = Number(parts[1]);
            //var row = Number(parts[2]);

            // Create plate selection array.
            if(!(plate in this.plateTags)) this.plateTags[plate] = new Chain<string>();
            //var plateSelection = this.plateTags[plate];

            // Columns are annotation categories.
            this.columns.forEach(column => {
                var tags = this.cell(column, row);
                this.plateTags[plate] = this.plateTags[plate].pushAll(tags);

                /*if(tags.length > 0) {
                    if(!(column in plateSelection)) plateSelection[column] = new Chain<string>();
                    plateSelection[column] = plateSelection[column].pushAll(tags);
                }*/
            });
        });

        // Sort tags, in place.
        this.plateTags.forEach(ts => ts.elements.sort());

        return this.plateTags;

        /*var selections: StringMap<StringMap<WellSelection>> = {};
        _.keys(focusAnnotations).forEach(cat => {
            selections[cat] = {};
            focusAnnotations[cat].forEach(tag =>
                    selections[cat][tag] = new WellSelection(cat, tag, plate, [])
            );
        });
        dataInfo.columnLabels.forEach((c, cI) =>
                dataInfo.rowLabels.forEach((r, rI) => {
                    var wellCoordinates = new WellCoordinates(cI, rI);
                    var annotations = wellAnnotations.annotationsAt(plate, wellCoordinates);

                    _.keys(annotations).forEach(cat => annotations[cat].forEach(tag => {
                        if (cat in selections && tag in selections[cat])
                            selections[cat][tag].wells.push(wellCoordinates);
                    }));
                })
        );*/
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
    constructor(public column: number = null, public row: number = null) {}

    static fromJSON(data: {}) {
        return new WellCoordinates(data['column'], data['row']);
    }

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
        return new WellSelection("Location", id, this.plate, [new WellCoordinates(this.column, this.row)]);
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
    constructor(public category: string,
                public tag: string,
                public plate: number,
                public wells: WellCoordinates[]) {}
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