# Screenit
A web-based tool that enables multi-parameter data analysis for high-throughput screening. Screenit was developed at the [Visual Computing Group](https://vcglab.org/screenit/)

## Installation
Install the following software packages:
- Python `2.7`
- Pip

Bash:
```
sudo apt-get install python python-dev python-pip
```

Use Pip to install the following Python packages:
- tangelo `>= 0.9.0`
- numpy `>= 1.10.1`
- pandas `>= 0.17.0`
- scipy `>= 0.13`
- scikit-learn `>= 0.17`
- wrapt `>= 1.10.5`


Bash:
```
sudo pip install tangelo numpy pandas scipy scikit-learn
```

Download and place the code at a location that you like, but first look at __Database__ and __Images__ sections for space requirements.

Install npm and then bower. Bash:
```
sudo apt-get install npm nodejs-legacy
sudo npm install -g bower
```

Use bower to install additional Javascript libraries. Bash, in the root directory of the prototype:
```
bower install
```

Add an directory __session__ to the root.

Run tangelo to launch the server. Bash, in the root directory of the prototype:
```
sudo tangelo -c tangelo_config.yaml
```

Browse to the server's address to try out the prototype.

## Data
Data sets are stored in the __dataset__ directory, which you will have to create upon installation. Multiple data sets are supported via sub-directories. For example, __dataset/DataSetName__ contains all files for a data set named __DataSetName__.

Image feature data is stored as a NumPy array dump per image feature in __dataset/DataSetName/columns__. Every object (in a well) has a value in such an array, where the array index of an object is consistent across all columns. Everything is therefore stored at the object level, including eventual well and plate information (sacrificing disk space for sake of computation speed). Two special files __mds0__ and __mds1__ can be included in the __columns__ as well, these provide the coordinates for the landscape plot that can for example be a 2D projection of the high-dimensional feature space.

Well annotation data is stored as a tab-delimited file __dataset/DataSetName/wells.tab__. The file contains __plate   column  row__ columns to designate the well, and additional columns for annotations categories. A single well can be given multiple annotations of a single category by giving a list of annotations as __annotation1|annotation2|annotation3__.

The example CellMorph data is 1.5GB and can be downloaded from Google Drive for now: https://drive.google.com/file/d/0B4zuo4p8QBcaSThHMm1jX2kwUkU/view?usp=sharing&resourcekey=0-T3f0SyvEb-LBHokHrgF_0Q
The __dataset/CellMorph__ directory already contains the __config.py__ file for CellMorph, which also contains explanatory comments per configuration option.

The code for converting the CellMorph (per plate) tab-delimited files to NumPy columns can be found in __wrangle/numpyFill.py__.

The system expects the following columns to be present in __dataset/DataSetName/columns__:
- __plate__, integer ranging from 0 to N, that encodes the containing plate of the object, out of N plates
- __column__, integer ranging from 0 to C, that encodes the column coordinate the containing well of the object, out of C columns on a plate
- __row__, integer ranging from 0 to R, that encodes the row coordinate of the containing well of the object, out of R rows on a plate
- __x__, float that specifies the x-coordinate of the object in its well, in pixel space of the well images
- __y__, float that specifies the y-coordinate of the object in its well, in pixel space of the well images

All other columns in the __dataset/DataSetName/columns__ directory are assumed to contain image features as floating point values. The CellMorph data stores image features as 32-bit floats to reduce storage and increase performance, but more precise floats are supported as well.

## Code organization
__server__ contains all server-side Python code. Currently, most files serve as API delegators for the Tangelo web server:
- __compute.py__ contains all interactive computation code
- __numpyData.py__ the data retrieval backend, which can be swapped in the future.

__wrangle/numpyFill__ contains code that can be used to scrape all image feature data from the CellMorph comma-separated files (per plate) and store it as NumPy columns in the __Data__ section.

__src__ contains all client-side code, which is written primarily in Typescript. __typings__ contains type definition files that interface TypeScript with common JavaScript libraries found in __bower_components__ and configured in __bower.json__.
