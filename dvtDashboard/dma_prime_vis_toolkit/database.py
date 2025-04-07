import sqlite3

import click
from flask import current_app, g
from flask_bcrypt import Bcrypt
import MySQLdb
from flask_login import UserMixin
# from . import db, login_manager
from flask_sqlalchemy import SQLAlchemy
from dataclasses import dataclass


db = SQLAlchemy()

# @login_manager.user_loader
# def load_user(user_id):
#     return User.query.filter_by(id=user_id).first()
@dataclass
class User(UserMixin, db.Model):
    __tablename__ = "user"
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(200), nullable=False, unique=True)
    username = db.Column(db.String(200), nullable=True)
    password = db.Column(db.String(200), nullable=False)
    access_level = db.Column(db.Integer, default=0)
    verified_user = db.Column(db.Boolean, default=False)

    def __init__(self, email, username, password, access_level, verified_user):
        self.email = email
        self.username = username
        self.password = password
        self.access_level = access_level
    # def serialized(self):
    #     return({"id": self.id, "email": self.email, "username": self.username})

def get_db():
    # create connection to database if it doesn't exist
    if 'db' not in g:
        g.db = MySQLdb.connect(user="***REMOVED***", password="***REMOVED***", database="")
        #g.db = MySQLdb.connect(user="root", password="superuser", database="")
    return g.db


def close_db(e=None):
    cursor = g.pop('db_cursor', None)
    db = g.pop('db', None)

    if cursor is not None:
        cursor.close()

    if db is not None:
        db.close()


def init_db():
    db = get_db().cursor()

    with current_app.open_resource('schema.sql') as f:
        string = f.read().decode('utf8')
        db.execute(string)


@click.command('init-db')
def init_db_command():
    """Clear the existing data and create new tables."""
    # init_db()
    '''
    # add admin account
    db = get_db()
    db.execute(
        """INSERT INTO user (username, password) VALUES (%s, %s)""", 
        ["admin", Bcrypt().generate_password_hash('')]
    )
    g.db.commit()
    '''
    click.echo('Initialized the database.')


def init_app(app):
    app.teardown_appcontext(close_db)
    app.cli.add_command(init_db_command)
