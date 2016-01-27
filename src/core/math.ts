/// <reference path="../../typings/tsd.d.ts" />
/// <reference path="collection.ts" />

import _ = require('lodash');

import collections = require('./collection');
import Chain = collections.Chain;
import indexMap = collections.indexMap;
import swap = collections.swap;

// Constants.
var PI = Math.PI;
var PI2 = Math.PI * 2;
var IPI = 1 / PI;
var IPI2 = 1 / PI2;

// Vector math functions.
// Assumes all operations are applied to number array of equal size.
export class Vector {
    // Create a (generic) vector of the given size, filled with the given value.
    static create<E>(size: number, fill: E = null): E[] {
        var result: E[] = [];

        for (var i = 0; i < size; i++) {
            result[i] = fill;
        }

        return result;
    }

    // Create a vector of the given size, filled with the given number.
    static createNumeric(size: number, fill: number = 0): number[] {
        var result: number[] = [];

        for (var i = 0; i < size; i++) {
            result[i] = fill;
        }

        return result;
    }

    // Fill a vector with the given value.
    static fill(vector: number[], val: number) {
        var len = vector.length;
        for (var i = 0; i < len; i++) {
            vector[i] = val;
        }
    }

    // Add up components.
    static sum(vector: number[]): number {
        var result = 0;

        var len = vector.length;
        for (var i = 0; i < len; i++) {
            result += vector[i];
        }

        return result;
    }

    // Average components.
    static avg(vector: number[]): number {
        return Vector.sum(vector) / vector.length;
    }

    // Dot product.
    static dot(a: number[], b: number[]): number {
        var result = 0;

        var len = a.length;
        for (var i = 0; i < len; i++) {
            result += a[i] * b[i];
        }

        return result;
    }

    // Add vector to vector and return new copy.
    static add(v1: number[], v2: number[]): number[] {
        var result: number[] = [];

        var len = v1.length;
        for (var i = 0; i < len; i++) {
            result.push(v1[i] + v2[i]);
        }

        return result;
    }

    // Add vector to vector.
    static addTo(target: number[], toAdd: number[]) {
        var len = target.length;
        for (var i = 0; i < len; i++) {
            target[i] += toAdd[i];
        }
    }

    // Multiply vector by factor and add to other vector.
    static mulAddTo(target: number[], toAdd: number[], factor: number) {
        var len = target.length;
        for (var i = 0; i < len; i++) {
            target[i] += toAdd[i] * factor;
        }
    }

    // Per element multiplication of two vectors.
    static mulEl(vector1: number[], vector2: number[]) {
        var result: number[] = [];

        var len = vector1.length;
        for (var i = 0; i < len; i++) {
            result.push(vector1[i] * vector2[i]);
        }

        return result;
    }

    // Subtract vector v2 from vector v1 and return new copy.
    static subtract(v1: number[], v2: number[]): number[] {
        var result: number[] = [];

        var len = v1.length;
        for (var i = 0; i < len; i++) {
            result.push(v1[i] - v2[i]);
        }

        return result;
    }

    // Subtract vector toSubtract from vector target.
    static subtractFrom(target: number[], toSubtract: number[]) {
        var len = target.length;
        for (var i = 0; i < len; i++) {
            target[i] -= toSubtract[i];
        }
    }

    // Compute the maximum components for two given vectors.
    static max(v1: number[], v2: number[]): number[] {
        var result: number[] = [];

        var len = v1.length;
        for (var i = 0; i < len; i++) {
            result.push(Math.max(v1[i], v2[i]));
        }

        return result;
    }

    // Compute the minimum components for two given vectors.
    static min(v1: number[], v2: number[]): number[] {
        var result: number[] = [];

        var len = v1.length;
        for (var i = 0; i < len; i++) {
            result.push(Math.min(v1[i], v2[i]));
        }

        return result;
    }

    // Rotate the given 2D vector by 90 counter clockwise.
    static orthoLeft(target: number[]): number[] {
        return [target[1], -target[0]];
    }

    // Rotate the given 2D vector by 90 degrees clockwise.
    static orthoRight(target: number[]): number[] {
        return [-target[1], target[0]];
    }

    // Multiply vector with given scalar and return new copy.
    static mul(v: number[], s: number): number[] {
        var result: number[] = [];

        var len = v.length;
        for (var i = 0; i < len; i++) {
            result.push(v[i] * s);
        }

        return result;
    }

    // Interpolate between the given vectors to the given position in [0..1].
    static interpolate(sV: number[], tV: number[], s: number): number[] {
        return Vector.add(Vector.mul(sV, 1 - s), Vector.mul(tV, s));
    }

