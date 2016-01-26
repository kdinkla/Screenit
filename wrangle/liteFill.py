import config
import sqlite3 as lite
import traceback
import os.path
from fastnumbers import fast_real
import csv

# Return parameter types and names.
def objectFeatures():
    firstFilePath = config.inputPath + "HT01/HT01A004_ftrs.tab"
    with open(firstFilePath, 'rb') as csvfile:
        reader = csv.reader(csvfile, delimiter='\t')
        header = reader.next()
        firstValues = [fast_real(v) for v in reader.next()]

    names = [config.formatField(f) for f in header]
    types = ['INTEGER' if isinstance(v, int) else 'REAL' if isinstance(v, float) else 'TEXT' for v in firstValues]

    return {name: types[i] for i, name in enumerate(names)}

try:
    # Remove any old database.
    for fileName in ["core.db"]:
        try:
            os.remove(config.outputPath + fileName)
        except Exception, e:
            pass

    # Create a SQL lite schema (and clear out any current content).
    con = config.connect()
    cur = con.cursor()

    # Clear database by dropping tables
    #tables = ["object"]
    #for t in tables:
    #    cur.execute("DROP TABLE IF EXISTS {0}".format(t))

    # Setup object table, include plate and well attributes.
    attributes = objectFeatures()
    attributes['plate'] = "INTEGER"
    attributes['column'] = "INTEGER"
    attributes['row'] = "INTEGER"
    attributes['img_rgb'] = "TEXT"
    attributes['img_seg'] = "TEXT"
    fCT = ','.join([config.formatField(at) + " " + type for at, type in attributes.items()])  # SQL fields and types.

    cur.execute("CREATE TABLE object(id INTEGER PRIMARY KEY, {0})".format(fCT))

    #colTags = [c for c in 'ABCDEFGHIJKKLMNOP']

    # Fill remainder per well CSV.
    # plate = config.plates[0]
    wellPath = -1
    for plate in range(68):     #range(1, 69): #config.plates:
        for col in range(len(config.columns)):
            for row in range(21):       #range(4,25):
                plateTag = config.plateTag(plate)   #"HT" + str(plate).zfill(2)
                colTag = config.columnTag(col)  #colTags[col]
                rowTag = config.rowTag(row) #str(row).zfill(3)
                wellPath = config.inputPath + plateTag + "/" + plateTag + colTag + rowTag + "_ftrs.tab"

                #print "Well file: " + wellPath

                if os.path.exists(wellPath):
                    # Read features.
                    featureDicts = csv.DictReader(open(wellPath), delimiter='\t')
                    for d in featureDicts:
                        # Extract direct attributes and include plate and well attributes.
                        attributes = {k: fast_real(v) for k, v in d.iteritems()}
                        attributes['plate'] = plate
                        attributes['column'] = col
                        attributes['row'] = row
                        attributes['img_rgb'] = config.wellURL(col, row, plate, "rgb")
                        attributes['img_seg'] = config.wellURL(col, row, plate, "seg")

                        fC = ','.join([config.formatField(at) for at, type in attributes.items()])
                        fV = ','.join(["'" + str(a) + "'" for a in attributes.values()])  # SQL values.

                        # Insert object features.
                        query = "INSERT INTO object ({0}) VALUES ({1})".format(fC, fV)
                        cur.execute(query)

                        objectId = cur.lastrowid
                else:
                    print "Well " + plateTag + colTag + rowTag + " has no file."

        # Commit per plate.
        con.commit()

        print "Inserted plate " + plateTag

except lite.Error, e:
    con.rollback()

    traceback.print_exc()

finally:
    con.close()
