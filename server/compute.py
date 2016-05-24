import numpy as np
import pandas as pd
import itertools
import json
import numpyData as data    # Swappable data backend.
from wrapt import synchronized
from sklearn.ensemble import RandomForestClassifier
from scipy.ndimage.morphology import grey_erosion
from multiprocessing.dummy import Pool  # Use multi-threading instead of multi-processing; synchronize functions!
from cache import lru_cache
from collections import defaultdict

# Names of available data sets.
def dataSets():
    return data.dataSetPaths.keys()

# Data set configuration.
def configuration(dataSet):
    return data.config(dataSet)

# Data set input conversion.
def dataSet(data):
    return str(data).replace('"', "")

# Feature set input conversion.
def featureSet(features):
    return frozenset(json.loads(features))

# Object set input conversion.
def objectSet(objects):
    return frozenset(json.loads(objects))

# One to one mapping.
def objectDict(objDict):
    dict = json.loads(objDict)
    tpls = [(id, object) for id, object in dict.iteritems()]
    return frozenset(tpls)

# Exemplar dictionary input conversion.
def exemplarDict(exemplars):
    dict = json.loads(exemplars)
    tpls = [(id, frozenset(objects)) for id, objects in dict.iteritems()]
    return frozenset(tpls)

# Load and combine multiple columns into a data frame.
#@lru_cache(maxsize=100)
def columns(dataSet, columns):
    cols = list(columns)
    return data.columnsDump(dataSet, cols)

# Retrieve well annotations.
@lru_cache(maxsize=5)
def wellAnnotations(dataSet):
    return data.wellAnnotations(dataSet)

# Retrieve well types from well annotations.
@lru_cache(maxsize=5)
def wellTypes(dataSet):
    return list()   #list(set([an[0] for an in data.wellAnnotations(dataSet)['Type'].values()]))

# Small sample for visualizations.
@lru_cache(maxsize=5)
def smallSample(dataSet):
    return data.objectSample(dataSet, 10**3)

# Well coordinate information for all objects, includes well type if provided in annotations.
@lru_cache(maxsize=5)
def wellIndex(dataSet):
    wellColumns = data.columnsDump(dataSet, data.systemObjectColumns)

    wTs = wellTypes(dataSet)
    if len(wTs) > 0:
        annotationMap = wellAnnotations(dataSet)['Type']
        typeToPopID = {tp: i + 3 for i, tp in enumerate(wTs)}   # Well type IDs start at 3, see src/model.ts -> Population

        cfg = configuration('CellMorph')
        columnCnt = len(cfg.columns)
        rowCnt = len(cfg.rows)
        def convertTag(wellTag):
            plate, column, row = [int(part) for part in wellTag.split("_")]
            return plate * columnCnt * rowCnt + column * rowCnt + row

        annotationDict = {convertTag(tag): typeToPopID[wT[0]] for tag, wT in annotationMap.iteritems()}
        annotationArr = np.array([annotationDict[i] for i in range(len(annotationDict))], np.int)

        objectAbsWell = wellColumns['plate'] * columnCnt * rowCnt + wellColumns['column'] * rowCnt + wellColumns['row']
        wellColumns['type'] = annotationArr[objectAbsWell.values]
    else:
        wellColumns['type'] = np.nan

    return wellColumns

def ftrMet(dataSet, ftr):
    col = data.numpyDump(dataSet, ftr)
    return {metric: np.asscalar(getattr(np, metric)(col)) for metric in ['min', 'max', 'mean']}

@synchronized
@lru_cache(maxsize=5)
def featureMetrics(dataSet):
    print "Computing image feature metrics for " + dataSet
    return {feature: ftrMet(dataSet, feature) for feature in data.features(dataSet)}

@lru_cache(maxsize=5)
def wellToObjects(dataSet):
    return wellIndex(dataSet).groupby(['plate', 'row', 'column']).groups

# Restrict sample features to those of images.
def selectImageFeatures(dataSet, subset):
    return subset[data.imageFeatures(dataSet)]

