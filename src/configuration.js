define(["require", "exports", './core/graphics/snippet', './core/graphics/style', './core/graphics/colormap'], function (require, exports, snippet_1, style_1, colormap_1) {
    "use strict";
    var BaseConfiguration = (function () {
        function BaseConfiguration() {
            this.backgroundColor = style_1.Color.WHITE;
            this.font = new style_1.Font(16, 200);
            this.sideFont = new style_1.Font(10);
            this.bigFont = new style_1.Font(34);
            // User adjustable options.
            this.imageType = null; // The type of image to present.
            this.imagePopulationOverlay = "None"; // Whether to show an image population overlay;
            // Default palette.
            this.base = style_1.Color.grey(75);
            this.baseEmphasis = style_1.Color.BLACK;
            this.baseMuted = style_1.Color.grey(140);
            this.baseDim = style_1.Color.grey(200);
            this.baseVeryDim = style_1.Color.grey(225);
            this.baseSelected = new style_1.Color(25, 50, 255);
            this.lightSelected = new style_1.Color(240, 240, 255);
            this.highlight = style_1.Color.grey(50); // Focused highlight color.
            //highlightTrans  = Color.grey(50, 0.75);      // Transparent variant of highlight.
            // Panel configuration.
            this.windowMargin = 5;
            this.panelSpace = 20;
            this.subPanelSpace = 10;
            this.panelHeaderFont = new style_1.Font(16);
            this.panelHeaderSpace = this.panelHeaderFont.size + 15;
            this.panelHeaderColor = this.baseDim;
            this.panelHeaderLabel = new snippet_1.LabelStyle(this.panelHeaderFont, this.panelHeaderColor, 'left', 'top');
            this.panelHeaderOpenLabel = new snippet_1.LabelStyle(this.panelHeaderFont, this.base, 'left', 'top');
            this.subPanelHeaderLabel = new snippet_1.LabelStyle(new style_1.Font(14), this.base, 'left', 'top');
            this.sideLabel = new snippet_1.LabelStyle(this.sideFont, this.baseMuted, 'left', 'top');
            this.selectedSideLabel = new snippet_1.LabelStyle(this.sideFont, this.baseSelected, 'left', 'top');
            // Scatter plots.
            //minDotSize = 1;
            //maxDotSize = 3;
            // Cluster view.
            //scatterPlotFont = new Font(6);
            //featureSpace = 80;
            //clusterSpace = 40;
            //tableSideMargin = 60;
            //featureMargin = 20;
            //binMargin = 5;
            //controlShareHeight = 20;
            // Splom view.
            //splomColor = new Color(247, 247, 247);
            this.splomInnerSize = 90;
            this.splomSpace = 2;
            this.splomTotalSize = 400;
            //splomDotDensityColor = Color.grey(0, 0.2);
            this.splomRepresentativeOuterDotRadius = 3;
            this.splomRepresentativeInnerDotRadius = 2;
            // Cluster list.
            this.clusterTileSpace = 5;
            this.clusterTileInnerSize = 0.5 * (this.splomInnerSize - this.clusterTileSpace);
            this.clusterTileSize = this.clusterTileInnerSize + this.clusterTileSpace;
            //clusterPlateDotRadius = 1.5;
            //clusterLabel = new LabelStyle(this.sideFont, this.baseDim);
            //clusterSelectedLabel = new LabelStyle(this.sideFont, this.baseEmphasis);
            //clusterAdditionLabel = new Font(34);
            this.exemplarSpace = 2;
            this.exemplarColumnSpace = 2 * this.exemplarSpace;
            // Features.
            this.featureFont = new style_1.Font(10);
            this.featureCellSpace = [4, 2];
            this.featureCellDimensions = [this.splomInnerSize, this.featureFont.size];
            //featureSplit = 'joint';
            // Transfer editor.
            this.transferPlotSize = this.clusterTileInnerSize;
            this.transferFont = new style_1.Font(8);
            // Plate mini heat map view.
            this.miniHeatWellDiameter = 2;
            this.miniHeatSpace = 2;
            this.miniHeatColumnMax = 12;
            //miniHeatColumnCount = 5;
            this.largeHeatMultiplier = 3;
            //heatMapFont = new Font(6);
            // Plate view.
            this.wellDiameter = this.miniHeatWellDiameter * this.largeHeatMultiplier;
            //wellRadius = .5 * this.wellDiameter;
            //wellInnerRadius = this.wellRadius - 1;
            this.plateColLabelMargin = 1;
            this.plateRowLabelMargin = 4;
            // Well list view.
            this.listWellsCount = 40;
            //listWellAbundanceWidth = 200;
            this.listColumnSpace = 5;
            this.listWellLabel = this.sideLabel;
            this.listWellSpace = 2;
            // Well details view.
            this.wellViewMaxWidth = 600;
            this.annotationFont = this.sideFont;
            this.annotationCategoryLabel = new snippet_1.LabelStyle(this.annotationFont, this.base);
            this.annotationLabel = new snippet_1.LabelStyle(this.annotationFont, this.baseDim);
            this.annotationSelectedLabel = new snippet_1.LabelStyle(this.annotationFont, this.baseEmphasis);
            this.annotationColumnSpace = 5;
            this.annotationTagSpace = 2;
            // Activation function.
            this.activationZScoreRange = 5;
            // Object details view.
            this.objectViewImageRadius = 40;
            this.wellViewMaxObjectRadius = 50;
        }
        // Plate index view.
        //plateWidth = 4;
        //plateIndexInnerHeight = 10;
        //plateIndexSpace = 5;
        //plateIndexMargin = 5;
        // Plate cluster shares.
        BaseConfiguration.voidColor = style_1.Color.NONE;
        BaseConfiguration.shareColorMap = function (normVal) {
            return normVal >= 0 ?
                colormap_1.heatedObjectMap[Math.ceil(255 * (1 - normVal))] :
                BaseConfiguration.voidColor;
        };
        return BaseConfiguration;
    }());
    exports.BaseConfiguration = BaseConfiguration;
});
//# sourceMappingURL=configuration.js.map