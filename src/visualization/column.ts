import { InteractionState, EnrichedState } from '../model';
import { PlacedSnippet, List, Label } from '../core/graphics/snippet';
import { ViewMouseEvent, ViewContext } from '../core/graphics/view';
import { Vector } from '../core/math';

export class ColumnPanel extends List<PlacedSnippet> {
    constructor(identifier: string,
                core: PlacedSnippet,
                state: EnrichedState,
                opened = false) {
        super("cp_" + identifier,
            _.union([new ColumnLabel(identifier, (<any>core['toString'])(opened), opened, state)], opened ? [core] : []),
            [0,0],
            [0,0],
            'vertical',
            state.configuration.panelSpace,
            'middle');
    }
}

class ColumnLabel extends Label {
    constructor(public viewIdentifier: string, text: string, public opened: boolean, state: EnrichedState) {
        super("clLbl_" + viewIdentifier, text, [0,0],
            opened ? state.configuration.panelHeaderOpenLabel : state.configuration.panelHeaderLabel, true);

        if(!opened) {
            this.setDimensions([this.dimensions[1], this.dimensions[0]]);
        }
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        interaction.pushView(this.viewIdentifier);
    }

    paint(context: ViewContext) {
        context.picking = this.pickable;
        context.fillStyle(this.style.color);
        context.font(this.style.font.toString());

        context.save();
        context.translate(this.opened ? this.topLeft : Vector.add(this.topLeft, [0, this.dimensions[1]]));
        context.rotate(this.opened ? 0 : -.5 * Math.PI);
        var dY = 0;
        this.lines.forEach(l => {
            dY += this.style.font.size;
            context.fillText(l, 0, dY);
        });
        context.restore();
    }
}