import _ = require('lodash');

import bacon = require('bacon');
import EventStream = bacon.EventStream;
import Bus = bacon.Bus;

import { Identifiable, identify, StringMap } from '../collection';
import { Color } from './style';
import { Vector } from '../math';

// Canvas view that supports state transitions while drawing a model of type M.
export class View<M> {
    content: HTMLElement;                     // Paper embedding element.
    canvas: HTMLCanvasElement;                // Canvas element.

    model: M;                                 // Model that is rendered.
    private manager: DrawManager;             // Interpolation manager.

    // View property streams.
    private resizeBus: Bus<ViewResizeEvent>;  // View dimensions upon resize as bus.
    resize: EventStream<ViewResizeEvent>;     // View dimensions as stream.

    // Outbound interaction streams.
    mouseClick: EventStream<ViewMouseEvent>;  // Mouse button has been clicked.
    mouseDown: EventStream<ViewMouseEvent>;   // Mouse button has gone down.
    mouseUp: EventStream<ViewMouseEvent>;     // Mouse button has gone up.
    mouseDrag: EventStream<ViewMouseEvent>;   // Mouse has moved while button is down.
    mouseMove: EventStream<ViewMouseEvent>;   // Mouse has moved while button is up.
    keyPress: EventStream<ViewKeyEvent>;      // Character has been pressed.

    event: EventStream<ViewEvent<any>>;       // Generic view event.

    private mousePos: number[];               // Last known mouse position.
    private hits: MouseHit[];                 // Last known mouse hits.

    // Base constructor, by HTML element id.
    constructor(public htmlId: string) {
        this.htmlId = htmlId;
        var document = window.document;
        this.content = document.getElementById(this.htmlId);
        this.canvas = <any> document.createElement("canvas");
        this.content.appendChild(this.canvas);
        this.manager = new DrawManager();
        this.mousePos = [0, 0];
        this.hits = [];

        // Push property events to subjects.
        this.resizeBus = new Bacon.Bus<ViewResizeEvent>();
        this.resize = this.resizeBus.skipDuplicates(_.isEqual);
        window.addEventListener("resize", () => this.resizeBus.push(new ViewResizeEvent(this.dimensions())));

        // Update mouse hits.
        var jqCanvas = $(this.canvas);
        jqCanvas.mousemove(me => {
            this.mousePos = this.correctHighDPIMouse([
                (me.offsetX || me.pageX - $(me.target).offset().left),
                (me.offsetY || me.pageY - $(me.target).offset().top)
            ]);
            this.update();
        });

        document.oncontextmenu = () => false;   // Circumvent mouse context menu.
        this.mouseClick = Bacon.fromEventTarget<MouseEvent>(this.canvas, 'click')
            .map(e => new ViewMouseEvent(e, 'mouseClick', this.mousePos, this.hits));
        this.mouseDown = Bacon.fromEventTarget<MouseEvent>(this.canvas, 'mousedown')
            .map(e => new ViewMouseEvent(e, 'mouseDown', this.mousePos, this.hits));
        this.mouseUp = Bacon.fromEventTarget<MouseEvent>(this.canvas, 'mouseup')
            .map(e => new ViewMouseEvent(e, 'mouseUp', this.mousePos, this.hits));
        this.mouseDrag = Bacon.fromEventTarget<MouseEvent>(this.canvas, 'mousemove')
            .filter(e => this.detectLeftButton(e))
            .map(e => new ViewMouseEvent(e, 'mouseDrag', this.mousePos, this.hits));
        this.mouseMove = Bacon.fromEventTarget<MouseEvent>(this.canvas, 'mousemove')
            .filter(e => !this.detectLeftButton(e))
            .map(e => new ViewMouseEvent(e, 'mouseMove', this.mousePos, this.hits));

        $(document).on("keydown", function (e) {
            if (e.which === 8 && !$(e.target).is("input:not([readonly]), textarea")) {
                e.preventDefault();
            }
        });
        this.keyPress = Bacon.fromEventTarget<KeyboardEvent>(document, 'keydown').map(e => new ViewKeyEvent(e));

        // Generic view events.
        this.event = Bacon.mergeAll<ViewEvent<any>>([
            this.resize,
            this.mouseClick,
            this.mouseDown,
            this.mouseUp,
            this.mouseDrag,
            this.mouseMove, // Ignore mouse movements (hover over).
            this.keyPress]);
    }

