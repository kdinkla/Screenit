import tangelo
tangelo.paths(".")
import compute

@tangelo.types(dataSet=compute.dataSet, features=compute.featureSet, column=int, row=int, plate=int, exemplars=compute.exemplarDict)
def run(dataSet, features, column, row, plate, exemplars):
    return compute.objectInfo(dataSet, features, column, row, plate, exemplars).to_json()
