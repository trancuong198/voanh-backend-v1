"""
Admin routes for CipherH monitoring and management
Vô Ảnh – CipherH Admin Panel
"""

from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for
from datetime import datetime, timedelta
import logging

# ==============================
# Database & Models
# ==============================
try:
    from app import db
    from models import User, Interaction, Memory, PlatformConfig
except ImportError:
    from extensions import db  # fallback nếu chạy độc lập
    from models import User, Interaction, Memory, PlatformConfig

bp = Blueprint('admin', __name__, url_prefix='/admin')
logger = logging.getLogger('cipherh_admin')
logger.setLevel(logging.INFO)


# ==============================
# Dashboard
# ==============================
@bp.route('/')
def dashboard():
    """Admin dashboard"""
    try:
        total_users = User.query.count()
        total_interactions = Interaction.query.count()
        total_memories = Memory.query.count()

        yesterday = datetime.utcnow() - timedelta(days=1)
        recent_interactions = Interaction.query.filter(
            Interaction.timestamp >= yesterday
        ).count()
        recent_users = User.query.filter(
            User.last_interaction >= yesterday
        ).count()

        from sqlalchemy import func
        platform_stats = db.session.query(
            Interaction.platform,
            func.count(Interaction.id).label('count')
        ).group_by(Interaction.platform).all()

        stats = {
            'total_users': total_users,
            'total_interactions': total_interactions,
            'total_memories': total_memories,
            'recent_interactions': recent_interactions,
            'recent_users': recent_users,
            'platform_stats': [
                {'platform': stat.platform, 'count': stat.count}
                for stat in platform_stats
            ]
        }

        return render_template('admin.html', stats=stats)

    except Exception as e:
        logger.error(f"Admin dashboard error: {e}")
        return render_template('admin.html', error=str(e))


# ==============================
# Interactions View
# ==============================
@bp.route('/interactions')
def interactions():
    """View recent interactions"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 50
        interactions = Interaction.query.join(User).order_by(
            Interaction.timestamp.desc()
        ).paginate(page=page, per_page=per_page, error_out=False)

        return render_template(
            'admin.html', view='interactions', interactions=interactions
        )

    except Exception as e:
        logger.error(f"Admin interactions error: {e}")
        return render_template('admin.html', error=str(e))


# ==============================
# Users View
# ==============================
@bp.route('/users')
def users():
    """View user list"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 50
        users = User.query.order_by(
            User.last_interaction.desc()
        ).paginate(page=page, per_page=per_page, error_out=False)

        return render_template('admin.html', view='users', users=users)

    except Exception as e:
        logger.error(f"Admin users error: {e}")
        return render_template('admin.html', error=str(e))


