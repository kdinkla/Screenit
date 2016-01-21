/// <reference path="../../typings/tsd.d.ts" />
/// <reference path="collection.ts" />
define(["require", "exports", 'lodash', './collection'], function (require, exports, _, collections) {
    var Chain = collections.Chain;
    var indexMap = collections.indexMap;
    var swap = collections.swap;
    // Constants.
    var PI = Math.PI;
    var PI2 = Math.PI * 2;
    var IPI = 1 / PI;
    var IPI2 = 1 / PI2;
    // Vector math functions.
    // Assumes all operations are applied to number array of equal size.
    var Vector = (function () {
        function Vector() {
        }
        // Create a (generic) vector of the given size, filled with the given value.
        Vector.create = function (size, fill) {
            if (fill === void 0) { fill = null; }
            var result = [];
            for (var i = 0; i < size; i++) {
                result[i] = fill;
            }
            return result;
        };
        // Create a vector of the given size, filled with the given number.
        Vector.createNumeric = function (size, fill) {
            if (fill === void 0) { fill = 0; }
            var result = [];
            for (var i = 0; i < size; i++) {
                result[i] = fill;
            }
            return result;
        };
        // Fill a vector with the given value.
        Vector.fill = function (vector, val) {
            var len = vector.length;
            for (var i = 0; i < len; i++) {
                vector[i] = val;
            }
        };
        // Add up components.
        Vector.sum = function (vector) {
            var result = 0;
            var len = vector.length;
            for (var i = 0; i < len; i++) {
                result += vector[i];
            }
            return result;
        };
        // Average components.
        Vector.avg = function (vector) {
            return Vector.sum(vector) / vector.length;
        };
        // Dot product.
        Vector.dot = function (a, b) {
            var result = 0;
            var len = a.length;
            for (var i = 0; i < len; i++) {
                result += a[i] * b[i];
            }
            return result;
        };
        // Add vector to vector and return new copy.
        Vector.add = function (v1, v2) {
            var result = [];
            var len = v1.length;
            for (var i = 0; i < len; i++) {
                result.push(v1[i] + v2[i]);
            }
            return result;
        };
        // Add vector to vector.
        Vector.addTo = function (target, toAdd) {
            var len = target.length;
            for (var i = 0; i < len; i++) {
                target[i] += toAdd[i];
            }
        };
        // Multiply vector by factor and add to other vector.
        Vector.mulAddTo = function (target, toAdd, factor) {
            var len = target.length;
            for (var i = 0; i < len; i++) {
                target[i] += toAdd[i] * factor;
            }
        };
        // Subtract vector v2 from vector v1 and return new copy.
        Vector.subtract = function (v1, v2) {
            var result = [];
            var len = v1.length;
            for (var i = 0; i < len; i++) {
                result.push(v1[i] - v2[i]);
            }
            return result;
        };
        // Subtract vector toSubtract from vector target.
        Vector.subtractFrom = function (target, toSubtract) {
            var len = target.length;
            for (var i = 0; i < len; i++) {
                target[i] -= toSubtract[i];
            }
        };
        // Compute the maximum components for two given vectors.
        Vector.max = function (v1, v2) {
            var result = [];
            var len = v1.length;
            for (var i = 0; i < len; i++) {
                result.push(Math.max(v1[i], v2[i]));
            }
            return result;
        };
        // Compute the minimum components for two given vectors.
        Vector.min = function (v1, v2) {
            var result = [];
            var len = v1.length;
            for (var i = 0; i < len; i++) {
                result.push(Math.min(v1[i], v2[i]));
            }
            return result;
        };
        // Rotate the given 2D vector by 90 counter clockwise.
        Vector.orthoLeft = function (target) {
            return [target[1], -target[0]];
        };
        // Rotate the given 2D vector by 90 degrees clockwise.
        Vector.orthoRight = function (target) {
            return [-target[1], target[0]];
        };
        // Multiply vector with given scalar and return new copy.
        Vector.mul = function (v, s) {
            var result = [];
            var len = v.length;
            for (var i = 0; i < len; i++) {
                result.push(v[i] * s);
            }
            return result;
        };
        // Interpolate between the given vectors to the given position in [0..1].
        Vector.interpolate = function (sV, tV, s) {
            return Vector.add(Vector.mul(sV, 1 - s), Vector.mul(tV, s));
        };
        // Squared Euclidian norm (auto dot product).
        Vector.sqEuclidian = function (vector) {
            var result = 0;
            var len = vector.length;
            for (var i = 0; i < len; i++) {
                var c = vector[i];
                result += c * c;
            }
            return result;
        };
        // Euclidean norm (magnitude).
        Vector.Euclidean = function (vector) {
            return Math.sqrt(Vector.sqEuclidian(vector));
        };
        // Normalized vector.
        Vector.normalize = function (vector) {
            var norm = Vector.Euclidean(vector);
            return Vector.mul(vector, 1 / norm);
        };
        // Euclidian distance between two points expressed as vectors.
        Vector.distance = function (v1, v2) {
            return Vector.Euclidean(Vector.subtract(v2, v1));
        };
        return Vector;
    })();
    exports.Vector = Vector;
    // Assumes all operations are applied to matrices of equal size.
    var Matrix = (function () {
        function Matrix() {
        }
        // Create a (generic) matrix of the given dimensions, filled with the given value.
        Matrix.create = function (cols, rows, fill) {
            if (fill === void 0) { fill = null; }
            var result = [];
            for (var i = 0; i < cols; i++) {
                result[i] = Vector.create(rows, fill);
            }
            return result;
        };
        // Create a matrix of the given dimensions, filled with the given number.
        Matrix.createNumeric = function (cols, rows, fill) {
            if (fill === void 0) { fill = 0; }
            var result = [];
            for (var i = 0; i < cols; i++) {
                result[i] = Vector.createNumeric(rows, fill);
            }
            return result;
        };
        // Add matrix to matrix.
        Matrix.addTo = function (target, toAdd) {
            var len = target.length;
            for (var i = 0; i < len; i++) {
                Vector.addTo(target[i], toAdd[i]);
            }
        };
        // Multiply matrix by factor and add to other vector.
        Matrix.mulAddTo = function (target, toAdd, factor) {
            var len = target.length;
            for (var i = 0; i < len; i++) {
                Vector.mulAddTo(target[i], toAdd[i], factor);
            }
        };
        // Transpose a matrix.
        Matrix.transpose = function (matrix) {
            var transposed = matrix.length > 0 ? Matrix.createNumeric(matrix[0].length, matrix.length) : [];
            for (var i = 0; i < transposed.length; i++) {
                for (var j = 0; j < transposed[i].length; j++) {
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
        };
        return Matrix;
    })();
    exports.Matrix = Matrix;
    // Range of numbers.
    var Range = (function () {
        function Range(begin, end) {
            this.begin = begin;
            this.end = end;
        }
        return Range;
    })();
    exports.Range = Range;
    // Rectangle (inclusive).
    var Rectangle = (function () {
        // Base constructor.
        function Rectangle(position, // Top left corner.
            dimensions // Rectangle size.
            ) {
            this.position = position;
            this.dimensions = dimensions;
            this.bottomRight = Vector.add(this.position, this.dimensions);
            this.center = Vector.add(this.position, Vector.mul(this.dimensions, 0.5));
        }
        Rectangle.prototype.toString = function () {
            return "[" + this.position[0] + "," + this.position[1] + "," + this.dimensions[0] + "," + this.dimensions[1] + "]";
        };
        // Translate rectangle to form new rectangle.
        Rectangle.prototype.translate = function (translation) {
            return new Rectangle(Vector.add(this.position, translation), _.clone(this.dimensions));
        };
        // Extend (or shrink) rectangle to form new rectangle.
        Rectangle.prototype.extend = function (extension) {
            var eV = [extension, extension];
            return new Rectangle(Vector.subtract(this.position, eV), Vector.add(this.dimensions, Vector.mul(eV, 2)));
        };
        // Bounds of a set of bounds.
        Rectangle.combine = function (rectangles) {
            var minX = Number.POSITIVE_INFINITY;
            var maxX = Number.NEGATIVE_INFINITY;
            var minY = Number.POSITIVE_INFINITY;
            var maxY = Number.NEGATIVE_INFINITY;
            rectangles.forEach(function (rs) {
                minX = Math.min(minX, rs.position[0]);
                maxX = Math.max(maxX, rs.bottomRight[0]);
                minY = Math.min(minY, rs.position[1]);
                maxY = Math.max(maxY, rs.bottomRight[1]);
            });
            return new Rectangle([minX, minY], [maxX - minX, maxY - minY]);
            ;
        };
        // Interpolate to the given rectangle at given position in [0..1].
        Rectangle.prototype.interpolate = function (target, s) {
            return new Rectangle(Vector.interpolate(this.position, target.position, s), Vector.interpolate(this.dimensions, target.dimensions, s));
        };
        return Rectangle;
    })();
    exports.Rectangle = Rectangle;
    // Combinatorial optimization functions.
    var Optimize = (function () {
        function Optimize() {
        }
        // Perform 2-opt optimization, for given elements by given distance matrix (mapped by index).
        // TODO: increase performance by order of N with a linked list implementation.
        Optimize.optTSP = function (orderedSet, distances, invert) {
            if (invert === void 0) { invert = false; }
            var index = indexMap(orderedSet.elements.map(function (e) { return e.toString(); }));
            // Element permutation by (local) index, include dummy node.
            var permutation = [];
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
                tryPairs: for (var i = 0; i < permutation.length - 1; i++) {
                    for (var k = i + 1; k < permutation.length; k++) {
                        this.invertSegment(permutation, i, k);
                        var newCost = this.cost(permutation, d);
                        if (newCost < minCost) {
                            minCost = newCost;
                            improved = true;
                            break tryPairs;
                        }
                        else {
                            this.invertSegment(permutation, i, k);
                        }
                    }
                }
                swaps++;
            }
            //console.log("Optimization swaps: " + swaps);
            // Open cycle at dummy and cut it out.
            var dummyIndex = _.indexOf(permutation, orderedSet.length);
            var newSets = permutation.slice(dummyIndex + 1, permutation.length).concat(permutation.slice(0, dummyIndex)).map(function (i) { return orderedSet.elements[i]; });
            return new Chain(newSets);
        };
        // The cost of a TSP tour for the given distance function.
        Optimize.cost = function (permutation, d) {
            var sum = 0;
            for (var i = 0; i < permutation.length; i++) {
                sum += d[permutation[i]][permutation[(i + 1) % permutation.length]];
            }
            return sum;
        };
        // Invert a segment indexed [i..k] of a TSP tour.
        Optimize.invertSegment = function (permutation, i, k) {
            var tmp;
            for (var j = i; j < (i + k) / 2; j++) {
                var jC = k - j;
                tmp = permutation[j];
                permutation[j] = permutation[jC];
                permutation[jC] = tmp;
            }
        };
        return Optimize;
    })();
    exports.Optimize = Optimize;
    function interpolate(source, target, s) {
        var result;
        var src = source;
        var tar = target;
        // No source.
        if (!source) {
            result = target;
        }
        else if (!target) {
            result = source;
        }
        else if (source['interpolate']) {
            result = source['interpolate'](target, s);
        }
        else if (_.isNumber(source.constructor)) {
            result = (1 - s) * src + s * tar;
        }
        else if (_.isArray(source)) {
            var maxLen = Math.max(src.length, tar.length);
            result = [];
            for (var i = 0; i < maxLen; i++) {
                result.push(interpolate(src[i] || tar[i], tar[i] || src[i], s));
            }
        }
        else if (_.isObject(source)) {
            result = _.clone(target); // Clone for proper function transfer.
            // Interpolate fields.
            var fields = _.union(_.keys(src), _.keys(tar));
            fields.forEach(function (f) { return result[f] = interpolate(src[f] || tar[f], tar[f] || src[f], s); });
        }
        else {
            result = s < 0.5 ? source : target;
        }
        return result;
    }
    exports.interpolate = interpolate;
});
//# sourceMappingURL=math.js.map