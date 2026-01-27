import pyotp
import qrcode
from io import BytesIO
from base64 import b64encode

from flask import (
    Blueprint,
    abort,
    flash,
    redirect,
    render_template,
    request,
    session,
    url_for,
    current_app,
)

from flask_login import LoginManager, login_user, logout_user, login_url, current_user

from flask_bcrypt import Bcrypt
import jwt

from .database import User, db

bp = Blueprint(
    "auth", __name__, url_prefix="/auth"
)  # allow __init__.py to import these routes

login_manager = LoginManager()
login_manager.login_view = "auth.login"


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
            flash(
                login_manager.login_message,
                category=login_manager.login_message_category,
            )

    redirect_url = login_url(login_view, next_url=request.url)

    return redirect(redirect_url)


@bp.route("/refresh", methods=["GET"])
def refresh():
    login_user(current_user)
    return "", 204


@bp.route("/two_factor_setup", methods=["GET"])
def two_factor_setup():
    user = User.query.filter_by(email=session["email"]).first()
    unique_key = pyotp.random_base32()
    user.two_factor_auth = unique_key
    db.session.commit()
    uri = pyotp.totp.TOTP(unique_key).provisioning_uri(
        name=user.email, issuer_name="DMA-PRIME"
    )
    # encode qr code so it can be served via render template instead of saved
    imgIO = BytesIO()
    qrcode.make(uri).save(imgIO, "PNG")
    imgIO.seek(0, 0)
    imgB64 = b64encode(imgIO.getvalue()).decode("utf-8")
    return render_template("authentication/two_factor_setup.html", img=imgB64)


@bp.route("/two_factor_auth", methods=["GET", "POST"])
def two_factor_auth():
    if request.method == "POST":
        otp_2fa = request.form["2fa_code"]
        curr_user = User.query.filter(User.email == session["email"]).first()
        key = curr_user.two_factor_auth  # "DMA_2FA_KEY"
        totp = pyotp.TOTP(key)
        authenticate_2fa = totp.verify(otp_2fa)
        if authenticate_2fa:
            flash("2FA Authentication Successful")
            login_user(curr_user)
            current_app.logger.info(f"Successful login of user {curr_user.email}")
            next = request.args.get("next")
            return redirect(next or url_for("index"))
        else:
            flash("Incorrect 2FA code")
            current_app.logger.info(f"Failed 2FA of user {curr_user.email}")
            session["email"] = session["email"]
    return render_template("authentication/two_factor_auth.html")


@bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email_username = request.form["email_username"]
        password = request.form["password"]

        curr_user = User.query.filter(
            (User.email == email_username) | (User.username == email_username)
        ).first()

        print(curr_user.access_level)
        if curr_user is None:
            current_app.logger.info(f"Login attempt with user {email_username}")
            flash("Incorrect username or email")
        else:
            if Bcrypt().check_password_hash(curr_user.password, password):
                current_app.logger.info(
                    f"Correct username and password of user {email_username}"
                )
                session["email"] = curr_user.email
                
                if current_app.config["DEVELOPMENT"]:
                    login_user(curr_user)
                    current_app.logger.info(
                        f"Successful login of user {curr_user.email}"
                    )
                    next = request.args.get("next")
                    return redirect(next or url_for("index"))
                else:
                    # allow waste water only access
                    if curr_user.access_level == -1:
                        login_user(curr_user)
                        current_app.logger.info(
                            f"Successful login of user {curr_user.email}"
                        )
                        next = request.args.get("next")
                        return redirect(next or url_for("index"))
                    
                    if curr_user.two_factor_auth is None:
                        next = request.args.get("next") or url_for("index")
                        return redirect(url_for("auth.two_factor_setup", next=next))
                    else:
                        next = request.args.get("next") or url_for("index")
                        return redirect(url_for("auth.two_factor_auth", next=next))
            else:
                current_app.logger.info(
                    f"Incorrect password attempt of user {curr_user.email}"
                )
                flash("Incorrect password")

    return render_template("authentication/login.html")


@bp.route("/logout", methods=["GET"])
def logout():
    logout_user()
    return redirect("/auth/login")


@bp.route("/signup", methods=["GET", "POST"])
def signup():
    if current_app.config["DEVELOPMENT"]:
        """Signup user by adding the user to the database."""
        if request.method == "POST":
            username = request.form["username"]
            password = request.form["password"]
            email = request.form["email"]

            try:
                old_user = User.query.filter_by(email=email).first()
                if old_user:
                    abort(403)

                # user_data_dict = {"email":email, "username":username, "password":Bcrypt().generate_password_hash(password), "access_level":0, "verified":False}
                temp_user = User(
                    email,
                    username,
                    Bcrypt().generate_password_hash(password),
                    access_level=0,
                    verified_user=False,
                )

                db.session.add(temp_user)
                db.session.commit()

            except Exception as e:
                flash(e)
                return redirect("/auth/signup")

            # store the user id in a new session and return to the index
            session.clear()
            session["email"] = email
            return redirect(url_for("auth.two_factor_setup"))
        return render_template("authentication/sign_up.html")
    else:
        return abort(404)


@bp.route("/verify_email/<token>", methods=["GET"])
def verify_email(token):
    data = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
    email = data["email"]

    user = User.query.filter_by(email=email).first()
    user.verified_user = True
    db.session.commit()
    current_app.logger.info(f"{email} verified account email")
    flash("Email confirmed successfully")
    return redirect("/auth/login")


@bp.route("/reset_password", methods=["GET", "POST"])
def get_email():
    if request.method == "GET":
        return render_template("authentication/reset_password.html")
    email = request.form["email"]
    curr_user = User.query.filter_by(email=email).first()

    if curr_user:
        token = jwt.encode(
            {"email": email}, current_app.config["SECRET_KEY"], algorithm="HS256"
        )
        reset_password_url = url_for("auth.reset_password", token=token, _external=True)


        if not current_app.config["DEVELOPMENT"]:
            reset_password_url = (
                "https://dmaprime.clemson.edu/auth"
                + reset_password_url.split("/auth")[-1]
            )
            
        return redirect(reset_password_url)
    else:
        flash("Email not found")
        return render_template("authentication/reset_password.html")


@bp.route("/reset_password/<token>", methods=["GET", "POST"])
def reset_password(token):
    data = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
    email = data["email"]
    curr_user = User.query.filter_by(email=email).first()

    if request.method == "GET":
        return render_template(
            "authentication/reset_password.html",
            email=email,
            verified=curr_user.verified_user,
        )

    password = request.form["password"]
    curr_user.password = Bcrypt().generate_password_hash(password)

    if not curr_user.verified_user:
        username = request.form["username"]
        curr_user.username = username
    curr_user.verified_user = True
    db.session.commit()
    session.clear()

    current_app.logger.info(f"{email} changed account password")

    flash("Password Changed Succesfully. Please Log in")
    return redirect("/auth/login")