# ==============================
# Memories View
# ==============================
@bp.route('/memories')
def memories():
    """View CipherH's memories"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 50
        memories = Memory.query.order_by(
            Memory.created_at.desc()
        ).paginate(page=page, per_page=per_page, error_out=False)

        return render_template('admin.html', view='memories', memories=memories)

    except Exception as e:
        logger.error(f"Admin memories error: {e}")
        return render_template('admin.html', error=str(e))


# ==============================
# Platforms View
# ==============================
@bp.route('/platforms')
def platforms():
    """Manage platform configurations"""
    try:
        from platform_adapters import platform_manager

        platform_statuses = platform_manager.get_all_statuses()
        configs = PlatformConfig.query.all()
        config_dict = {config.platform_name: config for config in configs}

        for platform_name, status in platform_statuses.items():
            if platform_name in config_dict:
                config = config_dict[platform_name]
                status.update({
                    'configured': True,
                    'active_db': config.active,
                    'webhook_url': config.webhook_url,
                    'last_sync': config.last_sync.isoformat() if config.last_sync else None
                })
            else:
                status['configured'] = False

        return render_template('admin.html', view='platforms', platforms=platform_statuses)

    except Exception as e:
        logger.error(f"Admin platforms error: {e}")
        return render_template('admin.html', error=str(e))


# ==============================
# Platform Toggle API
# ==============================
@bp.route('/api/platform/<platform_name>/toggle', methods=['POST'])
def toggle_platform(platform_name):
    """Toggle platform active status"""
    try:
        config = PlatformConfig.query.filter_by(platform_name=platform_name).first()

        if not config:
            config = PlatformConfig(platform_name=platform_name, active=True)
            db.session.add(config)
        else:
            config.active = not config.active

        config.last_sync = datetime.utcnow()
        db.session.commit()

        return jsonify({'status': 'success', 'platform': platform_name, 'active': config.active})

    except Exception as e:
        logger.error(f"Toggle platform error: {e}")
        return jsonify({'error': str(e)}), 500


# ==============================
# Memory Create API
# ==============================
@bp.route('/api/memory/create', methods=['POST'])
def create_memory():
    """Manually create a memory entry"""
    try:
        data = request.get_json()
        if not data or 'content' not in data:
            return jsonify({'error': 'Content is required'}), 400

        memory = Memory(
            memory_type=data.get('memory_type', 'manual'),
            content=data['content'],
            confidence=data.get('confidence', 1.0)
        )
        db.session.add(memory)
        db.session.commit()

        # Store to Notion if available
        from app import notion_vault
        notion_id = notion_vault.store_insight(
            data['content'], memory.confidence, memory.memory_type
        )
        if notion_id:
            memory.notion_id = notion_id
            db.session.commit()

        return jsonify({
            'status': 'success',
            'memory_id': memory.id,
            'notion_id': notion_id
        })

    except Exception as e:
        logger.error(f"Create memory error: {e}")
        return jsonify({'error': str(e)}), 500


# ==============================
# System Status API
# ==============================
@bp.route('/api/system/status')
def system_status():
    """Get detailed system status for admin monitoring"""
    try:
        from app import cipher_personality, notion_vault, openai_brain
        from platform_adapters import platform_manager

        db_stats = {
            'users': User.query.count(),
            'interactions': Interaction.query.count(),
            'memories': Memory.query.count(),
            'platform_configs': PlatformConfig.query.count()
        }

        yesterday = datetime.utcnow() - timedelta(days=1)
        recent_stats = {
            'interactions_24h': Interaction.query.filter(
                Interaction.timestamp >= yesterday
            ).count(),
            'active_users_24h': User.query.filter(
                User.last_interaction >= yesterday
            ).count()
        }

        status = {
            'timestamp': datetime.utcnow().isoformat(),
            'cipher_personality': {
                'name': cipher_personality.real_name,
                'birth_date': cipher_personality.birth_date,
                'active': True
            },
            'notion_vault': notion_vault.get_vault_status(),
            'openai_brain': openai_brain.get_brain_status(),
            'platforms': platform_manager.get_all_statuses(),
            'database': db_stats,
            'recent_activity': recent_stats
        }

        return jsonify(status)

    except Exception as e:
        logger.error(f"System status error: {e}")
        return jsonify({'error': str(e)}), 500


# ==============================
# Vault Sync API
# ==============================
@bp.route('/api/vault/sync', methods=['POST'])
def sync_vault():
    """Manually trigger vault synchronization"""
    try:
        from app import notion_vault
        notion_vault.update_memory_index()
        return jsonify({'status': 'success', 'message': 'Vault synchronization completed'})

    except Exception as e:
        logger.error(f"Vault sync error: {e}")
        return jsonify({'error': str(e)}), 500


# ==============================
# Analytics Export API
# ==============================
@bp.route('/api/analytics/export')
def export_analytics():
    """Export analytics data"""
    try:
        days = request.args.get('days', 30, type=int)
        since_date = datetime.utcnow() - timedelta(days=days)

        interactions = db.session.query(Interaction, User).join(User).filter(
            Interaction.timestamp >= since_date
        ).order_by(Interaction.timestamp.desc()).all()

        export_data = [{
            'timestamp': i.timestamp.isoformat(),
            'platform': i.platform,
            'user_id': u.platform_id,
            'username': u.username,
            'message_length': len(i.message),
            'response_length': len(i.cipher_response),
            'sentiment_score': i.sentiment_score,
            'context_tags': i.context_tags
        } for i, u in interactions]

        return jsonify({
            'period_days': days,
            'total_records': len(export_data),
            'data': export_data
        })

    except Exception as e:
        logger.error(f"Analytics export error: {e}")
        return jsonify({'error': str(e)}), 500
