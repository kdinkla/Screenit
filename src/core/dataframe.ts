/// <reference path="collection.ts" />

import collection = require('./collection');
import StringMap = collection.StringMap;

import math = require('./math');
import Matrix = math.Matrix;

export class DataFrame<T> {
    columns: string[];                  // Column names.
    columnIndex: StringMap<number>;     // Column name to index.
    rows: string[];                     // Row names.
    rowIndex: StringMap<number>;        // Row name to index.
    matrix: T[][];                      // By column index and row index.

    constructor(dictionary: any = {}) {
        this.columns = _.keys(dictionary);
        this.columnIndex = collection.indexMap(this.columns);
        this.rows = this.columns.length > 0 ? _.keys(dictionary[this.columns[0]]) : [];
        this.rowIndex = collection.indexMap(this.rows);
        this.matrix = this.columns.map(c => this.rows.map(r => dictionary[c][r]));
    }

    // All values for given column name.
    columnVector(name: string) {
        return this.matrix[this.columnIndex[name]];
    }

    // Value at given column and row names.
    cell(column: any, row: any) {
        return (this.columnVector(column) || [])[this.rowIndex[row]];
    }

    // Exchange columns and rows.
    transpose() {
        var tr = this.shallowClone();

        tr.columns = this.rows;
        tr.rows = this.columns;
        tr.rowIndex = this.columnIndex;
        tr.columnIndex = this.rowIndex;
        tr.matrix = Matrix.transpose(tr.matrix);

        return tr;
    }

    // Apply function to all cells.
    /*applyToCells(f: (n: T) => T): DataFrame<T> {
        var tr = this.shallowClone();

        tr.matrix = tr.matrix.map(c => c.map(f));

        return tr;
    }*/

    // Normalize along columns, or globally. Normalized map is [min, max] => [0,1] or [0, max] => [0,1].
    normalize(global: boolean = false, lowerBoundZero: boolean = false): DataFrame<number> {
        var tr: DataFrame<number> = <any> this.shallowClone();

        // Normalize by individual columns.
        var min = tr.matrix.map(c => _.min(c));
        var max = tr.matrix.map(c => _.max(c));

        // Normalize along all columns.
        if(global) {
            var indMin = _.min(min);
            var indMax = _.max(max);
            min = tr.matrix.map(c => indMin);
            max = tr.matrix.map(c => indMax);
        }

        // Normalize matrix.
        tr.matrix = lowerBoundZero ?
            tr.matrix.map((c, cI) => c.map(r => (r / max[cI]) || 0)) :
            tr.matrix.map((c, cI) => c.map(r => (r - min[cI]) / ((max[cI] - min[cI]) || 0)));

        return tr;
    }

    private shallowClone() {
        var tr = new DataFrame<T>({});

        tr.columns = this.columns;
        tr.rows = this.rows;
        tr.columnIndex = this.columnIndex;
        tr.rowIndex = this.rowIndex;
        tr.matrix = <any> this.matrix;

        return tr;
    }

    join(that: DataFrame<T>) {
        var joined = new DataFrame<T>({});

        joined.columns = _.union(this.columns, that.columns);
        joined.rows = _.union(this.rows, that.rows);
        joined.columnIndex = collection.indexMap(joined.columns);
        joined.rowIndex = collection.indexMap(joined.rows);

        joined.matrix = Matrix.create(joined.columns.length, joined.rows.length, null);
        joined.columns.forEach(c => {
            var cI = joined.columnIndex[c];

            joined.rows.forEach(r => {
                var rI = joined.rowIndex[r];

                var tCI = this.columnIndex[c];
                var tRI = this.rowIndex[r];
                if(tCI >= 0 && tRI >= 0) {
                    joined.matrix[cI][rI] = this.matrix[tCI][tRI];
                } else {
                    tCI = that.columnIndex[c];
                    tRI = that.rowIndex[r];
                    if(tCI >= 0 && tRI >= 0) {
                        joined.matrix[cI][rI] = that.matrix[tCI][tRI];
                    }
                }
            });
        });

        return joined;
    }

    toDict() {
        var dict = {};
        this.columns.forEach((c, cI) => {
            dict[c] = {};
            this.rows.forEach((r, rI) => dict[c][r] = this.matrix[cI][rI]);
        });
        return dict;
    }
}

export class NumberFrame extends DataFrame<number> {
    min: number[];
    max: number[];
    normalizedMatrix: number[][];
    zeroNormalizedMatrix: number[][];

    constructor(dictionary: any = {},
                globalNormalization: boolean = false,
                cellTransform: (number) => number = null) {
        super(dictionary);

        // Apply optional cell transformation.
        if(cellTransform) {
            for(var i = 0; i < this.matrix.length; i++) {
                for(var j = 0; j < this.matrix.length; j++) {
                    this.matrix[i][j] = cellTransform(this.matrix[i][j]);
                }
            }
        }

        // Normalize by individual columns.
        this.min = this.matrix.map(c => _.min(c));
        this.max = this.matrix.map(c => _.max(c));

        // Normalize along all columns.
        if(globalNormalization) {
            var indMin = _.min(this.min);
            var indMax = _.max(this.max);
            this.min = this.matrix.map(c => indMin);
            this.max = this.matrix.map(c => indMax);
        }
        this.normalizedMatrix = this.matrix.map((c, cI) => c.map(r => (r - this.min[cI]) / ((this.max[cI] - this.min[cI]) || 1)));
        this.zeroNormalizedMatrix = this.matrix.map((c, cI) => c.map(r => (r / this.max[cI]) || 1));
    }

    normalizedColumnVector(name: string) {
        return this.normalizedMatrix[this.columnIndex[name]];
    }

    zeroNormalizedColumnVector(name: string) {
        return this.zeroNormalizedMatrix[this.columnIndex[name]];
    }
}