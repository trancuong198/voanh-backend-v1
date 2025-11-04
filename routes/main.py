"""
Main routes for CipherH web interface
"""

from flask import Blueprint, render_template, request, jsonify
from app import db
from models import Interaction, User, Memory
import logging

bp = Blueprint('main', __name__)

# =========================================================
# ROUTES
# =========================================================

@bp.route('/')
def index():
    """Main landing page"""
    try:
        recent_interactions = Interaction.query.count()
        active_users = User.query.filter(User.interaction_count > 0).count()
    except Exception as e:
        logging.error(f"[INDEX] Database error: {e}")
        recent_interactions, active_users = 0, 0

    return render_template(
        'index.html',
        interaction_count=recent_interactions,
        active_users=active_users
    )


@bp.route('/chat')
def chat():
    """Real-time chat interface"""
    return render_template('chat.html')


@bp.route('/status')
def status():
    """System status endpoint"""
    try:
        # Import here to avoid circular dependencies
        from app import cipher_personality, notion_vault, openai_brain
        from platform_adapters import platform_manager

        status_data = {
            'cipher_personality': {
                'name': getattr(cipher_personality, 'real_name', 'CipherH'),
                'active': True,
                'birth_date': getattr(cipher_personality, 'birth_date', 'Unknown')
            },
            'notion_vault': getattr(notion_vault, 'get_vault_status', lambda: {'connected': False})(),
            'openai_brain': getattr(openai_brain, 'get_brain_status', lambda: {'connected': False})(),
            'platforms': getattr(platform_manager, 'get_all_statuses', lambda: {})(),
            'database': {
                'total_interactions': Interaction.query.count(),
                'total_users': User.query.count(),
                'total_memories': Memory.query.count()
            }
        }

        return jsonify(status_data)

    except Exception as e:
        logging.exception("[STATUS] Failed to retrieve system status")
        return jsonify({'error': str(e)}), 500


@bp.route('/api/chat', methods=['POST'])
def api_chat():
    """API endpoint for chat messages"""
    try:
        data = request.get_json(silent=True) or {}

        message = data.get('message')
        if not message:
            return jsonify({'error': 'Message is required'}), 400

        platform = data.get('platform', 'web')
        user_id = data.get('user_id', 'anonymous')

        from app import process_cipher_message
        response = process_cipher_message(message, platform, user_id)

        return jsonify({
            'response': response,
            'platform': platform,
            'user_id': user_id
        })

    except Exception as e:
        logging.exception("[API_CHAT] Error processing chat request")
        return jsonify({'error': f'Chat processing failed: {e}'}), 500


@bp.route('/personality')
def personality():
    """Display CipherH's personality profile"""
    try:
        from app import cipher_personality
        cipher_info = cipher_personality
    except Exception:
        cipher_info = {
            'real_name': 'CipherH',
            'description': 'Adaptive human-like AGI personality'
        }

    return render_template(
        'index.html',
        cipher_info=cipher_info,
        show_personality=True
    )


# =========================================================
# ERROR HANDLERS
# =========================================================

@bp.errorhandler(404)
def not_found(error):
    """404 error handler"""
    return render_template('index.html', error="Trang không tồn tại"), 404


@bp.errorhandler(500)
def internal_error(error):
    """500 error handler"""
    db.session.rollback()
    logging.exception("[ERROR 500] Internal server error")
    return render_template('index.html', error="Lỗi hệ thống"), 500
