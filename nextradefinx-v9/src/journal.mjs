export function createPreTradeJournal({symbol, thesis, invalidation, risk_pct, emotion='calm'}) {
  if (!symbol || !thesis || !invalidation) throw new Error('journal_fields_required');
  const risk=Number(risk_pct);
  if (!(risk>0 && risk<=1)) throw new Error('practice_risk_must_be_between_0_and_1_percent');
  return {type:'PRE_TRADE',timestamp:new Date().toISOString(),symbol,thesis,invalidation,risk_pct:risk,emotion,practice_only:true};
}

export function closeJournal(pre,{result,lesson,followed_plan}) {
  if (!pre || pre.type!=='PRE_TRADE') throw new Error('pre_trade_record_required');
  return {type:'POST_TRADE',timestamp:new Date().toISOString(),symbol:pre.symbol,result:Number(result),lesson:String(lesson||''),followed_plan:Boolean(followed_plan),practice_only:true};
}

export function disciplineScore({pre,post,decision}) {
  let score=50;
  if (pre?.risk_pct<=1) score+=15;
  if (post?.followed_plan) score+=20;
  if ((post?.lesson||'').trim().length>=10) score+=10;
  if (decision==='NO_FORECAST' || decision==='NO_TRADE') score+=5;
  return Math.min(100,score);
}
