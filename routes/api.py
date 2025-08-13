"""
API routes for CipherH multi-platform integration
"""
from flask import Blueprint, request, jsonify
from app import db, socketio
from models import User, Interaction, PlatformConfig
from platform_adapters import platform_manager
import logging
from datetime import datetime

bp = Blueprint('api', __name__, url_prefix='/api')

@bp.route('/webhook/<platform>', methods=['POST'])
def platform_webhook(platform):
    """Generic webhook endpoint for all platforms"""
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data received'}), 400

        # Handle webhook through platform manager
        result = platform_manager.handle_webhook(platform, data)

        if result:
            # Extract message data (this would be platform-specific)
            # For now, we'll use a generic structure

            # TODO: Implement platform-specific webhook parsing
            # This is a placeholder structure

            logging.info(f"CipherH: Processed webhook from {platform}")
            return jsonify({'status': 'processed', 'result': result})
        else:
            return jsonify({'error': f'Platform {platform} not supported'}), 400

    except Exception as e:
        logging.error(f"Webhook processing error for {platform}: {e}")
        return jsonify({'error': 'Webhook processing failed'}), 500

@bp.route('/platforms', methods=['GET'])
def get_platforms():
    """Get all available platforms and their status"""
    try:
        platforms = platform_manager.get_all_statuses()

        # Add database info for each platform
        for platform_name, status in platforms.items():
            config = PlatformConfig.query.filter_by(platform_name=platform_name).first()
            if config:
                status['configured'] = True
                status['webhook_url'] = config.webhook_url
                status['last_sync'] = config.last_sync.isoformat() if config.last_sync else None
            else:
                status['configured'] = False

        return jsonify(platforms)

    except Exception as e:
        logging.error(f"Get platforms error: {e}")
        return jsonify({'error': 'Failed to get platforms'}), 500

@bp.route('/platforms/<platform_name>/send', methods=['POST'])
def send_platform_message(platform_name):
    """Send message through specific platform"""
    try:
        data = request.get_json()

        if not data or 'recipient_id' not in data or 'message' not in data:
            return jsonify({'error': 'recipient_id and message are required'}), 400

        recipient_id = data['recipient_id']
        message = data['message']
        context = data.get('context')

        # Send through platform manager
        result = platform_manager.send_message(platform_name, recipient_id, message, context)

        if result:
            return jsonify({
                'status': 'sent',
                'platform': platform_name,
                'result': result
            })
        else:
            return jsonify({'error': f'Failed to send message via {platform_name}'}), 500

    except Exception as e:
        logging.error(f"Send message error for {platform_name}: {e}")
        return jsonify({'error': 'Message sending failed'}), 500

@bp.route('/conversation', methods=['POST'])
def process_conversation():
    """Process a conversation message from any platform"""
    try:
        data = request.get_json()

        required_fields = ['message', 'user_id', 'platform']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'message, user_id, and platform are required'}), 400

        message = data['message']
        user_id = data['user_id']
        platform = data['platform']

        # Find or create user
        user = User.query.filter_by(platform_id=user_id, platform_type=platform).first()
        if not user:
            user = User(
                platform_id=user_id,
                platform_type=platform,
                username=data.get('username', user_id),
                display_name=data.get('display_name', user_id)
            )
            db.session.add(user)
            db.session.commit()

        # Update user activity
        user.last_interaction = datetime.utcnow()
        user.interaction_count += 1

        # Process message through CipherH
        cipher_response = process_cipher_message(message, platform, user_id)

        # Store interaction
        interaction = Interaction(
            user_id=user.id,
            platform=platform,
            message=message,
            cipher_response=cipher_response
        )
        db.session.add(interaction)
        db.session.commit()

        # Emit real-time update
        socketio.emit('new_interaction', {
            'platform': platform,
            'user': user_id,
            'message': message[:100] + '...' if len(message) > 100 else message,
            'timestamp': datetime.now().isoformat()
        })

        return jsonify({
            'response': cipher_response,
            'user_id': user_id,
            'platform': platform,
            'interaction_id': interaction.id
        })

    except Exception as e:
        logging.error(f"Conversation processing error: {e}")
        db.session.rollback()
        return jsonify({'error': 'Conversation processing failed'}), 500

