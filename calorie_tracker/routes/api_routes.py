from flask import Blueprint, jsonify, request
from flask_login import login_user, logout_user, current_user, login_required
from sqlalchemy import and_, or_
from datetime import datetime, date, timedelta
import json
import os
import re
import urllib.error
import urllib.request
from .. import db
from ..models import (
    User, FoodEntry, WaterEntry, WeightEntry, StepEntry, SleepEntry,
    CaloriesBurntEntry, ChatMessage, UserMemory, AgentActionLog,
    Friendship, FriendPrivacy
)
from ..utils import get_daily_totals, get_health_metrics, get_user_goals

api_bp = Blueprint('api', __name__, url_prefix='/api')

def err(msg, code=400):
    return jsonify({'error': msg}), code

def ok(data=None, **kwargs):
    payload = kwargs if data is None else data
    return jsonify(payload)

def _parse_selected_date(payload):
    try:
        return datetime.strptime(payload.get('date', date.today().isoformat()), '%Y-%m-%d').date()
    except (TypeError, ValueError):
        return date.today()

def _resolve_message_date(message, selected):
    text = (message or '').lower()
    if re.search(r'\b(?:yesterday|yday|last night)\b', text):
        return date.today() - timedelta(days=1)

    days_ago = re.search(r'\b(\d+)\s+days?\s+ago\b', text)
    if days_ago:
        return date.today() - timedelta(days=int(days_ago.group(1)))

    explicit = re.search(r'\b(?:on\s+)?(\d{4}-\d{2}-\d{2})\b', text)
    if explicit:
        try:
            return datetime.strptime(explicit.group(1), '%Y-%m-%d').date()
        except ValueError:
            pass

    return selected

def _future_date_error(selected):
    if selected > date.today():
        return err('Future dates cannot be logged. Fitit only accepts real-time or past entries.', 400)
    return None

def _parse_query_date():
    try:
        return datetime.strptime(request.args.get('date', date.today().isoformat()), '%Y-%m-%d').date()
    except (TypeError, ValueError):
        return date.today()

def _public_user(user):
    return dict(
        id=user.id,
        username=user.username,
        profile_name=user.profile_name or user.username,
    )

def _friendship_between(user_a, user_b):
    return Friendship.query.filter(
        or_(
            and_(Friendship.requester_id == user_a, Friendship.receiver_id == user_b),
            and_(Friendship.requester_id == user_b, Friendship.receiver_id == user_a),
        )
    ).first()

def _ensure_friend_privacy(user_id):
    privacy = FriendPrivacy.query.filter_by(user_id=user_id).first()
    if not privacy:
        privacy = FriendPrivacy(user_id=user_id)
        db.session.add(privacy)
        db.session.flush()
    return privacy

def _serialize_friend_privacy(privacy):
    return dict(
        show_calories=privacy.show_calories,
        show_macros=privacy.show_macros,
        show_water=privacy.show_water,
        show_steps=privacy.show_steps,
        show_sleep=privacy.show_sleep,
        show_active_calories=privacy.show_active_calories,
        show_weight=privacy.show_weight,
        show_food_names=privacy.show_food_names,
    )

def _serialize_friendship(friendship):
    other = friendship.receiver if friendship.requester_id == current_user.id else friendship.requester
    direction = 'outgoing' if friendship.requester_id == current_user.id else 'incoming'
    return dict(
        id=friendship.id,
        status=friendship.status,
        direction=direction,
        user=_public_user(other),
        created_at=friendship.created_at.isoformat(),
    )

def _accepted_friendships(user_id):
    return Friendship.query.filter(
        Friendship.status == 'accepted',
        or_(Friendship.requester_id == user_id, Friendship.receiver_id == user_id),
    ).order_by(Friendship.updated_at.desc(), Friendship.id.desc()).all()

def _friend_metric_summary(user, selected):
    privacy = _ensure_friend_privacy(user.id)
    totals = get_daily_totals(user.id, selected)
    payload = dict(user=_public_user(user), date=selected.isoformat(), shared=_serialize_friend_privacy(privacy))
    if privacy.show_calories:
        payload['calories'] = round(totals.get('calories', 0), 1)
        payload['calorie_goal'] = user.calorie_goal
    if privacy.show_macros:
        payload['macros'] = dict(
            protein=round(totals.get('protein', 0), 1),
            carbs=round(totals.get('carbs', 0), 1),
            fat=round(totals.get('fat', 0), 1),
        )
        payload['macro_goals'] = dict(
            protein=user.protein_goal,
            carbs=user.carbs_goal,
            fat=user.fat_goal,
        )
    if privacy.show_water:
        payload['water'] = int(totals.get('water', 0))
        payload['water_goal'] = user.water_goal
    if privacy.show_steps:
        payload['steps'] = int(totals.get('steps', 0))
        payload['step_goal'] = user.step_goal
    if privacy.show_sleep:
        payload['sleep'] = round(totals.get('sleep', 0), 1)
        payload['sleep_goal'] = user.sleep_goal
    if privacy.show_weight:
        latest_weight = (WeightEntry.query.filter_by(user_id=user.id)
                         .order_by(WeightEntry.date.desc(), WeightEntry.id.desc()).first())
        payload['weight_kg'] = round(latest_weight.weight_kg, 1) if latest_weight else None
    if privacy.show_food_names:
        payload['foods'] = [
            dict(id=e.id, name=e.name, calories=e.calories)
            for e in FoodEntry.query.filter_by(user_id=user.id, date=selected)
                                    .order_by(FoodEntry.id.desc()).limit(5).all()
        ]
    return payload

def _number_before(words, text, default=None):
    pattern = rf'(\d+(?:\.\d+)?)\s*(?:{"|".join(words)})'
    found = re.search(pattern, text)
    return float(found.group(1)) if found else default

def _remember(user_id, key, value):
    memory = UserMemory.query.filter_by(user_id=user_id, key=key).first()
    if memory:
        memory.value = value
    else:
        db.session.add(UserMemory(user_id=user_id, key=key, value=value))

def _memory_map(user_id):
    return {m.key: m.value for m in UserMemory.query.filter_by(user_id=user_id).all()}

def _latest_entry(model, user_id):
    return model.query.filter_by(user_id=user_id).order_by(model.date.desc(), model.id.desc()).first()

def _agent_result(ok_, message, **data):
    return {'ok': ok_, 'message': message, **data}

def _log_agent_tool(tool, request_data, result):
    db.session.add(AgentActionLog(
        user_id=current_user.id,
        agent='nibbly',
        tool=tool,
        status='ok' if result.get('ok') else 'blocked',
        request=json.dumps(request_data, default=str, separators=(',', ':'))[:2000],
        result=json.dumps(result, default=str, separators=(',', ':'))[:2000],
    ))

def _entry_snapshot(entry):
    return dict(
        name=entry.name,
        calories=entry.calories,
        protein=entry.protein,
        carbs=entry.carbs,
        fat=entry.fat,
        sugar=entry.sugar,
    )

