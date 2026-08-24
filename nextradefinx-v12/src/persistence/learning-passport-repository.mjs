function assertUserId(userId) {
  if (!userId || typeof userId !== 'string') throw new Error('user_id_required');
}

export class LearningPassportRepository {
  constructor(client) {
    if (!client?.from) throw new Error('supabase_like_client_required');
    this.client = client;
  }

  async getPassport(userId) {
    assertUserId(userId);
    const { data, error } = await this.client.from('learner_passports').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  async upsertPassport(userId, patch = {}) {
    assertUserId(userId);
    const safe = {
      user_id: userId,
      language_code: String(patch.language_code ?? 'en').slice(0, 12),
      experience_level: ['beginner','intermediate','experienced'].includes(patch.experience_level) ? patch.experience_level : 'beginner',
      learning_goal: String(patch.learning_goal ?? 'understand_markets').slice(0, 80),
      current_stage: Math.max(0, Math.min(5, Number.isFinite(Number(patch.current_stage)) ? Number(patch.current_stage) : 0))
    };
    const { data, error } = await this.client.from('learner_passports').upsert(safe, { onConflict: 'user_id' }).select('*').single();
    if (error) throw error;
    return data;
  }

  async appendLearningEvent(userId, eventType, payload = {}) {
    assertUserId(userId);
    const type = String(eventType ?? '').trim();
    if (!type || type.length > 64) throw new Error('invalid_event_type');
    const event = { user_id: userId, event_type: type, event_payload: payload };
    const { data, error } = await this.client.from('learning_events').insert(event).select('*').single();
    if (error) throw error;
    return data;
  }

  async saveReadinessSnapshot(userId, snapshot) {
    assertUserId(userId);
    const score = Number(snapshot?.readiness_score);
    if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error('invalid_readiness_score');
    const row = {
      user_id: userId,
      readiness_score: score,
      status: String(snapshot?.status ?? 'LEARNING_IN_PROGRESS').slice(0, 48),
      blockers: Array.isArray(snapshot?.blockers) ? snapshot.blockers.slice(0, 32) : [],
      legal_status: 'internal_educational_competency_only'
    };
    const { data, error } = await this.client.from('readiness_snapshots').insert(row).select('*').single();
    if (error) throw error;
    return data;
  }
}
