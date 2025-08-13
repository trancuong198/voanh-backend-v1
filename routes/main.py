"""
Main routes for CipherH web interface
"""
from flask import Blueprint, render_template, request, jsonify, redirect, url_for
from app import db
from models import Interaction, User, Memory
import logging

bp = Blueprint('main', __name__)


@bp.route('/')
def index():
    """Main landing page"""
    # Get recent interaction count for display
    recent_interactions = Interaction.query.count()
    active_users = User.query.filter(User.interaction_count > 0).count()

    return render_template('index.html',
                           interaction_count=recent_interactions,
                           active_users=active_users)


@bp.route('/chat')
def chat():
    """Real-time chat interface"""
    return render_template('chat.html')


@bp.route('/status')
def status():
    """System status endpoint"""
    from app import cipher_personality, notion_vault, openai_brain
    from platform_adapters import platform_manager

    try:
        status_data = {
            'cipher_personality': {
                'name': cipher_personality.real_name,
                'active': True,
                'birth_date': cipher_personality.birth_date
            },
            'notion_vault': notion_vault.get_vault_status(),
            'openai_brain': openai_brain.get_brain_status(),
            'platforms': platform_manager.get_all_statuses(),
            'database': {
                'total_interactions': Interaction.query.count(),
                'total_users': User.query.count(),
                'total_memories': Memory.query.count()
            }
        }

        return jsonify(status_data)

    except Exception as e:
        logging.error(f"Status check failed: {e}")
        return jsonify({'error': 'Status check failed'}), 500


@bp.route('/api/chat', methods=['POST'])
def api_chat():
    """API endpoint for chat messages"""
    try:
        data = request.get_json()

        if not data or 'message' not in data:
            return jsonify({'error': 'Message is required'}), 400

        message = data.get('message')
        platform = data.get('platform', 'web')
        user_id = data.get('user_id', 'anonymous')

        # Import here to avoid circular import
        from app import process_cipher_message

        # Process through CipherH
        response = process_cipher_message(message, platform, user_id)

        return jsonify({
            'response': response,
            'platform': platform,
            'user_id': user_id
        })

    except Exception as e:
        logging.error(f"API chat error: {e}")
        return jsonify({'error': 'Chat processing failed'}), 500


@bp.route('/personality')
def personality():
    """Display CipherH's personality profile"""
    from app import cipher_personality

    return render_template('index.html',
                           cipher_info=cipher_personality,
                           show_personality=True)


@bp.errorhandler(404)
def not_found(error):
    """404 error handler"""
    return render_template('index.html', error="Trang không tồn tại"), 404


@bp.errorhandler(500)
def internal_error(error):
    """500 error handler"""
    db.session.rollback()
    return render_template('index.html', error="Lỗi hệ thống"), 500