MACRO_REFERENCE = [
    dict(name='cooked white rice, 1 cup', aliases=('rice', 'white rice'), calories=205, protein=4.3, carbs=44.5, fat=0.4, sugar=0.1),
    dict(name='cooked brown rice, 1 cup', aliases=('brown rice',), calories=218, protein=4.5, carbs=45.8, fat=1.6, sugar=0.7),
    dict(name='cooked basmati rice, 1 cup', aliases=('basmati', 'basmati rice'), calories=210, protein=4.4, carbs=45.6, fat=0.5, sugar=0.1),
    dict(name='cooked pasta, 1 cup', aliases=('pasta', 'noodles'), calories=220, protein=8.1, carbs=43.2, fat=1.3, sugar=0.8),
    dict(name='wheat chapati, 1 medium', aliases=('chapati', 'roti'), calories=120, protein=3.1, carbs=18.0, fat=3.7, sugar=0.8),
    dict(name='idli, 1 piece', aliases=('idli',), calories=58, protein=2.0, carbs=12.0, fat=0.4, sugar=0.2),
    dict(name='plain dosa, 1 medium', aliases=('dosa',), calories=168, protein=3.8, carbs=29.0, fat=3.7, sugar=0.9),
    dict(name='cooked oatmeal, 1 cup', aliases=('oatmeal', 'oats'), calories=166, protein=5.9, carbs=28.1, fat=3.6, sugar=0.6),
    dict(name='whole egg, 1 large', aliases=('egg', 'eggs'), calories=72, protein=6.3, carbs=0.4, fat=4.8, sugar=0.2),
    dict(name='grilled chicken breast, 100 g', aliases=('chicken', 'chicken breast', 'grilled chicken'), calories=165, protein=31.0, carbs=0.0, fat=3.6, sugar=0.0),
    dict(name='salmon, cooked, 100 g', aliases=('salmon',), calories=206, protein=22.1, carbs=0.0, fat=12.4, sugar=0.0),
    dict(name='tofu, firm, 100 g', aliases=('tofu',), calories=144, protein=17.3, carbs=2.8, fat=8.7, sugar=0.6),
    dict(name='paneer, 100 g', aliases=('paneer',), calories=321, protein=21.4, carbs=3.6, fat=25.0, sugar=2.6),
    dict(name='cooked chickpeas, 1 cup', aliases=('chickpeas', 'chana'), calories=269, protein=14.5, carbs=45.0, fat=4.2, sugar=7.9),
    dict(name='cooked lentils, 1 cup', aliases=('lentils', 'dal', 'dhal'), calories=230, protein=17.9, carbs=39.9, fat=0.8, sugar=3.6),
    dict(name='banana, 1 medium', aliases=('banana',), calories=105, protein=1.3, carbs=27.0, fat=0.4, sugar=14.4),
    dict(name='apple, 1 medium', aliases=('apple',), calories=95, protein=0.5, carbs=25.1, fat=0.3, sugar=18.9),
    dict(name='whole milk, 1 cup', aliases=('milk', 'whole milk'), calories=149, protein=7.7, carbs=11.7, fat=7.9, sugar=12.3),
    dict(name='plain greek yogurt, 170 g', aliases=('greek yogurt', 'yogurt', 'curd'), calories=100, protein=17.3, carbs=6.1, fat=0.7, sugar=5.7),
    dict(name='whey protein shake, 1 scoop', aliases=('protein shake', 'whey', 'shake'), calories=120, protein=24.0, carbs=3.0, fat=1.5, sugar=1.0),
    dict(name='brewed coffee, 12 oz', aliases=('coffee', 'black coffee'), calories=5, protein=0.3, carbs=0.0, fat=0.0, sugar=0.0),
    dict(name='latte with whole milk, 16 oz', aliases=('latte', 'cold coffee', 'iced coffee'), calories=190, protein=10.0, carbs=18.0, fat=9.0, sugar=17.0),
    dict(name='smoothie, fruit and yogurt, 16 oz', aliases=('smoothie',), calories=300, protein=10.0, carbs=55.0, fat=4.0, sugar=40.0),
    dict(name='tonkotsu ramen bowl', aliases=('tonkotsu', 'ramen', 'tonkotsu ramen'), calories=650, protein=28.0, carbs=70.0, fat=28.0, sugar=5.0),
    dict(name='burrito bowl with rice and chicken', aliases=('burrito bowl', 'chipotle bowl'), calories=700, protein=42.0, carbs=78.0, fat=24.0, sugar=6.0),
]

def _macro_reference_context(prompt='', limit=8):
    terms = set(re.findall(r'[a-z][a-z0-9]+', (prompt or '').lower()))
    scored = []
    for item in MACRO_REFERENCE:
        aliases = set(item['aliases']) | {item['name'].lower()}
        score = 0
        for alias in aliases:
            alias_terms = set(re.findall(r'[a-z][a-z0-9]+', alias))
            if alias in (prompt or '').lower():
                score += 4
            score += len(terms & alias_terms)
        if score:
            scored.append((score, item))
    if not scored:
        scored = [(1, item) for item in MACRO_REFERENCE[:limit]]
    scored.sort(key=lambda pair: (-pair[0], pair[1]['name']))
    return [
        {key: value for key, value in item.items() if key != 'aliases'}
        for _, item in scored[:limit]
    ]

def _scaled_macro(item, multiplier):
    return dict(
        name=item['name'],
        calories=round(item['calories'] * multiplier, 1),
        protein=round(item['protein'] * multiplier, 1),
        carbs=round(item['carbs'] * multiplier, 1),
        fat=round(item['fat'] * multiplier, 1),
        sugar=round(item['sugar'] * multiplier, 1),
    )

def _fallback_food_plan_from_reference(prompt):
    lower = prompt.lower()
    operations = []
    used_names = set()
    portion_multiplier = 1.0
    if any(word in lower for word in ('large', 'larger', 'big', 'bigger')):
        portion_multiplier = 1.25
    elif any(word in lower for word in ('small', 'smaller', 'half')):
        portion_multiplier = 0.75

    for item in MACRO_REFERENCE:
        matched_alias = None
        for alias in sorted(item['aliases'], key=len, reverse=True):
            if re.search(rf'\b{re.escape(alias)}\b', lower):
                matched_alias = alias
                break
        if not matched_alias or item['name'] in used_names:
            continue

        multiplier = portion_multiplier
        before_alias = re.search(rf'(\d+(?:\.\d+)?)\s*(?:x\s*)?{re.escape(matched_alias)}\b', lower)
        if before_alias:
            multiplier *= float(before_alias.group(1))
        elif '100 g' in item['name']:
            grams = re.search(r'(\d+(?:\.\d+)?)\s*(?:g|gram|grams)\b', lower)
            if grams:
                multiplier *= float(grams.group(1)) / 100

        macro = _scaled_macro(item, multiplier)
        operations.append(dict(type='create_food', **macro))
        used_names.add(item['name'])

    if not operations:
        return None
    names = ', '.join(op['name'] for op in operations[:3])
    return {
        'reply': f"Logged {names} using Fitit's macro reference. Adjust it if the portion was different.",
        'operations': operations[:4],
    }

def _local_contextual_reply(selected):
    totals = get_daily_totals(current_user.id, selected)
    goals = get_user_goals(current_user)
    missing = []
    for label, total_key, goal_key, unit in (
        ('protein', 'protein', 'protein_goal', 'g'),
        ('carbs', 'carbs', 'carbs_goal', 'g'),
        ('fat', 'fat', 'fat_goal', 'g'),
        ('calories', 'calories', 'calorie_goal', ''),
        ('water', 'water', 'water_goal', 'ml'),
    ):
        goal = goals.get(goal_key) or 0
        if goal > 0:
            remaining = max(goal - totals.get(total_key, 0), 0)
            if remaining:
                missing.append(f"{int(remaining)}{unit} {label}".strip())

    if missing:
        return f"Today you still need about {', '.join(missing[:4])}. Tell me a food and portion, or tap a suggestion, and I will log it."

    common = _routine_food_context(current_user.id, selected).get('common_foods', [])
    if common:
        names = ', '.join(item['name'] for item in common[:3])
        return f"Today you have {int(totals['calories'])} calories, {int(totals['protein'])}g protein, {int(totals['carbs'])}g carbs, and {int(totals['fat'])}g fat logged. I can quickly log your usuals: {names}."

    return (
        f"Today you have {int(totals['calories'])} calories, {int(totals['protein'])}g protein, "
        f"{int(totals['carbs'])}g carbs, {int(totals['fat'])}g fat, and {int(totals['water'])} ml water logged. "
        "Send a meal with a portion, like '2 eggs and rice' or 'large cold coffee'."
    )

def _store_undo(entry, action='update'):
    _remember(current_user.id, 'last_food_undo', (
        f"{action}|{entry.id}|{entry.name}|{entry.calories}|{entry.protein}|"
        f"{entry.carbs}|{entry.fat}|{entry.sugar}"
    ))

def _restore_last_food_undo():
    memory = _memory_map(current_user.id).get('last_food_undo')
    if not memory:
        return None
    parts = memory.split('|')
    if len(parts) != 8:
        return None
    action, entry_id, name, calories, protein, carbs, fat, sugar = parts
    entry = FoodEntry.query.get(int(entry_id))
    if action == 'delete':
        db.session.add(FoodEntry(
            user_id=current_user.id,
            date=date.today(),
            name=name,
            calories=float(calories),
            protein=float(protein),
            carbs=float(carbs),
            fat=float(fat),
            sugar=float(sugar),
        ))
        return f"Restored {name}."
    if entry and entry.user_id == current_user.id:
        entry.name = name
        entry.calories = float(calories)
        entry.protein = float(protein)
        entry.carbs = float(carbs)
        entry.fat = float(fat)
        entry.sugar = float(sugar)
        return f"Undid the last change to {name}."
    return None

