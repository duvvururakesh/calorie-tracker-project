# app.py
# Main Flask application file. Contains routes and core logic.

import os
from flask import Flask, render_template, redirect, url_for, flash, request
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField, FloatField, SelectField, IntegerField
from wtforms.fields import DateField, TimeField
from wtforms.validators import DataRequired, Email, EqualTo, Length, Optional
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import date, timedelta, datetime

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
        self.password_hash = generate_password_hash(password, method='pbkdf2:sha256')

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

# --- Forms ---
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
    calories = FloatField('Calories', validators=[DataRequired()])
    protein = FloatField('Protein (g)', validators=[Optional()])
    carbs = FloatField('Carbs (g)', validators=[Optional()])
    fat = FloatField('Fat (g)', validators=[Optional()])
    sugar = FloatField('Sugar (g)', validators=[Optional()])
    submit_food = SubmitField('Log Food')

class WaterLogForm(FlaskForm):
    water_amount = FloatField('Amount', validators=[DataRequired()])
    submit_water = SubmitField('Log Water')

class WeightLogForm(FlaskForm):
    weight_amount = FloatField('Weight', validators=[DataRequired()])
    submit_weight = SubmitField('Log Weight')

class StepLogForm(FlaskForm):
    step_amount = IntegerField('Steps', validators=[DataRequired()])
    submit_steps = SubmitField('Log Steps')

class SleepLogForm(FlaskForm):
    sleep_time = TimeField('Sleep Time', validators=[DataRequired()])
    wake_time = TimeField('Wake Time', validators=[DataRequired()])
    submit_sleep = SubmitField('Log Sleep')

class CaloriesBurntLogForm(FlaskForm):
    calories_burnt = IntegerField('Calories Burnt', validators=[DataRequired()])
    submit_calories_burnt = SubmitField('Log Calories Burnt')

class ProfileForm(FlaskForm):
    date_of_birth = DateField('Date of Birth', validators=[Optional()])
    height_cm = FloatField('Height (cm)', validators=[Optional()])
    height_ft = IntegerField('Height (ft)', validators=[Optional()])
    height_in = IntegerField('Height (in)', validators=[Optional()])
    weight_kg = FloatField('Current Weight (kg)', validators=[Optional()])
    gender = SelectField('Gender', choices=[('male', 'Male'), ('female', 'Female'), ('other', 'Other')], validators=[Optional()])
    activity_level = SelectField('Activity Level', choices=[
        ('sedentary', 'Sedentary'), ('light', 'Lightly active'), ('moderate', 'Moderately active'),
        ('active', 'Very active'), ('extra_active', 'Extra active')
    ], validators=[DataRequired()])
    submit_profile = SubmitField('Update Profile')

class GoalsForm(FlaskForm):
    calorie_goal = IntegerField('Calorie Goal', validators=[DataRequired()])
    protein_goal = IntegerField('Protein Goal (g)', validators=[DataRequired()])
    carbs_goal = IntegerField('Carbs Goal (g)', validators=[DataRequired()])
    fat_goal = IntegerField('Fat Goal (g)', validators=[DataRequired()])
    sugar_goal = IntegerField('Sugar Goal (g)', validators=[DataRequired()])
    water_goal = IntegerField('Water Goal (ml)', validators=[DataRequired()])
    step_goal = IntegerField('Step Goal', validators=[DataRequired()])
    sleep_goal = FloatField('Sleep Goal (hours)', validators=[DataRequired()])
    calories_burnt_goal = IntegerField('Calories Burnt Goal', validators=[DataRequired()])
    submit_goals = SubmitField('Update Goals')

class AccountSettingsForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(min=4, max=25)])
    profile_name = StringField('Profile Name', validators=[Optional(), Length(max=120)])
    email = StringField('Email', validators=[DataRequired(), Email()])
    current_password = PasswordField('Current Password', validators=[Optional()])
    new_password = PasswordField('New Password', validators=[Optional(), Length(min=6)])
    confirm_new_password = PasswordField('Confirm New Password', validators=[Optional(), EqualTo('new_password')])
    submit_account = SubmitField('Update Account')

# --- Context Processor ---
@app.context_processor
def inject_date():
    return {'date': date}

# --- Routes ---
@app.route('/')
def index():
    if not current_user.is_authenticated:
        return redirect(url_for('login'))
    return redirect(url_for('home'))

