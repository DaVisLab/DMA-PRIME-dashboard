import functools

from flask import (
    Blueprint, flash, g, redirect, render_template, request, session, url_for, current_app
)
from flask_bcrypt import Bcrypt

from .database import get_db

import MySQLdb



bp = Blueprint('auth', __name__, url_prefix='/auth') # allow __init__.py to import these routes

@bp.route("/login", methods=("GET", "POST"))
def login():
    """Log in a registered user by adding the user id to the session."""
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]
        db = get_db().cursor()
        error = None
        db.execute('SELECT * FROM user WHERE username = %s', [username])
        user = db.fetchone()

        if user is None:
            error = "Incorrect username"
        else:
            columns = [item[0] for item in db.description]
            user_data = {item[0] : item[1] for item in zip(columns, user)}
            
            if not Bcrypt().check_password_hash(user_data["password"].decode('utf-8'), password):
                error = "Incorrect password"

        if error is None:
            # store the user id in a new session and return to the index
            session.clear()
            session["user_id"] = int(user_data["id"])
            session["access_level"] = int(user_data["access_level"])
            return redirect("/")

        flash(error)

    return render_template('login.html')

@bp.route("/logout", methods=["GET"])
def logout():
    session.clear()
    return redirect("/auth/login")


@bp.route("/signup", methods=["GET", "POST"])
def signup():
    """Signup user by adding the user to the database."""
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]
        email = request.form["email"]
        db = get_db()
        
        try:
            db.cursor().execute(
                """INSERT INTO user (username, email, password, access_level) VALUES (%s, %s, %s, 0)""", 
                [username, email, Bcrypt().generate_password_hash(password)]
            ) # Bcrypt().generate_password_hash('')
            db.commit()
        except Exception as e:
            flash(e)
            return redirect("/auth/signup")
            
        # store the user id in a new session and return to the index
        session.clear()
        return redirect("/auth/login")
    return render_template('sign_up.html')



@bp.before_app_request
def load_logged_in_user():
    # if user is logged in, store in python side of session
    user_id = session.get('user_id')

    if user_id is None:
        g.user = None
    else:
        db = get_db().cursor()
        db.execute('SELECT * FROM user WHERE id = %s', [user_id])
        g.user = db.fetchone()

def login_required(view):
    @functools.wraps(view)
    def wrapped_view(**kwargs):
        # if not in development mode, route page to login if not logged in
        if g.user is None:
        # if not current_app.config['DEVELOPMENT'] and g.user is None:
            return redirect(url_for('auth.login'))

        return view(**kwargs)

    return wrapped_view


def admin_required(view):
    @functools.wraps(view)
    def wrapped_view(**kwargs):
        # if not in development mode, route page to login if not logged in
        if session["access_level"] != 1:
        # if not current_app.config['DEVELOPMENT'] and session["access_level"] != 1:
            flash("Access Denied: Admin access required")
            return redirect(url_for('index'))

        return view(**kwargs)

    return wrapped_view