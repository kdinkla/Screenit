import tangelo
tangelo.paths(".")
import compute

def run():
    return compute.featureInfo().to_json()