import sqlite3 as lite
import numpy as np
import pandas as pd
from collections import namedtuple
import sklearn.manifold.t_sne as tsne
from wrapt.decorators import synchronized
from sklearn.ensemble import RandomForestClassifier
from scipy.ndimage.morphology import grey_erosion
import itertools
import json

# Cache (memoize) large function outputs on disk, use in memory LRU for small, actual function outputs.
from joblib import Memory
memory = Memory(cachedir='../cache', verbose=0)
from cache import lru_cache

# Import data set specific configuration.
import sys
sys.path.append('../dataset')
import config
litePath = '../dataset/' + config.litePath

# Control columns (numbers) by dataset.
#controlColumns = {'CellMorph': [0, 1]}
#controlRows = {'CellMorph': [0]}

Selection = namedtuple('Selection', ['features', 'objects'])
WellCoordinates = namedtuple('WellCoordinates', ['column', 'row'])
WellLocation = namedtuple('WellLocation', ['column', 'row', 'plate'])
WellSelection = namedtuple('WellSelection', ['id', 'plates', 'wells'])

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

# Connect to SQLite database.
def sqlite():
    return lite.connect(litePath)

@memory.cache
def objectSample(size):
    con = sqlite()
    df = pd.read_sql_query('SELECT * FROM object ORDER BY RANDOM() LIMIT {0}'.format(size), con, index_col='id')
    con.close()
    return df

@memory.cache
def objectDump(features):
    columns = list(set(features + ['id', 'plate', 'well_col', 'well_row']))

    con = sqlite()
    df = pd.read_sql_query('SELECT {0} FROM object'.format(','.join(columns)), con, index_col='id')
    con.close()
    return df

# Load a given column from database (caching it) and convert it to a data frame indexed by object id.
@synchronized
@memory.cache
def columnDump(column):
    print "Starting column dump of " + column

    colStr = ','.join(['id', column])
    con = sqlite()
    df = pd.read_sql_query('SELECT {0} FROM object'.format(colStr), con, index_col='id')
    con.close()

    return df

# Load and combine multiple columns into a data frame.
@lru_cache(maxsize=5)
def columns(columns):
    cols = list(columns)
    cls = [columnDump(c) for c in list(cols)]

    if len(cols) > 0:
        mrg = pd.DataFrame(index=cls[0].index, columns=cols)
        for i, c in enumerate(cls):
            mrg[cols[i]] = c[cols[i]]
    else:
        mrg = pd.DataFrame()

    return mrg

# Restrict object attributes to those of images.
def imageFeatures(subset):
    return sorted(list(set(subset.columns) - set(["x", "y", "theta", "class", "well_col", "well_row", "plate", "id", "spot"])))

# Small sample for visualizations.
smallSample = objectSample(10**3)
mediumSample = pd.concat([objectSample(10**4), smallSample]).drop_duplicates()
largeSample = pd.concat([objectSample(10**5), mediumSample]).drop_duplicates()

# Well coordinate information for all objects.
wellIndex = columns(frozenset(['plate', 'well_row', 'well_col']))

@memory.cache
def featureMetrics():
    def ftrMet(ftr):
        col = columnDump(ftr)
        return {'mean': col.mean().values[0], 'min': col.min().values[0], 'median': col.median().values[0], 'max': col.max().values[0]}
        #pd.Series(index=['mean', 'min', 'median', 'max'], data=[col.mean(), col.min(), col.median(), col.max()])

    return {feature: ftrMet(feature) for feature in imageFeatures(smallSample)}

#print featureMetrics()

@memory.cache
def wellToObjects():
    return wellIndex.groupby(['plate', 'well_row', 'well_col']).groups

wellToObjectsMap = wellToObjects()

# Restrict sample features to those of images.
def selectImageFeatures(subset):
    return subset[imageFeatures(subset)]

# Selection sample, with optional inclusion of well information.
@lru_cache(maxsize=5)
def selectionSample(features):
    return columns(features)    #wellIndex.join(columns(features))    #columns(features).join(wellIndex)

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

def minMaxScale(vec, minimum=None, maximum=None):
    vecMin = vec.min() if minimum is None else minimum
    vecMax = vec.max() if maximum is None else maximum
    return (vec - vecMin) / (vecMax - vecMin)

