# app.py

import os
from flask import Flask, render_template, redirect, url_for, flash, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField, FloatField, SelectField, IntegerField
from wtforms.fields import DateField, TimeField
from wtforms.validators import DataRequired, Email, EqualTo, Length, Optional, NumberRange
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import date, timedelta, datetime
from sqlalchemy import func

# --- App Configuration ---
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'a_very_secret_key_that_should_be_changed')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# --- Database Models ---
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    profile_name = db.Column(db.String(120), nullable=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(150), nullable=False)
    date_of_birth = db.Column(db.Date, nullable=True)
    height_cm = db.Column(db.Float, nullable=True)
    weight_kg = db.Column(db.Float, nullable=True)
    gender = db.Column(db.String(10), nullable=True)
    activity_level = db.Column(db.String(50), nullable=False, default='sedentary')
    calorie_goal = db.Column(db.Integer, default=2000)
    protein_goal = db.Column(db.Integer, default=100)
    carbs_goal = db.Column(db.Integer, default=250)
    fat_goal = db.Column(db.Integer, default=60)
    sugar_goal = db.Column(db.Integer, default=50)
    water_goal = db.Column(db.Integer, default=2500)
    step_goal = db.Column(db.Integer, default=10000)
    sleep_goal = db.Column(db.Float, default=8.0)
    calories_burnt_goal = db.Column(db.Integer, default=300)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password, method='pbk2:sha256')

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class FoodEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    time = db.Column(db.Time, nullable=True)
    name = db.Column(db.String(100), nullable=False)
    calories = db.Column(db.Float, nullable=False)
    protein = db.Column(db.Float, default=0)
    carbs = db.Column(db.Float, default=0)
    fat = db.Column(db.Float, default=0)
    sugar = db.Column(db.Float, default=0)
    user = db.relationship('User', backref=db.backref('food_entries_ref', lazy=True))

class WaterEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    amount_ml = db.Column(db.Integer, nullable=False)
    user = db.relationship('User', backref=db.backref('water_entries_ref', lazy=True))

class WeightEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    weight_kg = db.Column(db.Float, nullable=False)
    user = db.relationship('User', backref=db.backref('weight_entries_ref', lazy=True))

class StepEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    steps = db.Column(db.Integer, nullable=False)
    user = db.relationship('User', backref=db.backref('step_entries_ref', lazy=True))

class SleepEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    duration_hours = db.Column(db.Float, nullable=False)
    sleep_time = db.Column(db.Time, nullable=True)
    wake_time = db.Column(db.Time, nullable=True)
    user = db.relationship('User', backref=db.backref('sleep_entries_ref', lazy=True))

class CaloriesBurntEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    calories_burnt = db.Column(db.Integer, nullable=False)
    user = db.relationship('User', backref=db.backref('calories_burnt_entries_ref', lazy=True))

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# --- Forms (Updated with new validation) ---
class SignUpForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(min=4, max=25)])
    email = StringField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired(), Length(min=6)])
    confirm_password = PasswordField('Confirm Password', validators=[DataRequired(), EqualTo('password')])
    submit = SubmitField('Create Account')

class LoginForm(FlaskForm):
    email = StringField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired()])
    submit = SubmitField('Login')

class FoodLogForm(FlaskForm):
    food_name = StringField('Food Name', validators=[DataRequired()])
    food_time = TimeField('Time', format='%H:%M', validators=[DataRequired()], default=datetime.now().time)
    calories = FloatField('Calories', validators=[DataRequired(), NumberRange(min=0)])
    protein = FloatField('Protein (g)', validators=[Optional(), NumberRange(min=0)])
    carbs = FloatField('Carbs (g)', validators=[Optional(), NumberRange(min=0)])
    fat = FloatField('Fat (g)', validators=[Optional(), NumberRange(min=0)])
    sugar = FloatField('Sugar (g)', validators=[Optional(), NumberRange(min=0)])
    submit_food = SubmitField('Log Food')

class WaterLogForm(FlaskForm):
    water_amount = FloatField('Amount', validators=[DataRequired(), NumberRange(min=0)])
    submit_water = SubmitField('Log Water')

class WeightLogForm(FlaskForm):
    weight_amount = FloatField('Weight', validators=[DataRequired(), NumberRange(min=0)])
    submit_weight = SubmitField('Log Weight')

