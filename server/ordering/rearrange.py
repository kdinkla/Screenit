from math import exp
from scipy.spatial.distance import pdist, squareform
from scipy.cluster.hierarchy import linkage, leaves_list
import pandas as pd

def rearrange(X, optimal = True, method = "average"):
    metric_kwargs = {}

    Y = squareform(X, force="tovector")
    Z = [(int(l), int(r), max(0., d), int(n))
         for (l, r, d, n) in linkage(Y, method=method, metric=None)]

    leaves = list(leaves_list(Z))
    N      = len(leaves)
    root   = len(Z)+N-1

    assert len(X) == N

    # bar-joseph optimal ordering
    if optimal:
        import barjoseph
        leaves = barjoseph.optimal(root, **{
            "S":        lambda i, j: exp(-X[i][j]),
            "left":     lambda i: None if i < N else Z[i-N][0],
            "right":    lambda i: None if i < N else Z[i-N][1],
            "is_leaf":  lambda i: i < N,
            "is_empty": lambda v: v is None,
        })

    assert list(sorted(leaves)) == list(range(N))

    return leaves

def rearrangeDataframe(targetFrame, distanceFrame, optimal = True, method = "average"):
    rearrangedIndices = rearrange(distanceFrame.values, optimal, method)
    oldIndex = targetFrame.index
    newIndex = [oldIndex[i] for i in rearrangedIndices]

    return targetFrame.reindex(newIndex)
