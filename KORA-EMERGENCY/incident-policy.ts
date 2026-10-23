export type KoraEmergencyStatus =
  | 'triggered' | 'verifying' | 'dispatching' | 'sent'
  | 'acknowledged' | 'confirmed' | 'resolved' | 'cancelled' | 'failed';

export interface KoraEmergencyIncident {
  incidentId: string;
  type: 'sos' | 'hijacking' | 'collision' | 'medical' | 'fire' | 'security' | 'hazard' | 'other';
  status: KoraEmergencyStatus;
  priority: 'urgent' | 'critical';
  responseChannelRefs?: string[];
  confirmationRef?: string;
}

export interface EmergencyDecision {
  responseActive: boolean;
  responderConfirmed: boolean;
  userConfirmationAllowed: boolean;
  reason: string;
}

/** Never equate a requested or sent alert with a confirmed emergency response. */
export function resolveEmergencyPolicy(incident: KoraEmergencyIncident): EmergencyDecision {
  if (incident.status === 'cancelled' || incident.status === 'failed') {
    return { responseActive: false, responderConfirmed: false, userConfirmationAllowed: false, reason: 'Emergency response is not active.' };
  }

  const responderConfirmed = incident.status === 'confirmed' && Boolean(incident.confirmationRef);
  const responseActive = ['triggered', 'verifying', 'dispatching', 'sent', 'acknowledged', 'confirmed'].includes(incident.status);

  return {
    responseActive,
    responderConfirmed,
    userConfirmationAllowed: responderConfirmed,
    reason: responderConfirmed
      ? 'Response confirmation is recorded.'
      : 'Emergency request is active but responder confirmation is not established.'
  };
}