def _food_context(selected):
    entries = FoodEntry.query.filter_by(user_id=current_user.id, date=selected).order_by(FoodEntry.id).all()
    return [
        dict(
            id=e.id,
            name=e.name,
            calories=e.calories,
            protein=e.protein,
            carbs=e.carbs,
            fat=e.fat,
            sugar=e.sugar,
        )
        for e in entries
    ]

def _routine_food_context(user_id, selected):
    start = selected - timedelta(days=30)
    entries = (FoodEntry.query.filter(
        FoodEntry.user_id == user_id,
        FoodEntry.date >= start,
        FoodEntry.date <= selected,
    ).order_by(FoodEntry.date.desc(), FoodEntry.id.desc()).limit(80).all())

    grouped = {}
    for entry in entries:
        key = entry.name.strip().lower()
        item = grouped.setdefault(key, dict(
            name=entry.name,
            count=0,
            calories=0.0,
            protein=0.0,
            carbs=0.0,
            fat=0.0,
            sugar=0.0,
        ))
        item['count'] += 1
        item['calories'] += entry.calories
        item['protein'] += entry.protein
        item['carbs'] += entry.carbs
        item['fat'] += entry.fat
        item['sugar'] += entry.sugar

    common = sorted(grouped.values(), key=lambda item: (-item['count'], item['name']))[:12]
    for item in common:
        count = item.pop('count')
        item['times_logged'] = count
        item['average'] = dict(
            calories=round(item.pop('calories') / count, 1),
            protein=round(item.pop('protein') / count, 1),
            carbs=round(item.pop('carbs') / count, 1),
            fat=round(item.pop('fat') / count, 1),
            sugar=round(item.pop('sugar') / count, 1),
        )

    return dict(
        common_foods=common,
        recent_foods=[
            dict(
                date=e.date.isoformat(),
                name=e.name,
                calories=e.calories,
                protein=e.protein,
                carbs=e.carbs,
                fat=e.fat,
                sugar=e.sugar,
            )
            for e in entries[:20]
        ],
    )

def _recent_chat_context(user_id, limit=12):
    messages = (ChatMessage.query.filter_by(user_id=user_id)
                .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
                .limit(limit).all())
    messages.reverse()
    return [
        dict(role=m.role, content=m.content, intent=m.intent)
        for m in messages
    ]

def _looks_like_food_or_correction(prompt):
    keywords = (
        'ate', 'food', 'meal', 'breakfast', 'lunch', 'dinner', 'snack',
        'portion', 'larger', 'bigger', 'smaller', 'grilled', 'fried',
        'remove', 'delete', 'omit', 'actually', 'calorie', 'calories',
        'protein', 'carbs', 'fat', 'sugar', 'coffee', 'latte', 'mocha',
        'smoothie', 'shake', 'juice', 'soda', 'boba', 'frappe', 'dutch'
    )
    return any(re.search(rf'\b{re.escape(word)}\b', prompt) for word in keywords)

def _planner_context(selected, prompt=''):
    recent_actions = (AgentActionLog.query.filter_by(user_id=current_user.id, agent='nibbly')
                      .order_by(AgentActionLog.created_at.desc(), AgentActionLog.id.desc())
                      .limit(10).all())
    return dict(
        date=selected.isoformat(),
        date_label='today' if selected == date.today() else selected.strftime('%b %d, %Y'),
        user=dict(id=current_user.id, name=current_user.profile_name or current_user.username),
        goals=get_user_goals(current_user),
        today_totals=get_daily_totals(current_user.id, selected),
        today_foods=_food_context(selected),
        routine_foods=_routine_food_context(current_user.id, selected),
        recent_chat=_recent_chat_context(current_user.id),
        macro_reference=_macro_reference_context(prompt),
        memories=_memory_map(current_user.id),
        allowed_tools=sorted(AGENT_TOOLS.keys()) if 'AGENT_TOOLS' in globals() else [],
        recent_agent_actions=[
            dict(tool=a.tool, status=a.status, result=a.result)
            for a in recent_actions
        ],
    )

def _planner_instructions():
    return (
        "You are Nibbly, the Fitit in-app nutrition agent. Convert the user's natural language into safe tool calls. "
        "Use context.date and that date's food list to decide whether this is a new log, correction, deletion, or clarification. "
        "Use recent_chat for follow-ups such as 'another bowl' or 'make it bigger'. "
        "Use routine_foods, memories, and macro_reference before estimating. "
        "Estimate nutrition when needed, but do not invent exactness; keep estimates reasonable and name uncertain items clearly. "
        "For branded drinks, restaurants, and vague portions, infer from size words and ask only if the target item is ambiguous. "
        "Call remember_user_fact for stable user facts: preferences, usual foods, common orders, allergies, dislikes, portion tendencies, or preferred units. "
        "Return only JSON with keys: reply string, tool_calls array. "
        "Each tool call must be {tool:string, args:object}. "
        "Allowed tools are listed in context.allowed_tools. "
        "Never invent a tool name. Never log to a future date. "
        "Past dates are allowed when context.date is in the past. "
        "For deletion/update, use an exact id from context.today_foods for the selected date unless the user clearly says latest/last. "
        "If deletion/update is ambiguous, call ask_clarification and explain which item needs clarification. "
        "Numbers must be numeric. Keep reply concise, specific, and natural."
    )

def _clean_json_text(text):
    text = (text or '').strip()
    if text.startswith('```'):
        text = re.sub(r'^```(?:json)?|```$', '', text, flags=re.MULTILINE).strip()
    return text

def _gemini_output_text(payload):
    parts = []
    for candidate in payload.get('candidates', []):
        content = candidate.get('content', {})
        for part in content.get('parts', []):
            if part.get('text'):
                parts.append(part['text'])
    return ''.join(parts)

def _ask_gemini_food_planner(prompt, selected):
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return None, 'missing_key'

    model = os.environ.get('GEMINI_MODEL', 'gemini-1.5-flash')
    body = {
        'contents': [{
            'role': 'user',
            'parts': [{
                'text': (
                    f"{_planner_instructions()}\n\n"
                    f"Input JSON:\n{json.dumps({'context': _planner_context(selected, prompt), 'message': prompt})}"
                )
            }],
        }],
        'generationConfig': {
            'temperature': 0.2,
            'responseMimeType': 'application/json',
        },
    }
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as res:
            payload = json.loads(res.read().decode('utf-8'))
        return json.loads(_clean_json_text(_gemini_output_text(payload))), None
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, ValueError) as exc:
        return {'reply': f"I couldn't reach Gemini right now: {exc}", 'operations': [{'type': 'ask'}]}, 'ai_error'

def _openai_output_text(payload):
    if payload.get('output_text'):
        return payload['output_text']
    parts = []
    for item in payload.get('output', []):
        for content in item.get('content', []):
            if content.get('type') in ('output_text', 'text') and content.get('text'):
                parts.append(content['text'])
    return ''.join(parts)

def _ask_ai_food_planner(prompt, selected):
    if os.environ.get('GEMINI_API_KEY'):
        return _ask_gemini_food_planner(prompt, selected)

    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return None, 'missing_key'
    model = os.environ.get('OPENAI_MODEL', 'gpt-4.1-mini')
    body = {
        'model': model,
        'input': [
            {'role': 'system', 'content': _planner_instructions()},
            {'role': 'user', 'content': json.dumps({'context': _planner_context(selected, prompt), 'message': prompt})},
        ],
        'temperature': 0.2,
    }
    req = urllib.request.Request(
        'https://api.openai.com/v1/responses',
        data=json.dumps(body).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as res:
            payload = json.loads(res.read().decode('utf-8'))
        return json.loads(_clean_json_text(_openai_output_text(payload))), None
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, ValueError) as exc:
        return {'reply': f"I couldn't reach the AI planner right now: {exc}", 'operations': [{'type': 'ask'}]}, 'ai_error'

