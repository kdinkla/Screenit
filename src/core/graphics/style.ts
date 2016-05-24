// Font configuration.
export class Font {
    string: string;

    constructor(
        public size: number = 16,               // Font size.
        public wrapLength: number = 1000) {     // Maximum sentence wrap length, in characters.
        this.string = this.size + "px OpenSans";
    }

    toString() {
        return this.string;
    }

    // Use an off screen canvas to determine text dimensions.
    private static textCanvas: HTMLCanvasElement;

    // The width of the painted text, in pixels.
    width(text: string) {
        var canvas = Font.textCanvas || (Font.textCanvas = document.createElement("canvas"));
        var context = canvas.getContext("2d");
        context.font = this.toString();
        var metrics = context.measureText(text);

        return metrics.width;
    }

    // Cut text into multiple sentences to respect wrapLength.
    wordWrap(text: string): string[] {
        var words = text.split(" ");
        var lines = [];
        words.forEach(wrd => {
            var w = wrd;
            var wWidth = this.width(w);
            while (wWidth > this.wrapLength) {
                w = w.substr(0, w.length - 1);
                wWidth = this.width(w);
            }

            if (!lines.length) {
                lines.push(w);
            } else if (this.width(lines[lines.length - 1] + " ") + wWidth < this.wrapLength) {
                lines[lines.length - 1] += " " + w;
            } else {
                lines.push(w);
            }
        });

        return lines;
    }

    wrapDimensions(lines: string[]): number[] {
        var maxLineLength = Math.max.apply(null, lines.map(l => this.width(l)));
        return [maxLineLength, lines.length * this.size];
    }
}

// RGBA color in [0..255] (maps to CSS rgb string).
export class Color {
    cssString: string;

    // Construct color from red, green, and blue in [0..255].
    constructor(public r: number,
                public g: number,
                public b: number,
                public a: number = 1) {
        this.cssString = "rgba(" + r + "," + g + "," + b + "," + a + ")";
    }

    // Alpha adjusted color.
    alpha(mulAlpha: number): Color {
        return new Color(this.r, this.g, this.b, mulAlpha * this.a);
    }

    // Darken the color by the given factor.
    darken(factor: number) {
        return new Color(
            Math.floor(factor * this.r),
            Math.floor(factor * this.g),
            Math.floor(factor * this.b),
            this.a
        );
    }

    toString() {
        return this.cssString;
    }

    // Interpolate this color with the given color, where s == 0 => this and s == 1 => target.
    interpolate(target: Color, s: number) {
        var nS = 1 - s;
        return new Color(
            Math.round(nS * this.r + s * target.r),
            Math.round(nS * this.g + s * target.g),
            Math.round(nS * this.b + s * target.b),
            nS * this.a + s * target.a
        );
    }

    static fromJSON(data: {}) {
        return new Color(data['r'], data['g'], data['b'], data['a']);
    }

    // Static shortcuts.
    static WHITE    = new Color(255, 255, 255);
    static BLACK    = new Color(0,   0,   0);
    static RED      = new Color(255, 0,   0);
    static CRIMSON  = new Color(165, 28,  48);
    static GREEN    = new Color(0,   255, 0);
    static BLUE     = new Color(0,   0,   255);
    static NONE     = new Color(0,   0,   0, 0);

    // Construct gray-scale value (in [0..255]).
    static grey(v: number, a: number = 1) {
        return new Color(v, v, v, a);
    }

    // 8 color nominal mapping.
    static colorMapNominal8 = [
        new Color(228, 26,  28),
        new Color(55,  126, 184),
        new Color(77,  175, 74),
        new Color(152, 78,  163),
        new Color(255, 127, 0),
        new Color(255, 255, 51),
        new Color(166, 86,  40),
        new Color(247, 129, 191)
    ];

    // 18 color nominal mapping.
    static colorMapNominal18 = [
        new Color(27,  158, 119),
        new Color(217, 95,  2),
        new Color(117, 112, 179),
        new Color(231, 41,  138),
        new Color(102, 166, 30),
        new Color(230, 171, 2),
        new Color(166, 118, 29),
        new Color(102, 102, 102),

        new Color(228, 26,  28),
        new Color(55,  126, 184),
        new Color(77,  175, 74),
        new Color(152, 78,  163),
        new Color(255, 127, 0),
        new Color(255, 255, 51),
        new Color(166, 86,  40),
        new Color(247, 129, 191)
    ];
}