    // Update the view (as long as it is required to complete animations).
    private updater;
    private updateTime:number;

    update(model: M = null) {
        if(model) {
            this.model = model;
            this.updateScene(model);
        }
        this.updateTime = new Date().getTime();
        if (!this.updater && model) this.updater = window.setInterval(() => this.updateCycle(), 30);
    }

    // To be implemented in subclass.
    updateScene(model: M) {

    }

    private updateCycle() {
        var man = this.manager;

        var context: CanvasRenderingContext2D = <any> this.canvas.getContext('2d');
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.textBaseline = "bottom";

        // Adjust canvas scaling and dimensions for high-DPI screens.
        this.correctHighDPI(context);

        // Pre draw.
        var nT = new Date().getTime();  // Determine the time passed since last draw.
        man.dT = Math.min(1000 / 30, man.oT ? (nT - man.oT) : 1000 / 30);
        man.oT = nT;
        man.snippetList.forEach(sV => {  // Initialize snippet values.
            sV.drawn = false;
            sV.ti = 0;
        });

        var viewContext = new ViewContext(context, man, this.dimensions(), this.mousePos);
        viewContext.transitioning = false; // No parameter interpolation outside of snippets.
        viewContext.picking = false;

        // Subclass paint.
        this.paint(viewContext, this.model);

        // Post draw.
        // Fade away and/or remove redundant snippets.
        var toRemove: SnippetValues[] = [];
        man.snippetList.forEach(sV => {
            // Fade in.
            if(sV.drawn) {
                sV.presence = sV.transitioning ?
                    Math.min(1, sV.presence + man.dT / DrawManager.pD) :
                    1;
            }
            else {
                // Remove.
                if(sV.presence < 0.1) {
                    toRemove.push(sV);
                }
                // Fade out.
                else {
                    sV.presence = sV.transitioning ?
                        sV.presence - man.dT / DrawManager.pD :
                        0;
                }
            }
        });

        toRemove.forEach((sV) => {
            //delete man.snippets[sV.id];
            man.snippets[sV.id] = null;
            var endSnip = man.snippetList.pop();
            if(endSnip.id !== sV.id) {
                man.snippetList[sV.index] = endSnip;
                endSnip.index = sV.index;
            }
        });

        // Draw non-drawn snippets.
        man.snippetList.forEach(sV => {
            if (!sV.drawn) {
                // Apply last known transformation and style.
                var t = sV.transform;
                context.setTransform(t[0], t[1], t[2], t[3], t[4], t[5]);

                // Draw snippet, push to back.
                if(sV.args) {
                    sV.args.forEach(as =>
                        viewContext.snippet.apply(viewContext, _.union([sV.instance], as)));
                } else viewContext.snippet(sV.instance);
            }
        });

        // Update mouse hits and cursor.
        this.hits = viewContext.hits;
        this.canvas.style.cursor = this.hits.length > 0 ? "pointer" : "default";


        // Terminate updates.
        if (nT > this.updateTime + 10 * (DrawManager.mD + DrawManager.pD)) {
            window.clearInterval(this.updater);
            this.updater = null;
        }
    }

