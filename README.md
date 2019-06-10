# ByPath

![ByPath Logo](/static/img/logo.png)

ByPath is a navigation app that displays an interactive San Francisco crime heat map and selects a safer walking or biking route for users. It also allows users to draw their own routes and save their regular commute.


## Prerequisites

- [PostgreSQL](https://www.postgresql.org/download/) and [PostGIS](https://postgis.net/install/)

- [Python3](https://www.python.org/downloads/)

- Get the SF Police Department Incident Reports (2018 to Present) [here](https://data.sfgov.org/Public-Safety/Police-Department-Incident-Reports-2018-to-Present/wg3w-h783)

## Installation

Use the package manager [pip](https://pip.pypa.io/en/stable/) to install required packages in a virtual environment.

```bash
virtualenv env
pip3 install -r requirements.txt
```

## Built With
- [Flask](http://flask.pocoo.org/) - The web framework used
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/overview/) - Used to display and render the map
 


## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.


## License
[MIT](https://choosealicense.com/licenses/mit/)
