from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from datetime import date, datetime, timedelta
from .. import db
from ..models import (
    FoodEntry, WaterEntry, WeightEntry, StepEntry, SleepEntry, CaloriesBurntEntry
)
from ..forms import (
    FoodLogForm, WaterLogForm, WeightLogForm, StepLogForm, SleepLogForm, CaloriesBurntLogForm
)
from ..utils import get_week_dates

log_bp = Blueprint('log', __name__)

# ---------------------------------
# Log New Entries
# ---------------------------------
@log_bp.route('/log', methods=['GET', 'POST'])
@login_required
def log_entry():
    selected_date_str = request.args.get('selected_date', date.today().strftime("%Y-%m-%d"))
    try:
        selected_date = datetime.strptime(selected_date_str, "%Y-%m-%d").date()
    except ValueError:
        selected_date = date.today()

    food_form = FoodLogForm()
    water_form = WaterLogForm()
    weight_form = WeightLogForm()
    step_form = StepLogForm()
    sleep_form = SleepLogForm()
    calories_burnt_form = CaloriesBurntLogForm()

    # Handle submissions
    if request.method == 'POST':
        # ---- Food ----
        if food_form.submit_food.data and food_form.validate_on_submit():
            entry = FoodEntry(
                user_id=current_user.id, date=selected_date,
                time=food_form.food_time.data, name=food_form.food_name.data,
                calories=food_form.calories.data, protein=food_form.protein.data or 0,
                carbs=food_form.carbs.data or 0, fat=food_form.fat.data or 0, sugar=food_form.sugar.data or 0
            )
            db.session.add(entry)
            db.session.commit()
            flash('Food entry added!', 'success')
            return redirect(url_for('log.log_entry', selected_date=selected_date_str, tab='food'))

        # ---- Water ----
        elif water_form.submit_water.data and water_form.validate_on_submit():
            entry = WaterEntry(user_id=current_user.id, date=selected_date, amount_ml=water_form.water_amount.data)
            db.session.add(entry)
            db.session.commit()
            flash('Water entry added!', 'success')
            return redirect(url_for('log.log_entry', selected_date=selected_date_str, tab='water'))

        # ---- Weight ----
        elif weight_form.submit_weight.data and weight_form.validate_on_submit():
            weight = weight_form.weight_amount.data
            unit = request.form.get('weight_unit', 'kg')
            if unit == 'lbs': weight *= 0.453592
            entry = WeightEntry(user_id=current_user.id, date=selected_date, weight_kg=weight)
            db.session.add(entry)
            db.session.commit()
            flash('Weight entry added!', 'success')
            return redirect(url_for('log.log_entry', selected_date=selected_date_str, tab='weight'))

        # ---- Steps ----
        elif step_form.submit_steps.data and step_form.validate_on_submit():
            entry = StepEntry(user_id=current_user.id, date=selected_date, steps=step_form.step_amount.data)
            db.session.add(entry)
            db.session.commit()
            flash('Step entry added!', 'success')
            return redirect(url_for('log.log_entry', selected_date=selected_date_str, tab='steps'))

        # ---- Sleep ----
        elif sleep_form.submit_sleep.data and sleep_form.validate_on_submit():
            sleep_time = sleep_form.sleep_time.data
            wake_time = sleep_form.wake_time.data
            start = datetime.combine(selected_date, sleep_time)
            end = datetime.combine(selected_date, wake_time)
            if end <= start: end += timedelta(days=1)
            duration = (end - start).total_seconds() / 3600
            entry = SleepEntry(
                user_id=current_user.id, date=selected_date,
                duration_hours=duration, sleep_time=sleep_time, wake_time=wake_time
            )
            db.session.add(entry)
            db.session.commit()
            flash('Sleep entry added!', 'success')
            return redirect(url_for('log.log_entry', selected_date=selected_date_str, tab='sleep'))

        # ---- Calories Burnt ----
        elif calories_burnt_form.submit_calories_burnt.data and calories_burnt_form.validate_on_submit():
            entry = CaloriesBurntEntry(
                user_id=current_user.id, date=selected_date,
                calories_burnt=calories_burnt_form.calories_burnt.data
            )
            db.session.add(entry)
            db.session.commit()
            flash('Calories burnt entry added!', 'success')
            return redirect(url_for('log.log_entry', selected_date=selected_date_str, tab='calories_burnt'))

    # Retrieve entries
    entries = {
        'food': FoodEntry.query.filter_by(user_id=current_user.id, date=selected_date).order_by(FoodEntry.time).all(),
        'water': WaterEntry.query.filter_by(user_id=current_user.id, date=selected_date).all(),
        'weight': WeightEntry.query.filter_by(user_id=current_user.id, date=selected_date).all(),
        'steps': StepEntry.query.filter_by(user_id=current_user.id, date=selected_date).all(),
        'sleep': SleepEntry.query.filter_by(user_id=current_user.id, date=selected_date).all(),
        'calories_burnt': CaloriesBurntEntry.query.filter_by(user_id=current_user.id, date=selected_date).all()
    }

    weekly_dates = get_week_dates(selected_date)
    prev_week_start = weekly_dates[0] - timedelta(days=7)
    next_week_start = weekly_dates[0] + timedelta(days=7)
    first_name = current_user.profile_name.split(' ')[0] if current_user.profile_name else current_user.username

    return render_template(
        'log_entry.html',
        title='Log',
        selected_date=selected_date,
        weekly_dates=weekly_dates,
        food_form=food_form,
        water_form=water_form,
        weight_form=weight_form,
        step_form=step_form,
        sleep_form=sleep_form,
        calories_burnt_form=calories_burnt_form,
        entries=entries,
        prev_week_start=prev_week_start,
        next_week_start=next_week_start,
        first_name=first_name
    )


