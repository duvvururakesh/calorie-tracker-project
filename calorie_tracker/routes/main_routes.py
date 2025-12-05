from flask import Blueprint, render_template, redirect, url_for, request
from flask_login import login_required, current_user
from datetime import datetime, date, timedelta
from ..utils import get_daily_totals, get_user_goals, get_health_metrics, get_week_dates
from ..models import WeightEntry, SleepEntry

# Register blueprint
main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    return redirect(url_for('main.dashboard'))

@main_bp.route('/dashboard')
@login_required
def dashboard():
    # 1️⃣ Get selected date from URL (default: today)
    selected_date_str = request.args.get('selected_date', date.today().strftime('%Y-%m-%d'))
    selected_date = datetime.strptime(selected_date_str, '%Y-%m-%d').date()

    # 2️⃣ Gather user data and metrics
    totals = get_daily_totals(current_user.id, selected_date)
    goals = get_user_goals(current_user)
    metrics = get_health_metrics(current_user, totals)
    weekly_dates = get_week_dates(selected_date)

    # 3️⃣ Compute navigation dates (for < and > week buttons)
    prev_week_start = selected_date - timedelta(days=7)
    next_week_start = selected_date + timedelta(days=7)

    # 4️⃣ Compute formatted weight (for kg/lbs toggle)
    last_weight_entry = (
        WeightEntry.query
        .filter_by(user_id=current_user.id)
        .order_by(WeightEntry.date.desc())
        .first()
    )
    if last_weight_entry:
        kg = last_weight_entry.weight_kg
        lbs = round(kg * 2.20462, 1)
        formatted_weight = {"kg": f"{kg:.1f}", "lbs": f"{lbs:.1f}"}
    else:
        formatted_weight = {"kg": "N/A", "lbs": "N/A"}

    # 5️⃣ Prepare chart data (latest 7 entries + include today's weight)
    chart_data = {
        "weight_labels": [],
        "weight_values": [],
        "sleep_labels": [],
        "sleep_values": []
    }

    # Get latest 7 weight entries
    weight_entries = (
        WeightEntry.query
        .filter_by(user_id=current_user.id)
        .order_by(WeightEntry.date.desc())
        .limit(7)
        .all()
    )
    weight_entries.reverse()  # Make chronological

    # Get latest 7 sleep entries
    sleep_entries = (
        SleepEntry.query
        .filter_by(user_id=current_user.id)
        .order_by(SleepEntry.date.desc())
        .limit(7)
        .all()
    )
    sleep_entries.reverse()

    # Fill chart arrays
    chart_data["weight_labels"] = [e.date.strftime("%b %d") for e in weight_entries]
    chart_data["weight_values"] = [float(e.weight_kg) for e in weight_entries]

    chart_data["sleep_labels"] = [e.date.strftime("%b %d") for e in sleep_entries]
    chart_data["sleep_values"] = [float(e.duration_hours) for e in sleep_entries]

    # 🔥 Ensure TODAY'S WEIGHT appears even if it isn't in the last 7 entries
    today_entry = WeightEntry.query.filter_by(
        user_id=current_user.id,
        date=date.today()
    ).first()

    if today_entry:
        today_label = date.today().strftime("%b %d")
        if today_label not in chart_data["weight_labels"]:
            chart_data["weight_labels"].append(today_label)
            chart_data["weight_values"].append(float(today_entry.weight_kg))

    # 6️⃣ Render the template with all required variables
    return render_template(
        'dashboard.html',
        title='Dashboard',
        totals=totals,
        goals=goals,
        health_metrics=metrics,
        selected_date=selected_date,
        weekly_dates=weekly_dates,
        prev_week_start=prev_week_start,
        next_week_start=next_week_start,
        formatted_weight=formatted_weight,
        chart_data=chart_data
    )
