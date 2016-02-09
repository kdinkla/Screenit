import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from scipy.ndimage.morphology import grey_erosion
from multiprocessing import Pool
import itertools
import json
from cache import lru_cache

# Swappable for change in data backend.
import numpyData as data

# Import data set specific configuration.
import sys
sys.path.append('../dataset')
import config

# Feature set input conversion.
def featureSet(features):
    return frozenset(json.loads(features))

# Object set input conversion.
def objectSet(objects):
    return frozenset(json.loads(objects))

# Exemplar dictionary input conversion.
def exemplarDict(exemplars):
    dict = json.loads(exemplars)
    tpls = [(id, frozenset(objects)) for id, objects in dict.iteritems()]
    return frozenset(tpls)

# Load and combine multiple columns into a data frame.
@lru_cache(maxsize=5)
def columns(columns):
    cols = list(columns)
    return data.columnsDump(cols)

# Small sample for visualizations.
print "Extracting samples..."
smallSample = data.objectSample(10**3)
#mediumSample = data.objectSample(10**4)
#largeSample = data.objectSample(10**5)

# Well coordinate information for all objects.
print "Extracting system columns..."
wellIndex = data.columnsDump(data.systemObjectColumns)

#@memory.cache
@lru_cache(maxsize=5)
def featureMetrics():
    print "Computing image feature metrics..."

    def ftrMet(ftr):
        col = data.numpyDump(ftr)
        return {metric: np.asscalar(getattr(np, metric)(col)) for metric in ['min', 'max', 'mean']}

    return {feature: ftrMet(feature) for feature in data.imageFeatures()}

def wellToObjects():
    return wellIndex.groupby(['plate', 'row', 'column']).groups

print "Mapping objects to wells..."
wellToObjectsMap = wellToObjects()

# Restrict sample features to those of images.
def selectImageFeatures(subset):
    return subset[data.imageFeatures()]

#@memory.cache
# def logicleSet(vec, minimum=None, maximum=None):
#     vecMin = vec.min() if minimum is None else minimum
#     vecMax = vec.max() if maximum is None else maximum
#     rNeg = min(0, vecMin)
#     rMax = abs(vecMax)
#     decades = max(1, abs(math.ceil(math.log10(rMax))))
#     scaleTop = rMax
#
#     logicleVec = _logicle(vec, T=scaleTop, m=decades, r=rNeg, w=0.5)
#
#     return logicleVec

def minMaxScale(vec, vecMin, vecMax):
    return (vec - vecMin) / (vecMax - vecMin)

# TODO: add client-side marking for log scaled features.
def adaptiveScale(vec, metrics):
    vecMin = metrics['min']
    vecMax = metrics['max']
    vecMean = metrics['mean']
    minMaxed = minMaxScale(vec, vecMin, vecMax)
    return np.log(1 + 100000 * minMaxed) / np.log(100000) if vecMean - vecMin < 0.2 * (vecMax - vecMean) else minMaxed

def scale(subset):
    subset = subset.copy()
    metrics = featureMetrics()
    for col in subset.columns:
        subset[col] = adaptiveScale(subset[col].values, metrics[col])
    return subset

scaledSmallSample = scale(selectImageFeatures(smallSample))

@lru_cache(maxsize=2)
def scaledArray(column):
    return adaptiveScale(data.numpyDump(column), featureMetrics()[column])

#@lru_cache(maxsize=20)
def scaledColumn(column):
    return scale(data.columnsDump([column]))

#@lru_cache(maxsize=5)
def scaledColumns(columns):
    cols = list(columns)
    cls = [scaledColumn(c) for c in cols]

    if len(cols) > 0:
        mrg = pd.DataFrame(index=cls[0].index, columns=cols)
        for i, c in enumerate(cls):
            mrg[cols[i]] = c[cols[i]]
    else:
        mrg = pd.DataFrame(index=wellIndex.index)

    return mrg

def dataFrameToDict(frame):
    return {str(k): v for k, v in frame.to_dict().iteritems()}

def featureOrdering():
    from ordering.rearrange import rearrange

    print "Order features by correlation"
    objectSet = selectImageFeatures(smallSample)
    corr = objectSet.corr()
    distances = 1 - corr.abs()
    rearrangedSubset = rearrange(distances.values)

    ftrs = data.imageFeatures()
    return [ftrs[i] for i in rearrangedSubset]

