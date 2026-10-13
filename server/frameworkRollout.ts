import {currentFrameworkRelease,verifyFrameworkRelease} from './frameworkRelease.ts';
import {listInstanceRuntimes,startInstanceRuntime,adoptInstanceRelease,rollbackInstanceRelease} from './instanceRuntimeManager.ts';
import {checkRuntimeCompatibility} from './runtimeContract.ts';

export interface RolloutPlan {
 releaseId:string;compatible:boolean;eligible:number;
 instances:Array<{projectRoot:string;status:string;currentRelease:string|null;action:'upgrade'|'noop';previousRelease:string|null}>;
 blockers:string[];
}
/** Plan is side-effect-free. Updating an active business Instance requires explicit confirmation. */
export async function planFrameworkRollout():Promise<RolloutPlan>{
 const release=currentFrameworkRelease();
 if(!release)throw new Error('No verified Framework release');
 verifyFrameworkRelease(release.releaseId);
 const compatibility=checkRuntimeCompatibility();
 const list=await listInstanceRuntimes();
 return {
  releaseId:release.releaseId,compatible:compatibility.compatible,
  eligible:list.filter(i=>i.releaseId!==release.releaseId).length,
  instances:list.map(i=>({projectRoot:i.projectRoot,status:i.status,
   currentRelease:i.releaseId??null,previousRelease:i.previousReleaseId??null,
   action:i.releaseId===release.releaseId?'noop':'upgrade'})),
  blockers:compatibility.compatible?[]:['Central UI requires a newer backend contract; upgrade refused'],
 };
}
export async function applyFrameworkRollout(confirm:string):Promise<{
 releaseId:string;results:Array<{projectRoot:string;status:'upgraded'|'unchanged'|'rolled-back'|'blocked';detail:string}>
}>{
 const plan=await planFrameworkRollout();
 if(confirm!=='UPGRADE_ALL_REGISTERED_INSTANCES')throw new Error('Explicit rollout confirmation required');
 if(!plan.compatible)throw new Error(plan.blockers.join('; '));
 const results:Array<{projectRoot:string;status:'upgraded'|'unchanged'|'rolled-back'|'blocked';detail:string}>=[];
 for(const entry of plan.instances){
  if(entry.action==='noop'){results.push({projectRoot:entry.projectRoot,status:'unchanged',detail:'Already at target release'});continue;}
  const wasRunning=entry.status==='running';
  try{
   await adoptInstanceRelease(entry.projectRoot,plan.releaseId);
   results.push({projectRoot:entry.projectRoot,status:'upgraded',detail:'Runtime release adopted and verified'});
  }catch(error){
   let status:'rolled-back'|'blocked'='blocked';
   try{
    await rollbackInstanceRelease(entry.projectRoot);
    if(wasRunning)await startInstanceRuntime(entry.projectRoot);
    status='rolled-back';
   }catch{/* Do not report a successful rollback without proof. */}
   results.push({projectRoot:entry.projectRoot,status,detail:String(error)});
   // Fail closed after first unsuccessful migration. No claim of atomic fleet rollback.
   break;
  }
 }
 return {releaseId:plan.releaseId,results};
}
