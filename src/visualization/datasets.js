var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
define(["require", "exports", '../core/graphics/snippet'], function (require, exports, snippet_1) {
    "use strict";
    // Plain list of available data sets.
    var DataSetList = (function (_super) {
        __extends(DataSetList, _super);
        function DataSetList(state) {
            _super.call(this, "dataSetList", state.dataSets.value
                .filter(function (ds) { return ds !== state.selectedCoordinates.dataSet; })
                .map(function (ds) { return new DataSetLabel(ds, state); }), [0, 0], [0, 0], 'vertical', state.configuration.featureCellSpace[0]);
            this.state = state;
        }
        DataSetList.prototype.toString = function () {
            return "Screen: " + this.state.selectedCoordinates.dataSet;
        };
        return DataSetList;
    }(snippet_1.List));
    exports.DataSetList = DataSetList;
    // Text label of single data set.
    var DataSetLabel = (function (_super) {
        __extends(DataSetLabel, _super);
        function DataSetLabel(dataSet, state) {
            _super.call(this, "clLbl_" + dataSet, dataSet, [0, 0], state.configuration.panelHeaderLabel, true);
            this.dataSet = dataSet;
        }
        DataSetLabel.prototype.mouseClick = function (event, coordinates, enriched, interaction) {
            interaction.switchToDataSet(this.dataSet);
            interaction.pushView('plates');
        };
        return DataSetLabel;
    }(snippet_1.Label));
});
//# sourceMappingURL=datasets.js.map