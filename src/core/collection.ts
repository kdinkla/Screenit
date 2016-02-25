/// <reference path="../../typings/tsd.d.ts" />

import _ = require('lodash');

// Map by number.
export interface NumberMap<V> {
    [index: number]: V;
}

// Map by string.
export interface StringMap<E> {
    [index: string]: E;
}

// Create index map for string array.
export function indexMap(keys: string[]): StringMap<number> {
    var result: StringMap<number> = {};

    var len = keys.length;
    for (var i = 0; i < len; i++) {
        result[keys[i]] = i;
    }

    return result;
}

// Swap the elements at the given positions a and b in the given array.
export function swap<E>(array: E[], i: number, j: number) {
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
}

// Push array onto other array.
export function push<E>(target: E[], toPush: E[]) {
    target.push.apply(target, toPush);
}

// Uniquely identified amongst its peers by number or string.
export interface Identifiable {
    toNumber?(): number;
    toString?(): string;
}

export function identify<E extends Identifiable>(element: E): string {
    return element.toString();  //<any>(element.toNumber || element.toString)();
}

// An immutable, ordered set of elements.
export class Chain<E extends Identifiable> {
    elements: E[];
    index: StringMap<E>;
    length: number;

    constructor(elements: E[] = []) {
        this.elements = [];
        this.index = {};
        this.length = 0;
        elements.forEach(e => this.pushMutation(e));
    }

    static fromJSON<E>(data: {}) {
        return new Chain<E>(data['elements']);
    }

    toString() {
        return this.elements.map(e => e.toString()).join(",");
    }

    private pushMutation(e: E) {
        if (!this.index[identify(e)]) {
            this.elements.push(e);
            this.index[identify(e)] = e;
            this.length++;
        }

        return this;
    }

    byId(id: string | number) { return this.index[<any>id]; }
    map<F>(f: (E, number?) => F) { return new Chain<F>(this.elements.map(f)); }
    filter<F>(f: (E, number?) => boolean) { return new Chain<E>(this.elements.filter(f)); }
    forEach(f: (E, number?) => any) { this.elements.forEach(f); }

    // Add an element at the end if it is not present yet.
    push(element: E): Chain<E> {
        return this.clone().pushMutation(element);
    }

    // Add multiple elements at the end if they are not present yet.
    pushAll(elements: E[]): Chain<E> {
        var result = this.clone();
        elements.forEach(e => result.pushMutation(e));
        return result;
    }

    // Remove an element.
    pull(element: E): Chain<E> {
        var id = identify(element);
        return new Chain(this.elements.filter(e => identify(e) !== id));
    }

    // Toggle membership of the given element.
    toggle(element: E): Chain<E> {
        return identify(element) in this.index ? this.pull(element) : this.push(element);
    }

    // Combine with given ordered set, results in new ordered set.
    combine(target: Chain<E>) {
        var result = new Chain<E>();

        result.pushAll(this.elements);
        result.pushAll(target.elements);

        return result;
    }

    // Clone this set.
    clone(): Chain<E> {
        return new Chain<E>(this.elements);
    }

    // Whether the given element is contained.
    has(that: E) {
        return identify(that) in this.index;
    }

    // Whether the given set is contained by the other set.
    contains(that: Chain<E>): boolean {
        var isContained = true;

        for (var i = 0; i < that.elements.length; i++) {
            if (!(identify(that.elements[i]) in this.index)) {
                isContained = false;
                break;
            }
        }

        return isContained;
    }

    // Whether this set overlaps that set.
    overlap(that: Chain<E>): boolean {
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
    }

    // Union of all given sets.
    static union<E extends Identifiable>(targets: Chain<E>[]) {
        var result = new Chain<E>();

        targets.forEach(t => t.elements.forEach(e => result.pushMutation(e)));

        return result;
    }

    // Intersection of all given sets.
    static intersection<E extends Identifiable>(targets: Chain<E>[]): Chain<E> {
        var result = new Chain<E>();

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
    }

    // Difference of two sets.
    static difference<E extends Identifiable>(source: Chain<E>, toExclude: Chain<E>) {
        var result = new Chain<E>();

        source.elements.forEach(e => {
            if (!(identify(e) in toExclude.index)) {
                result.pushMutation(e);
            }
        });

        return result;
    }
}

// Shallow clone (including function).
/*export function clone<T>(object: T) {
    return typeof(object) === 'object' ?
        <T> Object['assign'](Object.create(object['__proto__']), object) :
        _.clone(object);
}*/

export function snapshot<E>(obj: E) {
    var clone: E;

    if(obj === null) {
        clone = null;
    } else if (typeof(obj) === 'object') {
        if('clone' in obj) {
            clone = obj['clone']();
        } else {
            clone = new (<any>obj).constructor();

            for (var key in obj)
                if (obj.hasOwnProperty(key))
                    clone[key] = snapshot(obj[key]);
        }
    } else {
        clone = _.clone(obj, true);
    }

  return clone;
}