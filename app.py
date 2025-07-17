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
    user = db.relationship('User', backref=db.backref('sleep_entries_ref', lazy=True))


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
    water_amount = IntegerField('Amount (ml)', validators=[DataRequired()])
    submit_water = SubmitField('Log Water')

class WeightLogForm(FlaskForm):
    weight_amount = FloatField('Weight (kg)', validators=[DataRequired()])
    submit_weight = SubmitField('Log Weight')

class StepLogForm(FlaskForm):
    step_amount = IntegerField('Steps', validators=[DataRequired()])
    submit_steps = SubmitField('Log Steps')

class SleepLogForm(FlaskForm):
    duration_hours = FloatField('Sleep (hours)', validators=[DataRequired()])
    submit_sleep = SubmitField('Log Sleep')

class ProfileSettingsForm(FlaskForm):
    date_of_birth = DateField('Date of Birth', validators=[Optional()])
    height_cm = FloatField('Height (cm)', validators=[Optional()])
    weight_kg = FloatField('Current Weight (kg)', validators=[Optional()])
    gender = SelectField('Gender', choices=[('male', 'Male'), ('female', 'Female'), ('other', 'Other')], validators=[Optional()])
    activity_level = SelectField('Activity Level', choices=[
        ('sedentary', 'Sedentary'), ('light', 'Lightly active'), ('moderate', 'Moderately active'),
        ('active', 'Very active'), ('extra_active', 'Extra active')
    ], validators=[DataRequired()])
    calorie_goal = IntegerField('Calorie Goal', validators=[DataRequired()])
    protein_goal = IntegerField('Protein Goal (g)', validators=[DataRequired()])
    carbs_goal = IntegerField('Carbs Goal (g)', validators=[DataRequired()])
    fat_goal = IntegerField('Fat Goal (g)', validators=[DataRequired()])
    sugar_goal = IntegerField('Sugar Goal (g)', validators=[DataRequired()])
    water_goal = IntegerField('Water Goal (ml)', validators=[DataRequired()])
    step_goal = IntegerField('Step Goal', validators=[DataRequired()])
    sleep_goal = FloatField('Sleep Goal (hours)', validators=[DataRequired()])
    submit_profile = SubmitField('Update Profile')

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
    today_str = date.today().strftime("%Y-%m-%d")
    return redirect(url_for('dashboard', selected_date_str=today_str))

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
        return redirect(url_for('settings'))
        
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

@app.route('/dashboard/<selected_date_str>')
@login_required
def dashboard(selected_date_str):
    try:
        selected_date = datetime.strptime(selected_date_str, "%Y-%m-%d").date()
    except ValueError:
        return "Invalid date format", 400

    food_entries = FoodEntry.query.filter_by(user_id=current_user.id, date=selected_date).all()
    water_entries = WaterEntry.query.filter_by(user_id=current_user.id, date=selected_date).all()
    step_entries = StepEntry.query.filter_by(user_id=current_user.id, date=selected_date).all()
    sleep_entries = SleepEntry.query.filter_by(user_id=current_user.id, date=selected_date).all()
    
    totals = {
        'calories': sum(e.calories for e in food_entries),
        'carbs': sum(e.carbs for e in food_entries),
        'protein': sum(e.protein for e in food_entries),
        'fat': sum(e.fat for e in food_entries),
        'sugar': sum(e.sugar for e in food_entries),
        'water': sum(e.amount_ml for e in water_entries),
        'steps': sum(e.steps for e in step_entries),
        'sleep': sum(e.duration_hours for e in sleep_entries)
    }

    goals = {
        'calorie_goal': current_user.calorie_goal or 0,
        'protein_goal': current_user.protein_goal or 0,
        'carbs_goal': current_user.carbs_goal or 0,
        'fat_goal': current_user.fat_goal or 0,
        'sugar_goal': current_user.sugar_goal or 0,
        'water_goal': current_user.water_goal or 0,
        'step_goal': current_user.step_goal or 0,
        'sleep_goal': current_user.sleep_goal or 0
    }

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

    return render_template('dashboard.html', title='Dashboard', totals=totals, goals=goals, 
                           selected_date=selected_date, prev_day=prev_day, next_day=next_day,
                           chart_data=chart_data)