def minMaxScale(vec, vecMin, vecMax):
    return (vec - vecMin) / (vecMax - vecMin)

# Assume that the features are scaled, and behave decently, already. Do normalize to [0,1].
def adaptiveScale(vec, metrics):
    vecMin = metrics['min']
    vecMax = metrics['max']
    vecMean = metrics['mean']
    minMaxed = minMaxScale(vec, vecMin, vecMax)
    return np.log(1 + 100000 * minMaxed) / np.log(100000) if vecMean - vecMin < 0.2 * (vecMax - vecMean) else minMaxed

def scale(dataSet, subset):
    subset = subset.copy()
    metrics = featureMetrics(dataSet)
    for col in subset.columns:
        subset[col] = adaptiveScale(subset[col].values, metrics[col])
    return subset

def scaledSmallSample(dataSet):
    return scale(selectImageFeatures(dataSet, smallSample))

@synchronized
@lru_cache(maxsize=5)
def scaledArray(dataSet, column):
    return adaptiveScale(data.numpyDump(dataSet, column), featureMetrics(dataSet)[column])

def scaledColumns(dataSet, columns):
    return pd.DataFrame(index=wellIndex(dataSet).index, data={c: scaledArray(dataSet, c) for c in columns})

def dataFrameToDict(frame):
    return {str(k): v for k, v in frame.to_dict().iteritems()}

@lru_cache(maxsize=5)
def featureOrdering(dataSet):
    from ordering.rearrange import rearrange

    print "Order features by correlation"
    objectSet = selectImageFeatures(dataSet, smallSample(dataSet))
    corr = objectSet.corr()
    distances = 1 - corr.abs()
    rearrangedSubset = rearrange(distances.values)

    ftrs = data.imageFeatures(dataSet)
    return [ftrs[i] for i in rearrangedSubset]

@lru_cache(maxsize=5)
def featureInfo(dataSet):
    return featureOrdering(dataSet)

@synchronized
@lru_cache(maxsize=1)
def clusters(dataSet, features, exemplars):
    ftrs = list(features)

    wI = wellIndex(dataSet)
    objectCount = len(wI)
    predicted = np.empty(objectCount, dtype=np.int)

    # Default to use all features if none habe been selected.
    if not ftrs:
        ftrs = data.imageFeatures(dataSet)

    if ftrs and exemplars:   #(exemplars or wellTypes(dataSet)):
        # Training feature data.
        valueMatrix = np.matrix([scaledArray(dataSet, ftr) for ftr in ftrs], copy=False).transpose()

        # Construct from well type annotation.
        trainingLabels = np.copy(wI['type'].values)

        # Knock out large part of training values (to speed up training).
        trainingSample = np.random.rand(trainingLabels.size) < configuration(dataSet).wellTypeSample
        trainingLabels = np.where(trainingSample, trainingLabels, np.nan)

        # Override well type annotations where exemplars have been chosen by user.
        exemplarDict = dict(exemplars)

        for popId, exemplars in exemplarDict.iteritems():
            for exemplar in exemplars:
                trainingLabels[exemplar] = popId

        # Prune training features and labels, based on presence of labels.
        trainingValues = valueMatrix[~np.isnan(trainingLabels)]
        trainingLabels = trainingLabels[~np.isnan(trainingLabels)]

        print "Begin training"
        #trainingValues = np.take(valueMatrix, exemplarObjects, axis=0)
        forest = RandomForestClassifier(
            n_estimators=10,
            n_jobs=-1,
            class_weight="balanced"#,
            #min_samples_split=0.01*trainingValues.size
        )
        forest = forest.fit(trainingValues, trainingLabels)    #forest.fit(trainingValues, exemplarLabels)
        print "End training"

        print "Begin classification"
        #predicted = forest.predict(valueMatrix)
        confidenceThreshold = data.config(dataSet).classifierConfidenceThreshold
        probabilities = forest.predict_proba(valueMatrix)
        maxProb = np.max(probabilities, axis=1)
        maxArgProb = np.argmax(probabilities, axis=1)
        predicted = np.where(maxProb > confidenceThreshold, np.choose(maxArgProb, forest.classes_), 2).astype(np.int)
        print "End classification"
    else:
        predicted.fill(2)   # 2 unsure about all input when no training input is provided

    # Partition predicted column to object indices.
    return predicted

