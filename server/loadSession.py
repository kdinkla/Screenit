import tangelo
tangelo.paths(".")
import sessionData

@tangelo.types(key=int)
def run(key):
    return sessionData.load(key)
