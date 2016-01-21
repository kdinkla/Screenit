import tangelo
tangelo.paths(".")
import compute
import json

@tangelo.types(features=compute.featureSet, exemplars=compute.exemplarDict, bins=int)
def run(features, exemplars, bins):
    return json.dumps(compute.objectHistogramMatrix(features, exemplars, bins))
