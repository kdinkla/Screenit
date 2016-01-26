#
#   This data backend is no longer up to date!
#

import sqlite3 as lite
import sys
import pandas as pd
sys.path.append('../dataset')
import config
litePath = '../dataset/' + config.litePath

# Cache (memoize) large function outputs on disk, use in memory LRU for small, actual function outputs.
from joblib import Memory
memory = Memory(cachedir='../cache', verbose=0)

# Connect to SQLite database.
def sqlite():
    return lite.connect(litePath)

# Expected (non-image feature) columns.
systemObjectColumns = [
                    'plate',
                    'column',
                    'row',
                    'spot',
                    'x',
                    'y',
                    'class',
                    'img_rgb',
                    'img_seg'
]

@memory.cache
def objectSample(size):
    con = sqlite()
    df = pd.read_sql_query('SELECT * FROM object ORDER BY RANDOM() LIMIT {0}'.format(size), con, index_col='id')
    con.close()
    return df

# The image feature columns that are available for every object.
def imageFeatures():
    sf = objectSample(1)
    return sorted(list(set(sf.columns) - set(systemObjectColumns)))

# Load a given column from database (caching it) and convert it to a data frame indexed by object id.
@memory.cache
def columnDump(column):
    print "Starting column dump of " + column

    colStr = ','.join(['id', column])
    con = sqlite()
    df = pd.read_sql_query('SELECT {0} FROM object'.format(colStr), con, index_col='id')
    con.close()

    return df