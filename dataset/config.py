#
# Data set specific configuration.
#

# Path to SQLite database.
litePath = 'lite.db'

# Map of N database plate identifiers [0..N) to plate names.
plates = ["HT" + str(i).zfill(2) for i in range(1, 69)]     # 0 -> 'HT01'

# Map of N database column identifiers [0..N) to column names.
columns = [c for c in 'ABCDEFGHIJKLMNOP']   # 0 -> 'A'

# Map of N database row identifiers [0..N) to row names.
rows = [str(r).zfill(3) for r in range(4, 25)]  # 0 -> '001'

# All image features that are stored in the object table of the database.
features = ['AI1', 'AinNint', 'At_asm', 'At_con', 'At_cor', 'At_den', 'At_dva', 'At_ent', 'At_f12', 'At_idm', 'At_sav', 'At_sen', 'At_sva', 'At_var', 'AtoTint', 'Az_0101', 'Az_0202', 'Az_0301', 'Az_0303', 'Az_0404', 'NCdist', 'Necc', 'Next', 'Nint', 'Nt_den', 'Nt_ent', 'NtoATint', 'NtoATsz', 'Nz_0303', 'TI1', 'TinNint', 'Tt_asm', 'Tt_con', 'Tt_cor', 'Tt_den', 'Tt_dva', 'Tt_ent', 'Tt_f12', 'Tt_idm', 'Tt_sav', 'Tt_sen', 'Tt_sva', 'Tt_var', 'Tz_0101', 'Tz_0202', 'Tz_0301', 'Tz_0303', 'Tz_0404', 'ecc', 'ext', 'int']

# Resolves directory for given database column, row, and plate number.
def wellURL(column, row, plate):
    plateTag = plates[plate]
    wellTag = plateTag + columns[column] + rows[row]
    return "dataset/images/" + plateTag + "/" + wellTag + "/" + wellTag + "_seg.jpeg"