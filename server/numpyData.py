import os
import numpy as np
import pandas as pd
import random

dataPath = '../dataset/'
numpyPath = dataPath + 'columns/'

# Expected (non-image feature) columns.
systemObjectColumns = ['plate', 'column', 'row', 'x', 'y']

def objectColumns():
    return [os.path.splitext(os.path.basename(file))[0] for file in os.listdir(numpyPath) if file.endswith(".npy")]

# The image feature columns that are available for every object.
def imageFeatures():
    return sorted(list(set(objectColumns()) - set(systemObjectColumns)))

def numpyDump(column):
    return np.load(numpyPath + column + ".npy", mmap_mode="r")

# Load a given column from database (caching it) and convert it to a data frame indexed by object id.
def columnsDump(columns):
    return pd.DataFrame({col: numpyDump(col) for col in columns})

def objectSample(size):
    columns = objectColumns()
    index = range(len(columnsDump(['plate'])))
    indexSample = random.sample(index, size)
    return pd.DataFrame({col: np.take(numpyDump(col), indexSample) for col in columns}, index=indexSample)

# def mdsTSNE():
#     import sklearn.manifold.t_sne as tsne
#
#     selectFeatures = ['int', 'ext', 'At_den']
#     subset = columnsDump[]#objectSample(1000)[imageFeatures()]
#
#     print "Start TSNE of sample."
#     tsneObj = tsne.TSNE(metric="euclidean")
#     P = tsneObj.fit_transform(subset.values)
#     print "End TSNE."
#
#     print P
#
#     return subset.fillna(0.5)

#print mdsTSNE()