def _fallback_suggestions(selected):
    today_foods = _food_context(selected)
    routine = _routine_food_context(current_user.id, selected)
    suggestions = []
    if today_foods:
        latest = today_foods[-1]['name']
        suggestions.extend([
            f"Make {latest} a larger portion",
            f"Remove {latest}",
        ])
    for food in routine.get('common_foods', [])[:3]:
        suggestions.append(f"Log {food['name']}")
    totals = get_daily_totals(current_user.id, selected)
    goals = get_user_goals(current_user)
    if totals.get('water', 0) < goals.get('water_goal', 0):
        suggestions.append("Log water")
    return list(dict.fromkeys(suggestions))[:5]

def _ask_ai_suggestions(selected):
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return _fallback_suggestions(selected)

    instructions = (
        "Create 4 short, useful chat suggestion chips for a nutrition logging assistant. "
        "Use the user's today foods, goals, recent foods, and memories. "
        "Make suggestions actionable, not generic. Include food corrections or common foods when relevant. "
        "Do not suggest vague phrases like start logging, help me, tips, or what should I eat. "
        "Prefer concrete examples such as logging a recent food, correcting a portion, removing an item, or adding water. "
        "Return only JSON: {\"suggestions\":[\"...\"]}. Keep each suggestion under 42 characters."
    )
    model = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
    body = {
        'contents': [{
            'role': 'user',
            'parts': [{
                'text': f"{instructions}\n\nInput JSON:\n{json.dumps(_planner_context(selected))}"
            }],
        }],
        'generationConfig': {
            'temperature': 0.35,
            'responseMimeType': 'application/json',
        },
    }
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as res:
            payload = json.loads(res.read().decode('utf-8'))
        result = json.loads(_clean_json_text(_gemini_output_text(payload)))
        suggestions = result.get('suggestions') if isinstance(result, dict) else None
        if isinstance(suggestions, list):
            cleaned = [str(item).strip()[:60] for item in suggestions if str(item).strip()]
            if cleaned:
                return cleaned[:5]
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, ValueError):
        return _fallback_suggestions(selected)
    return _fallback_suggestions(selected)

def _ask_ai_general_reply(prompt, selected):
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return None

    instructions = (
        "You are Nibbly, a concise nutrition logging assistant inside Fitit. "
        "Answer the user naturally using the provided goals, totals, recent chat, routine foods, macro reference, and memories. "
        "If the user asks about food, macros, calories, or corrections, explain the best next logging action. "
        "If the user gives a stable preference or routine detail, include a memory object. "
        "Do not claim medical certainty. Return only JSON: {\"reply\":\"...\",\"memories\":[{\"key\":\"...\",\"value\":\"...\"}]}. "
        "Keep replies short enough for a mobile chat bubble."
    )
    model = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
    body = {
        'contents': [{
            'role': 'user',
            'parts': [{
                'text': f"{instructions}\n\nInput JSON:\n{json.dumps({'context': _planner_context(selected, prompt), 'message': prompt})}"
            }],
        }],
        'generationConfig': {
            'temperature': 0.35,
            'responseMimeType': 'application/json',
        },
    }
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            payload = json.loads(res.read().decode('utf-8'))
        result = json.loads(_clean_json_text(_gemini_output_text(payload)))
        if not isinstance(result, dict) or not result.get('reply'):
            return None
        memories = result.get('memories') if isinstance(result.get('memories'), list) else []
        for memory in memories[:4]:
            if isinstance(memory, dict) and memory.get('key') and memory.get('value'):
                _remember(current_user.id, str(memory['key'])[:80], str(memory['value'])[:500])
        return str(result['reply'])[:800]
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, ValueError):
        return None

def _fallback_dashboard_insights(totals, goals, metrics):
    def as_float(value):
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    insights = []
    bmi = as_float(metrics.get('bmi'))
    bmi_status = metrics.get('bmi_status')
    ideal_min = as_float(metrics.get('ideal_weight_min_kg'))
    ideal_max = as_float(metrics.get('ideal_weight_max_kg'))
    target_weight = as_float(metrics.get('ideal_weight_target_kg'))
    weight_delta = as_float(metrics.get('weight_delta_to_target_kg'))

    if bmi is not None:
        insights.append(
            f"Your BMI is {bmi:.1f}. The standard normal BMI range is 18.5 to 24.9; use it as a screening guide, not a full health score."
        )
        if bmi_status:
            insights.append(f"Current BMI category: {bmi_status}. Track the weekly trend instead of reacting to one day.")
        if ideal_min is not None and ideal_max is not None:
            insights.append(f"For your height, the standard BMI range maps to roughly {ideal_min:.1f}-{ideal_max:.1f} kg.")
        if target_weight is not None and weight_delta is not None:
            if weight_delta < -0.2:
                insights.append(f"A practical target is near {target_weight:.1f} kg, about {abs(weight_delta):.1f} kg below your current weight.")
            elif weight_delta > 0.2:
                insights.append(f"A practical target is near {target_weight:.1f} kg, about {weight_delta:.1f} kg above your current weight.")
            else:
                insights.append("You are close to the middle of the standard BMI range. Maintenance habits matter most now.")
    else:
        insights.append("Add height, weight, date of birth, gender, and routine to unlock BMI, maintenance, and weight guidance.")

    calorie_goal = goals.get('calorie_goal') or 0
    calories = totals.get('calories') or 0
    if calorie_goal:
        remaining = round(calorie_goal - calories)
        if remaining > 0:
            insights.append(f"{remaining} calories remain for today. Keep the next meal balanced instead of saving everything for late night.")
        elif remaining < 0:
            insights.append(f"You are {abs(remaining)} calories over target. Make the next choice lighter, higher-protein, and lower-sugar.")
        else:
            insights.append("Calories are exactly on target today. Keep hydration and sleep on track too.")

    protein_goal = goals.get('protein_goal') or 0
    protein_left = max(0, round(protein_goal - (totals.get('protein') or 0)))
    if protein_goal and protein_left:
        insights.append(f"{protein_left}g protein left. Eggs, yogurt, tofu, paneer, chicken, lentils, or a protein shake can close the gap.")
    elif protein_goal:
        insights.append("Protein is covered today. That helps fullness and recovery.")

    carbs_goal = goals.get('carbs_goal') or 0
    carbs_left = round(carbs_goal - (totals.get('carbs') or 0))
    if carbs_goal and carbs_left < 0:
        insights.append(f"Carbs are {abs(carbs_left)}g over target. Keep the next snack protein- or fiber-led.")

    fat_goal = goals.get('fat_goal') or 0
    fat_left = round(fat_goal - (totals.get('fat') or 0))
    if fat_goal and fat_left < 0:
        insights.append(f"Fat is {abs(fat_left)}g over target. Choose grilled, steamed, or leaner options next.")

    sugar_goal = goals.get('sugar_goal') or 0
    sugar_left = round(sugar_goal - (totals.get('sugar') or 0))
    if sugar_goal and sugar_left < 0:
        insights.append(f"Sugar is {abs(sugar_left)}g over target. Avoid sweet drinks for the rest of the day.")

    water_goal = goals.get('water_goal') or 0
    water_left = max(0, round(water_goal - (totals.get('water') or 0)))
    if water_goal and water_left:
        insights.append(f"{water_left} ml water left. Split it into a few smaller drinks so it is easier to finish.")
    elif water_goal:
        insights.append("Water target is complete. Keep normal sips going if you are active or it is hot.")

    step_goal = goals.get('step_goal') or 0
    steps_left = max(0, round(step_goal - (totals.get('steps') or 0)))
    if step_goal and steps_left:
        insights.append(f"{steps_left:,} steps left. A 10-15 minute walk can make a visible dent.")
    elif step_goal:
        insights.append("Step goal is complete. Good daily movement base.")

    sleep_goal = goals.get('sleep_goal') or 0
    sleep_left = max(0, round((sleep_goal - (totals.get('sleep') or 0)) * 10) / 10)
    if sleep_goal and sleep_left:
        insights.append(f"{sleep_left:g} hours of sleep left against your target. A consistent bedtime will help the trend.")

    return list(dict.fromkeys(insights))[:10]

