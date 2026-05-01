import click
from flask_login import UserMixin
from flask_sqlalchemy import SQLAlchemy
from dataclasses import dataclass

db = SQLAlchemy()


@dataclass
class User(UserMixin, db.Model):
    """Application user record used by Flask-Login and admin access controls."""

    __tablename__ = "user"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(200), nullable=False, unique=True)
    username = db.Column(db.String(200), nullable=True)
    password = db.Column(db.String(200), nullable=False)
    access_level = db.Column(db.Integer, default=0)
    data_approver = db.Column(db.Boolean, default=False)
    verified_user = db.Column(db.Boolean, default=False)
    two_factor_auth = db.Column(db.String(200), nullable=True)

    def __init__(
        self,
        email,
        username,
        password,
        access_level,
        data_approver=False,
        verified_user=False,
    ):
        self.email = email
        self.username = username
        self.password = password
        self.access_level = access_level
        self.data_approver = data_approver
        self.verified_user = verified_user


@click.command("init-db")
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
    click.echo("Initialized the database.")


def init_app(app):
    app.cli.add_command(init_db_command)