# ---------------------------------
# Edit Entry
# ---------------------------------
@log_bp.route('/edit_entry/<entry_type>/<int:entry_id>', methods=['GET', 'POST'])
@login_required
def edit_entry(entry_type, entry_id):
    model_map = {
        'food': (FoodEntry, FoodLogForm),
        'water': (WaterEntry, WaterLogForm),
        'weight': (WeightEntry, WeightLogForm),
        'steps': (StepEntry, StepLogForm),
        'sleep': (SleepEntry, SleepLogForm),
        'calories_burnt': (CaloriesBurntEntry, CaloriesBurntLogForm)
    }

    model, form_class = model_map.get(entry_type, (None, None))
    if not model:
        flash('Invalid entry type.', 'danger')
        return redirect(url_for('main.dashboard'))

    entry = model.query.get_or_404(entry_id)
    if entry.user_id != current_user.id:
        flash('Unauthorized action.', 'danger')
        return redirect(url_for('main.dashboard'))

    form = form_class(obj=entry)
    if form.validate_on_submit():
        if entry_type == 'food':
            entry.name = form.food_name.data
            entry.time = form.food_time.data
            entry.calories = form.calories.data
            entry.protein = form.protein.data
            entry.carbs = form.carbs.data
            entry.fat = form.fat.data
            entry.sugar = form.sugar.data
        elif entry_type == 'water':
            entry.amount_ml = form.water_amount.data
        elif entry_type == 'weight':
            entry.weight_kg = form.weight_amount.data
        elif entry_type == 'steps':
            entry.steps = form.step_amount.data
        elif entry_type == 'calories_burnt':
            entry.calories_burnt = form.calories_burnt.data
        elif entry_type == 'sleep':
            entry.sleep_time = form.sleep_time.data
            entry.wake_time = form.wake_time.data
            start = datetime.combine(entry.date, form.sleep_time.data)
            end = datetime.combine(entry.date, form.wake_time.data)
            if end <= start: end += timedelta(days=1)
            entry.duration_hours = (end - start).total_seconds() / 3600
        db.session.commit()
        flash(f'{entry_type.replace("_", " ").capitalize()} entry updated.', 'success')
        return redirect(url_for('log.log_entry', selected_date=entry.date.strftime('%Y-%m-%d'), tab=entry_type))

    return render_template('edit_entry.html', form=form, entry_type=entry_type, entry_id=entry.id, selected_date=entry.date)


# ---------------------------------
# Delete Entry
# ---------------------------------
@log_bp.route('/delete_entry/<entry_type>/<int:entry_id>', methods=['POST'])
@login_required
def delete_entry(entry_type, entry_id):
    model_map = {
        'food': FoodEntry, 'water': WaterEntry, 'weight': WeightEntry,
        'steps': StepEntry, 'sleep': SleepEntry, 'calories_burnt': CaloriesBurntEntry
    }
    model = model_map.get(entry_type)
    if not model:
        flash("Invalid entry type.", "danger")
        return redirect(url_for('main.dashboard'))

    entry = model.query.get_or_404(entry_id)
    if entry.user_id != current_user.id:
        flash("Unauthorized.", "danger")
        return redirect(url_for('main.dashboard'))

    db.session.delete(entry)
    db.session.commit()
    flash(f"{entry_type.replace('_', ' ').capitalize()} entry deleted.", "success")
    return redirect(url_for('log.log_entry', selected_date=entry.date.strftime('%Y-%m-%d'), tab=entry_type))
