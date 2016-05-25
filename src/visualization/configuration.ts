import { InteractionState, EnrichedState } from '../model';
import { PlacedSnippet, List, Label, LabelStyle } from '../core/graphics/snippet';
import { ViewMouseEvent, ViewContext } from '../core/graphics/view';
import { StringMap } from '../core/collection';

export class ConfigurationOptions extends PlacedSnippet {
    buttons: List<ConfigurationButton>;

    constructor(identifier: string,
                topLeft: number[],
                public targetState: InteractionState,
                public targetField: string,
                public targetMap: StringMap<any>) {
        super(identifier, topLeft);

        var cfg = targetState.configuration;
        var baseStyle: LabelStyle = new LabelStyle(cfg.annotationFont, cfg.baseDim, 'left', 'top');
        var selectedStyle: LabelStyle = new LabelStyle(cfg.annotationFont, cfg.baseEmphasis, 'left', 'top');

        var buttonSnippets = _.pairs(targetMap).map((p, pI) => {
            var label = p[0];
            var value = p[1];

            // Default to first option.
            var style = cfg[targetField] === value || (!cfg[targetField] && pI === 0) ? selectedStyle : baseStyle;

            return new ConfigurationButton(identifier + "_" + value, label, topLeft, targetField, value, style);
        });

        this.buttons = new List(identifier + "_lst", buttonSnippets, topLeft, [0, 0], 'horizontal', 5, 'top');
        this.setDimensions(this.buttons.dimensions);
    }

    setTopLeft(topLeft: number[]) {
        super.setTopLeft(topLeft);

        if(this.buttons) this.buttons.setTopLeft(topLeft);
    }

    paint(context: ViewContext) {
        context.snippet(this.buttons);
    }
}

class ConfigurationButton extends Label {
    constructor(identifier: string,
                text: string,
                position: number[],
                public targetField: string,
                public targetValue: any,
                style: LabelStyle) {
        super(identifier, text, position, style, true);
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        interaction.configuration[this.targetField] = this.targetValue;
    }
}