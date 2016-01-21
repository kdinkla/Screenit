import sqlite3 as lite
import csv

# Constants.
inputPath = "/Users/kdinkla/Desktop/Novartis/HCS/CellMorph/www.ebi.ac.uk/huber-srv/cellmorph/data/"
outputPath = "/Users/kdinkla/Desktop/Novartis/HCS/CellMorph/db/"
sqlDotReplacement = '_'

# Screening parameters.
plates = ["HT" + str(i).zfill(2) for i in range(1, 69)]
plateDirectories = [inputPath + d + "/" for d in plates]
columns = [c for c in 'ABCDEFGHIJKLMNOP']
rows = [str(r).zfill(3) for r in range(4, 25)]
imageSpots = range(1, 5)
assignedClasses = {
    "AF":   "Actin fiber",
    "BC":   "Big cells",
    "C":    "Condensed",
    "D":    "Debris",
    "LA":   "Lamellipodia",
    "M":    "Metaphase",
    "MB":   "Membrane blebbing",
    "N":    "Normal",
    "P":    "Protruded",
    "Z":    "Telophase"
}

# Derived.
dbPath = outputPath + "core.db"

# Connect to SQLite database.
def connect():
    return lite.connect(dbPath)

# Format object feature field for SQL.
def formatField(field):
    return field.replace(".", sqlDotReplacement)

# Convert plate index (starting at 1) to plate tag.
def plateTag(index):
    return plates[index]

def columnTag(index):
    return columns[index]

def rowTag(index):
    return rows[index]

# Determine object feature fields.
def objectFeatures():
    firstFilePath = inputPath + "HT01/HT01A004_ftrs.tab"
    with open(firstFilePath, 'rb') as csvfile:
        reader = csv.reader(csvfile, delimiter='\t')
        header = reader.next()

    return [formatField(f) for f in header if f != 'spot' and f != 'class']

# Directory of feature file of given plate, column, and row.
def featureDirectory(plate, column, row):
    return inputPath + plate + "/" + plate + column + row + "_ftrs.tab"