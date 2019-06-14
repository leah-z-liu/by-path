"""Incident report data model, user model, and database functions"""
from flask_sqlalchemy import SQLAlchemy
from geoalchemy2 import Geometry
from flask_login import UserMixin

db = SQLAlchemy()

##############################################################################
# Model definition
class Incident(db.Model):
    """Police incidents report data from SF Gov"""

    __tablename__ = "incidents"

    i_id = db.Column(db.Integer, primary_key=True, autoincrement=True,)
    incident_id = db.Column(db.String(20), nullable=False,)
    incident_time = db.Column(db.TIME, nullable=False,)
    incident_date = db.Column(db.DATE, nullable=False,)
    incident_category = db.Column(db.String(80), nullable=True,)
    incident_code = db.Column(db.Integer, nullable=True,)
    wkb_geometry  = db.Column(Geometry(geometry_type='POINT'),)

    def __repr__(self):
        """Helpful print"""

        return f"<Incident incident_id = {self.incident_id} time={self.incident_time} date={self.incident.date} category={self.incident_category} code={self.incident_code}"


class User(db.Model):
    """ User information """

    __tablename__ = "users"


    id = db.Column(db.Integer, primary_key=True, autoincrement=True,)
    username = db.Column(db.String(20), nullable=False,)
    email = db.Column(db.String(30), nullable=False,)
    password = db.Column(db.String(255), nullable=False,)
    is_active = db.Column(db.Boolean,)
    is_anonymous = db.Column(db.Boolean,)
    is_authenticated = db.Column(db.Boolean,)

    def __init__(self, username, email, password):
        """ Instantiate a user."""

        self.username = username
        self.email = email
        self.password = password
        self.is_active = True
        self.is_anonymous = False
        self.is_authenticated = True


    def get_id(self):
        """ Return unicode username."""

        return self.id

    def __repr__(self):
        """ Helpful output """

        return f"<Incident user_id = {self.id} username={self.username}" 


class Route(db.Model):
    """ User's saved routes """

    __tablename__ = "routes"

    r_id = db.Column(db.Integer, primary_key=True, autoincrement=True,)
    u_id = db.Column(db.Integer, db.ForeignKey('users.id'),)
    route = db.Column(db.String(1200), nullable=False,)

    user = db.relationship('User', backref='routes')

    def __init__(self, u_id, route):
        """ Instantiate a route """
        
        self.u_id = u_id
        self.route = route

    def __repr__(self):
        """ Helpful output """

        return f"<Route user_id = {self.u_id} route_id = {self.r_id} route = {self.route}"

##############################################################################
# Helper functions

def connect_to_db(app):
    """Connect the database to our Flask app."""

    app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql:///bypath'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.app = app
    db.init_app(app)


if __name__ == "__main__":
    from server import app
    connect_to_db(app)
    print("Connected to DB.")
