from flask import Blueprint, jsonify, request
from flask_login import login_user, logout_user, current_user, login_required
from datetime import datetime, date, timedelta
from .. import db
from ..models import User, FoodEntry, WaterEntry, WeightEntry, StepEntry, SleepEntry, CaloriesBurntEntry
from ..utils import get_daily_totals, get_health_metrics, get_user_goals

api_bp = Blueprint('api', __name__, url_prefix='/api')

def err(msg, code=400):
    return jsonify({'error': msg}), code

def ok(data=None, **kwargs):
    payload = kwargs if data is None else data
    return jsonify(payload)

# Auth

@api_bp.route('/auth/me')
def me():
    if not current_user.is_authenticated:
        return err('Not authenticated', 401)
    return ok(id=current_user.id, username=current_user.username,
              profile_name=current_user.profile_name or current_user.username,
              email=current_user.email)

@api_bp.route('/auth/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    if not username or not email or not password:
        return err('All fields are required')
    if len(password) < 6:
        return err('Password must be at least 6 characters')
    if User.query.filter_by(email=email).first():
        return err('Email already in use')
    if User.query.filter_by(username=username).first():
        return err('Username already taken')
    user = User(username=username, email=email, profile_name=username)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    login_user(user, remember=True)
    return ok(id=user.id, username=user.username,
              profile_name=user.profile_name, email=user.email), 201

@api_bp.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return err('Invalid email or password', 401)
    login_user(user, remember=True)
    return ok(id=user.id, username=user.username,
              profile_name=user.profile_name or user.username, email=user.email)

@api_bp.route('/auth/logout', methods=['POST'])
def logout():
    logout_user()
    return ok(message='Logged out')

# Dashboard

@api_bp.route('/dashboard')
@login_required
def dashboard():
    date_str = request.args.get('date', date.today().isoformat())
    try:
        selected = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        selected = date.today()
    totals = get_daily_totals(current_user.id, selected)
    goals = get_user_goals(current_user)
    metrics = get_health_metrics(current_user, totals)
    last_weight = (WeightEntry.query.filter_by(user_id=current_user.id)
                   .order_by(WeightEntry.date.desc()).first())
    weight_kg = last_weight.weight_kg if last_weight else None
    weight_entries = (WeightEntry.query.filter_by(user_id=current_user.id)
                      .order_by(WeightEntry.date.desc()).limit(14).all())
    weight_entries.reverse()
    sleep_entries = (SleepEntry.query.filter_by(user_id=current_user.id)
                     .order_by(SleepEntry.date.desc()).limit(14).all())
    sleep_entries.reverse()
    return ok(
        totals=totals, goals=goals, metrics=metrics,
        weight_kg=weight_kg,
        weight_lbs=round(weight_kg * 2.20462, 1) if weight_kg else None,
        chart=dict(
            weight_labels=[e.date.strftime('%b %d') for e in weight_entries],
            weight_values=[float(e.weight_kg) for e in weight_entries],
            sleep_labels=[e.date.strftime('%b %d') for e in sleep_entries],
            sleep_values=[float(e.duration_hours) for e in sleep_entries],
        )
    )

# Entries

@api_bp.route('/entries')
@login_required
def get_entries():
    date_str = request.args.get('date', date.today().isoformat())
    try:
        selected = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        selected = date.today()
    return ok(dict(
        food=[dict(id=e.id, name=e.name, calories=e.calories, protein=e.protein,
                   carbs=e.carbs, fat=e.fat, sugar=e.sugar,
                   time=e.time.strftime('%H:%M') if e.time else None)
              for e in FoodEntry.query.filter_by(user_id=current_user.id, date=selected)
                                      .order_by(FoodEntry.time).all()],
        water=[dict(id=e.id, amount_ml=e.amount_ml)
               for e in WaterEntry.query.filter_by(user_id=current_user.id, date=selected).all()],
        weight=[dict(id=e.id, weight_kg=e.weight_kg)
                for e in WeightEntry.query.filter_by(user_id=current_user.id, date=selected).all()],
        steps=[dict(id=e.id, steps=e.steps)
               for e in StepEntry.query.filter_by(user_id=current_user.id, date=selected).all()],
        sleep=[dict(id=e.id, duration_hours=e.duration_hours,
                    sleep_time=e.sleep_time.strftime('%H:%M') if e.sleep_time else None,
                    wake_time=e.wake_time.strftime('%H:%M') if e.wake_time else None)
               for e in SleepEntry.query.filter_by(user_id=current_user.id, date=selected).all()],
        calories_burnt=[dict(id=e.id, calories_burnt=e.calories_burnt)
                        for e in CaloriesBurntEntry.query.filter_by(user_id=current_user.id, date=selected).all()],
    ))

@api_bp.route('/entries/food', methods=['POST'])
@login_required
def add_food():
    d = request.get_json()
    selected = datetime.strptime(d.get('date', date.today().isoformat()), '%Y-%m-%d').date()
    time_val = None
    if d.get('time'):
        try: time_val = datetime.strptime(d['time'], '%H:%M').time()
        except ValueError: pass
    entry = FoodEntry(user_id=current_user.id, date=selected, name=d['name'],
                      calories=float(d['calories']), time=time_val,
                      protein=float(d.get('protein') or 0), carbs=float(d.get('carbs') or 0),
                      fat=float(d.get('fat') or 0), sugar=float(d.get('sugar') or 0))
    db.session.add(entry); db.session.commit()
    return ok(id=entry.id), 201

@api_bp.route('/entries/water', methods=['POST'])
@login_required
def add_water():
    d = request.get_json()
    selected = datetime.strptime(d.get('date', date.today().isoformat()), '%Y-%m-%d').date()
    entry = WaterEntry(user_id=current_user.id, date=selected, amount_ml=int(d['amount_ml']))
    db.session.add(entry); db.session.commit()
    return ok(id=entry.id), 201

@api_bp.route('/entries/weight', methods=['POST'])
@login_required
def add_weight():
    d = request.get_json()
    selected = datetime.strptime(d.get('date', date.today().isoformat()), '%Y-%m-%d').date()
    weight = float(d['weight_kg'])
    if d.get('unit') == 'lbs': weight *= 0.453592
    entry = WeightEntry(user_id=current_user.id, date=selected, weight_kg=weight)
    db.session.add(entry); db.session.commit()
    return ok(id=entry.id), 201

@api_bp.route('/entries/steps', methods=['POST'])
@login_required
def add_steps():
    d = request.get_json()
    selected = datetime.strptime(d.get('date', date.today().isoformat()), '%Y-%m-%d').date()
    entry = StepEntry(user_id=current_user.id, date=selected, steps=int(d['steps']))
    db.session.add(entry); db.session.commit()
    return ok(id=entry.id), 201

@api_bp.route('/entries/sleep', methods=['POST'])
@login_required
def add_sleep():
    d = request.get_json()
    selected = datetime.strptime(d.get('date', date.today().isoformat()), '%Y-%m-%d').date()
    sleep_time = datetime.strptime(d['sleep_time'], '%H:%M').time()
    wake_time = datetime.strptime(d['wake_time'], '%H:%M').time()
    start = datetime.combine(selected, sleep_time)
    end = datetime.combine(selected, wake_time)
    if end <= start: end += timedelta(days=1)
    duration = (end - start).total_seconds() / 3600
    entry = SleepEntry(user_id=current_user.id, date=selected, duration_hours=duration,
                       sleep_time=sleep_time, wake_time=wake_time)
    db.session.add(entry); db.session.commit()
    return ok(id=entry.id), 201

@api_bp.route('/entries/calories_burnt', methods=['POST'])
@login_required
def add_calories_burnt():
    d = request.get_json()
    selected = datetime.strptime(d.get('date', date.today().isoformat()), '%Y-%m-%d').date()
    entry = CaloriesBurntEntry(user_id=current_user.id, date=selected,
                               calories_burnt=int(d['calories_burnt']))
    db.session.add(entry); db.session.commit()
    return ok(id=entry.id), 201

@api_bp.route('/entries/<entry_type>/<int:entry_id>', methods=['DELETE'])
@login_required
def delete_entry(entry_type, entry_id):
    model_map = dict(food=FoodEntry, water=WaterEntry, weight=WeightEntry,
                     steps=StepEntry, sleep=SleepEntry, calories_burnt=CaloriesBurntEntry)
    model = model_map.get(entry_type)
    if not model: return err('Invalid entry type')
    entry = model.query.get_or_404(entry_id)
    if entry.user_id != current_user.id: return err('Unauthorized', 403)
    db.session.delete(entry); db.session.commit()
    return ok(message='Deleted')

# Goals

@api_bp.route('/goals', methods=['GET'])
@login_required
def get_goals():
    return ok(get_user_goals(current_user))

@api_bp.route('/goals', methods=['PUT'])
@login_required
def update_goals():
    d = request.get_json()
    for f in ['calorie_goal','calories_burnt_goal','protein_goal','carbs_goal',
              'fat_goal','sugar_goal','water_goal','step_goal','sleep_goal']:
        if f in d: setattr(current_user, f, float(d[f]))
    db.session.commit()
    return ok(get_user_goals(current_user))

# Profile / Account

@api_bp.route('/profile', methods=['GET'])
@login_required
def get_profile():
    u = current_user
    return ok(username=u.username, profile_name=u.profile_name, email=u.email,
              height_cm=u.height_cm, weight_kg=u.weight_kg,
              date_of_birth=u.date_of_birth.isoformat() if u.date_of_birth else None,
              gender=u.gender, activity_level=u.activity_level)

@api_bp.route('/profile', methods=['PUT'])
@login_required
def update_profile():
    d = request.get_json()
    if d.get('height_cm'): current_user.height_cm = float(d['height_cm'])
    if d.get('weight_kg'):
        current_user.weight_kg = float(d['weight_kg'])
        today = date.today()
        if not WeightEntry.query.filter_by(user_id=current_user.id, date=today).first():
            db.session.add(WeightEntry(user_id=current_user.id, date=today,
                                       weight_kg=float(d['weight_kg'])))
    if d.get('date_of_birth'):
        current_user.date_of_birth = datetime.strptime(d['date_of_birth'], '%Y-%m-%d').date()
    if 'gender' in d: current_user.gender = d['gender']
    if 'activity_level' in d: current_user.activity_level = d['activity_level']
    if 'profile_name' in d: current_user.profile_name = d['profile_name']
    db.session.commit()
    return ok(message='Profile updated')

@api_bp.route('/account', methods=['PUT'])
@login_required
def update_account():
    d = request.get_json()
    if d.get('username'):
        ex = User.query.filter_by(username=d['username']).first()
        if ex and ex.id != current_user.id: return err('Username already taken')
        current_user.username = d['username']
    if d.get('email'):
        ex = User.query.filter_by(email=d['email']).first()
        if ex and ex.id != current_user.id: return err('Email already in use')
        current_user.email = d['email']
    if d.get('new_password'):
        if not current_user.check_password(d.get('current_password', '')):
            return err('Current password is incorrect')
        current_user.set_password(d['new_password'])
    db.session.commit()
    return ok(message='Account updated')
