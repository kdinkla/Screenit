/// <reference path='style.ts' />

import view = require('./view');
import ViewContext = view.ViewContext;
import Snippet = view.Snippet;
import ViewMouseEvent = view.ViewMouseEvent;

import style = require('./style');
import Color = style.Color;
import Font = style.Font;

import math = require('../math');
import Vector = math.Vector;
import Positioned = math.Positioned;
import Dimensional = math.Dimensional;

// Base implementation of snippet.
export class BaseSnippet implements Snippet {
    constructor(public identifier: string) {

    }

    // Do not paint anything.
    paint(context: ViewContext) {

    }

    toString() {
        return this.identifier;
    }
}

// Positioned snippet with dimensions. Abstract class
export class PlacedSnippet extends BaseSnippet implements Dimensional {
    topLeft: number[];
    dimensions: number[];
    topRight: number[];
    bottomLeft: number[];
    bottomRight: number[];

    // Identifier and top left position of snippet.
    constructor(identifier: string, topLeft: number[] = [0, 0]) {
        super(identifier);

        //this.topLeft = topLeft;
        this.dimensions = [0, 0];
        this.setTopLeft(topLeft);
        //this.updatePositions();
    }

    // Sets top left position.
    setTopLeft(topLeft: number[]) {
        this.topLeft = topLeft;
        this.updatePositions();
    }

    // Sets dimensions.
    setDimensions(dimensions: number[]) {
        this.dimensions = dimensions;
        this.updatePositions();
    }

    updatePositions() {
        this.topRight = [this.topLeft[0] + this.dimensions[0], this.topLeft[1]];
        this.bottomLeft = [this.topLeft[0], this.topLeft[1] + this.dimensions[1]];
        this.bottomRight = Vector.add(this.topLeft, this.dimensions);
    }

    // Reference stub for paint.
    /*paint(context: ViewContext) {
        context.save();
        context.translate(this.topLeft);

        context.restore();
    }*/
}

export class List<S extends PlacedSnippet> extends PlacedSnippet {
    constructor(identifier: string,
                public snippets: S[],
                topLeft: number[] = [0, 0],      // Top left corner.
                dimensions: number[] = [0, 0],   // Minimum dimensions.
                public orientation = 'vertical',
                public space = 0,
                public alignment = 'middle') {
        super(identifier, topLeft);

        this.topLeft = topLeft;
        this.dimensions = dimensions;
        this.updateLayout();
    }

    // Also update positions of listed snippets.
    setTopLeft(topLeft: number[]) {
        this.topLeft = topLeft;
        this.updateLayout();
    }

    // Block dimension alteration, for now.
    setDimensions(dimensions: number[]) {
        this.dimensions = dimensions;
        this.updateLayout();
    }

    private updateLayout() {
        if(this.snippets) {
            var lAxis = this.orientation === 'vertical' ? 1 : 0;
            var wAxis = this.orientation === 'vertical' ? 0 : 1;

            // Column width is snippets maximum width.
            var span = this.snippets.length > 0 ? Math.max.apply(null, this.snippets.map(s => s.dimensions[wAxis])) : 0;
            span = Math.max(span, this.dimensions[wAxis]);

            var lAcc = this.topLeft[lAxis];
            this.snippets.forEach(s => {
                var wPos = this.topLeft[wAxis] +
                    (this.alignment === 'right' ? span - s.dimensions[wAxis] :
                        this.alignment === 'middle' ? .5 * (span - s.dimensions[wAxis]) : 0);

                s.setTopLeft(this.orientation === 'vertical' ? [wPos, lAcc] : [lAcc, wPos]);
                s.updatePositions();

                lAcc += s.dimensions[lAxis] + this.space;
            });

            this.dimensions = this.snippets.length > 0 ?
                Vector.subtract(this.snippets[this.snippets.length - 1].bottomRight, this.snippets[0].topLeft) : [0, 0];
            //this.dimensions[lAxis] = Math.max(0, lAcc - this.space);
            this.dimensions[wAxis] = span;
        }

        this.updatePositions();
    }

    paint(context: ViewContext) {
        context.snippets(this.snippets);
    }
}

// Background snippet.
export class Background extends BaseSnippet {
    constructor(public color: Color) {
        super("Background");
    }

    // Paint background.
    paint(context: ViewContext) {
        context.fillStyle(this.color);  // Transition background color.
        context.transitioning = false;  // Guarantee entire display fill.
        context.fillRect(0, 0, context.dimensions[0], context.dimensions[1]); // Clear display.
    }
}

// Basic snippets.
export class Rectangle extends BaseSnippet {
    constructor(public identifier:string,
                public topLeft:number[],
                public size:number[],
                public color:style.Color = style.Color.BLACK,
                public pickable:boolean = false) {
        super(identifier);
    }

    paint(context: ViewContext) {
        context.picking = this.pickable;
        context.save();
        context.fillStyle(this.color);
        context.translate(this.topLeft);
        context.fillRect(0, 0, this.size[0], this.size[1]);
        context.restore();
    }
}

export class Triangle extends BaseSnippet {
    constructor(public identifier: string,
                public coordinates: number[][],
                public color: Color = style.Color.BLACK,
                public pickable: boolean = false) {
        super(identifier);
    }

    paint(context:ViewContext) {
        context.picking = this.pickable;
        context.save();
        context.fillStyle(this.color);
        context.translate(this.coordinates[0]);
        context.beginPath();
        context.moveTo(0, 0);
        var sC = Vector.subtract(this.coordinates[1], this.coordinates[0]);
        context.lineTo(sC[0], sC[1]);
        var fC = Vector.subtract(this.coordinates[2], this.coordinates[0]);
        context.lineTo(fC[0], fC[1]);
        context.closePath();
        context.fill();
        context.restore();
    }
}

// Basic text label.
export class LabelStyle {
    constructor(public font: style.Font = new Font(),
                public color: style.Color = Color.BLACK,
                public horizontalAnchor: string = 'left',
                public verticalAnchor: string = 'top',
                public rotation: number = 0) {
    }
}

export class Label extends PlacedSnippet {
    public lines: string[]; // Wrapped lines.
    public size: number[];  // Dimensions of wrapped text in local space.

    constructor(public identifier: string,
                text: string,
                public position: number[],
                public style: LabelStyle = new LabelStyle(),
                public pickable: boolean = false) {
        super(identifier, position);

        // Multiple lines and their dimension.
        this.lines = style.font.wordWrap(text);
        var dimensions = style.font.wrapDimensions(this.lines);

        // Determine top left position from position and align.
        this.topLeft = Vector.clone(this.position);
        if (this.style.horizontalAnchor === 'middle') this.topLeft[0] -= .5 * this.dimensions[0];
        else if (this.style.horizontalAnchor === 'right') this.topLeft[0] -= this.dimensions[0];
        if (this.style.verticalAnchor === 'middle') this.topLeft[1] += .5 * this.dimensions[1];
        else if (this.style.verticalAnchor === 'top') this.topLeft[1] += this.dimensions[1];

        super.setDimensions(dimensions);
    }

    paint(context: ViewContext) {
        context.picking = this.pickable;
        context.fillStyle(this.style.color);
        context.font(this.style.font.toString());

        context.save();
        context.translate(this.topLeft);
        context.rotate(this.style.rotation);
        var dY = 0;
        this.lines.forEach(l => {
            dY += this.style.font.size;
            context.fillText(l, 0, dY);
        });
        context.restore();
    }
}