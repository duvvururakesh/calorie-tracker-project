from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from datetime import date, datetime, timedelta
from .. import db
from ..models import WeightEntry
from ..forms import ProfileForm, GoalsForm, AccountSettingsForm
from ..utils import get_week_dates

profile_bp = Blueprint('profile', __name__)

# ---------------------------------
# Goals
# ---------------------------------
@profile_bp.route('/goals', methods=['GET', 'POST'])
@login_required
def goals():
    goals_form = GoalsForm(obj=current_user)
    if goals_form.validate_on_submit():
        current_user.calorie_goal = goals_form.calorie_goal.data
        current_user.protein_goal = goals_form.protein_goal.data
        current_user.carbs_goal = goals_form.carbs_goal.data
        current_user.fat_goal = goals_form.fat_goal.data
        current_user.sugar_goal = goals_form.sugar_goal.data
        current_user.water_goal = goals_form.water_goal.data
        current_user.step_goal = goals_form.step_goal.data
        current_user.sleep_goal = goals_form.sleep_goal.data
        current_user.calories_burnt_goal = goals_form.calories_burnt_goal.data
        db.session.commit()
        flash('Goal settings updated.', 'success')
        return redirect(url_for('profile.goals'))

    selected_date = datetime.strptime(
        request.args.get('selected_date', date.today().strftime("%Y-%m-%d")), "%Y-%m-%d"
    ).date()

    weekly_dates = get_week_dates(selected_date)
    return render_template(
        'goals.html', title='Goals', goals_form=goals_form,
        selected_date=selected_date, weekly_dates=weekly_dates
    )

# ---------------------------------
# Settings / Profile
# ---------------------------------
@profile_bp.route('/settings', methods=['GET', 'POST'])
@login_required
def settings():
    profile_form = ProfileForm(obj=current_user)
    account_form = AccountSettingsForm(obj=current_user)

    # Update profile info
    if 'submit_profile' in request.form and profile_form.validate():
        height_unit = request.form.get('height_unit')
        weight_unit = request.form.get('weight_unit')

        # Convert height if in ft/in
        if height_unit == 'ft' and profile_form.height_ft.data is not None and profile_form.height_in.data is not None:
            ft, inch = profile_form.height_ft.data, profile_form.height_in.data
            current_user.height_cm = (ft * 30.48) + (inch * 2.54)
        elif profile_form.height_cm.data is not None:
            current_user.height_cm = profile_form.height_cm.data

        # Convert weight if lbs
        if profile_form.weight_kg.data is not None:
            weight = profile_form.weight_kg.data
            if weight_unit == 'lbs': weight *= 0.453592
            current_user.weight_kg = weight

            today_entry = WeightEntry.query.filter_by(user_id=current_user.id, date=date.today()).first()
            if today_entry:
                today_entry.weight_kg = weight
            else:
                db.session.add(WeightEntry(user_id=current_user.id, date=date.today(), weight_kg=weight))
            flash('Weight auto-logged for today.', 'info')

        current_user.date_of_birth = profile_form.date_of_birth.data
        current_user.gender = profile_form.gender.data
        current_user.activity_level = profile_form.activity_level.data
        db.session.commit()
        flash('Profile updated.', 'success')
        return redirect(url_for('profile.settings', tab='profile'))

    # Update account info
    if 'submit_account' in request.form and account_form.validate():
        if current_user.username != account_form.username.data or current_user.email != account_form.email.data:
            current_user.username = account_form.username.data
            current_user.email = account_form.email.data
        if account_form.new_password.data:
            if account_form.current_password.data and current_user.check_password(account_form.current_password.data):
                current_user.set_password(account_form.new_password.data)
                flash('Password updated.', 'success')
            else:
                flash('Incorrect current password.', 'danger')
        db.session.commit()
        flash('Account settings updated.', 'success')
        return redirect(url_for('profile.settings', tab='account'))

    return render_template('settings.html', title='Settings', profile_form=profile_form, account_form=account_form)
