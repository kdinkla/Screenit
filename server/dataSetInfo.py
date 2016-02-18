import tangelo
tangelo.paths(".")
import compute

@tangelo.types(dataSet=compute.dataSet)
def run(dataSet):
    config = compute.configuration(dataSet)
    return {'plateLabels': config.plates, 'columnLabels': config.columns, 'rowLabels': config.rows}
