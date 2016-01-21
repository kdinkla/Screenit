#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Command line utility to perform clustering and optimal ordering.

Copyright (c) 2011--2015, IIHM/LIG - Renaud Blanch <http://iihm.imag.fr/blanch/>
Licence: GPLv3 or higher <http://www.gnu.org/licenses/gpl.html>
"""


##############################################################################
# arguments handling #########################################################
##############################################################################


import sys
import getopt
import textwrap


DEFAULTS = {
	"sep":    '\t',
	"metric": None,
	"method": "average",
}

def exit_usage(name, message=None, code=0):
	if message:
		sys.stderr.write("%s\n" % message)
	sys.stderr.write(textwrap.dedent("""\
	Usage: %(name)s [-hs:d:p:l:n] <filename>
		-h  --help               print this help message then exit
		-s  --separator <sep>    use 'sep' as input delimitor (defaults to %(sep)r)
		-d  --distance <metric>  use 'metric' distance
		                         if not set, input is interpreted directly as a distance matrix
		                         else, input is interpreted as observations
		-p  --p-norm <p>         use p as exponent for p-norms (like minkowski)
		-l  --linkage <method>   use 'method' linkage (defaults to %(method)r)
		-n  --nooptimal          do not use bar-joseph's optimal leaf ordering
		<filename>               input (if none given, stdin used)
	""") % dict(name=name, **DEFAULTS))
	sys.exit(code)


prog_name, *args = sys.argv
try:
	options, args = getopt.getopt(args, "hs:nd:p:l:",
	                              ["help", "separator=", "nooptimal",
	                               "distance=", "p-norm=", "linkage="])
except getopt.GetoptError as message:
	exit_usage(prog_name, message, 1)

if len(args) > 1:
	exit_usage(prog_name, "at most one argument is expected", 1)

optimal = True
sep =    DEFAULTS["sep"]
metric = DEFAULTS["metric"]
method = DEFAULTS["method"]
metric_kwargs = {}

for opt, value in options:
	if opt in ["-h", "--help"]:
		exit_usage(prog_name)
	elif opt in ["-n", "--nooptimal"]:
		optimal = False
	elif opt in ["-s", "--separator"]:
		sep = value
	elif opt in ["-d", "--distance"]:
		metric = value
	elif opt in ["-p", "--p-norm"]:
		metric_kwargs["p"] = float(value)
	elif opt in ["-l", "--linkage"]:
		method = value


##############################################################################
# data #######################################################################
##############################################################################

from math import exp
from scipy.spatial.distance import pdist, squareform
from scipy.cluster.hierarchy import linkage, leaves_list


if len(args) == 0: # reading from stdin
	data_stream = sys.stdin
else:
	data_stream = open(args[0])

names = []
vectors = []
for line in data_stream:
	line = line.strip()
	if not line:
		continue
	name, *vector = line.split(sep)
	names.append(name)
	vectors.append([float(u) for u in vector])

if metric is None:
	X = vectors
	Y = squareform(vectors, force="tovector")
else:
	Y = pdist(vectors, metric=metric, **metric_kwargs)
	X = squareform(Y, force="tomatrix")

Z = [(int(l), int(r), max(0., d), int(n))
     for (l, r, d, n) in linkage(Y, method=method, metric=None)]

leaves = list(leaves_list(Z))
N      = len(leaves)
root   = len(Z)+N-1

assert len(X) == N


# bar-joseph optimal ordering

if optimal:
	import barjoseph
	leaves = barjoseph.optimal(root, **{
		"S":        lambda i, j: exp(-X[i][j]),
		"left":     lambda i: None if i < N else Z[i-N][0],
		"right":    lambda i: None if i < N else Z[i-N][1],
		"is_leaf":  lambda i: i < N,
		"is_empty": lambda v: v is None,
	})

assert list(sorted(leaves)) == list(range(N))


# output

for leaf in leaves:
	print(format(names[leaf], "%ss" % max(len(name) for name in names)),
	      *vectors[leaf], sep=sep)