class StepLogForm(FlaskForm):
    step_amount = IntegerField('Steps', validators=[DataRequired(), NumberRange(min=0)])
    submit_steps = SubmitField('Log Steps')

class SleepLogForm(FlaskForm):
    sleep_time = TimeField('Sleep Time', validators=[DataRequired()])
    wake_time = TimeField('Wake Time', validators=[DataRequired()])
    submit_sleep = SubmitField('Log Sleep')

class CaloriesBurntLogForm(FlaskForm):
    calories_burnt = IntegerField('Calories Burnt', validators=[DataRequired(), NumberRange(min=0)])
    submit_calories_burnt = SubmitField('Log Calories Burnt')

class ProfileForm(FlaskForm):
    date_of_birth = DateField('Date of Birth', validators=[Optional()])
    height_cm = FloatField('Height (cm)', validators=[Optional(), NumberRange(min=0)])
    height_ft = IntegerField('Height (ft)', validators=[Optional(), NumberRange(min=0)])
    height_in = IntegerField('Height (in)', validators=[Optional(), NumberRange(min=0, max=11)])
    weight_kg = FloatField('Current Weight (kg)', validators=[Optional(), NumberRange(min=0)])
    gender = SelectField('Gender', choices=[('male', 'Male'), ('female', 'Female'), ('other', 'Other')], validators=[Optional()])
    activity_level = SelectField('Activity Level', choices=[
        ('sedentary', 'Sedentary'), ('light', 'Lightly active'), ('moderate', 'Moderately active'),
        ('active', 'Very active'), ('extra_active', 'Extra active')
    ], validators=[DataRequired()])
    submit_profile = SubmitField('Update Profile')

class GoalsForm(FlaskForm):
    calorie_goal = IntegerField('Calorie Goal', validators=[DataRequired(), NumberRange(min=0)])
    protein_goal = IntegerField('Protein Goal (g)', validators=[DataRequired(), NumberRange(min=0)])
    carbs_goal = IntegerField('Carbs Goal (g)', validators=[DataRequired(), NumberRange(min=0)])
    fat_goal = IntegerField('Fat Goal (g)', validators=[DataRequired(), NumberRange(min=0)])
    sugar_goal = IntegerField('Sugar Goal (g)', validators=[DataRequired(), NumberRange(min=0)])
    water_goal = IntegerField('Water Goal (ml)', validators=[DataRequired(), NumberRange(min=0)])
    step_goal = IntegerField('Step Goal', validators=[DataRequired(), NumberRange(min=0)])
    sleep_goal = FloatField('Sleep Goal (hours)', validators=[DataRequired(), NumberRange(min=0)])
    calories_burnt_goal = IntegerField('Calories Burnt Goal', validators=[DataRequired(), NumberRange(min=0)])
    submit_goals = SubmitField('Update Goals')

class AccountSettingsForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(min=4, max=25)])
    profile_name = StringField('Profile Name', validators=[Optional(), Length(max=120)])
    email = StringField('Email', validators=[DataRequired(), Email()])
    current_password = PasswordField('Current Password', validators=[Optional()])
    new_password = PasswordField('New Password', validators=[Optional(), Length(min=6)])
    confirm_new_password = PasswordField('Confirm New Password', validators=[Optional(), EqualTo('new_password')])
    submit_account = SubmitField('Update Account')

# --- Helper Functions ---
def get_daily_totals(user_id, date):
    food_entries = FoodEntry.query.filter_by(user_id=user_id, date=date).all()
    water_entries = WaterEntry.query.filter_by(user_id=user_id, date=date).all()
    step_entries = StepEntry.query.filter_by(user_id=user_id, date=date).all()
    sleep_entries = SleepEntry.query.filter_by(user_id=user_id, date=date).all()
    calories_burnt_entries = CaloriesBurntEntry.query.filter_by(user_id=user_id, date=date).all()

    return {
        'calories': sum(e.calories for e in food_entries),
        'carbs': sum(e.carbs for e in food_entries),
        'protein': sum(e.protein for e in food_entries),
        'fat': sum(e.fat for e in food_entries),
        'sugar': sum(e.sugar for e in food_entries),
        'water': sum(e.amount_ml for e in water_entries),
        'steps': sum(e.steps for e in step_entries),
        'sleep': sum(e.duration_hours for e in sleep_entries),
        'calories_burnt': sum(e.calories_burnt for e in calories_burnt_entries)
    }

