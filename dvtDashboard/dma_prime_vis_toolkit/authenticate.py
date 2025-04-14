import functools

from flask import (
    Blueprint, abort, flash, g, redirect, render_template, request, session, url_for, current_app, jsonify
)
from flask_bcrypt import Bcrypt
import jwt
from flask_mailman import EmailMessage

from .database import get_db, User, db

import MySQLdb



bp = Blueprint('auth', __name__, url_prefix='/auth') # allow __init__.py to import these routes

@bp.route("/login", methods=("GET", "POST"))
def login():
    """Log in a registered user by adding the user id to the session."""
    if request.method == "POST":
        email_username = request.form["email_username"]
        password = request.form["password"]
        error = None

        # curr_user = User.query.filter_by(email=email).first()
        curr_user = User.query.filter((User.email == email_username) | (User.username == email_username)).first()
        # db.execute('SELECT * FROM user WHERE username = %s', [username])
        # user = db.fetchone()

        if curr_user is None:
            error = "Incorrect username or email"
        else:
            if not Bcrypt().check_password_hash(curr_user.password, password):
                error = "Incorrect password"

        if error is None:
            # store the user id in a new session and return to the index
            session.clear()
            session["user_id"] = int(curr_user.id)
            session["access_level"] = int(curr_user.access_level)
            flash("Logged in successfully. Welcome {}".format(curr_user.username))
            return redirect("/")

        flash(error)

    return render_template('login.html')

@bp.route("/logout", methods=["GET"])
def logout():
    session.clear()
    return redirect("/auth/login")


# @bp.route("/signup", methods=["GET", "POST"])
# def signup():
#     """Signup user by adding the user to the database."""
#     if request.method == "POST":
#         username = request.form["username"]
#         password = request.form["password"]
#         email = request.form["email"]
        
#         try:
#             old_user = User.query.filter_by(email=email).first()
#             if old_user:
#                 abort(403)

#             # user_data_dict = {"email":email, "username":username, "password":Bcrypt().generate_password_hash(password), "access_level":0, "verified":False}
#             temp_user = User(email, username, Bcrypt().generate_password_hash(password), access_level=0, verified_user=False)

#             db.session.add(temp_user)
#             db.session.commit()

#             # Create a secure token (string) that identifies the user
#             token = jwt.encode({"email": email}, current_app.config["SECRET_KEY"], algorithm='HS256')

#             # Send verification email
#             subject, from_email, to = 'Confirm Email', 'nickjohnson1207@gmail.com', email
#             html_content = render_template('email/verify.html', token=token)


#             msg = EmailMessage(subject, str(html_content), from_email, [to])
#             msg.content_subtype = "html"  # Main content is now text/html
#             msg.send()

#         except Exception as e:
#             flash(e)
#             return redirect("/auth/signup")
            
#         # store the user id in a new session and return to the index
#         session.clear()
#         return redirect("/auth/login")
#     return render_template('sign_up.html')

@bp.route("/verify_email/<token>", methods=["GET", "POST"])
def verify_email(token):
    data = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
    email = data["email"]

    user = User.query.filter_by(email=email).first()
    user.verified_user = True
    db.session.commit()
    flash("Email confirmed successfully")
    return redirect("/auth/login")

@bp.route("/reset_password/<token>", methods=["GET", "POST"])
def reset_password(token):
    data = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
    email = data["email"]
    if request.method == "GET":
        return render_template("reset_password.html", email=email)
    password = request.form["password"]
    username = request.form["username"]
    # password_reset_token = request.form["pwd_reset_token"]
    
    

    curr_user = User.query.filter_by(email=email).first()
    curr_user.password = Bcrypt().generate_password_hash(password)
    curr_user.username = username
    curr_user.verified_user = True
    db.session.commit()
    session.clear()


    flash("Password Changed Succesfully. Please Log in")
    return redirect("/auth/login")

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
            flash("You are not logged in. Please log in")
            return redirect(url_for('auth.login'))
        
        old_user = User.query.filter_by(id=session["user_id"]).first()
        if not old_user.verified_user:
        # if not current_app.config['DEVELOPMENT'] and g.user is None:
            flash("You are not verified. Please check your email to verify your account")
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