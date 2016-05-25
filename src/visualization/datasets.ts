import { InteractionState, EnrichedState } from '../model';
import { PlacedSnippet, List, Label } from '../core/graphics/snippet';
import { ViewMouseEvent } from '../core/graphics/view';

// Plain list of available data sets.
export class DataSetList extends List<PlacedSnippet> {
    constructor(public state: EnrichedState) {
        super("dataSetList",
            state.dataSets.value
                .filter(ds => ds !== state.selectedCoordinates.dataSet)
                .map(ds => new DataSetLabel(ds, state)),
            [0,0],
            [0,0],
            'vertical',
            state.configuration.featureCellSpace[0]
        );
    }

    toString() {
        return "Screen: " + this.state.selectedCoordinates.dataSet;
    }
}

// Text label of single data set.
class DataSetLabel extends Label {
    constructor(public dataSet: string, state: EnrichedState) {
        super("clLbl_" + dataSet, dataSet, [0,0], state.configuration.panelHeaderLabel, true);
    }

    mouseClick(event: ViewMouseEvent, coordinates: number[], enriched: EnrichedState, interaction: InteractionState) {
        interaction.switchToDataSet(this.dataSet);
        interaction.pushView('plates');
    }
}