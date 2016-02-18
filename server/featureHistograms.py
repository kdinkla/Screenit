import tangelo
tangelo.paths(".")
import compute
import json

@tangelo.types(dataSet=compute.dataSet, features=compute.featureSet, exemplars=compute.exemplarDict)
def run(dataSet, features, exemplars):
    return json.dumps(compute.featureHistograms(dataSet, features, exemplars, 100))
