import { cleanString, cleanTime, num, timeToMinutes, round2, newId } from './utils.mjs';

export function nextSequentialTime(previousExtendedMinutes,nextBaseMinutes){
  const day=Math.floor(previousExtendedMinutes/1440); let candidate=day*1440+nextBaseMinutes; if(candidate>=previousExtendedMinutes)return candidate;
  const previousClock=previousExtendedMinutes%1440; if(previousClock>=18*60&&nextBaseMinutes<=12*60)return(day+1)*1440+nextBaseMinutes; return null;
}
export function calculateDurations(assigned,onsite,completed){
  const a=timeToMinutes(assigned), oBase=timeToMinutes(onsite), cBase=timeToMinutes(completed);
  if([a,oBase,cBase].some(x=>x===null))return{valid:false,message:'One or more timestamps are invalid.'};
  const o=nextSequentialTime(a,oBase); if(o===null)return{valid:false,message:'On-site time occurs before assigned time and does not appear to be a valid overnight transition.'};
  const c=nextSequentialTime(o,cBase); if(c===null)return{valid:false,message:'Completed time occurs before on-site time and does not appear to be a valid overnight transition.'};
  return{valid:true,assignToOnSite:o-a,onSiteToComplete:c-o,assignToComplete:c-a};
}
export function evaluateJob(input,settings,requiredFields){
  const normalized={JobID:cleanString(input.JobID),CustomerName:cleanString(input.CustomerName),CustomerAddress:cleanString(input.CustomerAddress),ProblemReported:cleanString(input.ProblemReported),AssignedTime:cleanTime(input.AssignedTime),OnSiteTime:cleanTime(input.OnSiteTime),CompletedTime:cleanTime(input.CompletedTime),ActionTaken:cleanString(input.ActionTaken),MaterialUsed:cleanString(input.MaterialUsed),VoltageFound:cleanString(input.VoltageFound),VoltageLeft:cleanString(input.VoltageLeft),Remarks:cleanString(input.Remarks)};
  const filled=requiredFields.filter(f=>normalized[f]!==undefined&&String(normalized[f]).trim()!=='').length; const completeness=requiredFields.length?(filled/requiredFields.length)*100:100; const dataComplete=completeness>=100; const exceptions=[];
  if(!dataComplete){const missing=requiredFields.filter(f=>normalized[f]===undefined||String(normalized[f]).trim()==='');exceptions.push({type:'MISSING_REQUIRED_FIELD',severity:'Warning',description:'Required job data is incomplete: '+missing.join(', '),detected:missing.join(', '),expected:'All required fields completed'});}
  let timingEligible=false,timingValid=false,timingException=false,slaEligible=false,slaException=false,assignToOnSite=null,onSiteToComplete=null,assignToComplete=null;
  if(normalized.AssignedTime&&normalized.OnSiteTime&&normalized.CompletedTime){timingEligible=true;slaEligible=true;const seq=calculateDurations(normalized.AssignedTime,normalized.OnSiteTime,normalized.CompletedTime);
    if(!seq.valid){timingException=true;exceptions.push({type:'INVALID_TIME_SEQUENCE',severity:'Critical',description:seq.message,detected:[normalized.AssignedTime,normalized.OnSiteTime,normalized.CompletedTime].join(' → '),expected:'Assigned → On-site → Completed in chronological order'});}
    else{assignToOnSite=seq.assignToOnSite;onSiteToComplete=seq.onSiteToComplete;assignToComplete=seq.assignToComplete;const minGap=num(settings.MIN_TIME_GAP_MINUTES,15);
      if(assignToOnSite<minGap){timingException=true;exceptions.push({type:'ASSIGN_ONSITE_TOO_CLOSE',severity:'Warning',description:'Assigned and on-site timestamps are too close together.',detected:`${assignToOnSite} minutes`,expected:`At least ${minGap} minutes`});}
      if(onSiteToComplete<minGap){timingException=true;exceptions.push({type:'ONSITE_COMPLETE_TOO_CLOSE',severity:'Warning',description:'On-site and completed timestamps are too close together.',detected:`${onSiteToComplete} minutes`,expected:`At least ${minGap} minutes`});}
      const a2o=num(settings.ASSIGN_TO_ONSITE_WARNING_MIN,60),o2c=num(settings.ONSITE_TO_COMPLETE_WARNING_MIN,180),a2c=num(settings.ASSIGN_TO_COMPLETE_WARNING_MIN,240);
      if(assignToOnSite>a2o){slaException=true;exceptions.push({type:'ASSIGN_ONSITE_OVERRUN',severity:'Warning',description:'Assignment-to-on-site duration exceeds the configured warning threshold.',detected:`${assignToOnSite} minutes`,expected:`≤ ${a2o} minutes`});}
      if(onSiteToComplete>o2c){slaException=true;exceptions.push({type:'ONSITE_COMPLETE_OVERRUN',severity:'Warning',description:'On-site-to-completion duration exceeds the configured warning threshold.',detected:`${onSiteToComplete} minutes`,expected:`≤ ${o2c} minutes`});}
      if(assignToComplete>a2c){slaException=true;exceptions.push({type:'ASSIGN_COMPLETE_OVERRUN',severity:'Warning',description:'Assignment-to-completion duration exceeds the configured warning threshold.',detected:`${assignToComplete} minutes`,expected:`≤ ${a2c} minutes`});}
      timingValid=!timingException;
    }
  }
  return{completeness,dataComplete,timingEligible,timingValid,timingException,slaEligible,slaException,assignToOnSite,onSiteToComplete,assignToComplete,exceptions};
}
export function complianceStatus(percent,settings){const watch=num(settings.COMPLIANCE_WATCH_THRESHOLD,75),low=num(settings.COMPLIANCE_LOW_THRESHOLD,50);if(percent>=100)return'Target Met';if(percent>=watch)return'Watch';if(percent>=low)return'Low';return'Critical';}
export function normalizeWeights(w){const total=w.production+w.data+w.timing+w.sla||1;return{production:w.production/total,data:w.data/total,timing:w.timing/total,sla:w.sla/total};}
export function makeException(worksheetId,jobRecordId,type,severity,description,detected,expected,now){return{ExceptionID:newId('EXC'),WorksheetID:worksheetId,JobRecordID:jobRecordId||'',ExceptionType:type,Severity:severity,Description:description,DetectedValue:detected==null?'':String(detected),ExpectedValue:expected==null?'':String(expected),Status:'Open',ReviewedBy:'',ReviewedAt:'',ResolutionNotes:'',CreatedAt:now};}
