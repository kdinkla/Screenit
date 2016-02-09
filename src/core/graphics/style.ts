// Font configuration.
export class Font {
    string: string;

    constructor(public size: number = 16, public wrapLength: number = 1000) {
        this.string = this.size + "px OpenSans";
    }

    toString() {
        return this.string;
    }

    private static textCanvas:HTMLCanvasElement;

    width(text: string) {
        var canvas = Font.textCanvas ||
            (Font.textCanvas = document.createElement("canvas"));
        var context = canvas.getContext("2d");
        context.font = this.toString();
        var metrics = context.measureText(text);

        return metrics.width;
    }

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

// RGB color in [0..255] (maps to CSS rgb string).
export class Color {
    cssString: string;

    // Construct color from red, green, and blue in [0..255].
    constructor(public r:number,
                public g:number,
                public b:number,
                public a:number = 1) {
        this.cssString = "rgba(" + r + "," + g + "," + b + "," + a + ")";
    }

    // Alpha adjusted color.
    alpha(mulAlpha:number):Color {
        return new Color(this.r, this.g, this.b, mulAlpha * this.a);
    }

    toString() {
        return this.cssString;
    }

    interpolate(target:Color, s:number) {
        var nS = 1 - s;
        return new Color(
            Math.round(nS * this.r + s * target.r),
            Math.round(nS * this.g + s * target.g),
            Math.round(nS * this.b + s * target.b),
            nS * this.a + s * target.a);
    }

    // Static shortcuts.
    static WHITE = new Color(255, 255, 255);
    static BLACK = new Color(0, 0, 0);
    static RED = new Color(255, 0, 0);
    static CRIMSON = new Color(165, 28, 48);
    static GREEN = new Color(0, 255, 0);
    static BLUE = new Color(0, 0, 255);
    static NONE = new Color(0, 0, 0, 0);

    // Construct gray-scale value (in [0..255]).
    static grey(v:number, a:number = 1) {
        return new Color(v, v, v, a);
    }

    // Colorbrewer 12 nominal value color mapping.
    static colorMapNominal12 =
        [new Color(190, 186, 218),
            new Color(251, 128, 114),
            new Color(128, 177, 211),
            new Color(253, 180, 98),
            new Color(179, 222, 105),
            new Color(252, 205, 229),
            new Color(188, 128, 189),
            new Color(204, 235, 197),
            new Color(255, 237, 111),
            new Color(141, 211, 199),
            new Color(255, 255, 179)];

    static colorMapNominal8 =
        [new Color(228, 26, 28),
            new Color(55, 126, 184),
            new Color(77, 175, 74),
            new Color(152, 78, 163),
            new Color(255, 127, 0),
            new Color(255, 255, 51),
            new Color(166, 86, 40),
            new Color(247, 129, 191)];
}