import functools

from flask import (
    Blueprint, flash, g, redirect, render_template, request, session, url_for, current_app
)
from flask_bcrypt import Bcrypt

from .database import get_db



bp = Blueprint('auth', __name__, url_prefix='/auth') # allow __init__.py to import these routes

@bp.route("/login", methods=("GET", "POST"))
def login():
    """Log in a registered user by adding the user id to the session."""
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]
        db = get_db()
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
            return redirect("/")

        flash(error)

    return render_template('login.html')

@bp.before_app_request
def load_logged_in_user():
    # if user is logged in, store in python side of session
    user_id = session.get('user_id')

    if user_id is None:
        g.user = None
    else:
        db = get_db()
        db.execute('SELECT * FROM user WHERE id = %s', [user_id])
        g.user = db.fetchone()

def login_required(view):
    @functools.wraps(view)
    def wrapped_view(**kwargs):
        # if not in development mode, route page to login if not logged in
        if not current_app.config['DEVELOPMENT'] and g.user is None:
            return redirect(url_for('auth.login'))

        return view(**kwargs)

    return wrapped_view