    // Adjust canvas scaling and dimensions for high-DPI screens.
    private pixelRatio = 1;
    private storeRatio = 1;
    private correctHighDPI(context: CanvasRenderingContext2D) {
        this.pixelRatio = window.devicePixelRatio || 1;    // Device pixel ratio, fallback to 1.
        this.storeRatio =                                  // Determine the 'backing store ratio' of the canvas context.
            context['webkitBackingStorePixelRatio'] ||
            context['mozBackingStorePixelRatio'] ||
            context['msBackingStorePixelRatio'] ||
            context['oBackingStorePixelRatio'] ||
            context['backingStorePixelRatio'] ||
            1;
        var scaleRatio = this.pixelRatio / this.storeRatio;  // Determine the actual ratio we want to draw at.

        // Scale up area of canvas.
        this.canvas.width = Math.ceil(this.content.offsetWidth * scaleRatio);
        this.canvas.height = Math.ceil(this.content.offsetHeight * scaleRatio);

        // Fix dimensions of the actual canvas via CSS.
        this.canvas.style.width = this.content.offsetWidth + 'px';
        this.canvas.style.height = this.content.offsetHeight + 'px';

        // Scale the drawing context so everything will work at the higher ratio.
        context.scale(scaleRatio, scaleRatio);
    }

    private correctHighDPIMouse(pos: number[]) {
        return Vector.mul(pos, this.pixelRatio / this.storeRatio);
    }

    // Off-screen buffer draw helper function.
    static renderToCanvas(width: number, height: number, renderFunction: (ctx: CanvasRenderingContext2D) => any) {
        var buffer = document.createElement('canvas');
        var ctx = buffer.getContext('2d');

        var pixelRatio = window.devicePixelRatio || 1;    // Device pixel ratio, fallback to 1.
        var storeRatio =                                  // Determine the 'backing store ratio' of the canvas context.
            ctx['webkitBackingStorePixelRatio'] ||
            ctx['mozBackingStorePixelRatio'] ||
            ctx['msBackingStorePixelRatio'] ||
            ctx['oBackingStorePixelRatio'] ||
            ctx['backingStorePixelRatio'] ||
            1;

        var scaleRatio = pixelRatio / storeRatio;
        buffer.width = Math.ceil(width * scaleRatio);
        buffer.height = Math.ceil(height * scaleRatio);
        buffer['originalWidth'] = width;
        buffer['originalHeight'] = height;

        ctx.scale(scaleRatio, scaleRatio);
        renderFunction(ctx);

        return buffer;
    }

    // Implemented by sub-class to paint.
    paint(context: ViewContext, scene: M) {

    }

    // Determine whether left button is pressed from mouse event.
    detectLeftButton(event:MouseEvent):boolean {
        var isPressed;

        if ('buttons' in event) {
            isPressed = event.buttons === 1;
        } else if ('which' in event) {
            isPressed = event.which === 1;
        } else {
            isPressed = event.button === 1;
        }

        return isPressed
    }

    // Full canvas dimensions.
    dimensions(): number[] {
        return [this.content.offsetWidth, this.content.offsetHeight];
    }
}

// Request animation frame fallback
window["requestAnimFrame"] = window.requestAnimationFrame || (cb => window.setTimeout(cb, 1000 / 30));

export class ViewEvent<E> {
    constructor(public event: E, public type: string) {
    }

    onMouse(action: (event?: ViewMouseEvent, position?: number[], topHitId?: string, hits?: MouseHit[]) => any) {}
    onResize(action: (dimensions?: number[]) => any) {}
    onKey(action: (event?: KeyboardEvent) => any) {}
}

export class ViewMouseEvent extends ViewEvent<MouseEvent> {
    public topHit: MouseHit;

    constructor(public event: MouseEvent,   // Parent mouse event.
                public type: string,
                public position: number[],  // Absolute mouse position.
                public hits: MouseHit[]     // Hit snippets.
    ) {
        super(event, type);

        this.topHit = this.hits.length > 0 ? this.hits[this.hits.length - 1] : <any>null;
    }

    // Delegate.
    onMouse(action: (event?: ViewMouseEvent, position?: number[], topHitId?: string, hits?: MouseHit[]) => any) {
        action(this, this.position, this.topHit ? this.topHit.snippet.toString() : null, this.hits);
    }
}

