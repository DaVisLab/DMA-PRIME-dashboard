import functools

from flask import (
    Blueprint, abort, flash, redirect, render_template, request, session, url_for, current_app
)

from flask_login import LoginManager, login_user, logout_user, login_url, current_user

from flask_bcrypt import Bcrypt
import jwt

from .database import User, db

bp = Blueprint('auth', __name__, url_prefix='/auth') # allow __init__.py to import these routes

login_manager = LoginManager()
login_manager.login_view = 'auth.login'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@login_manager.unauthorized_handler
def unauthorized():

    if request.blueprint in login_manager.blueprint_login_views:
        login_view = login_manager.blueprint_login_views[request.blueprint]
    else:
        login_view = login_manager.login_view

    if not login_view:
        abort(401)

    if login_manager.login_message:
        if login_manager.localize_callback is not None:
            flash(
                login_manager.localize_callback(login_manager.login_message),
                category=login_manager.login_message_category,
            )
        else:
            flash(login_manager.login_message, category=login_manager.login_message_category)

    redirect_url = login_url(login_view, next_url=request.url)

    return redirect(redirect_url)


@bp.route("/login", methods=("GET", "POST"))
def login():
    if request.method == "POST":
        email_username = request.form["email_username"]
        password = request.form["password"]

        curr_user = User.query.filter((User.email == email_username) | (User.username == email_username)).first()

        if curr_user is None:
            current_app.logger.info(f'Login attempt with user {email_username}')
            flash("Incorrect username or email")

        if curr_user is not None:
            if Bcrypt().check_password_hash(curr_user.password, password):
                flash("Logged in successfully. Welcome {}".format(curr_user.username))
                login_user(curr_user)
                current_app.logger.info(f'Successful login of user {email_username}')
                next = request.args.get('next')
                return redirect(next or url_for('index'))
            else:
                current_app.logger.info(f'Unsuccessful login attempt of user {email_username}')
                flash("Incorrect password")
    
    return render_template('login.html')

@bp.route("/logout", methods=["GET"])
def logout():
    email = current_user.email
    logout_user()
    current_app.logger.info(f'Logout of user {email}')
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

def admin_required(view):
    @functools.wraps(view)
    def wrapped_view(**kwargs):
        # if not in development mode, route page to login if not logged in
        if current_user.access_level != 1:
            flash("Access Denied: Admin access required")
            return redirect(url_for('index'))

        return view(**kwargs)

    return wrapped_view