def _ask_ai_dashboard_insights(selected, totals, goals, metrics):
    fallback = _fallback_dashboard_insights(totals, goals, metrics)
    context = dict(
        date=selected.isoformat(),
        user=dict(name=current_user.profile_name or current_user.username),
        totals=totals,
        goals=goals,
        health_metrics=metrics,
        routine_foods=_routine_food_context(current_user.id, selected),
        memories=_memory_map(current_user.id),
        fallback_examples=fallback,
    )
    instructions = (
        "Create concise personalized dashboard insights for Fitit, a nutrition and wellness tracker. "
        "Use the user's totals, goals, health metrics, routine foods, and memories. "
        "Return 6 to 9 varied insights, not the same three every time. Include BMI education when BMI exists: "
        "standard normal BMI range is 18.5-24.9, but BMI is only a screening guide. "
        "Mention nutrition gaps, hydration, steps, sleep, calorie balance, maintenance/deficit, and weight trend when relevant. "
        "Avoid medical diagnosis, shame, and generic motivation. Keep each item under 140 characters. "
        "Return only JSON: {\"insights\":[\"...\"]}."
    )

    if os.environ.get('GEMINI_API_KEY'):
        model = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
        body = {
            'contents': [{
                'role': 'user',
                'parts': [{'text': f"{instructions}\n\nInput JSON:\n{json.dumps(context)}"}],
            }],
            'generationConfig': {'temperature': 0.55, 'responseMimeType': 'application/json'},
        }
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={os.environ["GEMINI_API_KEY"]}'
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST',
        )
        try:
            with urllib.request.urlopen(req, timeout=8) as res:
                payload = json.loads(res.read().decode('utf-8'))
            result = json.loads(_clean_json_text(_gemini_output_text(payload)))
            insights = result.get('insights') if isinstance(result, dict) else None
            if isinstance(insights, list):
                cleaned = [str(item).strip()[:180] for item in insights if str(item).strip()]
                if cleaned:
                    return list(dict.fromkeys(cleaned))[:9]
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, ValueError):
            pass

    api_key = os.environ.get('OPENAI_API_KEY')
    if api_key:
        body = {
            'model': os.environ.get('OPENAI_MODEL', 'gpt-4.1-mini'),
            'input': [
                {'role': 'system', 'content': instructions},
                {'role': 'user', 'content': json.dumps(context)},
            ],
            'temperature': 0.55,
        }
        req = urllib.request.Request(
            'https://api.openai.com/v1/responses',
            data=json.dumps(body).encode('utf-8'),
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
            method='POST',
        )
        try:
            with urllib.request.urlopen(req, timeout=8) as res:
                payload = json.loads(res.read().decode('utf-8'))
            result = json.loads(_clean_json_text(_openai_output_text(payload)))
            insights = result.get('insights') if isinstance(result, dict) else None
            if isinstance(insights, list):
                cleaned = [str(item).strip()[:180] for item in insights if str(item).strip()]
                if cleaned:
                    return list(dict.fromkeys(cleaned))[:9]
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, ValueError):
            pass

    return fallback

def _tool_create_food(args, selected):
    name = str(args.get('name') or 'AI food').strip()[:100]
    if not name:
        return _agent_result(False, 'Food name is required.')
    entry = FoodEntry(
        user_id=current_user.id,
        date=selected,
        name=name,
        calories=float(args.get('calories') or 0),
        protein=float(args.get('protein') or 0),
        carbs=float(args.get('carbs') or 0),
        fat=float(args.get('fat') or 0),
        sugar=float(args.get('sugar') or 0),
    )
    db.session.add(entry)
    db.session.flush()
    return _agent_result(True, f"Logged {entry.name}.", type='food', operation='create', id=entry.id)

def _tool_update_food(args, selected):
    entry = FoodEntry.query.get(int(args.get('id') or 0))
    if not entry or entry.user_id != current_user.id or entry.date != selected:
        return _agent_result(False, 'I could not find that food entry for the selected date.')
    _store_undo(entry)
    for field in ('name', 'calories', 'protein', 'carbs', 'fat', 'sugar'):
        if field in args and args[field] is not None:
            value = str(args[field]).strip()[:100] if field == 'name' else float(args[field])
            setattr(entry, field, value)
    return _agent_result(True, f"Updated {entry.name}.", type='food', operation='update', id=entry.id)

def _tool_delete_food(args, selected):
    entry = FoodEntry.query.get(int(args.get('id') or 0))
    if not entry or entry.user_id != current_user.id or entry.date != selected:
        return _agent_result(False, 'I could not find that food entry for the selected date.')
    snap = _entry_snapshot(entry)
    _remember(current_user.id, 'last_food_undo', (
        f"delete|{entry.id}|{snap['name']}|{snap['calories']}|{snap['protein']}|"
        f"{snap['carbs']}|{snap['fat']}|{snap['sugar']}"
    ))
    db.session.delete(entry)
    return _agent_result(True, f"Deleted {snap['name']}.", type='food', operation='delete', id=entry.id)

def _tool_log_water(args, selected):
    amount = int(float(args.get('amount_ml') or 0))
    if amount <= 0:
        return _agent_result(False, 'Water amount must be greater than zero.')
    entry = WaterEntry(user_id=current_user.id, date=selected, amount_ml=amount)
    db.session.add(entry)
    db.session.flush()
    return _agent_result(True, f"Logged {amount} ml of water.", type='water', operation='create', id=entry.id)

def _tool_update_water(args, selected):
    entry = WaterEntry.query.get(int(args.get('id') or 0)) if args.get('id') else _latest_entry(WaterEntry, current_user.id)
    if not entry or entry.user_id != current_user.id or entry.date != selected:
        return _agent_result(False, 'I could not find a water entry for the selected date.')
    amount = int(float(args.get('amount_ml') or 0))
    if amount <= 0:
        return _agent_result(False, 'Water amount must be greater than zero.')
    entry.amount_ml = amount
    return _agent_result(True, f"Updated water to {amount} ml.", type='water', operation='update', id=entry.id)

def _tool_delete_latest_water(args, selected):
    entry = (WaterEntry.query.filter_by(user_id=current_user.id, date=selected)
             .order_by(WaterEntry.id.desc()).first())
    if not entry:
        return _agent_result(False, 'I could not find a water entry for the selected date.')
    amount = entry.amount_ml
    db.session.delete(entry)
    return _agent_result(True, f"Removed your last water entry ({amount} ml).", type='water', operation='delete', id=entry.id)

def _tool_log_steps(args, selected):
    steps = int(float(args.get('steps') or 0))
    if steps <= 0:
        return _agent_result(False, 'Steps must be greater than zero.')
    entry = StepEntry(user_id=current_user.id, date=selected, steps=steps)
    db.session.add(entry)
    db.session.flush()
    return _agent_result(True, f"Logged {steps} steps.", type='steps', operation='create', id=entry.id)

def _tool_update_steps(args, selected):
    entry = StepEntry.query.get(int(args.get('id') or 0)) if args.get('id') else _latest_entry(StepEntry, current_user.id)
    if not entry or entry.user_id != current_user.id or entry.date != selected:
        return _agent_result(False, 'I could not find a steps entry for the selected date.')
    steps = int(float(args.get('steps') or 0))
    if steps <= 0:
        return _agent_result(False, 'Steps must be greater than zero.')
    entry.steps = steps
    return _agent_result(True, f"Updated steps to {steps}.", type='steps', operation='update', id=entry.id)

def _tool_delete_latest_steps(args, selected):
    entry = (StepEntry.query.filter_by(user_id=current_user.id, date=selected)
             .order_by(StepEntry.id.desc()).first())
    if not entry:
        return _agent_result(False, 'I could not find a steps entry for the selected date.')
    steps = entry.steps
    db.session.delete(entry)
    return _agent_result(True, f"Removed your last steps entry ({steps} steps).", type='steps', operation='delete', id=entry.id)

def _tool_update_goals(args, selected):
    allowed = {
        'calorie_goal', 'calories_burnt_goal', 'protein_goal', 'carbs_goal',
        'fat_goal', 'sugar_goal', 'water_goal', 'step_goal', 'sleep_goal'
    }
    changed = []
    for key, value in args.items():
        if key in allowed and value is not None:
            setattr(current_user, key, float(value))
            changed.append(key)
    if not changed:
        return _agent_result(False, 'No valid goals were provided.')
    return _agent_result(True, f"Updated {', '.join(changed)}.", type='goals', operation='update', fields=changed)