@lru_cache(maxsize=5)
def featureInfo():
    return featureOrdering()

@lru_cache(maxsize=5)
def clustersAsTable(features, exemplars):
    ftrs = list(features)
    table = scaledColumns(ftrs).copy()

    if ftrs and exemplars:
        print "Begin training"
        def exemplarTable(id, objects):
            subTable = table.loc[list(objects)]
            subTable['population'] = pd.Series(id, subTable.index)
            return subTable

        trainingTables = {id: exemplarTable(id, objects) for id, objects in dict(exemplars).iteritems()}
        trainingTable = pd.concat(trainingTables.values())

        forest = RandomForestClassifier(n_estimators=10, n_jobs=-1, class_weight="balanced")
        forest = forest.fit(trainingTable.drop('population', 1).values, trainingTable['population'].values)
        print "End training"

        print "Begin classification"
        assignPop = forest.predict(table.values)
        table['population'] = pd.Series(assignPop, table.index)
        print "End classification"
    else:
        table['population'] = -1

    return table

#@lru_cache(maxsize=5)
def clustersAsPartition(features, exemplars):
    return clustersAsTable(features, exemplars).groupby('population')

#@lru_cache(maxsize=5)
def clustersAsMap(features, exemplars):
    return {grp: table.index.values for grp, table in clustersAsPartition(features, exemplars)}

@lru_cache(maxsize=5)
def allObjects(column, row, plate, exemplars, colSelectA, colCoordinateA, colSelectB, colCoordinateB):
    allExemplars = list(itertools.chain.from_iterable(cls[1] for cls in exemplars))
    wellObjects = wellToObjectsMap[(plate, row, column)] if column >= 0 and (plate, row, column) in wellToObjectsMap else []
    return list(set(allExemplars + wellObjects))   #list(set(list(smallSample.index) + allExemplars + wellObjects))

# def allObjects(column, row, plate, exemplars):
#     allExemplars = list(itertools.chain.from_iterable(cls[1] for cls in exemplars))
#     wellObjects = wellToObjectsMap[(plate, row, column)] if column >= 0 and (plate, row, column) in wellToObjectsMap else []
#     return list(set(allExemplars + wellObjects))   #list(set(list(smallSample.index) + allExemplars + wellObjects))

def allObjects(column, row, plate, exemplars):
    allExemplars = list(itertools.chain.from_iterable(cls[1] for cls in exemplars))
    wellObjects = wellToObjectsMap[(plate, row, column)] if column >= 0 and (plate, row, column) in wellToObjectsMap else []
    return list(set(allExemplars + wellObjects))   #list(set(list(smallSample.index) + allExemplars + wellObjects))

@lru_cache(maxsize=5)
def objectInfo(featureSet, column, row, plate, exemplars):
    objects = allObjects(column, row, plate, exemplars)

    clusters = clustersAsTable(featureSet, exemplars).loc[objects]
    wellInfo = wellIndex.loc[objects]
    combined = clusters.join(wellInfo)

    # Generate well URLs on the spot, based on config.
    for name, urlFunction in config.wellImages.iteritems():
        combined["img_" + name] = combined.apply(
            lambda row: urlFunction(int(row['plate']), int(row['column']), int(row['row'])), axis=1)

    return combined

def histoLog(counts):
    return np.where(counts > 0, (np.log(counts) / 2 + 1), 0)

def featureHistogram(args):
    (feature, cluster, bins) = args
    clusterMap = workerShare[cluster]
    prunedColumn = np.take(scaledArray(feature), clusterMap)
    digitized = (prunedColumn * bins).astype(np.int8)
    return feature, cluster, {i: cnt for i, cnt in enumerate(np.bincount(digitized, minlength=bins))}

# Worker global variable set.
def setupWorkerShare(value):
    global workerShare
    workerShare = value

