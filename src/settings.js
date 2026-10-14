// Community setup contract: mapping changes never create device write permissions.
export const FEATURE_ROLES = {
 water:['hotWaterTop','hotWaterCharge','waterHeater'],
 ventilation:['ventilationSupply','ventilationExtract'],
 evcc:['evccEnabled','evccCharging','evccMode','evccAction']
};
export function entityCompatible(role,id,state,spec){
 const domain=String(id||'').split('.')[0];
 const required={waterHeater:'water_heater',climate:'climate',evccMode:'select',evccEnabled:'binary_sensor',evccCharging:'binary_sensor'}[role];
 if(required)return domain===required;
 if(role==='room')return domain==='climate'||(domain==='sensor'&&['°C','°F'].includes(state?.attributes?.unit_of_measurement));
 if(!['sensor','number','binary_sensor','switch'].includes(domain))return false;
 const unit=state?.attributes?.unit_of_measurement;
 if(!spec?.unit)return true;
 if(!unit)return !state; // disabled registry entities can be selected before activation
 if(spec.unit==='kW')return ['W','kW'].includes(unit);
 if(spec.unit==='°C')return ['°C','°F'].includes(unit);
 return unit.toLowerCase()===spec.unit.toLowerCase();
}
export function capabilityState(feature,mapping,registry,states,visibility={}){
 const roles=FEATURE_ROLES[feature]||[];
 const detected=roles.some(r=>mapping?.[r]&&(states?.[mapping[r]]||registry?.some(e=>e.entity_id===mapping[r])));
 const hidden=visibility[feature]==='hide';
 return {detected,visible:detected&&!hidden,label:hidden?'Manuell ausgeblendet':detected?'Erkannt · automatisch angezeigt':'Nicht erkannt · inaktiv'};
}
export function mergeDashboardSettings(raw,settings){
 if(!['custom:nibe-control','nibe-control'].includes(raw?.strategy?.type))throw new Error('Dieses Dashboard verwendet keine NIBE-Control-Strategie.');
 return {...raw,strategy:{...raw.strategy,profile:settings.profile,config_entry_id:settings.config_entry_id,mappings:{...settings.mappings},visibility:{...raw.strategy.visibility,...settings.visibility},setup_complete:true}};
}
export function settingSnapshot(raw){
 const s=raw?.strategy||raw||{};
 const sort=obj=>Object.fromEntries(Object.entries(obj||{}).sort(([a],[b])=>a.localeCompare(b)));
 return JSON.stringify({profile:s.profile||'auto',config_entry_id:s.config_entry_id||null,mappings:sort(s.mappings),visibility:sort(s.visibility),setup_complete:!!s.setup_complete});
}