@synchronized
@lru_cache(maxsize=5)
def clustersAsMap(dataSet, features, exemplars):
    clst = clusters(dataSet, features, exemplars)
    ids = np.unique(clst)
    return {int(id): np.where(clst == int(id))[0] for id in ids}    #(dict(exemplars).keys() if len(exemplars) > 0 and len(features) > 0 else [1])}

@lru_cache(maxsize=5)
def closestObject(dataSet, probes):
    result = []

    if len(probes) > 0:
        diffs = [np.square(scaledArray(dataSet, col) - coordinate) for col, coordinate in probes]
        distances = np.sqrt(np.sum(diffs, axis=0))
        result = [np.argmin(distances)]

    return result

@lru_cache(maxsize=5)
def allObjects(dataSet, column, row, plate, exemplars, probes):
    allExemplars = list(itertools.chain.from_iterable(cls[1] for cls in exemplars))
    wellObjectMap = wellToObjects(dataSet)
    wellObjects = wellObjectMap[(plate, row, column)] if column >= 0 and (plate, row, column) in wellObjectMap else []
    probeObject = closestObject(dataSet, probes)
    return list(set(allExemplars + wellObjects + probeObject))

@lru_cache(maxsize=5)
def objectInfo(dataSet, featureSet, column, row, plate, exemplars, probes):
    objects = allObjects(dataSet, column, row, plate, exemplars, probes)
    combined = wellIndex(dataSet).loc[objects].copy()

    # Feature values.
    for ftr in featureSet:
        combined[ftr] = np.take(scaledArray(dataSet, ftr), objects)

    if data.mdsColumnsPresent(dataSet):
        for mdsCol in data.mdsColumns:
            combined[mdsCol] = np.take(scaledArray(dataSet, mdsCol), objects)

    # Predicted population values.
    combined["population"] = np.take(clusters(dataSet, featureSet, exemplars), objects)

    # Generate well URLs on the spot, based on config.
    wellImages = data.config(dataSet).wellImages
    for name, urlFunction in wellImages.iteritems():
        combined["img_" + name] = combined.apply(
            lambda row: urlFunction(int(row['plate']), int(row['column']), int(row['row'])), axis=1)

    return combined

def histoLog(counts):
    return np.where(counts > 0, (np.log(counts) / 2 + 1), 0)

def featureHistogram(args):
    (dataSet, featureSet, exemplars, feature, cluster, bins) = args
    clusterMap = clustersAsMap(dataSet, featureSet, exemplars)[cluster]
    prunedColumn = np.take(scaledArray(dataSet, feature), clusterMap)
    digitized = (prunedColumn * bins).astype(np.int8)
    return feature, cluster, {i: cnt for i, cnt in enumerate(np.bincount(digitized, minlength=bins))}

@lru_cache(maxsize=5)
def featureHistograms(dataSet, featureSet, exemplars, bins):
    partition = clustersAsMap(dataSet, featureSet, exemplars)

    # All computation combinations.
    #print "Compute feature histograms."
    tasks = [(dataSet, featureSet, exemplars, feature, cluster, bins)
             for feature in data.imageFeatures(dataSet)
             for cluster, clusterMap in partition.iteritems()]

    pool = Pool()
    results = pool.imap(featureHistogram, tasks)
    pool.close()
    pool.join()

    histograms = {c: {} for c, table in partition.iteritems()}
    for feature, cluster, histogram in results:
        histograms[cluster][feature] = histogram
    #print "Finish compute feature histograms."

    return histograms

