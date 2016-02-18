import tangelo
tangelo.paths(".")
import compute

@tangelo.types(dataSet=compute.dataSet, column=int, row=int, plate=int, exemplars=compute.exemplarDict)
def run(dataSet, column, row, plate, exemplars):
    return compute.objectFeatureValues(dataSet, column, row, plate, exemplars).to_json()
