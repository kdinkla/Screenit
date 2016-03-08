import numpyData as data
import numpy as np
from tsne import bh_sne
from invdisttree import Invdisttree
from matplotlib.colors import LogNorm
import matplotlib.pyplot as plt
from sklearn.manifold import TSNE
import math

sampleSize = 100000
dataPath = "data/"
valuesFile = dataPath + "mds_sample_values.npy"
projectionFile = dataPath + "mds_sample_projection.npy"
mds0File = dataPath + "mds0.npy"
mds1File = dataPath + "mds1.npy"

def featureColumns(dataSet):
    def column(colName):
        col = data.numpyDump(dataSet, colName).astype(np.float64)
        return (col - np.mean(col)) / np.std(col)

    return np.array([column(col) for col in data.imageFeatures(dataSet)])

    #                  [
    #     'Tt.asm', 'TI1', 'Tt.den', 'Tt.sav', 'At.sav', 'At.den',
    #     'Nt.den', 'Nz.0303', 'ext', 'Tz.0301', 'Tz.0404', 'ecc'
    # ]])

def mds(dataSet):
    # Load all feature columns.
    rows = featureColumns(dataSet).transpose()

    sampledRows = rows[np.random.randint(len(rows), size=sampleSize)]

    print sampledRows

    print "Begin TSNE."
    projection = bh_sne(sampledRows, perplexity=5) #perplexity=math.sqrt(len(sampledRows)))
    print "End TSNE."

    #model = TSNE(n_components=2, random_state=0)
    #projection = model.fit_transform(sampledRows)

    # Save intermediate MDS.
    np.save(valuesFile, sampledRows)
    np.save(projectionFile, projection)

def extrapolateOtherCoordinates(dataSet):
    values = np.load(valuesFile)
    projection = np.load(projectionFile)

    rows = featureColumns(dataSet).transpose()

    invDist = Invdisttree(values, projection)
    inferCols = invDist(rows).transpose()

    np.save(mds0File, inferCols[0])
    np.save(mds1File, inferCols[1])

def verify(sub):
    subMDS = np.load(projectionFile).transpose() if sub else [np.load(mds0File), np.load(mds1File)]

    plt.hist2d(subMDS[0], subMDS[1], bins=200, norm=LogNorm(), cmap=plt.cm.afmhot)
    plt.colorbar()
    plt.show()

mds('CellMorph')
verify(True)

#extrapolateOtherCoordinates('CellMorph')
#verify(False)