@bp.route('/users/<platform>/<user_id>/history', methods=['GET'])
def get_user_history(platform, user_id):
    """Get conversation history for a specific user"""
    try:
        user = User.query.filter_by(platform_id=user_id, platform_type=platform).first()

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Get recent interactions
        limit = request.args.get('limit', 10, type=int)
        interactions = Interaction.query.filter_by(user_id=user.id)\
                                       .order_by(Interaction.timestamp.desc())\
                                       .limit(limit).all()

        history = []
        for interaction in interactions:
            history.append({
                'id': interaction.id,
                'message': interaction.message,
                'cipher_response': interaction.cipher_response,
                'timestamp': interaction.timestamp.isoformat(),
                'sentiment_score': interaction.sentiment_score,
                'context_tags': interaction.context_tags.split(',') if interaction.context_tags else []
            })

        return jsonify({
            'user': {
                'id': user.id,
                'platform_id': user.platform_id,
                'platform_type': user.platform_type,
                'username': user.username,
                'interaction_count': user.interaction_count,
                'last_interaction': user.last_interaction.isoformat() if user.last_interaction else None
            },
            'history': history
        })

    except Exception as e:
        logging.error(f"Get user history error: {e}")
        return jsonify({'error': 'Failed to get user history'}), 500

@bp.route('/analytics/summary', methods=['GET'])
def get_analytics_summary():
    """Get analytics summary for CipherH's performance"""
    try:
        from sqlalchemy import func
        from datetime import datetime, timedelta

        # Get date range
        days = request.args.get('days', 7, type=int)
        since_date = datetime.utcnow() - timedelta(days=days)

        # Total interactions
        total_interactions = Interaction.query.filter(
            Interaction.timestamp >= since_date
        ).count()

        # Active users
        active_users = User.query.filter(
            User.last_interaction >= since_date
        ).count()

        # Platform distribution
        platform_stats = db.session.query(
            Interaction.platform,
            func.count(Interaction.id).label('count')
        ).filter(
            Interaction.timestamp >= since_date
        ).group_by(Interaction.platform).all()

        # Sentiment distribution (if available)
        sentiment_stats = db.session.query(
            func.avg(Interaction.sentiment_score).label('avg_sentiment'),
            func.count(Interaction.id).label('total_with_sentiment')
        ).filter(
            Interaction.timestamp >= since_date,
            Interaction.sentiment_score.isnot(None)
        ).first()

        return jsonify({
            'period_days': days,
            'total_interactions': total_interactions,
            'active_users': active_users,
            'platform_distribution': [
                {'platform': stat.platform, 'count': stat.count}
                for stat in platform_stats
            ],
            'average_sentiment': float(sentiment_stats.avg_sentiment) if sentiment_stats.avg_sentiment else None,
            'interactions_with_sentiment': sentiment_stats.total_with_sentiment if sentiment_stats.total_with_sentiment else 0
        })

    except Exception as e:
        logging.error(f"Analytics summary error: {e}")
        return jsonify({'error': 'Failed to get analytics summary'}), 500

@bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        from app import cipher_personality, notion_vault, openai_brain

        health_status = {
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'components': {
                'database': 'healthy',
                'cipher_personality': 'healthy' if cipher_personality else 'unhealthy',
                'notion_vault': 'healthy' if notion_vault.client else 'limited',
                'openai_brain': 'healthy' if openai_brain.client else 'limited'
            }
        }

        # Test database connection
        try:
            db.session.execute('SELECT 1')
        except:
            health_status['components']['database'] = 'unhealthy'
            health_status['status'] = 'degraded'

        return jsonify(health_status)

    except Exception as e:
        logging.error(f"Health check error: {e}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 500
