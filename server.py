import json
import copy
from datetime import datetime
import requests


from flask import (Flask, render_template, redirect, request, flash, session, jsonify)
from flask_debugtoolbar import DebugToolbarExtension
from geoalchemy2 import Geometry
from sqlalchemy import update, func, extract
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash

from model import Incident, User, Route, connect_to_db, db
from config import ACCESS_TOKEN, APP_SECRET_KEY

app = Flask(__name__)

app.secret_key = APP_SECRET_KEY

# Initialize login manager
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"


DEGREE_PER_METER = .000008983


@login_manager.user_loader
def load_user(id):
    """Requirement for flask_login."""

    return User.query.get(id)

@app.route('/')
def index():
    """Homepage"""

    return render_template("index.html")

@app.route('/user')
@login_required
def show_routes():
    """ Display saved route."""

    user_id = current_user.id
    r_id = db.session.query(Route.r_id).join(User).filter(User.id==user_id).first()
    route = db.session.query(Route.route).join(User).filter(User.id==user_id).first()

    return render_template('routes.html', r_id=r_id,
                                          route=route)

@app.route('/register', methods=["POST"])
def register():
    """ Register a user."""

    username = request.form.get('username')
    email = request.form.get('email')
    password = request.form.get('password')
    hashed_password = generate_password_hash(password, 'sha256')
    db.session.add(User(username, email, hashed_password))
    db.session.commit()

    flash('Success! Please log in.')

    return redirect('/')

@app.route('/login', methods=["GET"])
def login():
    """ Display log in form and handle user login."""

    email = request.args.get('emailLogin')
    password = request.args.get('passwordLogin')
    
    user = User.query.filter(User.email == email).first()

    if user is None or not check_password_hash(user.password, password):
        flash('Invalid email or password')
        return redirect('/')

    else:
        login_user(user)
        flash('Welcome back!')
        return redirect('/')
    
    return render_template('login.html')


@app.route('/logout')
@login_required
def logout():
    """ Log out user.""" 

    logout_user()
    flash('You\'re out!')

    return redirect('/')


@app.route('/saveroute/<route>', methods=["POST"])
@login_required
def save_route(route):
    """ Save route information into database. """

    u_id = current_user.get_id()
    db.session.add(Route(u_id, route))
    db.session.commit()

    flash('Your route has been saved.')
    
    return redirect('/')

@app.route('/deleteroute/<del_id>', methods=["POST"])
@login_required
def del_route(del_id):
    """ Given route id, delete route from database. """

    del_id = int(del_id)
    Route.query.filter(Route.r_id == del_id).delete()
    db.session.commit()

    flash('Your route has been deleted.')

    return redirect('/user')

@app.route('/api/incidents/<hour>', methods=["GET"])
def get_current_crimes(hour):
    """Given hour, return json of crimes that happened within the hour."""

    result = db.session.query(Incident.incident_category, Incident.incident_code, Incident.wkb_geometry.ST_AsGeoJSON()).filter(extract('hour', Incident.incident_time) == hour).all()

    feature_collection = []
    for category, code, geojson in result:
        new_feature = {
            'type': 'Feature',
            'geometry': json.loads(geojson),
            'properties': {
                "incident_category": category,
                "incident_code": code,
            },
        }
        feature_collection.append(new_feature)

    geojson_result = {
        "type": "FeatureCollection",
        "features": feature_collection
    }

    return jsonify(geojson_result)

@app.route('/api/bufferarea/<route>/<hour>', methods=["GET"])
def get_buffered_area(route, hour):
    """Given a linestring of a route, return a buffer area."""

    process_route = 'LINESTRING(' + route + ')'

    query = db.session.query(Incident.incident_category, Incident.incident_code, Incident.wkb_geometry.ST_AsGeoJSON())

    result = query.filter((func.ST_Contains((func.ST_Buffer(func.ST_GeomFromText(process_route), DEGREE_PER_METER*200)), Incident.wkb_geometry)) & (extract('hour', Incident.incident_time) == hour)).all()

    feature_collection = []

    for category, code, geojson in result:
        new_feature = {
            'type': 'Feature',
            'geometry': json.loads(geojson),
            'properties': {
                "incident_category": category,
                "incident_code": code,
            },
        }
        feature_collection.append(new_feature)
    
    violent_crime_count = 0

    for feature in feature_collection:
        crime_code = feature['properties']['incident_code']
        if crime_code == 5:
            violent_crime_count += 1


    geojson_result = {
        "type": "FeatureCollection",
        "features": feature_collection,
        "violent_crime_count": violent_crime_count
    }

    return jsonify(geojson_result)


@app.route('/api/alternatives/<route>', methods=["GET"])
def add_waypoints(route):
    """Given two points, return four additional waypoints."""

    process_route = 'LINESTRING(' + route + ')'
    
    midpoint = db.session.query(func.ST_AsGeoJSON(func.ST_LineInterpolatePoint(func.ST_GeomFromText(process_route), 0.5))).first()

    midpoint_json = json.loads(midpoint[0])

    midpoint_lat = midpoint_json['coordinates'][1]

    midpoint_long = midpoint_json['coordinates'][0]

    result = [(midpoint_long, midpoint_lat + DEGREE_PER_METER*500),
              (midpoint_long, midpoint_lat - DEGREE_PER_METER*500),
              (midpoint_long + DEGREE_PER_METER*500, midpoint_lat),
              (midpoint_long - DEGREE_PER_METER*500, midpoint_lat)]

    return jsonify(result)


@app.route('/api/safest/<score>/<url1>/<url2>/<url3>/<url4>', methods=["GET"])
def get_safest_route(score, url1, url2, url3, url4):
    """Given 4 alt routes, return the linestring of the routes that's the safest."""
    
    urls = [url1, url2, url3, url4]

    hour = datetime.now().hour

    scores = {}

    lowest = int(score)
    
    for url in urls: 

        response = requests.get('https://api.mapbox.com/directions/v5/mapbox/walking/' + url + '?geometries=geojson&steps=true&&access_token=' + ACCESS_TOKEN)
        data = response.json()
        coords = data['routes'][0]['geometry']['coordinates']
        
        new_arr = []

        for coord in coords: 
            coord = str(coord[0]) + ' ' + str(coord[1])
            new_arr.append(coord)
            
        route = ','.join(new_arr)        

        process_route = 'LINESTRING(' + route + ')'

        query = db.session.query(func.count(Incident.incident_code))

        crime_score = query.filter((func.ST_Contains((func.ST_Buffer(func.ST_GeomFromText(process_route), DEGREE_PER_METER*200)), Incident.wkb_geometry)) & (extract('hour', Incident.incident_time) == hour) & (Incident.incident_code == 5)).group_by(Incident.incident_code).first()

        crime_score = int(crime_score[0])
        scores[url] = crime_score

        if(crime_score < lowest):
            lowest = crime_score
    

    for url, score in scores.items():
        if score == lowest:
            return jsonify([url, lowest])
        
    return 'None Found'


    


if __name__ == "__main__":
    # We have to set debug=True here, since it has to be True at the
    # point that we invoke the DebugToolbarExtension
    app.debug = True
    # make sure templates, etc. are not cached in debug mode
    connect_to_db(app)
    # Use the DebugToolbar
    DebugToolbarExtension(app)
    app.run(port=5000, host='0.0.0.0')