def scale(subset):
    subset = subset.copy()
    metrics = featureMetrics()
    for col in imageFeatures(subset):
        #subset[col] = subset[col]   #(subset[col] - metrics[col]['min']) / (metrics[col]['max'] - metrics[col]['min']) #logicleSet(subset[col], metrics[col]['min'], metrics[col]['max'])
        #subset[col] = logicleSet(subset[col].values, metrics[col]['min'], metrics[col]['max'])
        subset[col] = minMaxScale(subset[col].values, metrics[col]['min'], metrics[col]['max'])
    return subset

    #return subset.apply(logicleSet)   #(subset - subset.mean()) / subset.std()   #subset.apply(logicleSet) #return subset.apply(_logicle, T=262144, m=4.5, r=None, w=0.5)

scaledSmallSample = scale(selectImageFeatures(smallSample))
scaledMediumSample = scale(selectImageFeatures(mediumSample))
scaledLargeSample = scale(selectImageFeatures(largeSample))

@synchronized
@lru_cache(maxsize=15)
def scaledColumn(column):
    return scale(columnDump(column))

def scaledColumns(columns):
    cols = list(columns)
    cls = [scaledColumn(c) for c in cols]

    if len(cols) > 0:
        mrg = pd.DataFrame(index=cls[0].index, columns=cols)
        for i, c in enumerate(cls):
            mrg[cols[i]] = c[cols[i]]
    else:
        mrg = pd.DataFrame()

    return mrg

# Cached subset transpose.
@memory.cache
def transpose(subset):
    return subset.transpose()

def dataFrameToDict(frame):
    return {str(k): v for k, v in frame.to_dict().iteritems()}

@memory.cache
def mdsTSNE(subset):
    if len(subset.columns) > 2:
        print "Begin TSNE."
        tsneObj = tsne.TSNE(metric="euclidean")
        P = tsneObj.fit_transform(subset.values)
        print "End TSNE."
    elif len(subset.columns) is 2:
        P = subset.values
    elif len(subset.columns) is 1:
        P = subset.join(pd.DataFrame(.5, index=subset.index, columns=['duplicate'])).values
    else:
        P = pd.DataFrame(.5, index=subset.index, columns=[0, 1])

    dfP = pd.DataFrame(P, index=subset.index, columns=['mds1', 'mds2'])
    ndfP = (dfP - dfP.min()) / (dfP.max() - dfP.min())

    return ndfP.fillna(0.5)

@memory.cache
def featureOrdering(featureSet, objectSet):
    from ordering.rearrange import rearrangeDataframe

    print "Feature correlations"
    corr = objectSet.corr()
    distances = 1 - corr.abs()

    print "Order features by correlation"
    print featureSet
    rearrangedSubset = rearrangeDataframe(featureSet, distances)
    print rearrangedSubset

    return rearrangedSubset

@memory.cache
def featureInfo():
    objectSet = scale(selectImageFeatures(mediumSample))
    result = histogramTable(100)    #pd.DataFrame(index=imageFeatures(mediumSample))
    result = featureOrdering(result, objectSet)   # Rearrangement cluster by correlation.
    return result

#@memory.cache
def histogramTable(bins):
    colDict = {feature: pd.value_counts(pd.cut(scaledColumn(feature)[feature], bins, labels=False)).sort_index() for feature in imageFeatures(smallSample)}
    return pd.DataFrame(colDict, ).transpose().fillna(0)

# Composes a table of all relevant information for a given sample.
def slicedSample(featureSet, objectSet):
    subset = scaledColumns(featureSet) if len(featureSet) > 0 else pd.DataFrame(index=list(objectSet))
    subset = subset.join(columns(frozenset(['spot', 'x', 'y', 'plate', 'well_row', 'well_col'])))
    subset = subset.loc[list(objectSet)]
    subset['well_url'] = subset.apply(lambda r: config.wellURL(int(r['well_col']), int(r['well_row']), int(r['plate'])), axis=1)
    return subset

def wellCorrectCoordinates(sample):
    sample['x'] += np.where(sample['spot'] == 2, 673, 0)
    sample['x'] += np.where(sample['spot'] == 4, 673, 0)
    sample['y'] += np.where(sample['spot'] < 3, 0, 512)