def get_health_metrics(user, totals):
    metrics = {
        'bmi': 'N/A', 'bmi_status': 'N/A',
        'maintenance_calories': 'N/A', 'calorie_deficit': 'N/A'
    }
    if user.weight_kg and user.height_cm and user.height_cm > 0:
        height_m = user.height_cm / 100
        bmi = user.weight_kg / (height_m ** 2)
        metrics['bmi'] = f"{bmi:.2f}"
        if bmi < 18.5: metrics['bmi_status'] = 'Underweight'
        elif 18.5 <= bmi < 25: metrics['bmi_status'] = 'Normal'
        else: metrics['bmi_status'] = 'Overweight'

    if user.date_of_birth and user.gender and user.weight_kg and user.height_cm:
        age = (date.today() - user.date_of_birth).days // 365
        if user.gender == 'male':
            bmr = 10 * user.weight_kg + 6.25 * user.height_cm - 5 * age + 5
        else:
            bmr = 10 * user.weight_kg + 6.25 * user.height_cm - 5 * age - 161
        activity_factors = {'sedentary': 1.2, 'light': 1.375, 'moderate': 1.55, 'active': 1.725, 'extra_active': 1.9}
        maintenance_calories = bmr * activity_factors.get(user.activity_level, 1.2)
        metrics['maintenance_calories'] = f"{int(maintenance_calories)}"
        if totals['calories'] is not None:
            metrics['calorie_deficit'] = f"{int(maintenance_calories - totals['calories'])}"
    return metrics

def get_user_goals(user):
    return {
        'calorie_goal': user.calorie_goal or 0, 'protein_goal': user.protein_goal or 0,
        'carbs_goal': user.carbs_goal or 0, 'fat_goal': user.fat_goal or 0,
        'sugar_goal': user.sugar_goal or 0, 'water_goal': user.water_goal or 0,
        'step_goal': user.step_goal or 0, 'sleep_goal': user.sleep_goal or 0,
        'calories_burnt_goal': user.calories_burnt_goal or 0
    }

def get_week_dates(selected_date):
    # Find the first day of the week (Sunday)
    start_of_week = selected_date - timedelta(days=(selected_date.weekday() + 1) % 7)
    return [start_of_week + timedelta(days=i) for i in range(7)]

# --- Context Processor ---
@app.context_processor
def inject_date():
    return {'date': date}

# --- Routes ---
@app.route('/')
def index():
    if not current_user.is_authenticated:
        return redirect(url_for('login'))
    return redirect(url_for('dashboard'))

@app.route('/dashboard')
@login_required
def dashboard():
    selected_date_str = request.args.get('selected_date', date.today().strftime("%Y-%m-%d"))
    selected_date = datetime.strptime(selected_date_str, "%Y-%m-%d").date()
    
    totals = get_daily_totals(current_user.id, selected_date)
    goals = get_user_goals(current_user)
    health_metrics = get_health_metrics(current_user, totals)
    
    current_weight_kg = current_user.weight_kg
    current_weight_lbs = current_weight_kg * 2.20462 if current_weight_kg else None
    formatted_weight = {
        'kg': f"{current_weight_kg:.2f}" if current_weight_kg is not None else 'N/A',
        'lbs': f"{current_weight_lbs:.2f}" if current_weight_lbs is not None else 'N/A'
    }

    weekly_dates = get_week_dates(selected_date)
    
    # Calculate the start dates for the previous and next weeks
    prev_week_start = weekly_dates[0] - timedelta(days=7)
    next_week_start = weekly_dates[0] + timedelta(days=7)
    
    # Chart data for the last 7 days
    start_of_week = weekly_dates[0]
    weight_data = WeightEntry.query.filter(WeightEntry.user_id == current_user.id, WeightEntry.date >= start_of_week, WeightEntry.date <= selected_date).order_by(WeightEntry.date).all()
    sleep_chart_data = SleepEntry.query.filter(SleepEntry.user_id == current_user.id, SleepEntry.date >= start_of_week, SleepEntry.date <= selected_date).order_by(SleepEntry.date).all()

    sleep_by_date = {s.date: s for s in sleep_chart_data}
    
    chart_data = {
        'weight_labels': [d.strftime('%a') for d in weekly_dates],
        'weight_values': [next((w.weight_kg for w in weight_data if w.date == d), None) for d in weekly_dates],
        'sleep_labels': [d.strftime('%a') for d in weekly_dates],
        'sleep_values': [sleep_by_date[d].duration_hours if d in sleep_by_date else None for d in weekly_dates],
    }
    
    first_name = current_user.profile_name.split(' ')[0] if current_user.profile_name else current_user.username
    
    return render_template('dashboard.html', title='Dashboard',
                           totals=totals, goals=goals, health_metrics=health_metrics,
                           chart_data=chart_data, first_name=first_name,
                           selected_date=selected_date, weekly_dates=weekly_dates,
                           formatted_weight=formatted_weight,
                           prev_week_start=prev_week_start, next_week_start=next_week_start)

