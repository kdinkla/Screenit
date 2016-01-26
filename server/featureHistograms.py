import tangelo
tangelo.paths(".")
import compute
import json

@tangelo.types(features=compute.featureSet, exemplars=compute.exemplarDict)
def run(features, exemplars):
    return json.dumps(compute.featureHistograms(features, exemplars, 100))
