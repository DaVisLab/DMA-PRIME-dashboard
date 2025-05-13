import click
from flask_login import UserMixin
# from . import db, login_manager
from flask_sqlalchemy import SQLAlchemy
from dataclasses import dataclass


db = SQLAlchemy()

@dataclass
class User(UserMixin, db.Model):
    __tablename__ = "user"
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(200), nullable=False, unique=True)
    username = db.Column(db.String(200), nullable=True)
    password = db.Column(db.String(200), nullable=False)
    access_level = db.Column(db.Integer, default=0)
    verified_user = db.Column(db.Boolean, default=False)
    two_factor_auth = db.Column(db.String(200), nullable=True)

    def __init__(self, email, username, password, access_level, verified_user):
        self.email = email
        self.username = username
        self.password = password
        self.access_level = access_level

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
    app.cli.add_command(init_db_command)