    // Squared Euclidian norm (auto dot product).
    static sqEuclidian(vector: number[]): number {
        var result = 0;

        var len = vector.length;
        for (var i = 0; i < len; i++) {
            var c = vector[i];
            result += c * c;
        }

        return result;
    }

    // Euclidean norm (magnitude).
    static Euclidean(vector: number[]): number {
        return Math.sqrt(Vector.sqEuclidian(vector));
    }

    // Normalized vector.
    static normalize(vector: number[]): number[] {
        var norm = Vector.Euclidean(vector);
        return Vector.mul(vector, 1 / norm);
    }

    // Euclidian distance between two points expressed as vectors.
    static distance(v1: number[], v2: number[]): number {
        return Vector.Euclidean(Vector.subtract(v2, v1));
    }

    // Clone the given array.
    static clone(v: number[]) {
        return v.map(n => n);
    }
}

// Assumes all operations are applied to matrices of equal size.
export class Matrix {

    // Create a (generic) matrix of the given dimensions, filled with the given value.
    static create<E>(cols: number, rows: number, fill: E = null): E[][] {
        var result: E[][] = [];

        for (var i = 0; i < cols; i++) {
            result[i] = Vector.create<E>(rows, fill);
        }

        return result;
    }

    // Create a matrix of the given dimensions, filled with the given number.
    static createNumeric(cols: number, rows: number, fill: number = 0): number[][] {
        var result: number[][] = [];

        for (var i = 0; i < cols; i++) {
            result[i] = Vector.createNumeric(rows, fill);
        }

        return result;
    }

    // Add matrix to matrix.
    static addTo(target: number[][], toAdd: number[][]) {
        var len = target.length;
        for (var i = 0; i < len; i++) {
            Vector.addTo(target[i], toAdd[i]);
        }
    }

    // Multiply matrix by factor and add to other vector.
    static mulAddTo(target: number[][], toAdd: number[][], factor: number) {
        var len = target.length;
        for (var i = 0; i < len; i++) {
            Vector.mulAddTo(target[i], toAdd[i], factor);
        }
    }

    // Transpose a matrix.
    static transpose(matrix: any[][]) {
        var transposed: any[][] = matrix.length > 0 ? Matrix.createNumeric(matrix[0].length, matrix.length) : [];

        for(var i = 0; i < transposed.length; i++) {
            for(var j = 0; j < transposed[i].length; j++) {
                transposed[i][j] = matrix[j][i];
            }
        }

        /*for(var i = 0; i < target.length; i++) {
            for(var j = 0; j < target[i].length; j++) {
                var t = target[i][j];
                target[i][j] = target[j][i];
                target[j][i] = t;
            }
        }*/

        return transposed;
    }
}

// Range of numbers.
export class Range {
    constructor(public begin: number,
                public end: number) {

    }
}

// Positioned object.
export interface Positioned {
    position: number[]; // [x, y, ...]
}

// Object with dimensions.
export interface Dimensional {
    dimensions: number[];  // [width, height, ...]
}

// Rectangle (inclusive).
export class Rectangle implements Positioned, Dimensional {
    bottomRight: number[];  // Bottom right corner.
    center: number[];       // Center.

    // Base constructor.
    constructor(public position: number[],     // Top left corner.
                public dimensions: number[]    // Rectangle size.
    ) {
        this.bottomRight = Vector.add(this.position, this.dimensions);
        this.center = Vector.add(this.position, Vector.mul(this.dimensions, 0.5));
    }

    toString(): string {
        return "[" + this.position[0] + "," + this.position[1] + "," + this.dimensions[0] + "," + this.dimensions[1] + "]";
    }

    // Translate rectangle to form new rectangle.
    translate(translation: number[]): Rectangle {
        return new Rectangle(Vector.add(this.position, translation), _.clone(this.dimensions));
    }

    // Extend (or shrink) rectangle to form new rectangle.
    extend(extension: number): Rectangle {
        var eV = [extension, extension];
        return new Rectangle(
            Vector.subtract(this.position, eV),
            Vector.add(this.dimensions, Vector.mul(eV, 2)));
    }

    // Bounds of a set of bounds.
    static combine(rectangles: Rectangle[]): Rectangle {
        var minX = Number.POSITIVE_INFINITY;
        var maxX = Number.NEGATIVE_INFINITY;
        var minY = Number.POSITIVE_INFINITY;
        var maxY = Number.NEGATIVE_INFINITY;
        rectangles.forEach(rs => {
            minX = Math.min(minX, rs.position[0]);
            maxX = Math.max(maxX, rs.bottomRight[0]);
            minY = Math.min(minY, rs.position[1]);
            maxY = Math.max(maxY, rs.bottomRight[1]);
        });

        return new Rectangle([minX, minY], [maxX - minX, maxY - minY]);;
    }

