from flask import Blueprint, jsonify, request

api_bp = Blueprint('api', __name__, url_prefix='/api')

@api_bp.route('/ping')
def ping():
    return jsonify({'status': 'ok', 'message': 'API running'})

# Example chatbot endpoint (future use)
@api_bp.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_message = data.get('message')
    # Future logic: parse and log automatically
    return jsonify({'reply': f"You said: {user_message}"})
