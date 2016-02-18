import config
import os.path
from fastnumbers import fast_real
import csv
import numpy as np

# Return parameter types and names.
objectFeatures = {}

firstFilePath = config.inputPath + "HT01/HT01A004_ftrs.tab"
with open(firstFilePath, 'rb') as csvfile:
    reader = csv.reader(csvfile, delimiter='\t')
    header = reader.next()
    firstValues = [fast_real(v) for v in reader.next()]

    types = [np.int32 if isinstance(v, int) else np.float32 if isinstance(v, float) else np.object for v in firstValues]

    for i, name in enumerate(header):
        objectFeatures[name] = types[i]

objectFeatures['plate'] = np.int32
objectFeatures['column'] = np.int32
objectFeatures['row'] = np.int32

del objectFeatures['class']
del objectFeatures['spot']

features = objectFeatures.keys()

def openTextFile(feature, mode):
    return open(config.outputPath + feature + ".txt", mode)

def fillText():
    try:
        # Create column dump files for all features.
        featureFiles = {ftr: openTextFile(ftr, "w") for ftr in features}

        # Fill remainder per well CSV.
        for plate in range(68):
            plateTag = config.plateTag(plate)

            for col in range(len(config.columns)):
                colTag = config.columnTag(col)

                for row in range(21):
                    rowTag = config.rowTag(row)
                    wellPath = config.inputPath + plateTag + "/" + plateTag + colTag + rowTag + "_ftrs.tab"

                    # Read and insert features.
                    if os.path.exists(wellPath):
                        for attributes in csv.DictReader(open(wellPath), delimiter='\t'):
                            # Extract direct attributes and include plate and well attributes.
                            attributes['plate'] = plate
                            attributes['column'] = col
                            attributes['row'] = row

                            # Correct well coordinates to account for spot.
                            if int(attributes['spot']) in [2, 4]:
                                attributes['x'] = float(attributes['x']) + 673.0
                            if int(attributes['spot']) in [3, 4]:
                                attributes['y'] = float(attributes['y']) + 512.0

                            # Exclude spot.
                            del attributes['spot']

                            for attr, val in attributes.iteritems():
                                if attr in features:
                                    featureFiles[attr].write(str(val) + "\n")
                    else:
                        print "Well " + plateTag + colTag + rowTag + " has no file."

            print "Text dumped plate " + plateTag

        # Close tex dump files.
        for ftr, file in featureFiles.iteritems():
            file.close()
    finally:
        print "Finished column fill."

#fillText()

def fillNumpy():
    # Convert each text dump file to a numpy file.
    for ftr in features:
        try:
            textFile = openTextFile(ftr, "r")
            arr = np.loadtxt(textFile, delimiter="\n", dtype=objectFeatures[ftr])
            textFile.close()

            np.save(config.outputPath + ftr, arr)

            print "Converted " + ftr
        except Exception, e:
            print "Failed to convert " + ftr + str(e)

fillNumpy()