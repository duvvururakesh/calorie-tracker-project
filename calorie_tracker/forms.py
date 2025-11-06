from flask_wtf import FlaskForm
from wtforms import (
    StringField, PasswordField, SubmitField, FloatField,
    SelectField, IntegerField
)
from wtforms.fields import DateField, TimeField
from wtforms.validators import (
    DataRequired, Email, EqualTo, Length,
    Optional, NumberRange
)
from datetime import datetime

# ---------------------------
# Authentication Forms
# ---------------------------

class SignUpForm(FlaskForm):
    username = StringField(
        'Username', validators=[DataRequired(), Length(min=4, max=25)]
    )
    email = StringField(
        'Email', validators=[DataRequired(), Email()]
    )
    password = PasswordField(
        'Password', validators=[DataRequired(), Length(min=6)]
    )
    confirm_password = PasswordField(
        'Confirm Password',
        validators=[DataRequired(), EqualTo('password', message='Passwords must match')]
    )
    submit = SubmitField('Create Account')


class LoginForm(FlaskForm):
    email = StringField(
        'Email', validators=[DataRequired(), Email()]
    )
    password = PasswordField(
        'Password', validators=[DataRequired()]
    )
    submit = SubmitField('Login')

# ---------------------------
# Food & Activity Log Forms
# ---------------------------

class FoodLogForm(FlaskForm):
    food_name = StringField('Food Name', validators=[DataRequired()])
    food_time = TimeField(
        'Time', format='%H:%M', validators=[DataRequired()],
        default=datetime.now().time
    )
    calories = FloatField('Calories', validators=[DataRequired(), NumberRange(min=0)])
    protein = FloatField('Protein (g)', validators=[Optional(), NumberRange(min=0)])
    carbs = FloatField('Carbs (g)', validators=[Optional(), NumberRange(min=0)])
    fat = FloatField('Fat (g)', validators=[Optional(), NumberRange(min=0)])
    sugar = FloatField('Sugar (g)', validators=[Optional(), NumberRange(min=0)])
    submit_food = SubmitField('Log Food')


class WaterLogForm(FlaskForm):
    water_amount = FloatField(
        'Amount (ml)', validators=[DataRequired(), NumberRange(min=0)]
    )
    submit_water = SubmitField('Log Water')


class WeightLogForm(FlaskForm):
    weight_amount = FloatField(
        'Weight', validators=[DataRequired(), NumberRange(min=0)]
    )
    submit_weight = SubmitField('Log Weight')


class StepLogForm(FlaskForm):
    step_amount = IntegerField(
        'Steps', validators=[DataRequired(), NumberRange(min=0)]
    )
    submit_steps = SubmitField('Log Steps')


class SleepLogForm(FlaskForm):
    sleep_time = TimeField('Sleep Time', validators=[DataRequired()])
    wake_time = TimeField('Wake Time', validators=[DataRequired()])
    submit_sleep = SubmitField('Log Sleep')


class CaloriesBurntLogForm(FlaskForm):
    calories_burnt = IntegerField(
        'Calories Burnt', validators=[DataRequired(), NumberRange(min=0)]
    )
    submit_calories_burnt = SubmitField('Log Calories Burnt')

# ---------------------------
# Profile & Goals Forms
# ---------------------------

class ProfileForm(FlaskForm):
    date_of_birth = DateField('Date of Birth', validators=[Optional()])
    height_cm = FloatField('Height (cm)', validators=[Optional(), NumberRange(min=0)])
    height_ft = IntegerField('Height (ft)', validators=[Optional(), NumberRange(min=0)])
    height_in = IntegerField('Height (in)', validators=[Optional(), NumberRange(min=0, max=11)])
    weight_kg = FloatField('Current Weight (kg)', validators=[Optional(), NumberRange(min=0)])
    gender = SelectField(
        'Gender',
        choices=[('male', 'Male'), ('female', 'Female'), ('other', 'Other')],
        validators=[Optional()]
    )
    activity_level = SelectField(
        'Activity Level',
        choices=[
            ('sedentary', 'Sedentary'),
            ('light', 'Lightly active'),
            ('moderate', 'Moderately active'),
            ('active', 'Very active'),
            ('extra_active', 'Extra active')
        ],
        validators=[DataRequired()]
    )
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
    confirm_new_password = PasswordField(
        'Confirm New Password',
        validators=[Optional(), EqualTo('new_password', message='Passwords must match')]
    )
    submit_account = SubmitField('Update Account')