@app.route('/log', methods=['GET', 'POST'])
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

    if request.method == 'POST':
        if food_form.submit_food.data and food_form.validate_on_submit():
            entry = FoodEntry(user_id=current_user.id, date=selected_date, time=food_form.food_time.data,
                              name=food_form.food_name.data, calories=food_form.calories.data,
                              protein=food_form.protein.data or 0, carbs=food_form.carbs.data or 0,
                              fat=food_form.fat.data or 0, sugar=food_form.sugar.data or 0)
            db.session.add(entry)
            db.session.commit()
            flash('Food entry added!', 'success')
            return redirect(url_for('log_entry', selected_date=selected_date_str, tab='food'))
        elif water_form.submit_water.data and water_form.validate_on_submit():
            entry = WaterEntry(user_id=current_user.id, date=selected_date, amount_ml=water_form.water_amount.data)
            db.session.add(entry)
            db.session.commit()
            flash('Water entry added!', 'success')
            return redirect(url_for('log_entry', selected_date=selected_date_str, tab='water'))
        elif weight_form.submit_weight.data and weight_form.validate_on_submit():
            weight = weight_form.weight_amount.data
            unit = request.form.get('weight_unit', 'kg')
            if unit == 'lbs': weight *= 0.453592
            entry = WeightEntry(user_id=current_user.id, date=selected_date, weight_kg=weight)
            db.session.add(entry)
            db.session.commit()
            flash('Weight entry added!', 'success')
            return redirect(url_for('log_entry', selected_date=selected_date_str, tab='weight'))
        elif step_form.submit_steps.data and step_form.validate_on_submit():
            entry = StepEntry(user_id=current_user.id, date=selected_date, steps=step_form.step_amount.data)
            db.session.add(entry)
            db.session.commit()
            flash('Step entry added!', 'success')
            return redirect(url_for('log_entry', selected_date=selected_date_str, tab='steps'))
        elif sleep_form.submit_sleep.data and sleep_form.validate_on_submit():
            sleep_time = sleep_form.sleep_time.data
            wake_time = sleep_form.wake_time.data
            start = datetime.combine(selected_date, sleep_time)
            end = datetime.combine(selected_date, wake_time)
            if end <= start: end += timedelta(days=1)
            duration_hours = (end - start).total_seconds() / 3600
            entry = SleepEntry(user_id=current_user.id, date=selected_date,
                               duration_hours=duration_hours, sleep_time=sleep_time, wake_time=wake_time)
            db.session.add(entry)
            db.session.commit()
            flash('Sleep entry added!', 'success')
            return redirect(url_for('log_entry', selected_date=selected_date_str, tab='sleep'))
        elif calories_burnt_form.submit_calories_burnt.data and calories_burnt_form.validate_on_submit():
            entry = CaloriesBurntEntry(user_id=current_user.id, date=selected_date, calories_burnt=calories_burnt_form.calories_burnt.data)
            db.session.add(entry)
            db.session.commit()
            flash('Calories burnt entry added!', 'success')
            return redirect(url_for('log_entry', selected_date=selected_date_str, tab='calories_burnt'))

    entries = {
        'food': FoodEntry.query.filter_by(user_id=current_user.id, date=selected_date).order_by(FoodEntry.time).all(),
        'water': WaterEntry.query.filter_by(user_id=current_user.id, date=selected_date).all(),
        'weight': WeightEntry.query.filter_by(user_id=current_user.id, date=selected_date).all(),
        'steps': StepEntry.query.filter_by(user_id=current_user.id, date=selected_date).all(),
        'sleep': SleepEntry.query.filter_by(user_id=current_user.id, date=selected_date).all(),
        'calories_burnt': CaloriesBurntEntry.query.filter_by(user_id=current_user.id, date=selected_date).all()
    }
    
    weekly_dates = get_week_dates(selected_date)

    # Calculate the start dates for the previous and next weeks
    prev_week_start = weekly_dates[0] - timedelta(days=7)
    next_week_start = weekly_dates[0] + timedelta(days=7)
    first_name = current_user.profile_name.split(' ')[0] if current_user.profile_name else current_user.username
    
    return render_template('log_entry.html', title='Log', selected_date=selected_date,
                           weekly_dates=weekly_dates,
                           food_form=food_form, water_form=water_form, weight_form=weight_form,
                           step_form=step_form, sleep_form=sleep_form, calories_burnt_form=calories_burnt_form,
                           entries=entries,
                           prev_week_start=prev_week_start, next_week_start=next_week_start,
                           first_name=first_name)