class MouseHit {
    constructor(public snippet: Snippet,
                public local: number[],     // Local mouse position.
                public normalized: number[] // Normalized local mouse position.
        ) { }
}

export class ViewResizeEvent extends ViewEvent<DocumentEvent> {
    constructor(public dimensions: number[]) {
        super(null, 'resize');
    }

    // Delegate.
    onResize(action: (dimensions?: number[]) => any) {
        action(this.dimensions);
    }
}

export class ViewKeyEvent extends ViewEvent<KeyboardEvent> {
    constructor(public event: KeyboardEvent) {
        super(event, 'key');
    }

    // Delegate.
    onKey(action: (event?: KeyboardEvent) => any) {
        action(this.event);
    }
}

// Manages the interpolation for a view.
class DrawManager {
    static mD = 100;   // Movement duration.
    static pD = 500;   // Presence duration.

    snippets: StringMap<SnippetValues> = {}; // Mapping of snippets to managed values.
    snippetList: SnippetValues[] = [];       // Fast snippet lookup.
    oT: number;                              // Time point of last global draw.
    dT: number;                              // Time difference since last global draw.
}

// Identifiable piece of graphics.
export interface Snippet extends Identifiable {
    // Paint to a view context. To implement in sub class.
    paint(context: ViewContext, ...args: any[]);

    // Possible interaction mutations.
    mouseClick?(event: ViewMouseEvent, coordinates: number[], ...state: any[]);
    mouseDown?(event: ViewMouseEvent, coordinates: number[], ...states: any[]);
    mouseUp?(event: ViewMouseEvent, coordinates: number[], ...states: any[]);
    mouseDrag?(event: ViewMouseEvent, coordinates: number[], ...states: any[]);
    mouseMove?(event: ViewMouseEvent, coordinates: number[], ...states: any[]);
}

// Additional information that is maintained for a snippet during its lifespan.
class SnippetValues {
    id: string;                                     // Identifier;
    instance: Snippet;                              // Last drawn snippet.
    index: number;                                  // Position of snippet in list.
    ti: number = 0;                                 // Index counter of transitioned values for drawn snippet.
    drawn = false;                                  // Whether snippet has been drawn (for fade-out).
    presence = -DrawManager.mD / DrawManager.pD;    // Extent of presence in the scene, includes delay.
    intermediates: Intermediate[] = [];             // Intermediate state of doubles that are transitioned over.
    transform = [0, 0, 0, 0, 0, 0];                 // Last known transformation matrix.
    transitioning = true;                           // Last known transitioning value.
    args: any[][] = [];                             // All instance call arguments.
}

class Intermediate {
    constructor(public value: number, public change: number) { }
}

export class ViewContext {
    private sV: SnippetValues;  // Active snippet values.
    private mouseR: number[];   // Mouse position in local space.
    hits: MouseHit[];           // Mouse hit snippet identifiers.

    transitioning: boolean;     // Whether parameters are transitioned for snippet.
    picking: boolean;           // Whether snippet is pickable.

    private dT: number;
    private mD: number;
    private mD2: number;

    private fontHeight: number;

    constructor(public context: CanvasRenderingContext2D,
                public manager: DrawManager,
                public dimensions: number[],    // Canvas dimensions.
                public mouse: number[]          // Absolute mouse position.
    ) {
        this.hits = [];
        this.updateMouse();

        this.dT = manager.dT;
        this.mD = DrawManager.mD;
        this.mD2 = this.mD * this.mD;
    }