def _tool_remember_user_fact(args, selected):
    key = str(args.get('key') or 'preference').strip()[:80]
    value = str(args.get('value') or '').strip()[:500]
    if not value:
        return _agent_result(False, 'There was nothing useful to remember.')
    _remember(current_user.id, key, value)
    return _agent_result(True, f"Remembered {key}.", type='memory', operation='upsert', key=key)

def _tool_read_today_logs(args, selected):
    return _agent_result(True, 'Read selected date logs.', type='read', logs=_food_context(selected), totals=get_daily_totals(current_user.id, selected))

def _tool_ask_clarification(args, selected):
    question = str(args.get('question') or 'I need a bit more detail.').strip()[:500]
    return _agent_result(False, question, type='ask')

AGENT_TOOLS = {
    'create_food': _tool_create_food,
    'update_food': _tool_update_food,
    'delete_food': _tool_delete_food,
    'log_water': _tool_log_water,
    'update_water': _tool_update_water,
    'delete_latest_water': _tool_delete_latest_water,
    'log_steps': _tool_log_steps,
    'update_steps': _tool_update_steps,
    'delete_latest_steps': _tool_delete_latest_steps,
    'update_goals': _tool_update_goals,
    'remember_user_fact': _tool_remember_user_fact,
    'read_today_logs': _tool_read_today_logs,
    'ask_clarification': _tool_ask_clarification,
}

LEGACY_OPERATION_TO_TOOL = {
    'create_food': 'create_food',
    'update_food': 'update_food',
    'delete_food': 'delete_food',
    'remember': 'remember_user_fact',
    'ask': 'ask_clarification',
}

def _normalize_tool_calls(plan):
    if not isinstance(plan, dict):
        return []
    calls = plan.get('tool_calls')
    if isinstance(calls, list):
        return [
            {'tool': call.get('tool'), 'args': call.get('args') or {}}
            for call in calls
            if isinstance(call, dict)
        ]

    operations = plan.get('operations')
    if not isinstance(operations, list):
        return []
    normalized = []
    for operation in operations:
        if not isinstance(operation, dict):
            continue
        op_type = operation.get('type')
        tool = LEGACY_OPERATION_TO_TOOL.get(op_type)
        if not tool:
            continue
        args = dict(operation)
        args.pop('type', None)
        if op_type == 'remember':
            args = {'key': args.get('key'), 'value': args.get('value')}
        elif op_type == 'ask':
            args = {'question': plan.get('reply') or 'I need a bit more detail.'}
        normalized.append({'tool': tool, 'args': args})
    return normalized

def _execute_agent_plan(plan, selected):
    tool_calls = _normalize_tool_calls(plan)
    if not tool_calls:
        return plan.get('reply', 'I need a clearer instruction.'), 'agent_ask', None

    results = []
    for call in tool_calls[:6]:
        tool = call.get('tool')
        args = call.get('args') if isinstance(call.get('args'), dict) else {}
        if tool not in AGENT_TOOLS:
            result = _agent_result(False, f"Blocked unknown tool: {tool}.")
        else:
            try:
                result = AGENT_TOOLS[tool](args, selected)
            except (KeyError, TypeError, ValueError):
                result = _agent_result(False, f"{tool} received invalid input.")
        _log_agent_tool(tool or 'unknown', args, result)
        results.append({'tool': tool, 'result': result})

    blocked = [item['result']['message'] for item in results if not item['result'].get('ok')]
    succeeded = [item for item in results if item['result'].get('ok')]
    reply = plan.get('reply')
    if not reply:
        reply = blocked[0] if blocked and not succeeded else 'Updated your log.'
    action = {
        'type': 'agent',
        'tools': results,
        'primary': succeeded[0]['result'] if succeeded else (results[0]['result'] if results else None),
    }
    return reply, 'agent_plan', action

def _learn_from_interaction(message, selected, intent, action):
    _remember(current_user.id, 'last_coach_message', message[:500])

    routine = _routine_food_context(current_user.id, selected)
    common = routine.get('common_foods', [])[:6]
    if common:
        _remember(current_user.id, 'common_foods_summary', json.dumps(common, separators=(',', ':'))[:1200])

    primary = action.get('primary') if action and action.get('type') == 'agent' else action
    if primary and primary.get('type') == 'food':
        food_id = primary.get('id')
        entry = FoodEntry.query.get(food_id) if food_id else None
        if not entry:
            entry = _latest_entry(FoodEntry, current_user.id)
        if entry:
            _remember(current_user.id, 'last_food_log', json.dumps(dict(
                name=entry.name,
                calories=entry.calories,
                protein=entry.protein,
                carbs=entry.carbs,
                fat=entry.fat,
                sugar=entry.sugar,
                operation=primary.get('operation'),
            ), separators=(',', ':'))[:700])

    if intent in ('log_water', 'update_water', 'delete_water'):
        _remember(current_user.id, 'last_hydration_action', message[:300])
    elif intent in ('log_steps', 'update_steps', 'delete_steps'):
        _remember(current_user.id, 'last_steps_action', message[:300])

def _apply_ai_food_plan(plan, selected):
    operations = plan.get('operations') if isinstance(plan, dict) else None
    if not isinstance(operations, list):
        return plan.get('reply', 'I need a clearer food instruction.'), 'ai_ask', None

    action = None
    changed = False
    for op in operations:
        if not isinstance(op, dict):
            continue
        op_type = op.get('type')
        if op_type == 'create_food':
            name = (op.get('name') or 'AI food').strip()[:100]
            entry = FoodEntry(
                user_id=current_user.id,
                date=selected,
                name=name,
                calories=float(op.get('calories') or 0),
                protein=float(op.get('protein') or 0),
                carbs=float(op.get('carbs') or 0),
                fat=float(op.get('fat') or 0),
                sugar=float(op.get('sugar') or 0),
            )
            db.session.add(entry)
            db.session.flush()
            action = {'type': 'food', 'operation': 'create', 'id': entry.id}
            changed = True
        elif op_type == 'update_food':
            entry = FoodEntry.query.get(int(op.get('id') or 0))
            if not entry or entry.user_id != current_user.id:
                continue
            _store_undo(entry)
            for field in ('name', 'calories', 'protein', 'carbs', 'fat', 'sugar'):
                if field in op and op[field] is not None:
                    value = str(op[field]).strip()[:100] if field == 'name' else float(op[field])
                    setattr(entry, field, value)
            action = {'type': 'food', 'operation': 'update', 'id': entry.id}
            changed = True
        elif op_type == 'delete_food':
            entry = FoodEntry.query.get(int(op.get('id') or 0))
            if not entry or entry.user_id != current_user.id:
                continue
            snap = _entry_snapshot(entry)
            _remember(current_user.id, 'last_food_undo', (
                f"delete|{entry.id}|{snap['name']}|{snap['calories']}|{snap['protein']}|"
                f"{snap['carbs']}|{snap['fat']}|{snap['sugar']}"
            ))
            db.session.delete(entry)
            action = {'type': 'food', 'operation': 'delete', 'id': entry.id}
            changed = True
        elif op_type == 'remember' and op.get('key') and op.get('value'):
            _remember(current_user.id, str(op['key'])[:80], str(op['value'])[:500])
            action = {'type': 'memory'}
            changed = True

    reply = plan.get('reply') or ('Updated your food log.' if changed else 'I need a bit more detail.')
    return reply, 'ai_food_plan', action

