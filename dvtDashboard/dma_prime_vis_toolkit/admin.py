import functools

from flask import (
    Blueprint, flash, g, redirect, render_template, request, session, url_for, current_app
)
from flask_bcrypt import Bcrypt

from .database import get_db
from .authenticate import login_required, admin_required

import time
import MySQLdb

bp = Blueprint('admin', __name__, url_prefix='/admin') # allow admin.py to import these routes


@bp.route("/add-user", methods=("GET", "POST"))
@login_required
@admin_required
def add_user():
    if request.method == "POST":
        email = request.form["email"]
  
        db = get_db()

        try:
            db.cursor().execute(
                """INSERT INTO user (email, username, password, access_level) VALUES (%s, "uname101", "pwd101", 1);""", [email]) 
            db.commit()
        except Exception as e:
            flash(e)
            return redirect("/admin")
            
        flash("User added successfully")
        return redirect("/admin")
    return render_template('admin_access_user.html', action="add")


@bp.route("/delete-user", methods=("GET", "POST"))
@login_required
@admin_required
def delete_user():
    if request.method == "POST":
        username = request.form["username"]
  
        db = get_db()

        try:
            db.cursor().execute(
                """DELETE FROM user WHERE username = %s""", [username]) 
            db.commit()
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
        db = get_db()

        try:
            if field == "username":
                return redirect("/admin")
            elif field == "password":
                return redirect("/admin")
            elif field == "access_level":
                db.cursor().execute("""UPDATE user
                                SET access_level = 1 
                                WHERE email = %s;""", [email])
                db.commit()

        except Exception as e:
            flash(e)
            return redirect("/admin")
  
        flash("User changed successfully")
        return redirect("/admin")
    return render_template('admin_access_user.html', action="change")