    // Set interpolation checkpoint by identifier.
    snippet(snippet: Snippet, ...args: any[]) {
        if(!snippet) return;

        var id = identify(snippet);
        var man = this.manager;

        // Set snippet values context.
        this.sV = man.snippets[id];
        if(!this.sV) {
            this.sV = new SnippetValues();
            man.snippets[id] = this.sV;
            this.sV.id = id;
            this.sV.index = man.snippetList.length;
            man.snippetList.push(this.sV);
        }

        if(!this.sV.drawn) this.sV.args = [];               // Refresh argument list.

        this.sV.drawn = true;                               // Is drawn.
        this.sV.instance = snippet;                         // Update last drawn snippet.
        this.sV.transform = this.context['getTransform'](); // Initial transform of last draw.
        if(args.length) this.sV.args.push(_.clone(args));   // Push instance arguments.
        this.transitioning = true;                          // Parameter interpolation enabled by default.
        this.picking = false;                               // Picking disabled by default.

        if(args.length) snippet.paint.apply(snippet, _.flatten([this, args], true));
        else snippet.paint(this);

        this.sV.transitioning = this.transitioning;         // Update last transitioning value.
    }

    snippets(snippets: Snippet[], ...args: any[]) {
        if(!snippets) return;
        if(args.length) snippets.forEach(s =>
            this.snippet.apply(this, _.flatten([s, args], true)));
        else snippets.forEach(s => this.snippet(s));
    }

    // Transition value to target, returns intermediate.
    t(target: number): number {
        var sV = this.sV;
        if(sV) {
            if (this.transitioning) {
                var im: Intermediate = sV.intermediates[sV.ti];
                if (!im) {
                    im = new Intermediate(target, 0);   // TODO: change to latest queued value?
                    sV.intermediates.push(im);
                }

                var d = target - im.value;      // Apply acceleration.
                im.change += this.dT * (d - (2 * im.change * this.mD)) / this.mD2;
                var ad = this.dT * im.change;   // Apply velocity.
                im.value = ad > 0 ? Math.min(target, im.value + ad) : Math.max(target, im.value + ad);

                sV.ti++; // Increment for next transition.
            } else {
                //im.value = target;
                return target;
            }
        } else {
            return target;
        }

        return im.value;
    }

    // Interpolate color to CSS string.
    private tColor(color: Color): string {
        return "rgba(" +
            Math.round(this.t(color.r)) + "," +
            Math.round(this.t(color.g)) + "," +
            Math.round(this.t(color.b)) + "," +
            (this.t(color.a) * (this.sV ? this.sV.presence : 0)).toFixed(2) + ")";  // Transparency by presence.
    }

    // Update mouse position in local space.
    private updateMouse() {
        var t = this.context['getTransform']();
        var d = 1 / (t[0] * t[3] - t[1] * t[2]);
        var iT: number[] =
            [d * t[3],
             d * -t[1],
             d * -t[2],
             d * t[0],
             d * (t[2] * t[5] - t[3] * t[4]),
             d * (t[1] * t[4] - t[0] * t[5])];
        this.mouseR = [this.mouse[0] * iT[0] + this.mouse[1] * iT[2] + iT[4],
                       this.mouse[0] * iT[1] + this.mouse[1] * iT[3] + iT[5]];
    }

    // Push mouse hit, if there is a snippet.
    private pushHit(normalized: number[] = null) {
        if(this.picking && this.sV)
            this.hits.push(new MouseHit(this.sV.instance, this.mouseR, normalized));
    }

    // Delegate context functions, including interpolation.
    strokeStyle(color: Color) {
        this.context.strokeStyle = this.tColor(color);
    }

    lineWidth(width: number) {
        this.context.lineWidth = this.t(width);
    }

    setLineDash(segments: number[]) {
        this.context.setLineDash(segments);
    }

    globalAlpha(alpha: number) {
        this.context.globalAlpha = this.t(alpha);
    }

    stroke() {
        this.context.stroke();
    }

    fillStyle(color: Color) {
        this.context.fillStyle = this.tColor(color);
    }

    fill() {
        this.context.fill();

        // Mouse hit.
        if(this.context.isPointInPath(this.mouse[0], this.mouse[1]))
            this.pushHit();
    }

