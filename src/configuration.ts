///<reference path="references.d.ts"/>

import _ = require('lodash');

import { LabelStyle } from './core/graphics/snippet';
import { Color, Font } from './core/graphics/style';
import { Vector } from './core/math';
import { heatedObjectMap } from './core/graphics/colormap';

export class BaseConfiguration {
    backgroundColor = Color.WHITE;
    font = new Font(16, 200);
    sideFont = new Font(10);

    // User adjustable options.
    imageType: string = null;                  // The type of image to present.
    imagePopulationOverlay: string = "None";   // Whether to show an image population overlay;

    // Default palette.
    base = Color.grey(75);
    baseEmphasis = Color.BLACK;
    baseMuted = Color.grey(140);
    baseDim = Color.grey(200);
    baseVeryDim = Color.grey(225);
    baseSelected = new Color(25, 50, 255);
    lightSelected = new Color(240, 240, 255);
    highlight = Color.grey(50);     // Focused highlight color.
    highlightTrans = Color.grey(50, 0.75);

    // Panel configuration.
    panelSpace = 20;
    subPanelSpace = 10;
    panelHeaderFont = new Font(16);
    panelHeaderSpace = this.panelHeaderFont.size + 15;
    panelHeaderColor = this.baseDim;
    panelHeaderLabel = new LabelStyle(this.panelHeaderFont, this.panelHeaderColor, 'left', 'top');
    panelHeaderOpenLabel = new LabelStyle(this.panelHeaderFont, this.base, 'left', 'top');
    subPanelHeaderLabel = new LabelStyle(new Font(14), this.base, 'left', 'top');
    sideLabel = new LabelStyle(this.sideFont, this.baseMuted, 'left', 'top');
    selectedSideLabel = new LabelStyle(this.sideFont, this.baseSelected, 'left', 'top');

    // Guide labels.
    guideStyle = new LabelStyle(new Font(12, 180), Color.CRIMSON, 'left', 'top');
    bigGuideStyle = new LabelStyle(new Font(32, 180), Color.CRIMSON, 'left', 'top');
    guideArrowLength = 5;
    guideVisible = false;

    // Scatter plots.
    minDotSize = 1;
    maxDotSize = 3;

    // Cluster view.
    windowMargin = 5;
    scatterPlotFont = new Font(6);
    featureSpace = 80;
    clusterSpace = 40;
    tableSideMargin = 60;
    featureMargin = 20;
    binMargin = 5;
    controlShareHeight = 20;

    // Splom view.
    splomColor = new Color(247, 247, 247);

    splomInnerSize = 90;
    splomSpace = 2;
    splomSize = this.splomInnerSize + this.splomSpace;
    splomTotalSize = 400;
    splomClusterRadius = 3;
    splomDotRadius = 1;
    splomDotDensityColor = Color.grey(0, 0.2);
    splomRepresentativeOuterDotRadius = 3;
    splomRepresentativeInnerDotRadius = 2;
    scatterPlotSize = this.splomSize + this.splomInnerSize;

    // Cluster list.
    clusterTileSpace = 5;
    clusterTileInnerSize = 0.5 * (this.splomInnerSize - this.clusterTileSpace);
    clusterTileSize = this.clusterTileInnerSize + this.clusterTileSpace;
    clusterPlateDotRadius = 1.5;
    clusterLabel = new LabelStyle(this.sideFont, this.baseDim);
    clusterSelectedLabel = new LabelStyle(this.sideFont, this.baseEmphasis);
    clusterAdditionLabel = new Font(34);
    exemplarSpace = 2;
    exemplarColumnSpace = 2 * this.exemplarSpace;

    // Features.
    featureFont = new Font(10);
    featureCellSpace = [4, 2];
    featureCellDimensions = [this.splomInnerSize, this.featureFont.size];
    featureSplit = 'joint';

    // Transfer editor.
    transferPlotSize = this.clusterTileInnerSize;
    transferFont = new Font(8);

    // Plate index view.
    plateWidth = 4;
    plateIndexInnerHeight = 10;
    plateIndexSpace = 5;
    plateIndexMargin = 5;

    // Plate cluster shares.
    static voidColor = Color.NONE;
    static shareColorMap = (normVal: number) => (normVal >= 0 ? heatedObjectMap[Math.ceil(255 * (1 - normVal))] :
                                                BaseConfiguration.voidColor);

    // Plate mini heat map view.
    miniHeatWellDiameter = 2;
    miniHeatSpace = 2;
    miniHeatColumnMax = 12;
    miniHeatColumnCount = 5;
    largeHeatMultiplier = 3;
    heatmapFont = new Font(6);

    // Plate view.
    wellDiameter = this.miniHeatWellDiameter * this.largeHeatMultiplier;
    wellRadius = .5 * this.wellDiameter;
    wellInnerRadius = this.wellRadius - 1;
    plateColLabelMargin = 1;
    plateRowLabelMargin = 4;

    // Well list view.
    listWellsCount = 40;
    listWellAbundanceWidth = 200;
    listColumnSpace = 5;
    listWellLabel = this.sideLabel;
    listWellSpace = 2;

    // Well details view.
    wellViewMaxWidth = 600;
    annotationFont = this.sideFont;
    annotationCategoryLabel = new LabelStyle(this.annotationFont, this.base);
    annotationLabel = new LabelStyle(this.annotationFont, this.baseDim);
    annotationSelectedLabel = new LabelStyle(this.annotationFont, this.baseEmphasis);
    annotationColumnSpace = 5;
    annotationTagSpace = 2;

    // Activation function.
    activationZScoreRange = 5;

    // Object details view.
    objectViewImageRadius = 40;
    wellViewMaxObjectRadius = 50;
}

export class NumberTableConfiguration {
    cellOuterDimensions: number[];

    constructor(public font: Font = new Font(12),
                public fontColor: Color = Color.BLACK,
                public cellDimensions: number[] = [40, 14],
                public cellSpace: number[] = [2, 2],
                public visibleIndex: boolean = true,
                public visibleHeader: boolean = true) {
        this.cellOuterDimensions = Vector.add(cellDimensions, cellSpace);
    }
}