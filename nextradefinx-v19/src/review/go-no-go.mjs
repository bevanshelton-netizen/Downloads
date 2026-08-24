const BLOCKING=new Set(['privacy_breach','cross_user_access','auth_bypass','secret_exposure','consent_integrity_failure']);
export function evaluateBetaReview(i={}){
  const blockers=[],warnings=[],inc=Array.isArray(i.incidents)?i.incidents:[];
  if(inc.some(x=>BLOCKING.has(x.type)&&x.status!=='resolved')) blockers.push('unresolved_blocking_incident');
  if(!i.rlsIsolationPassed) blockers.push('rls_isolation_not_proven');
  if(!i.consentAuditPassed) blockers.push('consent_audit_failed');
  if(!i.authPersistencePassed) blockers.push('auth_or_persistence_failed');
  if(!i.deletionFlowPassed) blockers.push('deletion_flow_failed');
  const invited=Number(i.invitedLearners||0),activated=Number(i.activatedLearners||0),completed=Number(i.completedFirstSession||0);
  if(activated>invited) blockers.push('activated_exceeds_invited');
  if(completed>activated) blockers.push('session_completion_exceeds_activated');
  const rate=activated?completed/activated:0;
  if(activated&&rate<.8) warnings.push('first_session_completion_below_80pct');
  if(Number(i.openSupportIssues||0)>2) warnings.push('support_load_high');
  if(Number(i.openCriticalBugs||0)>0) blockers.push('critical_bug_open');
  if(Number(i.openMediumBugs||0)>3) warnings.push('medium_bug_backlog_high');
  const go=blockers.length===0;
  return {decision:go?(warnings.length?'HOLD_AND_REVIEW':'GO_NEXT_COHORT'):'STOP_AND_FIX',blockers,warnings,metrics:{invited,activated,completedFirstSession:completed,completionRate:Number(rate.toFixed(4))},expansionCap:go&&!warnings.length?Math.min(Math.max(activated*2,1),10):activated};
}
export function privacySafeBetaMetrics(events=[]){
  const allowed=new Set(['invite_sent','account_verified','consent_complete','learning_passport_created','lesson_completed','paper_session_completed','journal_completed','no_trade_decision','logout_login_persistence_passed','deletion_request_tested']);
  const counts={}; for(const e of events){if(allowed.has(e?.type)) counts[e.type]=(counts[e.type]||0)+1;} return counts;
}
