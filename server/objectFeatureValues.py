import tangelo
tangelo.paths(".")
import compute

@tangelo.types(dataSet=compute.dataSet, column=int, row=int, plate=int, exemplars=compute.exemplarDict, probes=compute.objectDict)
def run(dataSet, column, row, plate, exemplars, probes):
    return compute.objectFeatureValues(dataSet, column, row, plate, exemplars, probes).to_json()