@app.route('/goals', methods=['GET', 'POST'])
@login_required
def goals():
    goals_form = GoalsForm(obj=current_user)
    if goals_form.validate_on_submit():
        current_user.calorie_goal = goals_form.calorie_goal.data
        current_user.calories_burnt_goal = goals_form.calories_burnt_goal.data
        current_user.protein_goal = goals_form.protein_goal.data
        current_user.carbs_goal = goals_form.carbs_goal.data
        current_user.fat_goal = goals_form.fat_goal.data
        current_user.sugar_goal = goals_form.sugar_goal.data
        current_user.water_goal = goals_form.water_goal.data
        current_user.step_goal = goals_form.step_goal.data
        current_user.sleep_goal = goals_form.sleep_goal.data
        db.session.commit()
        flash('Goal settings updated.', 'success')
        return redirect(url_for('goals'))
    
    selected_date_str = request.args.get('selected_date', date.today().strftime("%Y-%m-%d"))
    selected_date = datetime.strptime(selected_date_str, "%Y-%m-%d").date()
    weekly_dates = get_week_dates(selected_date)

    # Calculate the start dates for the previous and next weeks
    prev_week_start = weekly_dates[0] - timedelta(days=7)
    next_week_start = weekly_dates[0] + timedelta(days=7)
    first_name = current_user.profile_name.split(' ')[0] if current_user.profile_name else current_user.username

    return render_template('goals.html', title='Goals', goals_form=goals_form, 
                           selected_date=selected_date, weekly_dates=weekly_dates,
                           prev_week_start=prev_week_start, next_week_start=next_week_start,
                           first_name=first_name)


