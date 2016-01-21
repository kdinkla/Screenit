import tangelo
tangelo.paths(".")

import sys
sys.path.append('../dataset')
import config

def run():
    return {'plateLabels': config.plates, 'columnLabels': config.columns, 'rowLabels': config.rows}
