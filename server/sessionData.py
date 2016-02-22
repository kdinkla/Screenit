import os
import random

sessionPath = "../session/"

def paths():
    return {int(o): os.path.join(sessionPath, o) for o in os.listdir(sessionPath)
            if os.path.isfile(os.path.join(sessionPath, o))}

def create():
    # Determine existing sessions identifiers that are in use.
    existing = paths().keys()

    # Generate new session key, retry on conflict.
    maxKey = 10**9
    newKey = random.randint(0, maxKey)
    while newKey in existing:
        newKey = random.randint(0, maxKey)

    # Create session file.
    file = open(sessionPath + str(newKey), 'w')
    file.write("{}")
    file.close()

    return newKey

def store(key, state):
    file = open(sessionPath + str(key), 'w')
    file.write(state)
    file.close()

def load(key):
    try:
        file = open(sessionPath + str(key), 'r')
        state = file.read()
        file.close()
    except:
        state = "{}"

    return state