    // Interpolate to the given rectangle at given position in [0..1].
    interpolate(target: Rectangle, s: number): Rectangle {
        return new Rectangle(
            Vector.interpolate(this.position, target.position, s),
            Vector.interpolate(this.dimensions, target.dimensions, s));
    }
}

// Combinatorial optimization functions.
export class Optimize {

    // Perform 2-opt optimization, for given elements by given distance matrix (mapped by index).
    // TODO: increase performance by order of N with a linked list implementation.
    static optTSP<E>(orderedSet: Chain<E>,
                     distances: number[][],
                     invert: boolean = false): Chain<E> {
        var index = indexMap(orderedSet.elements.map(e => e.toString()));

        // Element permutation by (local) index, include dummy node.
        var permutation: number[] = [];
        for (var i = 0; i < orderedSet.length + 1; i++) {
            permutation.push(i);
        }

        // Local distance matrix.
        var d = Matrix.create(permutation.length, permutation.length, 0);
        for (var i = 0; i < permutation.length - 1; i++) {
            var eI = index[orderedSet.elements[i].toString()];

            for (var j = 0; j < permutation.length - 1; j++) {
                var eJ = index[orderedSet.elements[j].toString()];

                d[i][j] = invert ? 1 - distances[eI][eJ] : distances[eI][eJ];
            }
        }

        // Initial, greedy solution.
        for (var i = 1; i < permutation.length; i++) {
            // Select next best node to swap.
            var minD = Number.MAX_VALUE;
            var minN = null;
            for (var j = i; j < permutation.length; j++) {
                var dP = d[permutation[i - 1]][permutation[j]];
                if (dP < minD) {
                    minD = dP;
                    minN = j;
                }
            }

            // Swap best node and i.
            swap(permutation, i, minN);
        }

        // Continue optimization until we hit a minima.
        var swaps = 0;
        var improved = true;
        while (improved) {
            improved = false;

            var minCost = this.cost(permutation, d);

            tryPairs:
            for (var i = 0; i < permutation.length - 1; i++) {
                for (var k = i + 1; k < permutation.length; k++) {
                    this.invertSegment(permutation, i, k);
                    var newCost = this.cost(permutation, d);

                    if (newCost < minCost) {
                        minCost = newCost;
                        improved = true;
                        break tryPairs;
                    } else {
                        this.invertSegment(permutation, i, k);
                    }
                }
            }

            swaps++;
        }

        //console.log("Optimization swaps: " + swaps);

        // Open cycle at dummy and cut it out.
        var dummyIndex = _.indexOf(permutation, orderedSet.length);
        var newSets = permutation.slice(dummyIndex + 1, permutation.length)
            .concat(permutation.slice(0, dummyIndex))
            .map(i => orderedSet.elements[i]);

        return new Chain(newSets);
    }


    // The cost of a TSP tour for the given distance function.
    private static cost(permutation: number[], d: number[][]) {
        var sum = 0;

        for (var i = 0; i < permutation.length; i++) {
            sum += d[permutation[i]][permutation[(i + 1) % permutation.length]];
        }

        return sum;
    }

    // Invert a segment indexed [i..k] of a TSP tour.
    private static invertSegment(permutation: number[], i: number, k: number) {
        var tmp;
        for (var j = i; j < (i + k) / 2; j++) {
            var jC = k - j;
            tmp = permutation[j];
            permutation[j] = permutation[jC];
            permutation[jC] = tmp;
        }
    }
}

// Generic object interpolation method.
export interface Interpolatable<E> {
    interpolate(target: E, s: number);  // Interpolate to target object, with given factor in [0..1].
}

export function interpolate<E>(source: E, target: E, s: number): E {
    var result: any;

    var src = <any>source;
    var tar = <any>target;

    // No source.
    if(!source) {
        result = target;
    }
    // No target.
    else if(!target) {
        result = source;
    }
    // Has predefined interpolation function.
    else if(source['interpolate']) {
        result = source['interpolate'](target, s);
    }
    // Number.
    else if(_.isNumber(source.constructor)) {
        result = (1 - s) * src + s * tar;
    }
    // Array.
    else if(_.isArray(source)) {
        var maxLen = Math.max(src.length, tar.length);
        result = [];
        for(var i = 0; i < maxLen; i++) {
            result.push(interpolate<any>(src[i] || tar[i], tar[i] || src[i], s));
        }
    }
    // Interpolation of object members.
    else if(_.isObject(source)) {
        result = <any>_.clone(target); // Clone for proper function transfer.

        // Interpolate fields.
        var fields = _.union(_.keys(src), _.keys(tar));
        fields.forEach(f => result[f] = interpolate<any>(src[f] || tar[f], tar[f] || src[f], s));
    }
    // Blunt interpolation for everything else.
    else {
        result = s < 0.5 ? source : target;
    }

    return result;
}
