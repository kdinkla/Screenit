import tangelo
tangelo.paths(".")
import compute

@tangelo.types(dataSet=compute.dataSet)
def run(dataSet):
    return compute.featureInfo(dataSet)
