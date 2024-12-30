import sqlite3

import click
from flask import current_app, g
from flask_bcrypt import Bcrypt
import MySQLdb

def get_db():
    # create connection to database if it doesn't exist
    if 'db' not in g:
        g.db = MySQLdb.connect(user="***REMOVED***", password="***REMOVED***", database="")
        g.db_cursor = g.db.cursor()
    return g.db_cursor


def close_db(e=None):
    cursor = g.pop('db_cursor', None)
    db = g.pop('db', None)

    if cursor is not None:
        cursor.close()

    if db is not None:
        db.close()


def init_db():
    db = get_db()

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
