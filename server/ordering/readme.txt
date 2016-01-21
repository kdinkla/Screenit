0. licence

Copyright (c) 2011--2015, IIHM/LIG - Renaud Blanch <http://iihm.imag.fr/blanch/>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>


1. content

Implementation of binary tree optimal ordering described in
[Bar-Joseph et al., 2003]


2. dependencies

python: <https://www.python.org/>

for the sample command line tool :
scipy: <http://www.scipy.org/>


3. running

The ordering command line tool accept a similarity matrix or some vectors
on its standard input, and reports the vector sorted on its standard output.
The data.py scripts produces some random vectors, so you can test the program
by launching:

    python3 data.py | ./ordering.py -d 'cosine'


4. references

[Bar-Joseph et al., 2003]
K-ary Clustering with Optimal Leaf Ordering for Gene Expression Data.
Ziv Bar-Joseph, Erik D. Demaine, David K. Gifford, Angèle M. Hamel,
Tommy S. Jaakkola and Nathan Srebro
Bioinformatics, 19(9), pp 1070-8, 2003.
http://www.cs.cmu.edu/~zivbj/compBio/k-aryBio.pdf
