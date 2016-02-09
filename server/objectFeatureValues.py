import tangelo
tangelo.paths(".")
import compute

@tangelo.types(column=int, row=int, plate=int, exemplars=compute.exemplarDict)
def run(column, row, plate, exemplars):
    return compute.objectFeatureValues(column, row, plate, exemplars).to_json()
