import tangelo
tangelo.paths(".")
import compute
import json
from frozendict import frozendict

@tangelo.types(features=compute.featureSet, exemplars=compute.exemplarDict)
def run(features, exemplars):
    return compute.wellClusterSharesFlat(features, exemplars).to_json()
