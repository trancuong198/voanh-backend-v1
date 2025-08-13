"""
Admin routes for CipherH monitoring and management
"""
from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for
from app import db
from models import User, Interaction, Memory, PlatformConfig
from datetime import datetime, timedelta
import logging

bp = Blueprint('admin', __name__, url_prefix='/admin')

@bp.route('/')
def dashboard():
    """Admin dashboard"""
    try:
        # Get summary statistics
        total_users = User.query.count()
        total_interactions = Interaction.query.count()
        total_memories = Memory.query.count()
        
        # Recent activity (last 24 hours)
        yesterday = datetime.utcnow() - timedelta(days=1)
        recent_interactions = Interaction.query.filter(
            Interaction.timestamp >= yesterday
        ).count()
        
        recent_users = User.query.filter(
            User.last_interaction >= yesterday
        ).count()
        
        # Platform breakdown
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
        logging.error(f"Admin dashboard error: {e}")
        return render_template('admin.html', error=str(e))

@bp.route('/interactions')
def interactions():
    """View recent interactions"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 50
        
        interactions = Interaction.query\
            .join(User)\
            .order_by(Interaction.timestamp.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        return render_template('admin.html', 
                             view='interactions',
                             interactions=interactions)
        
    except Exception as e:
        logging.error(f"Admin interactions error: {e}")
        return render_template('admin.html', error=str(e))

@bp.route('/users')
def users():
    """View user list"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 50
        
        users = User.query\
            .order_by(User.last_interaction.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        return render_template('admin.html',
                             view='users', 
                             users=users)
        
    except Exception as e:
        logging.error(f"Admin users error: {e}")
        return render_template('admin.html', error=str(e))

@bp.route('/memories')
def memories():
    """View CipherH's memories"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 50
        
        memories = Memory.query\
            .order_by(Memory.created_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        return render_template('admin.html',
                             view='memories',
                             memories=memories)
        
    except Exception as e:
        logging.error(f"Admin memories error: {e}")
        return render_template('admin.html', error=str(e))

@bp.route('/platforms')
def platforms():
    """Manage platform configurations"""
    try:
        from platform_adapters import platform_manager
        
        # Get platform statuses
        platform_statuses = platform_manager.get_all_statuses()
        
        # Get database configs
        configs = PlatformConfig.query.all()
        config_dict = {config.platform_name: config for config in configs}
        
        # Combine status and config data
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
        
        return render_template('admin.html',
                             view='platforms',
                             platforms=platform_statuses)
        
    except Exception as e:
        logging.error(f"Admin platforms error: {e}")
        return render_template('admin.html', error=str(e))

@bp.route('/api/platform/<platform_name>/toggle', methods=['POST'])
def toggle_platform(platform_name):
    """Toggle platform active status"""
    try:
        config = PlatformConfig.query.filter_by(platform_name=platform_name).first()
        
        if not config:
            # Create new config
            config = PlatformConfig(
                platform_name=platform_name,
                active=True
            )
            db.session.add(config)
        else:
            config.active = not config.active
        
        config.last_sync = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'platform': platform_name,
            'active': config.active
        })
        
    except Exception as e:
        logging.error(f"Toggle platform error: {e}")
        return jsonify({'error': str(e)}), 500

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
        
        # Also store in Notion if available
        from app import notion_vault
        notion_id = notion_vault.store_insight(
            data['content'],
            memory.confidence,
            memory.memory_type
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
        logging.error(f"Create memory error: {e}")
        return jsonify({'error': str(e)}), 500

@bp.route('/api/system/status')
def system_status():
    """Get detailed system status for admin monitoring"""
    try:
        from app import cipher_personality, notion_vault, openai_brain
        from platform_adapters import platform_manager
        
        # Database stats
        db_stats = {
            'users': User.query.count(),
            'interactions': Interaction.query.count(),
            'memories': Memory.query.count(),
            'platform_configs': PlatformConfig.query.count()
        }
        
        # Recent activity
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
        logging.error(f"System status error: {e}")
        return jsonify({'error': str(e)}), 500

@bp.route('/api/vault/sync', methods=['POST'])
def sync_vault():
    """Manually trigger vault synchronization"""
    try:
        from app import notion_vault
        
        notion_vault.update_memory_index()
        
        return jsonify({
            'status': 'success',
            'message': 'Vault synchronization completed'
        })
        
    except Exception as e:
        logging.error(f"Vault sync error: {e}")
        return jsonify({'error': str(e)}), 500

@bp.route('/api/analytics/export')
def export_analytics():
    """Export analytics data"""
    try:
        # Get date range
        days = request.args.get('days', 30, type=int)
        since_date = datetime.utcnow() - timedelta(days=days)
        
        # Get interactions with users
        interactions = db.session.query(Interaction, User)\
            .join(User)\
            .filter(Interaction.timestamp >= since_date)\
            .order_by(Interaction.timestamp.desc())\
            .all()
        
        export_data = []
        for interaction, user in interactions:
            export_data.append({
                'timestamp': interaction.timestamp.isoformat(),
                'platform': interaction.platform,
                'user_id': user.platform_id,
                'username': user.username,
                'message_length': len(interaction.message),
                'response_length': len(interaction.cipher_response),
                'sentiment_score': interaction.sentiment_score,
                'context_tags': interaction.context_tags
            })
        
        return jsonify({
            'period_days': days,
            'total_records': len(export_data),
            'data': export_data
        })
        
    except Exception as e:
        logging.error(f"Analytics export error: {e}")
        return jsonify({'error': str(e)}), 500
