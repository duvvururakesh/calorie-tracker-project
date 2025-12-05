from datetime import date, timedelta
from .models import FoodEntry, WaterEntry, StepEntry, SleepEntry, CaloriesBurntEntry, WeightEntry

def get_daily_totals(user_id, date_):
    food_entries = FoodEntry.query.filter_by(user_id=user_id, date=date_).all()
    water_entries = WaterEntry.query.filter_by(user_id=user_id, date=date_).all()
    step_entries = StepEntry.query.filter_by(user_id=user_id, date=date_).all()
    sleep_entries = SleepEntry.query.filter_by(user_id=user_id, date=date_).all()
    calories_burnt_entries = CaloriesBurntEntry.query.filter_by(user_id=user_id, date=date_).all()
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
    from datetime import date
    metrics = {'bmi': 'N/A', 'bmi_status': 'N/A', 'maintenance_calories': 'N/A', 'calorie_deficit': 'N/A'}
    if user.weight_kg and user.height_cm:
        height_m = user.height_cm / 100
        bmi = user.weight_kg / (height_m ** 2)
        metrics['bmi'] = f"{bmi:.2f}"
        if bmi < 18.5:
            metrics['bmi_status'] = 'Underweight'
        elif bmi < 25:
            metrics['bmi_status'] = 'Normal'
        else:
            metrics['bmi_status'] = 'Overweight'
    if user.date_of_birth and user.gender and user.weight_kg and user.height_cm:
        age = (date.today() - user.date_of_birth).days // 365
        if user.gender == 'male':
            bmr = 10 * user.weight_kg + 6.25 * user.height_cm - 5 * age + 5
        else:
            bmr = 10 * user.weight_kg + 6.25 * user.height_cm - 5 * age - 161
        factors = {'sedentary': 1.2, 'light': 1.375, 'moderate': 1.55, 'active': 1.725, 'extra_active': 1.9}
        maintenance = bmr * factors.get(user.activity_level, 1.2)
        metrics['maintenance_calories'] = f"{int(maintenance)}"
        metrics['calorie_deficit'] = f"{int(maintenance - totals['calories'])}"
    return metrics

def get_user_goals(user):
    return {
        'calorie_goal': user.calorie_goal or 0,
        'protein_goal': user.protein_goal or 0,
        'carbs_goal': user.carbs_goal or 0,
        'fat_goal': user.fat_goal or 0,
        'sugar_goal': user.sugar_goal or 0,
        'water_goal': user.water_goal or 0,
        'step_goal': user.step_goal or 0,
        'sleep_goal': user.sleep_goal or 0,
        'calories_burnt_goal': user.calories_burnt_goal or 0
    }

def get_week_dates(selected_date):
    start_of_week = selected_date - timedelta(days=(selected_date.weekday() + 1) % 7)
    return [start_of_week + timedelta(days=i) for i in range(7)]
