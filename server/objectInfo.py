import tangelo
tangelo.paths(".")
import compute

@tangelo.types(features=compute.featureSet, column=int, row=int, plate=int, exemplars=compute.exemplarDict)
def run(features, column, row, plate, exemplars):
    return compute.objectInfo(features, column, row, plate, exemplars).to_json()