@app.route('/settings', methods=['GET', 'POST'])
@login_required
def settings():
    profile_form = ProfileForm(obj=current_user)
    account_form = AccountSettingsForm(obj=current_user)

    if 'submit_profile' in request.form and profile_form.validate():
        height_unit = request.form.get('height_unit')
        weight_unit = request.form.get('weight_unit')

        if height_unit == 'ft' and profile_form.height_ft.data is not None and profile_form.height_in.data is not None:
            ft = profile_form.height_ft.data
            inch = profile_form.height_in.data
            current_user.height_cm = (ft * 30.48) + (inch * 2.54)
        elif profile_form.height_cm.data is not None:
            current_user.height_cm = profile_form.height_cm.data

        if profile_form.weight_kg.data is not None:
            new_weight = profile_form.weight_kg.data
            if weight_unit == 'lbs':
                new_weight *= 0.453592
            if new_weight != current_user.weight_kg:
                current_user.weight_kg = new_weight
                today_entry = WeightEntry.query.filter_by(user_id=current_user.id, date=date.today()).first()
                if today_entry:
                    today_entry.weight_kg = new_weight
                else:
                    new_entry = WeightEntry(user_id=current_user.id, date=date.today(), weight_kg=new_weight)
                    db.session.add(new_entry)
                flash('Weight auto-logged for today.', 'info')

        current_user.date_of_birth = profile_form.date_of_birth.data
        current_user.gender = profile_form.gender.data
        current_user.activity_level = profile_form.activity_level.data
        
        db.session.commit()
        flash('Profile settings updated.', 'success')
        return redirect(url_for('settings', tab='profile'))

    if 'submit_account' in request.form and account_form.validate():
        user_changed = False
        if current_user.username != account_form.username.data or \
           current_user.profile_name != account_form.profile_name.data or \
           current_user.email != account_form.email.data:
            current_user.username = account_form.username.data
            current_user.profile_name = account_form.profile_name.data
            current_user.email = account_form.email.data
            user_changed = True

        if account_form.new_password.data:
            if account_form.current_password.data and current_user.check_password(account_form.current_password.data):
                current_user.set_password(account_form.new_password.data)
                user_changed = True
                flash('Password updated successfully.', 'success')
            else:
                flash('Incorrect current password or current password not provided.', 'danger')
        
        if user_changed:
            db.session.commit()
            flash('Account settings updated.', 'success')
        return redirect(url_for('settings', tab='account'))

    selected_date_str = request.args.get('selected_date', date.today().strftime("%Y-%m-%d"))
    selected_date = datetime.strptime(selected_date_str, "%Y-%m-%d").date()
    weekly_dates = get_week_dates(selected_date)
    first_name = current_user.profile_name.split(' ')[0] if current_user.profile_name else current_user.username
        
    return render_template('settings.html', title='Settings', profile_form=profile_form, account_form=account_form,
                           selected_date=selected_date, weekly_dates=weekly_dates)

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if current_user.is_authenticated: return redirect(url_for('dashboard'))
    form = SignUpForm()
    if form.validate_on_submit():
        new_user = User(
            username=form.username.data, 
            email=form.email.data,
            profile_name=form.username.data
        )
        new_user.set_password(form.password.data)
        db.session.add(new_user)
        db.session.commit()
        login_user(new_user)
        flash('Account created! Please complete your profile.', 'success')
        return redirect(url_for('settings'))
    return render_template('signup.html', title='Sign Up', form=form)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated: return redirect(url_for('dashboard'))
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user and user.check_password(form.password.data):
            login_user(user, remember=True)
            return redirect(url_for('dashboard'))
        else:
            flash('Login failed. Check email and password.', 'danger')
    return render_template('login.html', title='Login', form=form)

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/delete_entry/<entry_type>/<int:entry_id>', methods=['POST'])
@login_required
def delete_entry(entry_type, entry_id):
    model_map = {
        'food': FoodEntry, 'water': WaterEntry, 'weight': WeightEntry,
        'steps': StepEntry, 'sleep': SleepEntry, 'calories_burnt': CaloriesBurntEntry
    }
    model = model_map.get(entry_type)
    if not model:
        flash("Invalid entry type.", "danger")
        return redirect(request.referrer or url_for('dashboard'))

    entry = model.query.get_or_404(entry_id)
    if entry.user_id != current_user.id:
        flash("You are not authorized to delete this entry.", "danger")
        return redirect(request.referrer or url_for('dashboard'))

    selected_date_str = entry.date.strftime('%Y-%m-%d')
    db.session.delete(entry)
    db.session.commit()
    flash(f'{entry_type.replace("_", " ").capitalize()} entry deleted.', 'success')
    return redirect(url_for('log_entry', selected_date=selected_date_str, tab=entry_type))

@app.route('/edit_entry/<entry_type>/<int:entry_id>', methods=['GET', 'POST'])
@login_required
def edit_entry(entry_type, entry_id):
    model_map = {
        'food': (FoodEntry, FoodLogForm), 'water': (WaterEntry, WaterLogForm),
        'weight': (WeightEntry, WeightLogForm), 'steps': (StepEntry, StepLogForm),
        'sleep': (SleepEntry, SleepLogForm), 'calories_burnt': (CaloriesBurntEntry, CaloriesBurntLogForm)
    }
    model, form_class = model_map.get(entry_type)
    if not model:
        flash("Invalid entry type.", "danger")
        return redirect(url_for('dashboard'))

    entry = model.query.get_or_404(entry_id)
    if entry.user_id != current_user.id:
        flash("You are not authorized to edit this entry.", "danger")
        return redirect(url_for('dashboard'))

    form = form_class(obj=entry) if request.method == 'GET' else form_class(request.form)

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
        return redirect(url_for('log_entry', selected_date=entry.date.strftime('%Y-%m-%d'), tab=entry_type))

    return render_template('edit_entry.html', form=form, entry_type=entry_type, entry_id=entry.id, selected_date=entry.date)


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=5001, debug=True)