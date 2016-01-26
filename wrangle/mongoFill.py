#
#   This code is no longer up to date!
#

import config
import os.path
from fastnumbers import fast_real
import csv
from pymongo import MongoClient

try:
    client = MongoClient()
    client.drop_database('CellMorph')   # Clear old database.
    db = client['CellMorph']
    objectCol = db.objects

    # Fill remainder per well CSV.
    for plate in range(68):
        plateTag = config.plateTag(plate)
        plateObjects = []

        for col in range(len(config.columns)):
            colTag = config.columnTag(col)

            for row in range(21):
                rowTag = config.rowTag(row)
                wellPath = config.inputPath + plateTag + "/" + plateTag + colTag + rowTag + "_ftrs.tab"

                # Read and insert features.
                if os.path.exists(wellPath):
                    for d in csv.DictReader(open(wellPath), delimiter='\t'):
                        # Extract direct attributes and include plate and well attributes.
                        attributes = {config.formatField(k): fast_real(v) for k, v in d.iteritems()}
                        attributes['plate'] = plate
                        attributes['column'] = col
                        attributes['row'] = row
                        # TODO: image URLs

                        plateObjects.append(attributes)
                else:
                    print "Well " + plateTag + colTag + rowTag + " has no file."

        # Bulk object insert for plate.
        objectCol.insert_many(plateObjects)

        print "Inserted plate " + plateTag
finally:
    client.close()
