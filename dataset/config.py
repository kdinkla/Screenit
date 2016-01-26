#
# Data set specific configuration.
#

# Plates, column, and rows are stored as numbers in the range [0..N) in column files plate.npy, column.npy, and row.npy

# Map of N database plate identifiers [0..N) to plate names.
plates = ["HT" + str(i).zfill(2) for i in range(1, 69)]     # 0 -> 'HT01'

# Map of N database column identifiers [0..N) to column names.
columns = [c for c in 'ABCDEFGHIJKLMNOP']       # 0 -> 'A'

# Map of N database row identifiers [0..N) to row names.
rows = [str(r).zfill(3) for r in range(4, 25)]      # 0 -> '001'

def img(plate, column, row):
    plateTag = plates[plate]
    wellTag = plateTag + columns[column] + rows[row]
    return "http://www.ebi.ac.uk/huber-srv/cellmorph/view/" + plateTag + "/" + wellTag + "/" + wellTag
    #return "dataset/images/" + plateTag + "/" + wellTag + "/" + wellTag

# URLs for different image types are dynamically resolved for plate, column, and row numbers.
def imgRGB(plate, column, row):
    return img(plate, column, row) + "_rgb.jpeg"

def imgSeg(plate, column, row):
    return img(plate, column, row) + "_seg.jpeg"

# Specify the image type name and matching URL function.
wellImages = {'Normal': imgRGB, 'Segmented': imgSeg}
