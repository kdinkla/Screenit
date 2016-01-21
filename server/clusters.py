import tangelo
tangelo.paths(".")
import compute
import jsonlib as json

@tangelo.types(features=compute.featureSet, exemplars=compute.exemplarDict)
def run(features, exemplars):
    return compute.clusterInfo(features, exemplars).to_json()