@lru_cache(maxsize=5)
def featureHistograms(featureSet, exemplars, bins):
    partition = clustersAsMap(featureSet, exemplars)

    # All computation combinations.
    #print "Compute feature histograms."
    tasks = [(feature, cluster, bins)
             for feature in data.imageFeatures()
             for cluster, clusterMap in partition.iteritems()]

    pool = Pool(initializer=setupWorkerShare, initargs=[partition])
    results = pool.imap(featureHistogram, tasks)
    pool.close()
    pool.join()

    histograms = {c: {} for c, table in partition.iteritems()}
    for feature, cluster, histogram in results:
        histograms[cluster][feature] = histogram
    #print "Finish compute feature histograms."

    return histograms

@lru_cache(maxsize=5)
def wellClusterShares(features, exemplars):
    print "Join clustering and well info."
    sampleWellsClst = wellIndex[['plate', 'column', 'row']].copy()
    sampleWellsClst['population'] = clustersAsTable(features, exemplars)['population']

    print "Start pivot table."
    pivoted = pd.pivot_table(sampleWellsClst,
                             columns=['population'],
                             index=['plate', 'column', 'row'],
                             aggfunc=len)
    total = pivoted.sum(axis='columns')
    maxTotal = total.max()
    pivoted = pivoted.divide(total, axis='index')
    pivoted['objects'] = total.divide(maxTotal, axis='index')
    print "Finish pivot table."

    return pivoted

@lru_cache(maxsize=5)
def wellClusterSharesFlat(features, exemplars):
    wellShares = wellClusterShares(features, exemplars)
    wellShares['plate'] = wellShares.index.get_level_values('plate').astype(str)
    wellShares['column'] = wellShares.index.get_level_values('column').astype(str)
    wellShares['row'] = wellShares.index.get_level_values('row').astype(str)
    wellShares['well'] = wellShares['plate'] + "_" + wellShares['column'] + "_" + wellShares['row']

    return wellShares.set_index('well').drop(['plate', 'column', 'row'], axis=1)

#@lru_cache(maxsize=20)
def objectHistogram2D(args):
    (xFeature, yFeature, bins) = args

    # Contour maps per cluster.
    contours = {}
    kernel = [[1, 1, 1], [1, 1, 1], [1, 1, 1]]  # Morphology kernel.
    for cluster, table in workerShare:
        tBins = bins - 1
        xCol = (table[xFeature].values * tBins).astype(np.int16)
        yCol = (table[yFeature].values * tBins).astype(np.int16)
        digitized = (xCol * bins) + yCol
        counts = np.bincount(digitized, minlength=bins*bins)
        counts.shape = (bins, bins)

        # Scale histogram densities to base 10 logarithm levels.
        levels = histoLog(counts).astype(np.int8)   #np.where(counts > 0, (np.log(counts) / 2 + 1), 0).astype(np.int8)

        # Level set outlines as contours (retain level as outline number).
        eroded = grey_erosion(levels, footprint=kernel, mode='constant')
        difference = np.sign(levels - eroded)
        levelContours = np.multiply(difference, levels)

        contours[str(cluster)] = levelContours

    return xFeature, yFeature, contours

def objectHistogramMatrix(features, exemplars, bins):
    partition = clustersAsPartition(features, exemplars)

    pool = Pool(initializer=setupWorkerShare, initargs=[partition])
    tasks = [(xFtr, yFtr, bins) for yFtr in features for xFtr in features if xFtr < yFtr]
    results = pool.imap(objectHistogram2D, tasks)
    pool.close()
    pool.join()

    histograms = {ftr2: {ftr1: {} for ftr1 in features} for ftr2 in features}
    for xFeature, yFeature, contours in results:
        for c, lvlCnt in contours.iteritems():
            histograms[xFeature][yFeature][c] = lvlCnt.tolist()
            histograms[yFeature][xFeature][c] = lvlCnt.transpose().tolist()     # Transpose for the inverse pair.

    return histograms

def forObjectFeatureValues(col):
    objects = workerShare
    return col, np.take(scaledArray(col), objects)

def objectFeatureValues(column, row, plate, exemplars):
    objects = allObjects(column, row, plate, exemplars)
    cols = data.imageFeatures()

    pool = Pool(initializer=setupWorkerShare, initargs=[objects])
    results = pool.imap(forObjectFeatureValues, cols)
    pool.close()
    pool.join()

    mrg = pd.DataFrame(index=objects, columns=cols)
    for c, vals in results:
        mrg[c] = vals

    return mrg