@synchronized
@lru_cache(maxsize=5)
def clustersAsTable(features, exemplars):  # sample):     # Get rid of sample!
    ftrs = list(features)

    if len(exemplars) > 0:
        print "Start object dump."
        sample = selectionSample(features)
        #clstSample = sample[ftrs]

        print "Begin normalization."
        normSample = sample[ftrs]   #sample #normalize(sample)
        print "End normalization."

        print "Begin compose training sample."
        def exemplarTable(id, objects):
            table = normSample.loc[list(objects)]
            table['population'] = pd.Series(id, table.index)
            return table

        print "Exemplars:"
        print dict(exemplars)
        trainingTables = {id: exemplarTable(id, objects) for id, objects in dict(exemplars).iteritems()}
        trainingTable = pd.concat(trainingTables.values())
        print "End compose training sample."

        print "Begin training"
        # TODO: consider sample weighting to compensate unequal class representation.
        forest = RandomForestClassifier(n_estimators=10, n_jobs=-1, class_weight="balanced")
        forest = forest.fit(trainingTable.drop('population', 1).values, trainingTable['population'].values)
        print "End training"

        print "Begin classification"
        assignPop = forest.predict(normSample.values)
        tbl = pd.DataFrame(index=sample.index, columns=['population'])
        tbl['population'] = pd.Series(assignPop, tbl.index)
        print "End classification"

        #print trainingTable
    else:
        tbl = pd.DataFrame(index=wellIndex.index, columns=['population'])
        tbl['population'] = -1

    return tbl

@lru_cache(maxsize=5)
def objectInfo(featureSet, column, row, plate, exemplars):
    allExemplars = list(itertools.chain.from_iterable(cls[1] for cls in exemplars))
    wellObjects = set(wellToObjectsMap[(plate, row, column)] if column >= 0 and (plate, row, column) in wellToObjectsMap else [])
    sample = slicedSample(featureSet, frozenset(smallSample.index).union(allExemplars).union(wellObjects))
    wellCorrectCoordinates(sample)
    embedding = mdsTSNE(selectImageFeatures(smallSample))
    clusters = clustersAsTable(featureSet, exemplars).loc[sample.index]
    return sample.join(embedding).join(clusters)

@lru_cache(maxsize=5)
def wellObjectInfo(featureSet, plate, row, column):
    if plate >= 0 and (plate, row, column) in wellToObjectsMap:
        subset = slicedSample(featureSet, wellToObjectsMap[(plate, row, column)], True)
        wellCorrectCoordinates(subset)
    else:
        subset = pd.DataFrame()
    return subset

#@memory.cache
#@lru_cache(maxsize=5)
# def clusterInfo(features, exemplars):
#     clstTable = clustersAsTable(features, exemplars)
#     return clstTable.loc[smallSample.index]

def histogramClusterTable(objects, bins):
    scaledSample = scaledLargeSample    #scaledMediumSample
    #ftrMet = featureMetrics()
    colDict = {feature: pd.value_counts(pd.cut(scaledSample.loc[objects][feature].values,
                                               np.linspace(scaledMediumSample[feature].min(), scaledMediumSample[feature].max(), num=bins, endpoint=True),
                                               #bins, #np.linspace(ftrMet[feature]['min'], ftrMet[feature]['max'], num=bins, endpoint=True),
                                               labels=False)).sort_index() for feature in featureInfo().index.values}
    return pd.DataFrame(colDict, ).transpose().fillna(0)

@lru_cache(maxsize=5)
def featureHistograms(featureSet, exemplars):
    bins = 100
    histograms = {}

    # Combine feature table with cluster table.
    clusters = clustersAsTable(featureSet, exemplars).loc[mediumSample.index]

    # Histogram for all objects.
    #histograms['objects'] = histogramClusterTable(clusters.index, bins).to_dict()

    # Histograms for clusters.
    partition = clusters.groupby('population')
    for cluster, clusterTable in partition:
        print "computing histogram for cluster " + str(cluster)
        histograms[cluster] = histogramClusterTable(clusterTable.index.values, bins).to_dict()

    return histograms