@app.route('/home')
@login_required
def home():
    # Data for Dashboard
    selected_date_str = request.args.get('selected_date', date.today().strftime("%Y-%m-%d"))
    try:
        selected_date = datetime.strptime(selected_date_str, "%Y-%m-%d").date()
    except ValueError:
        selected_date = date.today()

    food_entries = FoodEntry.query.filter_by(user_id=current_user.id, date=selected_date).all()
    water_entries = WaterEntry.query.filter_by(user_id=current_user.id, date=selected_date).all()
    step_entries = StepEntry.query.filter_by(user_id=current_user.id, date=selected_date).all()
    sleep_entries = SleepEntry.query.filter_by(user_id=current_user.id, date=selected_date).all()
    calories_burnt_entries = CaloriesBurntEntry.query.filter_by(user_id=current_user.id, date=selected_date).all()

    totals = {
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

    goals = {
        'calorie_goal': current_user.calorie_goal or 0,
        'protein_goal': current_user.protein_goal or 0,
        'carbs_goal': current_user.carbs_goal or 0,
        'fat_goal': current_user.fat_goal or 0,
        'sugar_goal': current_user.sugar_goal or 0,
        'water_goal': current_user.water_goal or 0,
        'step_goal': current_user.step_goal or 0,
        'sleep_goal': current_user.sleep_goal or 0,
        'calories_burnt_goal': current_user.calories_burnt_goal or 0
    }

    health_metrics = {
        'bmi': 'N/A',
        'bmi_status': 'N/A',
        'maintenance_calories': 'N/A',
        'calorie_deficit': 'N/A'
    }

    if current_user.weight_kg and current_user.height_cm:
        height_m = current_user.height_cm / 100
        if height_m > 0:
            bmi = current_user.weight_kg / (height_m ** 2)
            health_metrics['bmi'] = f"{bmi:.1f}"
            if bmi < 18.5:
                health_metrics['bmi_status'] = 'Underweight'
            elif 18.5 <= bmi < 25:
                health_metrics['bmi_status'] = 'Normal'
            else:
                health_metrics['bmi_status'] = 'Overweight'

    if current_user.date_of_birth and current_user.gender and current_user.weight_kg and current_user.height_cm:
        today = date.today()
        age = today.year - current_user.date_of_birth.year - ((today.month, today.day) < (current_user.date_of_birth.month, current_user.date_of_birth.day))
        if current_user.gender == 'male':
            bmr = 10 * current_user.weight_kg + 6.25 * current_user.height_cm - 5 * age + 5
        else: # female or other
            bmr = 10 * current_user.weight_kg + 6.25 * current_user.height_cm - 5 * age - 161
        activity_factors = {'sedentary': 1.2, 'light': 1.375, 'moderate': 1.55, 'active': 1.725, 'extra_active': 1.9}
        maintenance_calories = bmr * activity_factors.get(current_user.activity_level, 1.2)
        health_metrics['maintenance_calories'] = int(maintenance_calories)
        health_metrics['calorie_deficit'] = int(maintenance_calories - totals['calories'])


    today = date.today()
    start_of_week = today - timedelta(days=6)
    weight_data = WeightEntry.query.filter(WeightEntry.user_id == current_user.id, WeightEntry.date >= start_of_week).order_by(WeightEntry.date).all()
    sleep_chart_data = SleepEntry.query.filter(SleepEntry.user_id == current_user.id, SleepEntry.date >= start_of_week).order_by(SleepEntry.date).all()

    chart_data = {
        'weight_labels': [d.date.strftime('%a') for d in weight_data],
        'weight_values': [d.weight_kg for d in weight_data],
        'sleep_labels': [d.date.strftime('%a') for d in sleep_chart_data],
        'sleep_values': [d.duration_hours for d in sleep_chart_data]
    }

    prev_day = selected_date - timedelta(days=1)
    next_day = selected_date + timedelta(days=1)
    
    # Data for Settings
    profile_form = ProfileForm(obj=current_user)
    goals_form = GoalsForm(obj=current_user)
    account_form = AccountSettingsForm(obj=current_user)

    return render_template('home.html', title='Home',
                           # Dashboard data
                           totals=totals, goals=goals, 
                           selected_date=selected_date, prev_day=prev_day, next_day=next_day,
                           chart_data=chart_data, health_metrics=health_metrics,
                           # Settings data
                           profile_form=profile_form, goals_form=goals_form, account_form=account_form)


@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if current_user.is_authenticated: return redirect(url_for('index'))
    form = SignUpForm()
    if form.validate_on_submit():
        new_user = User(
            username=form.username.data, 
            email=form.email.data,
        )
        new_user.set_password(form.password.data)
        db.session.add(new_user)
        db.session.commit()
        login_user(new_user)
        flash('Account created! Please complete your profile.', 'success')
        return redirect(url_for('home', view='settings'))
    return render_template('signup.html', title='Sign Up', form=form)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated: return redirect(url_for('index'))
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user and user.check_password(form.password.data):
            login_user(user, remember=True)
            return redirect(url_for('index'))
        else:
            flash('Login failed. Check email and password.', 'danger')
    return render_template('login.html', title='Login', form=form)

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))