    translate(d: number[]) {
        this.context.translate(this.t(d[0]), this.t(d[1]));
        this.updateMouse();
    }

    rotate(dr: number) {
        this.context.rotate(this.t(dr));
        this.updateMouse();
    }

    scale(dx: number, dy: number) {
        this.context.scale(this.t(dx), this.t(dy));
        this.updateMouse();
    }

    save() {
        this.context.save();
    }

    restore() {
        this.context.restore();
        this.updateMouse();
    }

    strokeRect(x: number, y: number, w: number, h: number) {
        this.context.strokeRect(this.t(x), this.t(y), this.t(w), this.t(h));
    }

    fillRect(x: number, y: number, w: number, h: number) {
        this.context.fillRect(this.t(x), this.t(y), this.t(w), this.t(h));

        // Mouse hit.
        if(x <= this.mouseR[0] && y <= this.mouseR[1] &&
           this.mouseR[0] <= x + w && this.mouseR[1] <= y + h)
            this.pushHit([this.mouseR[0] / w, this.mouseR[1] / h]);
    }

    strokeRoundRect(x: number,
                    y: number,
                    width: number,
                    height: number,
                    radius: number) {
        this.beginPath();
        this.moveTo(x + radius, y);
        this.arcTo(x + width, y, x + width, y + height, radius);
        this.arcTo(x + width, y + height, x, y + height, radius);
        this.arcTo(x, y + height, x, y, radius);
        this.arcTo(x, y, x + width, y, radius);
        this.closePath();

        this.stroke();
    }

    fillRoundRect(x: number,
                  y: number,
                  width: number,
                  height: number,
                  radius: number) {
        this.beginPath();
        this.moveTo(x + radius, y);
        this.arcTo(x + width, y, x + width, y + height, radius);
        this.arcTo(x + width, y + height, x, y + height, radius);
        this.arcTo(x, y + height, x, y, radius);
        this.arcTo(x, y, x + width, y, radius);
        this.closePath();

        this.fill();
    }

    strokeLine(pos1: number[], pos2: number[]) {
        this.context.beginPath();
        this.context.moveTo(this.t(pos1[0]), this.t(pos1[1]));
        this.context.lineTo(this.t(pos2[0]), this.t(pos2[1]));
        this.context.stroke();
    }

    strokeEllipse(cx:number, cy:number, rw:number, rh:number) {
        this.context.beginPath();
        this.ellipse(cx, cy, rw, rh);
        this.context.stroke();
    }

    fillEllipse(cx:number, cy:number, rw:number, rh:number) {
        this.context.beginPath();
        this.ellipse(cx, cy, rw, rh);
        this.context.fill();

        // Mouse hit.
        if (Vector.Euclidean(Vector.subtract([cx, cy], [this.mouseR[0], this.mouseR[1]])) <= 0.5 * (rw + rh))
            this.pushHit();
    }

    // Ellipse path with fallback.
    private ellipse(cx: number, cy: number, w: number, h: number) {
        if(this.context['ellipse']) {
            this.context['ellipse'](this.t(cx), this.t(cy), this.t(w), this.t(h), 0, 2 * Math.PI, false);
        } else {
            this.context.save();
            this.context.translate(this.t(cx), this.t(cy));
            this.context.scale(this.t(w), this.t(h));
            this.context.arc(0, 0, 1, 0, 2 * Math.PI, false);
            this.context.restore();
        }
    }

    beginPath() {
        this.context.beginPath();
    }

    closePath() {
        this.context.closePath();
    }

    moveTo(x: number, y: number) {
        this.context.moveTo(this.t(x), this.t(y));
    }

    lineTo(x: number, y: number) {
        this.context.lineTo(this.t(x), this.t(y));
    }

    arc(x, y, radius, startRadius, endRadius) {
        this.context.arc(this.t(x), this.t(y), this.t(radius), this.t(startRadius), this.t(endRadius));
    }