@lru_cache(maxsize=5)
def wellClusterShares(dataSet, features, exemplars):
    print "Join clustering and well info."
    sampleWellsClst = wellIndex(dataSet)[['plate', 'column', 'row']].copy()
    sampleWellsClst['population'] = clusters(dataSet, features, exemplars)

    print "Start pivot table."
    pivoted = pd.pivot_table(sampleWellsClst,
                             columns=['population'],
                             index=['plate', 'column', 'row'],
                             aggfunc=len)
    total = pivoted.sum(axis='columns')
    #maxTotal = total.max()
    pivoted = pivoted.divide(total, axis='index')
    pivoted['0'] = total
    print "Finish pivot table."

    return pivoted

@lru_cache(maxsize=5)
def wellClusterSharesFlat(dataSet, features, exemplars):
    wellShares = wellClusterShares(dataSet, features, exemplars)
    wellShares['plate'] = wellShares.index.get_level_values('plate').astype(str)
    wellShares['column'] = wellShares.index.get_level_values('column').astype(str)
    wellShares['row'] = wellShares.index.get_level_values('row').astype(str)
    wellShares['well'] = wellShares['plate'] + "_" + wellShares['column'] + "_" + wellShares['row']
    return wellShares.set_index('well').drop(['plate', 'column', 'row'], axis=1)

#@lru_cache(maxsize=20)
def objectHistogram2D(args):
    (dataSet, features, exemplars, xFeature, yFeature, bins) = args
    partition = clustersAsMap(dataSet, features, exemplars)

    # Contour maps per cluster.
    contours = {}
    #kernel = [[1, 1, 1], [1, 1, 1], [1, 1, 1]]  # Morphology kernel.
    for cluster, objects in partition.iteritems():
        tBins = bins - 1
        xCol = (np.take(scaledArray(dataSet, xFeature), objects) * tBins).astype(np.int)
        yCol = (np.take(scaledArray(dataSet, yFeature), objects) * tBins).astype(np.int)
        digitized = (xCol * bins) + yCol
        counts = np.bincount(digitized, minlength=bins*bins)
        counts.shape = (bins, bins)

        # Scale histogram densities to base 10 logarithm levels.
        levels = histoLog(counts)   #.astype(np.int8)

        # Level set outlines as contours (retain level as outline number).
        #eroded = grey_erosion(levels, footprint=kernel, mode='constant')
        #difference = np.sign(levels - eroded)
        #levelContours = np.multiply(difference, levels)

        #contours[str(cluster)] = levelContours

        contours[str(cluster)] = levels

    return xFeature, yFeature, contours

def objectHistogramMatrix(dataSet, features, exemplars, bins):
    tasks = [(dataSet, features, exemplars, xFtr, yFtr, bins) for yFtr in features for xFtr in features if xFtr < yFtr]
    if data.mdsColumnsPresent(dataSet):
        tasks.append((dataSet, features, exemplars, data.mdsColumns[0], data.mdsColumns[1], bins))

    pool = Pool()
    results = pool.imap(objectHistogram2D, tasks)
    pool.close()
    pool.join()

    recDict = lambda: defaultdict(recDict)
    histograms = recDict()
    for xFeature, yFeature, contours in results:
        for c, lvlCnt in contours.iteritems():
            histograms[xFeature][yFeature][c] = lvlCnt.tolist()
            histograms[yFeature][xFeature][c] = lvlCnt.transpose().tolist()

    return dict(histograms)

def forObjectFeatureValues(args):
    (dataSet, col, objects) = args
    return col, np.take(scaledArray(dataSet, col), objects)

def objectFeatureValues(dataSet, column, row, plate, exemplars, probes):
    objects = allObjects(dataSet, column, row, plate, exemplars, probes)
    cols = data.features(dataSet)

    pool = Pool()
    results = pool.imap(forObjectFeatureValues, [(dataSet, col, objects) for col in cols])
    pool.close()
    pool.join()

    mrg = pd.DataFrame(index=objects, columns=cols)
    for c, vals in results:
        mrg[c] = vals

    return mrg