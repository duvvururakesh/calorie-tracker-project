from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from . import db, login_manager

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

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

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
    user = db.relationship('User', backref=db.backref('food_entries', lazy=True, cascade='all, delete-orphan'))

class WaterEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    amount_ml = db.Column(db.Integer, nullable=False)
    user = db.relationship('User', backref=db.backref('water_entries', lazy=True, cascade='all, delete-orphan'))

class WeightEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    weight_kg = db.Column(db.Float, nullable=False)
    user = db.relationship('User', backref=db.backref('weight_entries', lazy=True, cascade='all, delete-orphan'))

class StepEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    steps = db.Column(db.Integer, nullable=False)
    user = db.relationship('User', backref=db.backref('step_entries', lazy=True, cascade='all, delete-orphan'))

class SleepEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    duration_hours = db.Column(db.Float, nullable=False)
    sleep_time = db.Column(db.Time, nullable=True)
    wake_time = db.Column(db.Time, nullable=True)
    user = db.relationship('User', backref=db.backref('sleep_entries', lazy=True, cascade='all, delete-orphan'))

class CaloriesBurntEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    calories_burnt = db.Column(db.Integer, nullable=False)
    user = db.relationship('User', backref=db.backref('calories_burnt_entries', lazy=True, cascade='all, delete-orphan'))

class ChatMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False)
    content = db.Column(db.Text, nullable=False)
    intent = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    user = db.relationship('User', backref=db.backref('chat_messages', lazy=True, cascade='all, delete-orphan'))

class UserMemory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    key = db.Column(db.String(80), nullable=False)
    value = db.Column(db.Text, nullable=False)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    user = db.relationship('User', backref=db.backref('memories', lazy=True, cascade='all, delete-orphan'))
    __table_args__ = (db.UniqueConstraint('user_id', 'key', name='uq_user_memory_key'),)

class AgentActionLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    agent = db.Column(db.String(80), nullable=False, default='nibbly')
    tool = db.Column(db.String(80), nullable=False)
    status = db.Column(db.String(20), nullable=False)
    request = db.Column(db.Text, nullable=False)
    result = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    user = db.relationship('User', backref=db.backref('agent_actions', lazy=True, cascade='all, delete-orphan'))

class Friendship(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    requester_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='pending')
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    requester = db.relationship('User', foreign_keys=[requester_id], backref=db.backref('sent_friendships', lazy=True, cascade='all, delete-orphan'))
    receiver = db.relationship('User', foreign_keys=[receiver_id], backref=db.backref('received_friendships', lazy=True, cascade='all, delete-orphan'))
    __table_args__ = (
        db.UniqueConstraint('requester_id', 'receiver_id', name='uq_friendship_pair'),
        db.CheckConstraint('requester_id != receiver_id', name='ck_friendship_not_self'),
    )

class FriendPrivacy(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, unique=True)
    show_calories = db.Column(db.Boolean, nullable=False, default=True)
    show_macros = db.Column(db.Boolean, nullable=False, default=True)
    show_water = db.Column(db.Boolean, nullable=False, default=True)
    show_steps = db.Column(db.Boolean, nullable=False, default=True)
    show_sleep = db.Column(db.Boolean, nullable=False, default=True)
    show_active_calories = db.Column(db.Boolean, nullable=False, default=True)
    show_weight = db.Column(db.Boolean, nullable=False, default=False)
    show_food_names = db.Column(db.Boolean, nullable=False, default=False)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    user = db.relationship('User', backref=db.backref('friend_privacy', uselist=False, cascade='all, delete-orphan'))