    arcTo(x1: number, y1: number, x2: number, y2: number, radius) {
        this.context.arcTo(this.t(x1), this.t(y1), this.t(x2), this.t(y2), this.t(radius));
    }

    font(font: string) {
        this.context.font = font;   // Do not interpolate; nasty scale effects are probable.
        this.fontHeight = Number(this.context.font.split("px")[0]);
    }

    fillText(text: string, x: number = 0, y: number = 0) {
        this.context.fillText(text, this.t(x), this.t(y));

        // Mouse hit.
        var w = this.context.measureText(text).width;
        if(x <= this.mouseR[0] && y - this.fontHeight <= this.mouseR[1] &&
            this.mouseR[0] <= x + w && this.mouseR[1] <= y)
            this.pushHit();
    }

    strokeText(text: string, x: number = 0, y: number = 0) {
        this.context.strokeText(text, this.t(x), this.t(y));

        // Mouse hit.
        var w = this.context.measureText(text).width;
        if(x <= this.mouseR[0] && y - this.fontHeight <= this.mouseR[1] &&
           this.mouseR[0] <= x + w && this.mouseR[1] <= y)
            this.pushHit();
    }

    textAlign(align: string) {
        this.context.textAlign = align;
    }

    textBaseline(baseline: string) {
        this.context.textBaseline = baseline;
    }

    drawImage(img: any, pos: number[] = [0, 0]) {
        if(img['originalWidth']) {
            this.drawImageScaled(img, pos, [img['originalWidth'], img['originalHeight']]);
        } else {
            var oldAlpha = this.context.globalAlpha;
            this.context.globalAlpha = Math.max(0, this.sV.presence);

            this.context.drawImage(img, this.t(pos[0]), this.t(pos[1]));

            // Mouse hit.
            if (pos[0] <= this.mouseR[0] && pos[1] <= this.mouseR[1] &&
                this.mouseR[0] <= pos[0] + img.width && this.mouseR[1] <= pos[1] + img.height)
                this.pushHit();

            this.context.globalAlpha = oldAlpha;
        }
    }

    drawImageScaled(img: any, pos: number[], dim: number[]) {
        var oldAlpha = this.context.globalAlpha;
        this.context.globalAlpha = Math.max(0, this.sV.presence);

        this.context.drawImage(img, this.t(pos[0]), this.t(pos[1]), this.t(dim[0]), this.t(dim[1]));

        // Mouse hit.
        if (pos[0] <= this.mouseR[0] && pos[1] <= this.mouseR[1] &&
            this.mouseR[0] <= pos[0] + dim[0] && this.mouseR[1] <= pos[1] + dim[1])
            this.pushHit();

        this.context.globalAlpha = oldAlpha;
    }

    drawImageClipped(img: any, spos: number[], sdim: number[],
                     pos: number[], dim: number[]) {
        var oldAlpha = this.context.globalAlpha;
        this.context.globalAlpha = Math.max(0, this.sV.presence);

        this.context.drawImage(img,
            spos[0], spos[1], sdim[0], sdim[1],
            this.t(pos[0]), this.t(pos[1]), this.t(dim[0]), this.t(dim[1]));

        // Correct mouse coordinates for image scaling.
        this.mouseR = [this.mouseR[0] * sdim[0] / dim[0], this.mouseR[1] * sdim[1] / dim[1]];

        // Mouse hit. TODO: scale.
        if (pos[0] <= this.mouseR[0] && pos[1] <= this.mouseR[1] &&
            this.mouseR[0] <= pos[0] + sdim[0] && this.mouseR[1] <= pos[1] + sdim[1])
            this.pushHit();

        this.context.globalAlpha = oldAlpha;
    }
}

/**
 * Get transformation addition.
 * Copyright 2012- Takeshi Arabiki
 * License: MIT License (http://opensource.org/licenses/MIT)
 */
