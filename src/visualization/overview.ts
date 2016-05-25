import jsts = require('jsts');

import { EnrichedState, viewCycle } from '../model';
import { View, ViewContext } from '../core/graphics/view';
import { PlacedSnippet, List } from '../core/graphics/snippet';
import { ColumnPanel } from './column';
import { DataSetList } from './datasets';
import { PlateIndex } from './plates';
import { WellView } from './wells';
import { FeatureHistogramTable } from './features';
import { ExemplarTable } from './exemplars';
import { Color } from '../core/graphics/style';

export class OverView extends View<EnrichedState> {
    panelColumns: List<PlacedSnippet>;

    constructor() {
        super("overView");
    }

    updateScene(state: EnrichedState) {
        var cfg = state.configuration;
        var columnConstructors = {
            'datasets':     DataSetList,
            'plates':       PlateIndex,
            'wells':        WellView,
            'exemplars':    ExemplarTable,
            'features':     FeatureHistogramTable
        };

        // Active panels.
        var openPanels = viewCycle.map(ov =>
            new ColumnPanel(ov, new columnConstructors[ov](state), state, state.openViews.has(ov)));
        this.panelColumns = new List("pnlCols", openPanels, [0,0], [0,0], 'horizontal', cfg.panelSpace, 'left');

        //console.log("State:");
        //console.log(state);
    }

    paint(c: ViewContext, state: EnrichedState) {
        var cfg = state.configuration;

        // Center panels.
        this.panelColumns.setTopLeft([
            Math.min(.5 * (this.dimensions()[0] - this.panelColumns.dimensions[0]),
                    this.dimensions()[0] - this.panelColumns.dimensions[0] - cfg.windowMargin),
            cfg.panelSpace
        ]);
        c.snippet(this.panelColumns);

        // Show data loading text, or filtering text.
        var isLoading = _.keys(state).filter(prp => state[prp] && _.isBoolean(state[prp]['converged'])).some(prp => !state[prp].converged);
        var secondsMod = Math.round(Date.now() / 1000) % 3;
        c.save();

        c.strokeStyle(isLoading ? cfg.backgroundColor : Color.NONE);
        c.lineWidth(3);
        c.font(cfg.bigFont.toString());
        c.textBaseline('bottom');
        c.textAlign('left');

        var compTxt = 'Computing' + (secondsMod === 1 ? '.' : secondsMod === 2 ? '..' : '...');

        c.transitioning = false;
        c.translate([.5 * this.dimensions()[0] - 20, this.dimensions()[1] - cfg.windowMargin]);
        c.transitioning = true;

        // Show computation text.
        c.fillStyle(isLoading ? cfg.base : Color.NONE);
        c.strokeText(compTxt);
        c.fillText(compTxt);

        c.restore();
    }
}