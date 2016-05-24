///<reference path="references.d.ts"/>
define(["require", "exports", './core/graphics/snippet', './core/graphics/style', './core/math', './core/graphics/colormap'], function (require, exports, snippet_1, style_1, math_1, colormap_1) {
    "use strict";
    var BaseConfiguration = (function () {
        function BaseConfiguration() {
            this.backgroundColor = style_1.Color.WHITE;
            this.font = new style_1.Font(16, 200);
            this.sideFont = new style_1.Font(10);
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
            this.highlightTrans = style_1.Color.grey(50, 0.75);
            // Panel configuration.
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
            // Guide labels.
            this.guideStyle = new snippet_1.LabelStyle(new style_1.Font(12, 180), style_1.Color.CRIMSON, 'left', 'top');
            this.bigGuideStyle = new snippet_1.LabelStyle(new style_1.Font(32, 180), style_1.Color.CRIMSON, 'left', 'top');
            this.guideArrowLength = 5;
            this.guideVisible = false;
            // Scatter plots.
            this.minDotSize = 1;
            this.maxDotSize = 3;
            // Cluster view.
            this.windowMargin = 5;
            this.scatterPlotFont = new style_1.Font(6);
            this.featureSpace = 80;
            this.clusterSpace = 40;
            this.tableSideMargin = 60;
            this.featureMargin = 20;
            this.binMargin = 5;
            this.controlShareHeight = 20;
            // Splom view.
            this.splomColor = new style_1.Color(247, 247, 247);
            this.splomInnerSize = 90;
            this.splomSpace = 2;
            this.splomSize = this.splomInnerSize + this.splomSpace;
            this.splomTotalSize = 400;
            this.splomClusterRadius = 3;
            this.splomDotRadius = 1;
            this.splomDotDensityColor = style_1.Color.grey(0, 0.2);
            this.splomRepresentativeOuterDotRadius = 3;
            this.splomRepresentativeInnerDotRadius = 2;
            this.scatterPlotSize = this.splomSize + this.splomInnerSize;
            // Cluster list.
            this.clusterTileSpace = 5;
            this.clusterTileInnerSize = 0.5 * (this.splomInnerSize - this.clusterTileSpace);
            this.clusterTileSize = this.clusterTileInnerSize + this.clusterTileSpace;
            this.clusterPlateDotRadius = 1.5;
            this.clusterLabel = new snippet_1.LabelStyle(this.sideFont, this.baseDim);
            this.clusterSelectedLabel = new snippet_1.LabelStyle(this.sideFont, this.baseEmphasis);
            this.clusterAdditionLabel = new style_1.Font(34);
            this.exemplarSpace = 2;
            this.exemplarColumnSpace = 2 * this.exemplarSpace;
            // Features.
            this.featureFont = new style_1.Font(10);
            this.featureCellSpace = [4, 2];
            this.featureCellDimensions = [this.splomInnerSize, this.featureFont.size];
            this.featureSplit = 'joint';
            // Transfer editor.
            this.transferPlotSize = this.clusterTileInnerSize;
            this.transferFont = new style_1.Font(8);
            // Plate index view.
            this.plateWidth = 4;
            this.plateIndexInnerHeight = 10;
            this.plateIndexSpace = 5;
            this.plateIndexMargin = 5;
            // Plate mini heat map view.
            this.miniHeatWellDiameter = 2;
            this.miniHeatSpace = 2;
            this.miniHeatColumnMax = 12;
            this.miniHeatColumnCount = 5;
            this.largeHeatMultiplier = 3;
            this.heatmapFont = new style_1.Font(6);
            // Plate view.
            this.wellDiameter = this.miniHeatWellDiameter * this.largeHeatMultiplier;
            this.wellRadius = .5 * this.wellDiameter;
            this.wellInnerRadius = this.wellRadius - 1;
            this.plateColLabelMargin = 1;
            this.plateRowLabelMargin = 4;
            // Well list view.
            this.listWellsCount = 40;
            this.listWellAbundanceWidth = 200;
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
        // Plate cluster shares.
        BaseConfiguration.voidColor = style_1.Color.NONE;
        BaseConfiguration.shareColorMap = function (normVal) { return (normVal >= 0 ? colormap_1.heatedObjectMap[Math.ceil(255 * (1 - normVal))] :
            BaseConfiguration.voidColor); };
        return BaseConfiguration;
    }());
    exports.BaseConfiguration = BaseConfiguration;
    var NumberTableConfiguration = (function () {
        function NumberTableConfiguration(font, fontColor, cellDimensions, cellSpace, visibleIndex, visibleHeader) {
            if (font === void 0) { font = new style_1.Font(12); }
            if (fontColor === void 0) { fontColor = style_1.Color.BLACK; }
            if (cellDimensions === void 0) { cellDimensions = [40, 14]; }
            if (cellSpace === void 0) { cellSpace = [2, 2]; }
            if (visibleIndex === void 0) { visibleIndex = true; }
            if (visibleHeader === void 0) { visibleHeader = true; }
            this.font = font;
            this.fontColor = fontColor;
            this.cellDimensions = cellDimensions;
            this.cellSpace = cellSpace;
            this.visibleIndex = visibleIndex;
            this.visibleHeader = visibleHeader;
            this.cellOuterDimensions = math_1.Vector.add(cellDimensions, cellSpace);
        }
        return NumberTableConfiguration;
    }());
    exports.NumberTableConfiguration = NumberTableConfiguration;
});
//# sourceMappingURL=configuration.js.map