# MPDA
Multi-Parameter Data Analysis for High-throughput Screening - Visualization Prototype

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

Bash:
```
sudo pip install tangelo numpy pandas scipy scikit-learn
```

Download and place the code at a location that you like, but first look at __Cache__, __Database__, and __Images__ sections for space requirements.

Install npm and then bower. Bash:
```
sudo apt-get install npm nodejs-legacy
sudo npm install -g bower
```

Use bower to install additional Javascript libraries. Bash, in the root directory of the prototype:
```
bower install
```

Run tangelo to launch the server. Bash, in the root directory of the prototype:
```
sudo tangelo -c tangelo_config.yaml
```

Browse to the server's address to try out the prototype.

## Data
Image feature data is stored per image feature as a NumPy array dump in __dataset/columns__. Every object (in a well) has a value in such an array, where the array index of an object is consistent across all columns. Everything is therefore stored at the object level, including eventual well and plate information (sacrificing disk space for sake of computation speed).

The example CellMorph data is 1.5GB and can be downloaded from Google Drive for now: https://drive.google.com/folderview?id=0B4zuo4p8QBcaN1dVUmxXVW9nR28&usp=sharing
The column data should be placed in __dataset/columns__. The __dataset__ directory already contains the __config.py__ file for CellMorph, which also contains explanatory comments per configuration option.

The code for converting the CellMorph (per plate) tab-delimited files can be found in __wrangle/liteFill.py__.

The system expects the following columns to be present:
- plate, integer ranging from 0 to N, that encodes the containing plate of the object, out of N plates
- column, integer ranging from 0 to C, that encodes the column coordinate the containing well of the object, out of C columns on a plate
- row, integer ranging from 0 to R, that encodes the row coordinate of the containing well of the object, out of R rows on a plate
- x, float that specifies the x-coordinate of the object in its well, in pixel space of the well images
- y, float that specifies the y-coordinate of the object in its well, in pixel space of the well images

## Directory structure
__server__ contains all server-side Python code. Currently, most files serve as API delegators for the Tangelo web server.

__wrangle__ contains code that can be used to scrape all image feature data from the CellMorph comma-separated files and store it in a SQLite database as described in the __Database__ section.