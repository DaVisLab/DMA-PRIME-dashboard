import functools

from flask import (
    Blueprint, flash, g, redirect, render_template, request, session, url_for, current_app
)
from flask_bcrypt import Bcrypt

from .database import db, User
from .authenticate import login_required, admin_required
import jwt
from flask_mailman import EmailMessage
import time
import MySQLdb

bp = Blueprint('admin', __name__, url_prefix='/admin') # allow admin.py to import these routes


@bp.route("/add-user", methods=("GET", "POST"))
@login_required
@admin_required
def add_user():
    if request.method == "POST":
        email = request.form["email"]
        access_level = int(request.form["access_level"])
  
        try:
            # Check if the user already exists
            existing_user = User.query.filter_by(email=email).first()
            if existing_user:
                flash("User already exists")
                return redirect("/admin")

            temp_user = User(email, email[:4]+"123", Bcrypt().generate_password_hash(email[:4]+"789"), access_level=access_level, verified_user=False)
            db.session.add(temp_user)
            db.session.commit()

            token = jwt.encode({"email": email}, current_app.config["SECRET_KEY"], algorithm='HS256')

            # Send verification email
            # subject, from_email, to = 'Reset Password', 'nickjohnson1207@gmail.com', email
            # html_content = render_template('email/reset_pwd_email.html', token=token)


            # msg = EmailMessage(subject, str(html_content), from_email, [to])
            # msg.content_subtype = "html"  # Main content is now text/html
            # msg.send()
            reset_password_url = url_for("auth.reset_password", token=token, _external=True)
            flash(f"User added successfully. Verification link: {reset_password_url}")
        except Exception as e:
            flash(e)
            return redirect("/admin")
            
        # flash("User added successfully")
        return redirect("/admin")
    return render_template('admin_access_user.html', action="add")


@bp.route("/delete-user", methods=("GET", "POST"))
@login_required
@admin_required
def delete_user():
    if request.method == "POST":
        email = request.form["email"]

        try:
            # Check if the user exists
            existing_user = User.query.filter_by(email=email).first()
            if not existing_user:
                flash("User does not exist")
                return redirect("/admin")

            User.query.filter_by(email=email).delete()
            db.session.commit()

        except Exception as e:
            flash(e)
            return redirect("/admin")
            
        flash("User deleted successfully")
        return redirect("/admin")
    return render_template('admin_access_user.html', action="delete")

@bp.route("/change-user", methods=("GET", "POST"))
@login_required
@admin_required
def change_user():
    if request.method == "POST":
        email = request.form["email"]
        field = request.form["field"]
        new_value = request.form["changed_field"]
        
        # db = get_db()
        the_user = User.query.filter_by(email=email).first()
        try:
            if field == "username":
                the_user.username = new_value
                db.session.commit()
            elif field == "password":
                the_user.password = Bcrypt().generate_password_hash(new_value)
                db.session.commit()
            elif field == "access_level":
                the_user.access_level = int(new_value)
                db.session.commit()

        except Exception as e:
            flash(e)
            return redirect("/admin")
  
        flash("User changed successfully")
        return redirect("/admin")
    return render_template('admin_access_user.html', action="change")