def _assistant_reply(message, selected):
    text = (message or '').strip()
    lower = text.lower()
    memories = _memory_map(current_user.id)
    intent = 'chat'
    action = None

    if not text:
        return "Tell me what you ate, drank, changed, or want to remember.", intent, action

    remember_match = re.search(r'\b(?:remember|note|i like|i prefer|my goal is)\b\s*(?:that\s*)?(.*)', lower)
    if remember_match and remember_match.group(1).strip():
        value = remember_match.group(1).strip()
        plan = {
            'reply': f"I'll remember that: {value}.",
            'tool_calls': [{'tool': 'remember_user_fact', 'args': {'key': 'preference', 'value': value}}],
        }
        return _execute_agent_plan(plan, selected)

    if _looks_like_food_or_correction(lower):
        plan, error = _ask_ai_food_planner(text, selected)
        if error == 'ai_error':
            fallback_plan = _fallback_food_plan_from_reference(text)
            if fallback_plan:
                reply, intent, action = _execute_agent_plan(fallback_plan, selected)
                return reply, 'reference_food_plan', action
        if plan:
            reply, intent, action = _execute_agent_plan(plan, selected)
            return reply, intent, action
        if error == 'missing_key':
            fallback_plan = _fallback_food_plan_from_reference(text)
            if fallback_plan:
                reply, intent, action = _execute_agent_plan(fallback_plan, selected)
                return reply, 'reference_food_plan', action
            return (
                "AI food understanding is not configured yet. Add GEMINI_API_KEY or OPENAI_API_KEY on the server, "
                "then I can parse meals and corrections from conversation instead of fixed rules."
            ), 'ai_missing_key', None

    delete_words = ('remove', 'delete', 'undo')
    update_words = ('change', 'update', 'modify', 'set')
    is_delete = any(w in lower for w in delete_words)
    is_update = any(w in lower for w in update_words)

    if any(w in lower for w in ('water', 'drink', 'drank', 'ml', 'liter', 'litre')):
        amount = _number_before(['ml', 'milliliters', 'millilitres'], lower)
        liters = _number_before(['l', 'liter', 'liters', 'litre', 'litres'], lower)
        if liters is not None and amount is None:
            amount = liters * 1000
        if is_delete:
            return _execute_agent_plan({
                'reply': None,
                'tool_calls': [{'tool': 'delete_latest_water', 'args': {}}],
            }, selected)
        if is_update:
            if amount:
                return _execute_agent_plan({
                    'reply': f"Updated your latest water entry to {int(amount)} ml.",
                    'tool_calls': [{'tool': 'update_water', 'args': {'amount_ml': int(amount)}}],
                }, selected)
        if amount:
            return _execute_agent_plan({
                'reply': f"Logged {int(amount)} ml of water.",
                'tool_calls': [{'tool': 'log_water', 'args': {'amount_ml': int(amount)}}],
            }, selected)

    if any(w in lower for w in ('steps', 'walked')):
        steps = _number_before(['steps'], lower)
        if is_delete:
            return _execute_agent_plan({
                'reply': None,
                'tool_calls': [{'tool': 'delete_latest_steps', 'args': {}}],
            }, selected)
        if is_update:
            if steps:
                return _execute_agent_plan({
                    'reply': f"Updated your latest steps entry to {int(steps)} steps.",
                    'tool_calls': [{'tool': 'update_steps', 'args': {'steps': int(steps)}}],
                }, selected)
        if steps:
            return _execute_agent_plan({
                'reply': f"Logged {int(steps)} steps.",
                'tool_calls': [{'tool': 'log_steps', 'args': {'steps': int(steps)}}],
            }, selected)

    ai_reply = _ask_ai_general_reply(text, selected)
    if ai_reply:
        return ai_reply, 'ai_chat', action

    return _local_contextual_reply(selected), intent, action

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
        insights=_fallback_dashboard_insights(totals, goals, metrics),
        weight_kg=weight_kg,
        weight_lbs=round(weight_kg * 2.20462, 1) if weight_kg else None,
        chart=dict(
            weight_labels=[e.date.strftime('%b %d') for e in weight_entries],
            weight_values=[float(e.weight_kg) for e in weight_entries],
            sleep_labels=[e.date.strftime('%b %d') for e in sleep_entries],
            sleep_values=[float(e.duration_hours) for e in sleep_entries],
        )
    )

@api_bp.route('/dashboard/insights')
@login_required
def dashboard_insights():
    selected = _parse_query_date()
    totals = get_daily_totals(current_user.id, selected)
    goals = get_user_goals(current_user)
    metrics = get_health_metrics(current_user, totals)
    return ok(insights=_ask_ai_dashboard_insights(selected, totals, goals, metrics))

# Coach chat

@api_bp.route('/coach/history')
@login_required
def coach_history():
    selected = _parse_selected_date(request.args)
    messages = (ChatMessage.query.filter_by(user_id=current_user.id)
                .order_by(ChatMessage.created_at.desc()).limit(40).all())
    messages.reverse()
    memories = _memory_map(current_user.id)
    greeting = f"Hi {current_user.profile_name or current_user.username}."
    if memories.get('preference'):
        greeting += f" I remember {memories['preference']}."
    else:
        greeting += " Tell me what you ate or what you want me to remember."
    ai_provider = None
    if os.environ.get('GEMINI_API_KEY'):
        ai_provider = 'Gemini'
    elif os.environ.get('OPENAI_API_KEY'):
        ai_provider = 'OpenAI'
    return ok(
        greeting=greeting,
        memories=memories,
        ai_provider=ai_provider,
        suggestions=_ask_ai_suggestions(selected),
        messages=[
            dict(id=m.id, role=m.role, content=m.content, intent=m.intent,
                 created_at=m.created_at.isoformat())
            for m in messages
        ],
    )

@api_bp.route('/coach/message', methods=['POST'])
@login_required
def coach_message():
    payload = request.get_json() or {}
    message = (payload.get('message') or '').strip()
    selected = _resolve_message_date(message, _parse_selected_date(payload))
    future_error = _future_date_error(selected)
    if future_error:
        return future_error
    if not message:
        return err('Message is required')

    user_message = ChatMessage(user_id=current_user.id, role='user', content=message)
    db.session.add(user_message)

    reply, intent, action = _assistant_reply(message, selected)
    _learn_from_interaction(message, selected, intent, action)
    assistant_message = ChatMessage(
        user_id=current_user.id,
        role='assistant',
        content=reply,
        intent=intent,
    )
    db.session.add(assistant_message)
    db.session.commit()

    return ok(
        reply=dict(
            id=assistant_message.id,
            role='assistant',
            content=assistant_message.content,
            intent=assistant_message.intent,
            created_at=assistant_message.created_at.isoformat(),
        ),
        action=action,
        memories=_memory_map(current_user.id),
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
                                      .order_by(FoodEntry.id.desc()).all()],
        water=[dict(id=e.id, amount_ml=e.amount_ml)
               for e in WaterEntry.query.filter_by(user_id=current_user.id, date=selected)
                                        .order_by(WaterEntry.id.desc()).all()],
        weight=[dict(id=e.id, weight_kg=e.weight_kg)
                for e in WeightEntry.query.filter_by(user_id=current_user.id, date=selected)
                                         .order_by(WeightEntry.id.desc()).all()],
        steps=[dict(id=e.id, steps=e.steps)
               for e in StepEntry.query.filter_by(user_id=current_user.id, date=selected)
                                       .order_by(StepEntry.id.desc()).all()],
        sleep=[dict(id=e.id, duration_hours=e.duration_hours,
                    sleep_time=e.sleep_time.strftime('%H:%M') if e.sleep_time else None,
                    wake_time=e.wake_time.strftime('%H:%M') if e.wake_time else None)
               for e in SleepEntry.query.filter_by(user_id=current_user.id, date=selected)
                                        .order_by(SleepEntry.id.desc()).all()],
        calories_burnt=[dict(id=e.id, calories_burnt=e.calories_burnt)
                        for e in CaloriesBurntEntry.query.filter_by(user_id=current_user.id, date=selected)
                                                   .order_by(CaloriesBurntEntry.id.desc()).all()],
    ))

@api_bp.route('/entries/food', methods=['POST'])
@login_required
def add_food():
    d = request.get_json()
    selected = datetime.strptime(d.get('date', date.today().isoformat()), '%Y-%m-%d').date()
    future_error = _future_date_error(selected)
    if future_error:
        return future_error
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
    future_error = _future_date_error(selected)
    if future_error:
        return future_error
    entry = WaterEntry(user_id=current_user.id, date=selected, amount_ml=int(d['amount_ml']))
    db.session.add(entry); db.session.commit()
    return ok(id=entry.id), 201

