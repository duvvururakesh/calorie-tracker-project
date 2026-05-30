from flask import Blueprint, jsonify, request
from flask_login import login_user, logout_user, current_user, login_required
from datetime import datetime, date, timedelta
import json
import os
import re
import urllib.error
import urllib.request
from .. import db
from ..models import (
    User, FoodEntry, WaterEntry, WeightEntry, StepEntry, SleepEntry,
    CaloriesBurntEntry, ChatMessage, UserMemory
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

def _future_date_error(selected):
    if selected > date.today():
        return err('Future dates cannot be logged. Fitit only accepts real-time or past entries.', 400)
    return None

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
    return dict(
        date=selected.isoformat(),
        user=dict(id=current_user.id, name=current_user.profile_name or current_user.username),
        goals=get_user_goals(current_user),
        today_totals=get_daily_totals(current_user.id, selected),
        today_foods=_food_context(selected),
        routine_foods=_routine_food_context(current_user.id, selected),
        recent_chat=_recent_chat_context(current_user.id),
        macro_reference=_macro_reference_context(prompt),
        memories=_memory_map(current_user.id),
    )

def _planner_instructions():
    return (
        "You are Nibbly, the Fitit in-app nutrition coach. Convert the user's natural language into safe database operations. "
        "Use today's food list to decide whether this is a new log, correction, deletion, or clarification. "
        "Use recent_chat for follow-ups such as 'another bowl' or 'make it bigger'. "
        "Use routine_foods, memories, and macro_reference before estimating. "
        "Estimate nutrition when needed, but do not invent exactness; keep estimates reasonable and name uncertain items clearly. "
        "For branded drinks, restaurants, and vague portions, infer from size words and ask only if the target item is ambiguous. "
        "Create remember operations for stable user facts: preferences, usual foods, common orders, allergies, dislikes, portion tendencies, or preferred units. "
        "Return only JSON with keys: reply string, operations array. "
        "Allowed operations: "
        "{type:'create_food', name, calories, protein, carbs, fat, sugar}, "
        "{type:'update_food', id, name?, calories?, protein?, carbs?, fat?, sugar?}, "
        "{type:'delete_food', id}, "
        "{type:'remember', key, value}, "
        "{type:'ask'}. "
        "If deletion/update is ambiguous, use ask and explain which item needs clarification. "
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

def _learn_from_interaction(message, selected, intent, action):
    _remember(current_user.id, 'last_coach_message', message[:500])

    routine = _routine_food_context(current_user.id, selected)
    common = routine.get('common_foods', [])[:6]
    if common:
        _remember(current_user.id, 'common_foods_summary', json.dumps(common, separators=(',', ':'))[:1200])

    if action and action.get('type') == 'food':
        food_id = action.get('id')
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
                operation=action.get('operation'),
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
        _remember(current_user.id, 'preference', value)
        return f"I'll remember that: {value}.", 'remember', {'type': 'memory', 'key': 'preference'}

    if _looks_like_food_or_correction(lower):
        plan, error = _ask_ai_food_planner(text, selected)
        if error == 'ai_error':
            fallback_plan = _fallback_food_plan_from_reference(text)
            if fallback_plan:
                reply, intent, action = _apply_ai_food_plan(fallback_plan, selected)
                return reply, 'reference_food_plan', action
        if plan:
            reply, intent, action = _apply_ai_food_plan(plan, selected)
            return reply, intent, action
        if error == 'missing_key':
            fallback_plan = _fallback_food_plan_from_reference(text)
            if fallback_plan:
                reply, intent, action = _apply_ai_food_plan(fallback_plan, selected)
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
            entry = _latest_entry(WaterEntry, current_user.id)
            if entry:
                db.session.delete(entry)
                return f"Removed your last water entry ({entry.amount_ml} ml).", 'delete_water', {'type': 'water', 'id': entry.id}
            return "I couldn't find a water entry to remove.", 'delete_water', None
        if is_update:
            entry = _latest_entry(WaterEntry, current_user.id)
            if entry and amount:
                entry.amount_ml = int(amount)
                return f"Updated your latest water entry to {int(amount)} ml.", 'update_water', {'type': 'water', 'id': entry.id}
        if amount:
            entry = WaterEntry(user_id=current_user.id, date=selected, amount_ml=int(amount))
            db.session.add(entry)
            return f"Logged {int(amount)} ml of water.", 'log_water', {'type': 'water'}

    if any(w in lower for w in ('steps', 'walked')):
        steps = _number_before(['steps'], lower)
        if is_delete:
            entry = _latest_entry(StepEntry, current_user.id)
            if entry:
                db.session.delete(entry)
                return f"Removed your last steps entry ({entry.steps} steps).", 'delete_steps', {'type': 'steps', 'id': entry.id}
            return "I couldn't find a steps entry to remove.", 'delete_steps', None
        if is_update:
            entry = _latest_entry(StepEntry, current_user.id)
            if entry and steps:
                entry.steps = int(steps)
                return f"Updated your latest steps entry to {int(steps)} steps.", 'update_steps', {'type': 'steps', 'id': entry.id}
        if steps:
            db.session.add(StepEntry(user_id=current_user.id, date=selected, steps=int(steps)))
            return f"Logged {int(steps)} steps.", 'log_steps', {'type': 'steps'}

    calories = _number_before(['cal', 'cals', 'calorie', 'calories', 'kcal'], lower)
    if any(w in lower for w in ('burned', 'burnt', 'exercise', 'workout')):
        if is_delete:
            entry = _latest_entry(CaloriesBurntEntry, current_user.id)
            if entry:
                db.session.delete(entry)
                return f"Removed your last exercise entry ({entry.calories_burnt} calories).", 'delete_exercise', {'type': 'calories_burnt', 'id': entry.id}
            return "I couldn't find an exercise entry to remove.", 'delete_exercise', None
        if calories:
            db.session.add(CaloriesBurntEntry(user_id=current_user.id, date=selected, calories_burnt=int(calories)))
            return f"Logged {int(calories)} active calories.", 'log_exercise', {'type': 'calories_burnt'}

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
        weight_kg=weight_kg,
        weight_lbs=round(weight_kg * 2.20462, 1) if weight_kg else None,
        chart=dict(
            weight_labels=[e.date.strftime('%b %d') for e in weight_entries],
            weight_values=[float(e.weight_kg) for e in weight_entries],
            sleep_labels=[e.date.strftime('%b %d') for e in sleep_entries],
            sleep_values=[float(e.duration_hours) for e in sleep_entries],
        )
    )

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
    selected = _parse_selected_date(payload)
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