#@synchronized
@lru_cache(maxsize=5)
def wellClusterShares(features, exemplars):
    print "Start clustering."
    clstTable = clustersAsTable(features, exemplars)

    print "Start table join."
    #clstTable.columns = ['population']
    sampleWellsClst = wellIndex.join(clstTable)

    print "Start pivot table."
    pivoted = pd.pivot_table(sampleWellsClst,
                             columns=['population'],
                             index=['plate', 'well_col', 'well_row'],
                             aggfunc=len)
    total = pivoted.sum(axis='columns')
    maxTotal = total.max()
    pivoted = pivoted.divide(total, axis='index')
    pivoted['objects'] = total.divide(maxTotal, axis='index')
    print "Finish pivot table."

    return pivoted

#@synchronized
@lru_cache(maxsize=5)
def wellClusterSharesFlat(features, exemplars):
    wellShares = wellClusterShares(features, exemplars)
    wellShares['plate'] = wellShares.index.get_level_values('plate').astype(str)
    wellShares['well_col'] = wellShares.index.get_level_values('well_col').astype(str)
    wellShares['well_row'] = wellShares.index.get_level_values('well_row').astype(str)
    wellShares['well'] = wellShares['plate'] + "_" + wellShares['well_col'] + "_" + wellShares['well_row']

    return wellShares.set_index('well').drop(['plate', 'well_col', 'well_row'], axis=1)

#@synchronized
# @lru_cache(maxsize=5)
# def plateMetrics(features, exemplars):
#     wellClsShares = wellClusterShares(features, exemplars)
#
#     wellShares = wellClsShares.drop('objects', 1)
#     plateShares = wellShares.groupby(level=0)
#     dict = {'min': plateShares.min(),
#             'median': plateShares.median(),
#             'max': plateShares.max()}
#     metrics = pd.concat(dict.values(), axis=1, keys=dict.keys())
#     metrics.columns = [str(col[0]) + '_' + str(col[1]) for col in metrics.columns.values]
#
#     return metrics

#def wellDetails(location):
#    return {'imageURL': wellURL(location.column, location.row, location.plate)}

# def objectWells():
#     targetSample = smallSample
#
#     resultTable = targetSample[['well_col', 'well_row', 'plate', 'spot', 'x', 'y']].copy()
#     wellCorrectCoordinates(resultTable)
#     resultTable['imageURL'] = resultTable.apply(lambda r: wellURL(int(r['well_col']), int(r['well_row']), int(r['plate'])), axis=1)
#
#     return resultTable

@memory.cache
def objectHistogram(ftr1, ftr2, bins):
    targetSample = scaledColumns(frozenset([ftr1, ftr2]))
    return np.histogram2d(targetSample[ftr1].values, targetSample[ftr2].values, bins=bins)

def objectHistogramMatrix(features, exemplars, bins):
    contours = {}

    if len(features) > 1:
        ftrTable = scaledColumns(features)
        clstTable = clustersAsTable(features, exemplars).join(ftrTable)
        partition = dict(list(clstTable.groupby('population')))
        #partition['objects'] = clstTable    # Include histogram of entire cell population.

        # Establish raw histograms for feature pairs and populations.
        histos = {}
        for cName, cTable in partition.iteritems():
            for ftr1, ftr2 in itertools.combinations(features, 2):
                histos[(cName, ftr1, ftr2)] = np.histogram2d(clstTable[ftr1].values, clstTable[ftr2].values, bins=bins)[0]

        # Divide histogram density values into quantiles (bins).
        flatDensities = np.array(histos.values()).flatten()
        flatDensities = np.trim_zeros(np.sort(flatDensities))
        bins = np.unique(np.percentile(flatDensities, range(20, 100, 20)))

        # Establish quantile level sets and derive their contours.
        for cName, cTable in partition.iteritems():
            clusterContours = {}
            contours[str(cName)] = clusterContours
            for ftr1, ftr2 in itertools.combinations(features, 2):
                counts = histos[(cName, ftr1, ftr2)]
                digitized = [np.digitize(hC, bins) for hC in counts]
                kernel = [[1, 1, 1], [1, 1, 1], [1, 1, 1]]
                eroded = grey_erosion(digitized, footprint=kernel, mode='constant')
                diff = np.sign(digitized - eroded)
                clusterContours[ftr1 + ".." + ftr2] = np.multiply(diff, digitized).tolist()

    return contours