@app.route('/log_entry/<selected_date_str>', methods=['GET', 'POST'])
@login_required
def log_entry(selected_date_str):
    selected_date = datetime.strptime(selected_date_str, "%Y-%m-%d").date()
    food_form = FoodLogForm()
    water_form = WaterLogForm()
    weight_form = WeightLogForm()
    step_form = StepLogForm()
    sleep_form = SleepLogForm()

    if request.method == 'POST':
        if 'submit_food' in request.form and food_form.validate_on_submit():
            entry = FoodEntry(user_id=current_user.id, date=selected_date, time=food_form.food_time.data, 
                              name=food_form.food_name.data, calories=food_form.calories.data,
                              protein=food_form.protein.data or 0, carbs=food_form.carbs.data or 0, 
                              fat=food_form.fat.data or 0, sugar=food_form.sugar.data or 0)
            db.session.add(entry)
            flash('Food entry added!', 'success')
        
        elif 'submit_water' in request.form and water_form.validate_on_submit():
            entry = WaterEntry(user_id=current_user.id, date=selected_date, amount_ml=water_form.water_amount.data)
            db.session.add(entry)
            flash('Water entry added!', 'success')

        elif 'submit_weight' in request.form and weight_form.validate_on_submit():
            entry = WeightEntry(user_id=current_user.id, date=selected_date, weight_kg=weight_form.weight_amount.data)
            current_user.weight_kg = weight_form.weight_amount.data
            db.session.add(entry)
            flash('Weight entry added!', 'success')

        elif 'submit_steps' in request.form and step_form.validate_on_submit():
            entry = StepEntry(user_id=current_user.id, date=selected_date, steps=step_form.step_amount.data)
            db.session.add(entry)
            flash('Step entry added!', 'success')
        
        elif 'submit_sleep' in request.form and sleep_form.validate_on_submit():
            entry = SleepEntry(user_id=current_user.id, date=selected_date, duration_hours=sleep_form.duration_hours.data)
            db.session.add(entry)
            flash('Sleep entry added!', 'success')
            
        db.session.commit()
        return redirect(url_for('log_entry', selected_date_str=selected_date_str))
    
    food_entries = FoodEntry.query.filter_by(user_id=current_user.id, date=selected_date).order_by(FoodEntry.time).all()
        
    return render_template('log_entry.html', title='Add Entry', selected_date=selected_date,
                           food_form=food_form, water_form=water_form, weight_form=weight_form, 
                           step_form=step_form, sleep_form=sleep_form, food_entries=food_entries)

@app.route('/delete/<entry_type>/<int:entry_id>', methods=['POST'])
@login_required
def delete_entry(entry_type, entry_id):
    model_map = { 'food': FoodEntry }
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
    flash(f'{entry_type.capitalize()} entry deleted.', 'success')
    return redirect(request.referrer or url_for('dashboard', selected_date_str=selected_date_str))

@app.route('/settings', methods=['GET', 'POST'])
@login_required
def settings():
    profile_form = ProfileSettingsForm(obj=current_user)
    account_form = AccountSettingsForm(obj=current_user)

    if 'submit_profile' in request.form and profile_form.validate_on_submit():
        profile_form.populate_obj(current_user)
        db.session.commit()
        flash('Profile settings updated.', 'success')
        return redirect(url_for('settings'))

    if 'submit_account' in request.form and account_form.validate_on_submit():
        user_changed = False
        if current_user.username != account_form.username.data or \
           current_user.profile_name != account_form.profile_name.data or \
           current_user.email != account_form.email.data:
            account_form.populate_obj(current_user)
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
        return redirect(url_for('settings'))

    return render_template('settings.html', title='Settings', profile_form=profile_form, account_form=account_form)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)