import tangelo
tangelo.paths(".")
import compute

@tangelo.types(dataSet=compute.dataSet, features=compute.featureSet, column=int, row=int, plate=int, exemplars=compute.exemplarDict, probes=compute.objectDict)
def run(dataSet, features, column, row, plate, exemplars, probes):
    return compute.objectInfo(dataSet, features, column, row, plate, exemplars, probes).to_json()
