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
- scikit-learn `>= 0.17`
- joblib `>= 0.8.4`
- wrapt `>= 1.10.5`
- frozendict `>= 0.5`

Bash:
```
sudo pip install tangelo numpy pandas scikit-learn joblib wrapt frozendict
```

Download and place the code at a location that you like, but first look at __Cache__, __Database__, and __Images__ sections for space requirements.

Install npm and then bower. Bash:
```
sudo apt-get install npm
sudo apt-get install nodejs-legacy
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

Browse to the server's address to try out the prototype. Be warned that the first time it may take a while to launch the prototype; it will be setting up its data.

## Cache
The server-side caches the results of large computations on disk in the __cache__ directory. This directory can be replaced by a symbolic link to a more suited disk or location. Cache size will probably stay below 100GB for the CellMorph data set.

## Database
Image feature data is stored in a SQLite database that contains a single table __objects__.

The database is ~3GB and can be downloaded, along with its config.py file, via Dropbox for now: https://www.dropbox.com/sh/hvhpdjcfiap3ofe/AABUn4ZZk0V49ArRQZihckADa?dl=0
Both database and config file should be placed in the __dataset__ directory.

## Directory structure
__server__ contains all server-side Python code. Currently, most files serve as API delegators for the Tangelo web server.

__wrangle__ contains code that can be used to scrape all image feature data from the CellMorph comma-separated files and store it in a SQLite database as described in the __Database__ section.