(function() {
    CanvasRenderingContext2D.prototype["_transform"] = [1, 0, 0, 1, 0, 0];
    CanvasRenderingContext2D.prototype["_transforms"] = [];

    CanvasRenderingContext2D.prototype["getTransform"] = function() {
        return this._transform;
    };

    var restore = CanvasRenderingContext2D.prototype.restore;
    CanvasRenderingContext2D.prototype.restore = function() {
        this._transform = this._transforms.pop() || [1, 0, 0, 1, 0, 0];
        restore.apply(this);
    };

    // |   |   |                            | |   |
    // | x'|   | cos(angle)  -sin(angle)  0 | | x |
    // |   |   |                            | |   |
    // | y'| = | sin(angle)   cos(angle)  0 | | y |
    // |   |   |                            | |   |
    // | 1 |   |     0             0      1 | | 1 |
    // |   |   |                            | |   |
    var rotate = CanvasRenderingContext2D.prototype.rotate;
    CanvasRenderingContext2D.prototype.rotate = function(angle) {
        var t = [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0];
        this._transform = multiplyTransform(this._transform, t);
        rotate.apply(this, arguments);
    };

    var save = CanvasRenderingContext2D.prototype.save;
    CanvasRenderingContext2D.prototype.save = function() {
        this._transforms.push(this._transform.slice());
        save.apply(this);
    };

    // |   |   |         | |   |
    // | x'|   | sx 0  0 | | x |
    // |   |   |         | |   |
    // | y'| = | 0  sy 0 | | y |
    // |   |   |         | |   |
    // | 1 |   | 0  0  1 | | 1 |
    // |   |   |         | |   |
    var scale = CanvasRenderingContext2D.prototype.scale;
    CanvasRenderingContext2D.prototype.scale = function(sx, sy) {
        this._transform = multiplyTransform(this._transform, [sx, 0, 0, sy, 0, 0]);
        scale.apply(this, arguments);
    };

    var setTransform = CanvasRenderingContext2D.prototype.setTransform;
    CanvasRenderingContext2D.prototype.setTransform = function(a, b, c, d, e, f) {
        this._transform = Array.prototype.slice.apply(arguments);
        setTransform.apply(this, arguments);
    };

    // |   |   |          | |   |
    // | x'|   | 1  0  tx | | x |
    // |   |   |          | |   |
    // | y'| = | 0  1  ty | | y |
    // |   |   |          | |   |
    // | 1 |   | 0  0  1  | | 1 |
    // |   |   |          | |   |
    var translate = CanvasRenderingContext2D.prototype.translate;
    CanvasRenderingContext2D.prototype.translate = function(tx, ty) {
        this._transform = multiplyTransform(this._transform, [1, 0, 0, 1, tx, ty]);
        translate.apply(this, arguments);
    };

    // |   |   |         | |   |
    // | x'|   | a  c  e | | x |
    // |   |   |         | |   |
    // | y'| = | b  d  f | | y |
    // |   |   |         | |   |
    // | 1 |   | 0  0  1 | | 1 |
    // |   |   |         | |   |
    var transform = CanvasRenderingContext2D.prototype.transform;
    CanvasRenderingContext2D.prototype.transform = function(a, b, c, d, e, f) {
        this._transform = multiplyTransform.call(this, this._transform, arguments);
        transform.apply(this, arguments);
    };

    // ctx.transform.apply(ctx, t1)
    // ctx.transform.apply(ctx, t2)
    // => ctx.transform.apply(ctx, multiplyTransform(t1, t2))
    var multiplyTransform = function(t1, t2) {
        return [
                t1[0] * t2[0] + t1[2] * t2[1],
                t1[1] * t2[0] + t1[3] * t2[1],
                t1[0] * t2[2] + t1[2] * t2[3],
                t1[1] * t2[2] + t1[3] * t2[3],
                t1[0] * t2[4] + t1[2] * t2[5] + t1[4],
                t1[1] * t2[4] + t1[3] * t2[5] + t1[5]
        ];
    };
})();