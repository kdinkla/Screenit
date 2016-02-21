import tangelo
tangelo.paths(".")
import sessionData

@tangelo.types(key=int)
def run(key, state):
    sessionData.store(key, state)
