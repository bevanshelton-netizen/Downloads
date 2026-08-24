export function buildDeletionRequest({ userId, reason = null, requestedAt = new Date() }) {
  if (!userId) throw new Error('user_id_required');
  return {
    user_id: String(userId),
    reason: reason == null ? null : String(reason).slice(0, 240),
    requested_at: new Date(requestedAt).toISOString(),
    status: 'REQUESTED',
    server_only_auth_deletion_required: true,
    client_can_delete_auth_user_directly: false
  };
}

export function deletionExecutionBoundary() {
  return Object.freeze({
    educational_rows: ['learner_passports','learning_events','readiness_snapshots','consent_receipts','deletion_requests'],
    auth_user_deletion: 'server_admin_only',
    brokerage_data: 'not_present_in_v13',
    client_funds: 'not_present_in_v13'
  });
}
