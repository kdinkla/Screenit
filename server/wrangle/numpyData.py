import os
import numpy as np
import pandas as pd
import random
import csv
from collections import defaultdict

# Required (non-image feature) columns.
systemObjectColumns = ['plate', 'column', 'row', 'x', 'y']

# Data sets available at directory of dataPath, where data set name matches sub-directory name.
dataPath = '../../dataset/'
dataSetPaths = {o: os.path.join(dataPath, o) for o in os.listdir(dataPath) if os.path.isdir(os.path.join(dataPath, o))}
numpyPaths = {o: path + '/columns/' for o, path in dataSetPaths.iteritems()}

# Configuration file of given data set.
def config(dataSet):
    import imp
    print "Load: " + '../dataset/' + dataSet + '/config.py'
    return imp.load_source('config', '../dataset/' + dataSet + '/config.py')

def objectColumns(dataSet):
    return [os.path.splitext(os.path.basename(file))[0] for file in os.listdir(numpyPaths[dataSet]) if file.endswith(".npy")]

# The image feature columns that are available for every object.
def imageFeatures(dataSet):
    return sorted(list(set(objectColumns(dataSet)) - set(systemObjectColumns)))

def numpyDump(dataSet, column):
    return np.load(numpyPaths[dataSet] + column + ".npy", mmap_mode="r")

# Load a given column from database (caching it) and convert it to a data frame indexed by object id.
def columnsDump(dataSet, columns):
    return pd.DataFrame({col: numpyDump(dataSet, col) for col in columns})

def objectSample(dataSet, size):
    columns = objectColumns(dataSet)
    index = range(len(columnsDump(dataSet, ['plate'])))
    indexSample = random.sample(index, size)
    return pd.DataFrame({col: np.take(numpyDump(dataSet, col), indexSample) for col in columns}, index=indexSample)

# Well annotation data.
wellPaths = {o: path + '/wells.tab' for o, path in dataSetPaths.iteritems()}

# Well annotations as a (plate, column, row) to attributes map.
def wellAnnotations(dataSet):
    inverted = {}

    if dataSet in wellPaths:
        with open(wellPaths[dataSet]) as file:
            wellAnnotations = {attributes['plate'] + "_" + attributes['column'] + "_" + attributes['row']:
                                   {cat: val.split('|') for cat, val in attributes.iteritems()
                                    if cat not in ['plate', 'column', 'row']}
                               for attributes in csv.DictReader(file, delimiter='\t')}

            # Invert nested dictionary, to put column keys at highest level.
            inverted = defaultdict(dict)
            for key, val in wellAnnotations.items():
                for subkey, subval in val.items():
                    inverted[subkey][key] = subval

    return inverted
