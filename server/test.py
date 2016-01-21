import compute

# for ftr in imageFeatures(smallSample):
#     print scaledColumn(ftr).min()
#     print scaledColumn(ftr).median()
#     print scaledColumn(ftr).max()


#print objectHistogramMatrix(['Az_0301', 'Tt_cor', 'Nint', 'int'], 100)

#normalizeLogicle(columns(['Az_0301', 'Tt_cor', 'Nint', 'int'])).hist(bins=100)
#columns(['Az_0301', 'Tt_cor', 'Nint', 'int']).hist(bins=100)
#plt.show()

# H, xedges, yedges = objectHistogram('Nt_ent', 'Nt_den', 100)
# fig = plt.figure(figsize=(5, 5))
# ax = fig.add_subplot(132)
# ax.set_title('pcolormesh: exact bin edges')
# X, Y = np.meshgrid(xedges, yedges)
# ax.pcolormesh(X, Y, H)
# #ax.set_aspect('equal')
# plt.show()

# H = objectHistogramMatrix(['At_sen', 'Nt_den'], 90)['At_sen..Nt_den']
# H = objectHistogramMatrix(['Nt_ent', 'Nt_den'], 90)['Nt_ent..Nt_den']

# fig = plt.figure(figsize=(6, 3.2))
# ax = fig.add_subplot(111)
# ax.set_title('colorMap')
# plt.imshow(H)
# ax.set_aspect('equal')

# plt.matshow(H)
# plt.show()

#print clustersAsTable({}, columns(['ecc', 'Tt_idm']))
#print clustersAsTable({1: [300, 200, 1000], 2: [234, 542, 5053], 3: [643, 4530, 1321, 3534]}, columns(['ecc', 'Tt_idm']))

#print featureHistograms(frozenset(['ecc', 'Tt_idm']), frozenset([(1, frozenset([300, 200, 1000])), (2, frozenset([234, 542, 5053])), (3, frozenset([643, 4530, 1321, 3534]))]), 100)

#print wellClusterShares([], {})
#print wellClusterSharesFlat(['ecc', 'Tt_idm'], {})
#print wellClusterSharesFlat([], {})

#print plateMetrics([], {})

#print objectHistogramMatrix(frozenset(['ecc', 'Tt_idm']), frozenset([(1, frozenset([300, 200, 1000])), (2, frozenset([234, 542, 5053])), (3, frozenset([643, 4530, 1321, 3534]))]), 90)

#print json.dumps(objectHistogramMatrix(frozenset(['ecc', 'Tt_idm']), frozenset({}), 90))
