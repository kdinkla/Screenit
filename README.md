# MPDA
Multi-Parameter Data Analysis for High-throughput Screening - Visualization Prototype

## Installation
Install the following software packages:
- Python 2.7
- Pip

Linux:
```
sudo apt-get install python python-dev python-pip
```

Use Pip to install the following Python packages:
- tangelo
- numpy
- pandas
- scikit-learn
- joblib

Linux:
```
sudo pip install tangelo numpy pandas scikit-learn joblib
```

Download and place the code at a location that you like, but first look at __Cache__, __Database__, and __Images__ sections for space requirements.

Install npm and then bower.

Linux:
```
sudo apt-get install npm
sudo apt-get install nodejs-legacy
sudo npm install -g bower
```
Use bower to install additional Javascript libraries.

Linux, in the root directory of the prototype code:
```
bower install
```

Run tangelo to launch the server:
```
sudo tangelo -c tangelo_config.yaml
```

Browse to the server's address to try out the prototype. Be warned that the first time it may take a while to launch the prototype; it will be setting up its data.

## Cache
The server-side caches the results of large computations on disk in the __cache__ directory. This directory can be replaced by a symbolic link to a more suited disk or location. Cache size will probably stay below 100GB for the CellMorph data set.

## Database
Image feature data is stored in a SQLite database that contains a single table __objects__.

## Directory structure
__server__ contains all server-side Python code. Currently, most files serve as API delegators for the Tangelo web server.

__wrangle__ contains code that can be used to scrape all image feature data from the CellMorph comma-separated files and store it in a SQLite database as described in the __Database__ section.