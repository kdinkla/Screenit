import tangelo
tangelo.paths(".")
import compute
import json

@tangelo.types(dataSet=compute.dataSet, features=compute.featureSet, exemplars=compute.exemplarDict, bins=int)
def run(dataSet, features, exemplars, bins):
    return json.dumps(compute.objectHistogramMatrix(dataSet, features, exemplars, bins))
