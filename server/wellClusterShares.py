import tangelo
tangelo.paths(".")
import compute

@tangelo.types(dataSet=compute.dataSet, features=compute.featureSet, exemplars=compute.exemplarDict)
def run(dataSet, features, exemplars):
    return compute.wellClusterSharesFlat(dataSet, features, exemplars).to_json()