@app.route('/log_entry/<selected_date_str>', methods=['GET', 'POST'])
@login_required
def log_entry(selected_date_str):
    selected_date = datetime.strptime(selected_date_str, "%Y-%m-%d").date()
    # Initialize all forms
    food_form = FoodLogForm()
    water_form = WaterLogForm()
    weight_form = WeightLogForm()
    step_form = StepLogForm()
    sleep_form = SleepLogForm()
    calories_burnt_form = CaloriesBurntLogForm()
    
    active_tab = request.args.get('tab', 'food')

    if request.method == 'POST':
        if 'submit_food' in request.form and food_form.validate_on_submit():
            active_tab = 'food'
            entry = FoodEntry(user_id=current_user.id, date=selected_date, time=food_form.food_time.data, 
                              name=food_form.food_name.data, calories=food_form.calories.data,
                              protein=food_form.protein.data or 0, carbs=food_form.carbs.data or 0, 
                              fat=food_form.fat.data or 0, sugar=food_form.sugar.data or 0)
            db.session.add(entry)
            flash('Food entry added!', 'success')
        elif 'submit_water' in request.form and water_form.validate_on_submit():
            active_tab = 'water'
            amount = water_form.water_amount.data
            entry = WaterEntry(user_id=current_user.id, date=selected_date, amount_ml=amount)
            db.session.add(entry)
            flash('Water entry added!', 'success')
        elif 'submit_weight' in request.form and weight_form.validate_on_submit():
            active_tab = 'weight'
            weight = weight_form.weight_amount.data
            unit = request.form.get('weight_unit', 'kg')
            if unit == 'lbs':
                weight *= 0.453592
            
            entry = WeightEntry(user_id=current_user.id, date=selected_date, weight_kg=weight)
            db.session.add(entry)
            flash('Weight entry added!', 'success')
        elif 'submit_steps' in request.form and step_form.validate_on_submit():
            active_tab = 'steps'
            entry = StepEntry(user_id=current_user.id, date=selected_date, steps=step_form.step_amount.data)
            db.session.add(entry)
            flash('Step entry added!', 'success')
        elif 'submit_sleep' in request.form and sleep_form.validate_on_submit():
            active_tab = 'sleep'
            sleep_time = sleep_form.sleep_time.data
            wake_time = sleep_form.wake_time.data
            dummy_date = date.today()
            start = datetime.combine(dummy_date, sleep_time)
            end = datetime.combine(dummy_date, wake_time)

            if end <= start:
                end += timedelta(days=1)
            duration = end - start
            duration_hours = duration.total_seconds() / 3600

            entry = SleepEntry(user_id=current_user.id, date=selected_date, 
                               duration_hours=duration_hours, sleep_time=sleep_time, wake_time=wake_time)
            db.session.add(entry)
            flash('Sleep entry added!', 'success')
        elif 'submit_calories_burnt' in request.form and calories_burnt_form.validate_on_submit():
            active_tab = 'calories_burnt'
            entry = CaloriesBurntEntry(user_id=current_user.id, date=selected_date, calories_burnt=calories_burnt_form.calories_burnt.data)
            db.session.add(entry)
            flash('Calories burnt entry added!', 'success')

        db.session.commit()
        return redirect(url_for('log_entry', selected_date_str=selected_date_str, tab=active_tab))

    # Fetch all entries for the selected date
    entries = {
        'food': FoodEntry.query.filter_by(user_id=current_user.id, date=selected_date).order_by(FoodEntry.time).all(),
        'water': WaterEntry.query.filter_by(user_id=current_user.id, date=selected_date).all(),
        'weight': WeightEntry.query.filter_by(user_id=current_user.id, date=selected_date).all(),
        'steps': StepEntry.query.filter_by(user_id=current_user.id, date=selected_date).all(),
        'sleep': SleepEntry.query.filter_by(user_id=current_user.id, date=selected_date).all(),
        'calories_burnt': CaloriesBurntEntry.query.filter_by(user_id=current_user.id, date=selected_date).all()
    }
    
    prev_day = selected_date - timedelta(days=1)
    next_day = selected_date + timedelta(days=1)

    return render_template('log_entry.html', title='Add Entry', selected_date=selected_date,
                           prev_day=prev_day, next_day=next_day,
                           food_form=food_form, water_form=water_form, weight_form=weight_form, 
                           step_form=step_form, sleep_form=sleep_form, calories_burnt_form=calories_burnt_form,
                           entries=entries)