@api_bp.route('/entries/weight', methods=['POST'])
@login_required
def add_weight():
    d = request.get_json()
    selected = datetime.strptime(d.get('date', date.today().isoformat()), '%Y-%m-%d').date()
    future_error = _future_date_error(selected)
    if future_error:
        return future_error
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
    future_error = _future_date_error(selected)
    if future_error:
        return future_error
    entry = StepEntry(user_id=current_user.id, date=selected, steps=int(d['steps']))
    db.session.add(entry); db.session.commit()
    return ok(id=entry.id), 201

@api_bp.route('/entries/sleep', methods=['POST'])
@login_required
def add_sleep():
    d = request.get_json()
    selected = datetime.strptime(d.get('date', date.today().isoformat()), '%Y-%m-%d').date()
    future_error = _future_date_error(selected)
    if future_error:
        return future_error
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
    future_error = _future_date_error(selected)
    if future_error:
        return future_error
    entry = CaloriesBurntEntry(user_id=current_user.id, date=selected,
                               calories_burnt=int(d['calories_burnt']))
    db.session.add(entry); db.session.commit()
    return ok(id=entry.id), 201

@api_bp.route('/entries/<entry_type>/<int:entry_id>', methods=['PUT'])
@login_required
def update_entry(entry_type, entry_id):
    d = request.get_json() or {}
    model_map = dict(food=FoodEntry, water=WaterEntry, weight=WeightEntry,
                     steps=StepEntry, sleep=SleepEntry, calories_burnt=CaloriesBurntEntry)
    model = model_map.get(entry_type)
    if not model:
        return err('Invalid entry type')
    entry = model.query.get_or_404(entry_id)
    if entry.user_id != current_user.id:
        return err('Unauthorized', 403)

    selected = _parse_selected_date(d)
    future_error = _future_date_error(selected)
    if future_error:
        return future_error
    entry.date = selected

    try:
        if entry_type == 'food':
            time_val = None
            if d.get('time'):
                time_val = datetime.strptime(d['time'], '%H:%M').time()
            entry.name = (d.get('name') or '').strip()
            if not entry.name:
                return err('Food name is required')
            entry.calories = float(d.get('calories') or 0)
            entry.protein = float(d.get('protein') or 0)
            entry.carbs = float(d.get('carbs') or 0)
            entry.fat = float(d.get('fat') or 0)
            entry.sugar = float(d.get('sugar') or 0)
            entry.time = time_val
        elif entry_type == 'water':
            entry.amount_ml = int(d['amount_ml'])
        elif entry_type == 'weight':
            weight = float(d['weight_kg'])
            if d.get('unit') == 'lbs':
                weight *= 0.453592
            entry.weight_kg = weight
        elif entry_type == 'steps':
            entry.steps = int(d['steps'])
        elif entry_type == 'sleep':
            sleep_time = datetime.strptime(d['sleep_time'], '%H:%M').time()
            wake_time = datetime.strptime(d['wake_time'], '%H:%M').time()
            start = datetime.combine(selected, sleep_time)
            end = datetime.combine(selected, wake_time)
            if end <= start:
                end += timedelta(days=1)
            entry.sleep_time = sleep_time
            entry.wake_time = wake_time
            entry.duration_hours = (end - start).total_seconds() / 3600
        elif entry_type == 'calories_burnt':
            entry.calories_burnt = int(d['calories_burnt'])
    except (KeyError, TypeError, ValueError):
        return err('Invalid entry data')

    db.session.commit()
    return ok(message='Updated')

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

# Friends

@api_bp.route('/friends')
@login_required
def friends_index():
    _ensure_friend_privacy(current_user.id)
    friendships = Friendship.query.filter(
        or_(Friendship.requester_id == current_user.id, Friendship.receiver_id == current_user.id),
        Friendship.status.in_(('pending', 'accepted')),
    ).order_by(Friendship.updated_at.desc(), Friendship.id.desc()).all()
    return ok(
        friends=[_serialize_friendship(f) for f in friendships if f.status == 'accepted'],
        incoming=[_serialize_friendship(f) for f in friendships if f.status == 'pending' and f.receiver_id == current_user.id],
        outgoing=[_serialize_friendship(f) for f in friendships if f.status == 'pending' and f.requester_id == current_user.id],
        privacy=_serialize_friend_privacy(_ensure_friend_privacy(current_user.id)),
    )

@api_bp.route('/friends/search')
@login_required
def friends_search():
    query = (request.args.get('q') or '').strip()
    if len(query) < 2:
        return ok(results=[])
    users = (User.query.filter(
        User.id != current_user.id,
        or_(
            User.username.ilike(f'%{query}%'),
            User.profile_name.ilike(f'%{query}%'),
            User.email.ilike(f'%{query}%'),
        )
    ).order_by(User.username.asc()).limit(12).all())
    results = []
    for user in users:
        friendship = _friendship_between(current_user.id, user.id)
        relation = None
        if friendship and friendship.status != 'declined':
            relation = dict(
                id=friendship.id,
                status=friendship.status,
                direction='outgoing' if friendship.requester_id == current_user.id else 'incoming',
            )
        results.append(dict(user=_public_user(user), relation=relation))
    return ok(results=results)

@api_bp.route('/friends/request', methods=['POST'])
@login_required
def create_friend_request():
    payload = request.get_json() or {}
    receiver_id = int(payload.get('user_id') or 0)
    if receiver_id == current_user.id:
        return err('You cannot add yourself as a friend')
    receiver = User.query.get(receiver_id)
    if not receiver:
        return err('User not found', 404)
    existing = _friendship_between(current_user.id, receiver_id)
    if existing:
        if existing.status == 'declined':
            existing.requester_id = current_user.id
            existing.receiver_id = receiver_id
            existing.status = 'pending'
            db.session.commit()
            return ok(friendship=_serialize_friendship(existing))
        return ok(friendship=_serialize_friendship(existing))
    friendship = Friendship(requester_id=current_user.id, receiver_id=receiver_id, status='pending')
    db.session.add(friendship)
    db.session.commit()
    return ok(friendship=_serialize_friendship(friendship)), 201

@api_bp.route('/friends/<int:friendship_id>/accept', methods=['POST'])
@login_required
def accept_friend_request(friendship_id):
    friendship = Friendship.query.get_or_404(friendship_id)
    if friendship.receiver_id != current_user.id:
        return err('Only the receiver can accept this request', 403)
    friendship.status = 'accepted'
    db.session.commit()
    return ok(friendship=_serialize_friendship(friendship))

@api_bp.route('/friends/<int:friendship_id>/decline', methods=['POST'])
@login_required
def decline_friend_request(friendship_id):
    friendship = Friendship.query.get_or_404(friendship_id)
    if friendship.receiver_id != current_user.id:
        return err('Only the receiver can decline this request', 403)
    friendship.status = 'declined'
    db.session.commit()
    return ok(message='Declined')

@api_bp.route('/friends/<int:friendship_id>', methods=['DELETE'])
@login_required
def remove_friendship(friendship_id):
    friendship = Friendship.query.get_or_404(friendship_id)
    if current_user.id not in (friendship.requester_id, friendship.receiver_id):
        return err('Unauthorized', 403)
    db.session.delete(friendship)
    db.session.commit()
    return ok(message='Removed')

@api_bp.route('/friends/activity')
@login_required
def friends_activity():
    selected = _parse_query_date()
    friendships = _accepted_friendships(current_user.id)
    friends = []
    for friendship in friendships:
        friend = friendship.receiver if friendship.requester_id == current_user.id else friendship.requester
        summary = _friend_metric_summary(friend, selected)
        summary['friendship_id'] = friendship.id
        friends.append(summary)
    return ok(date=selected.isoformat(), mine=_friend_metric_summary(current_user, selected), friends=friends)

@api_bp.route('/privacy/friends', methods=['GET'])
@login_required
def get_friend_privacy():
    return ok(_serialize_friend_privacy(_ensure_friend_privacy(current_user.id)))

@api_bp.route('/privacy/friends', methods=['PUT'])
@login_required
def update_friend_privacy():
    payload = request.get_json() or {}
    privacy = _ensure_friend_privacy(current_user.id)
    fields = {
        'show_calories', 'show_macros', 'show_water', 'show_steps',
        'show_sleep', 'show_active_calories', 'show_weight', 'show_food_names'
    }
    for field in fields:
        if field in payload:
            setattr(privacy, field, bool(payload[field]))
    db.session.commit()
    return ok(_serialize_friend_privacy(privacy))

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
