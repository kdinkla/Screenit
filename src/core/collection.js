/// <reference path="../../typings/tsd.d.ts" />
define(["require", "exports", 'lodash'], function (require, exports, _) {
    // Create index map for string array.
    function indexMap(keys) {
        var result = {};
        var len = keys.length;
        for (var i = 0; i < len; i++) {
            result[keys[i]] = i;
        }
        return result;
    }
    exports.indexMap = indexMap;
    // Swap the elements at the given positions a and b in the given array.
    function swap(array, i, j) {
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    exports.swap = swap;
    // Push array onto other array.
    function push(target, toPush) {
        target.push.apply(target, toPush);
    }
    exports.push = push;
    function identify(element) {
        return element.toString(); //<any>(element.toNumber || element.toString)();
    }
    exports.identify = identify;
    // An immutable, ordered set of elements.
    var Chain = (function () {
        function Chain(elements) {
            var _this = this;
            if (elements === void 0) { elements = []; }
            this.elements = [];
            this.index = {};
            this.length = 0;
            elements.forEach(function (e) { return _this.pushMutation(e); });
        }
        Chain.fromJSON = function (data) {
            return new Chain(data['elements']);
        };
        Chain.prototype.pushMutation = function (e) {
            if (!this.index[identify(e)]) {
                this.elements.push(e);
                this.index[identify(e)] = e;
                this.length++;
            }
            return this;
        };
        Chain.prototype.byId = function (id) {
            return this.index[id];
        };
        Chain.prototype.map = function (f) {
            return new Chain(this.elements.map(f));
        };
        Chain.prototype.filter = function (f) {
            return new Chain(this.elements.filter(f));
        };
        Chain.prototype.forEach = function (f) {
            this.elements.forEach(f);
        };
        // Add an element at the end if it is not present yet.
        Chain.prototype.push = function (element) {
            return this.clone().pushMutation(element);
        };
        // Add multiple elements at the end if they are not present yet.
        Chain.prototype.pushAll = function (elements) {
            var result = this.clone();
            elements.forEach(function (e) { return result.pushMutation(e); });
            return result;
        };
        // Remove an element.
        Chain.prototype.pull = function (element) {
            var id = identify(element);
            return new Chain(this.elements.filter(function (e) { return identify(e) !== id; }));
        };
        // Toggle membership of the given element.
        Chain.prototype.toggle = function (element) {
            return identify(element) in this.index ? this.pull(element) : this.push(element);
        };
        // Combine with given ordered set, results in new ordered set.
        Chain.prototype.combine = function (target) {
            var result = new Chain();
            result.pushAll(this.elements);
            result.pushAll(target.elements);
            return result;
        };
        // Clone this set.
        Chain.prototype.clone = function () {
            return new Chain(this.elements);
        };
        // Whether the given element is contained.
        Chain.prototype.has = function (that) {
            return identify(that) in this.index;
        };
        // Whether the given set is contained by the other set.
        Chain.prototype.contains = function (that) {
            var isContained = true;
            for (var i = 0; i < that.elements.length; i++) {
                if (!(identify(that.elements[i]) in this.index)) {
                    isContained = false;
                    break;
                }
            }
            return isContained;
        };
        // Whether this set overlaps that set.
        Chain.prototype.overlap = function (that) {
            var hasOverlap = false;
            var largeSet = this.length > that.length ? this : that;
            var smallSet = this.length > that.length ? that : this;
            for (var i = 0; i < smallSet.length; i++) {
                if (identify(smallSet.elements[i]) in largeSet.index) {
                    hasOverlap = true;
                    break;
                }
            }
            return hasOverlap;
        };
        // Union of all given sets.
        Chain.union = function (targets) {
            var result = new Chain();
            targets.forEach(function (t) { return t.elements.forEach(function (e) { return result.pushMutation(e); }); });
            return result;
        };
        // Intersection of all given sets.
        Chain.intersection = function (targets) {
            var result = new Chain();
            var tLen = targets.length;
            if (tLen > 0) {
                // For every element of the first target set.
                var es = targets[0].elements;
                var esLen = es.length;
                for (var i = 0; i < esLen; i++) {
                    var el = es[i];
                    // Determine whether element is also in other target sets.
                    var consensus = true;
                    for (var j = 1; j < tLen; j++) {
                        if (identify(el) in targets[j].index) {
                            consensus = false;
                            break;
                        }
                    }
                    // Add to result when shared by all sets.
                    if (consensus) {
                        result.push(el);
                    }
                }
            }
            return result;
        };
        // Difference of two sets.
        Chain.difference = function (source, toExclude) {
            var result = new Chain();
            source.elements.forEach(function (e) {
                if (!(identify(e) in toExclude.index)) {
                    result.pushMutation(e);
                }
            });
            return result;
        };
        return Chain;
    })();
    exports.Chain = Chain;
    // Shallow clone (including function).
    /*export function clone<T>(object: T) {
        return typeof(object) === 'object' ?
            <T> Object['assign'](Object.create(object['__proto__']), object) :
            _.clone(object);
    }*/
    function snapshot(obj) {
        var clone;
        if (obj === null) {
            clone = null;
        }
        else if (typeof (obj) === 'object') {
            if ('clone' in obj) {
                clone = obj['clone']();
            }
            else {
                clone = new obj.constructor();
                for (var key in obj)
                    if (obj.hasOwnProperty(key))
                        clone[key] = snapshot(obj[key]);
            }
        }
        else {
            clone = _.clone(obj, true);
        }
        return clone;
    }
    exports.snapshot = snapshot;
});
//# sourceMappingURL=collection.js.map