@app.route('/delete_entry/<entry_type>/<int:entry_id>', methods=['POST'])
@login_required
def delete_entry(entry_type, entry_id):
    model_map = {
        'food': FoodEntry,
        'water': WaterEntry,
        'weight': WeightEntry,
        'steps': StepEntry,
        'sleep': SleepEntry,
        'calories_burnt': CaloriesBurntEntry
    }
    model = model_map.get(entry_type)
    if not model:
        flash("Invalid entry type.", "danger")
        return redirect(request.referrer or url_for('index'))

    entry = model.query.get_or_404(entry_id)
    if entry.user_id != current_user.id:
        flash("You are not authorized to delete this entry.", "danger")
        return redirect(request.referrer or url_for('index'))

    selected_date_str = entry.date.strftime('%Y-%m-%d')
    db.session.delete(entry)
    db.session.commit()
    flash(f'{entry_type.replace("_", " ").capitalize()} entry deleted.', 'success')
    return redirect(url_for('log_entry', selected_date_str=selected_date_str, tab=entry_type))


@app.route('/edit_entry/<entry_type>/<int:entry_id>', methods=['GET', 'POST'])
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
    model, form_class = model_map.get(entry_type)
    if not model:
        flash("Invalid entry type.", "danger")
        return redirect(url_for('index'))

    entry = model.query.get_or_404(entry_id)
    if entry.user_id != current_user.id:
        flash("You are not authorized to edit this entry.", "danger")
        return redirect(url_for('index'))

    if request.method == 'GET':
        form = form_class(obj=entry)
    else:
        form = form_class(request.form)

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
            dummy_date = date.today()
            start = datetime.combine(dummy_date, form.sleep_time.data)
            end = datetime.combine(dummy_date, form.wake_time.data)

            if end <= start:
                end += timedelta(days=1)
            duration = end - start
            entry.duration_hours = duration.total_seconds() / 3600

        db.session.commit()
        flash(f'{entry_type.replace("_", " ").capitalize()} entry updated.', 'success')
        return redirect(url_for('log_entry', selected_date_str=entry.date.strftime('%Y-%m-%d'), tab=entry_type))

    return render_template('edit_entry.html', form=form, entry_type=entry_type, entry_id=entry.id, selected_date=entry.date)


@app.route('/settings', methods=['POST'])
@login_required
def settings():
    # This route now only handles POST requests from settings forms
    profile_form = ProfileForm()
    goals_form = GoalsForm()
    account_form = AccountSettingsForm()

    if 'submit_profile' in request.form and profile_form.validate():
        height_unit = request.form.get('height_unit')
        weight_unit = request.form.get('weight_unit')

        if height_unit == 'ft':
            ft = profile_form.height_ft.data or 0
            inch = profile_form.height_in.data or 0
            current_user.height_cm = (ft * 30.48) + (inch * 2.54)
        else:
            current_user.height_cm = profile_form.height_cm.data

        original_weight = current_user.weight_kg
        new_weight_input = profile_form.weight_kg.data
        
        if new_weight_input is not None:
            new_weight = new_weight_input
            if weight_unit == 'lbs':
                new_weight = new_weight * 0.453592
            
            if new_weight != original_weight:
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
        return redirect(url_for('home', view='settings', tab='profile'))

    if 'submit_goals' in request.form and goals_form.validate():
        # Manually populate since populate_obj doesn't work well with multiple forms
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
        return redirect(url_for('home', view='settings', tab='goals'))

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
            if current_user.check_password(account_form.current_password.data):
                current_user.set_password(account_form.new_password.data)
                user_changed = True
                flash('Password updated successfully.', 'success')
            else:
                flash('Incorrect current password.', 'danger')
        
        if user_changed:
            db.session.commit()
            flash('Account settings updated.', 'success')
        return redirect(url_for('home', view='settings', tab='account'))

    return redirect(url_for('home'))


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=5001, debug=True)
