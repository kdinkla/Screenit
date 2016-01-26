#
#   This data backend is no longer up to date!
#

from pymongo import MongoClient
from monary import Monary
import numpy as np
import pandas as pd
import math

import sys
sys.path.append('../dataset')
import config

# Cache (memoize) large function outputs on disk, use in memory LRU for small, actual function outputs.
from joblib import Memory
memory = Memory(cachedir='../cache', verbose=0)

def connect():
    return Monary()

# Expected (non-image feature) columns with type.
systemObjectColumns = {
                    'plate':    'int32',
                    'column':   'int32',
                    'row':      'int32',
                    'spot':     'int32',
                    'x':        'float64',
                    'y':        'float64',
                    'class':    'string:20',
                    '_id':      'id'
}

# Column types; for now assumes all column types to be float64, except for
def objectColumnType(column):
    return systemObjectColumns[column] if column in systemObjectColumns else 'float64'

# Assumes a single object will contain all possible columns. Also returns column types.
def objectColumns():
    client = MongoClient()
    db = client['CellMorph']
    object = db.objects.find_one()
    return object.keys(), [objectColumnType(col) for col in object.keys()]

def frame(columns):
    con = MongoClient()
    db = con['CellMorph']
    sample = db.objects.find({}, {col: 1 for col in columns})
    df = pd.DataFrame(list(sample))
    df.set_index(['_id'], inplace=True)
    con.close()
    return df

#     fullColumns = ['_id'] + columns
#     con = connect()
#     types = [objectColumnType(col) for col in fullColumns]
#     print "Start query"
#     arrays = con.query('CellMorph', 'objects', {}, fullColumns, types)
#     print "Finish query"
#     matrix = np.matrix(arrays).transpose()
#     con.close()
#     df = pd.DataFrame(matrix, columns=fullColumns)
#     df.set_index(['_id'], inplace=True)
#    return df

#print frame(['ecc'])

# Connect to localhost.
@memory.cache
def objectSample(size):
    con = MongoClient()
    db = con['CellMorph']
    sample = db.objects.aggregate([{'$sample': {'size': size}}])
    df = pd.DataFrame(list(sample))
    df.set_index(['_id'], inplace=True)
    con.close()
    return df

#print objectSample(1000)

# @memory.cache
# def objectDump(features):
#     columns = list(set(features + ['id', 'plate', 'well_col', 'well_row']))
#
#     con = sqlite()
#     df = pd.read_sql_query('SELECT {0} FROM object'.format(','.join(columns)), con, index_col='id')
#     con.close()
#     return df

# Load a given column from database (caching it) and convert it to a data frame indexed by object id.
@memory.cache
def columnDump(column):
    print "Starting column dump of " + column
    return frame([column])