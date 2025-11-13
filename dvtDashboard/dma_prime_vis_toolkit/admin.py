import functools

from flask import (
    Blueprint, flash, redirect, render_template, request, url_for, current_app
)
from flask_bcrypt import Bcrypt

from flask_login import login_required, current_user

from .database import db, User
import jwt

bp = Blueprint('admin', __name__, url_prefix='/admin') # allow admin.py to import these routes


def admin_required(view):
    @functools.wraps(view)
    def wrapped_view(**kwargs):
        if current_user.access_level != 1:
            current_app.logger.info(f'{current_user.email} attempted to view admin page')
            flash("Access Denied: Admin access required")
            return redirect(url_for('index'))

        return view(**kwargs)

    return wrapped_view

@bp.route("/add-user", methods=['GET', 'POST'])
@login_required
@admin_required
def add_user():
    if request.method == 'POST':
        email = request.form["email"]
        access_level = int(request.form["access_level"])
  
        try:
            # Check if the user already exists
            existing_user = User.query.filter_by(email=email).first()
            if existing_user:
                current_app.logger.info(f'{current_user.email} failed to create user {email} (user already exists)')
                flash("User already exists")
                return redirect("/admin")

            temp_user = User(email, email[:4]+"123", Bcrypt().generate_password_hash(email[:4]+"789"), access_level=access_level, verified_user=False)
            db.session.add(temp_user)
            db.session.commit()

            current_app.logger.info(f'{current_user.email} created user {email} with access level {access_level}')

            token = jwt.encode({"email": email}, current_app.config["SECRET_KEY"], algorithm='HS256')

            reset_password_url =  url_for("auth.reset_password", token=token, _external=True)
            
            if not current_app.config['DEVELOPMENT']:
                reset_password_url = 'https://dmaprime.clemson.edu/auth' + reset_password_url.split("/auth")[-1]

            flash(reset_password_url, 'link')
        except Exception as e:
            current_app.logger.info(f'{current_user.email} failed to create user {email} (error)')
            flash(str(e))
            return redirect("/admin")
            
        # flash("User added successfully")
        return redirect("/admin")
    return render_template('admin/admin_access_user.html', action="add")


@bp.route("/delete-user", methods=['GET', 'POST'])
@login_required
@admin_required
def delete_user():
    if request.method == 'POST':
        email = request.form["email"]

        try:
            # Check if the user exists
            existing_user = User.query.filter_by(email=email).first()
            if not existing_user:
                flash("User does not exist")
                current_app.logger.info(f'{current_user.email} failed to delete user {email} (user does not exist)')
                return redirect("/admin")

            User.query.filter_by(email=email).delete()
            db.session.commit()

            current_app.logger.info(f'{current_user.email} deleted user {email}')
        except Exception as e:
            current_app.logger.info(f'{current_user.email} failed to delete user {email} (error)')
            flash(str(e))
            return redirect("/admin")
            
        flash("User deleted successfully")
        return redirect("/admin")
    return render_template('admin/admin_access_user.html', action="delete")

@bp.route("/change-user", methods=['GET', 'POST'])
@login_required
@admin_required
def change_user():
    if request.method == 'POST':
        email = request.form["email"]
        field = request.form["field"]
        new_value = request.form["changed_field"]
        
        # db = get_db()
        the_user = User.query.filter_by(email=email).first()
        try:
            if field == "username":
                the_user.username = new_value
                db.session.commit()
                current_app.logger.info(f'{current_user.email} changed username of {email}')
            elif field == "password":
                the_user.password = Bcrypt().generate_password_hash(new_value)
                db.session.commit()
                current_app.logger.info(f'{current_user.email} changed password of {email}')
            elif field == "access_level":
                the_user.access_level = int(new_value)
                db.session.commit()
                current_app.logger.info(f'{current_user.email} changed access_level of {email}')
            elif field == "data_approver":
                the_user.data_approver = new_value.lower() == 'true' or new_value == '1' 
                print(the_user.data_approver)
                db.session.commit()
                current_app.logger.info(f'{current_user.email} changed data_approver status of {email}')

        except Exception as e:
            current_app.logger.info(f'{current_user.email} attempted to change {field} of {email}')
            flash(str(e))
            return redirect("/admin")
  
        flash("User changed successfully")
        return redirect("/admin")
    return render_template('admin/admin_access_user.html', action="change")