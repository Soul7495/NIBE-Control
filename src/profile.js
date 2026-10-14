export const PROFILE = {
  model: "VVM S320",
  roles: {
    outdoor: { register: "30002", entity: "sensor.current_outdoor_temperature_bt1_30002", label: "Außen", tag: "BT1", unit: "°C", group: "core" },
    room: { entity: "climate.vvms320_climate_system_s1", attribute: "current_temperature", label: "Innen", unit: "°C", group: "core" },
    roomSetpoint: { register: "40207", entity: "number.room_sensor_set_point_value_climate_system_1_40207", label: "Raum-Sollwert (Register)", unit: "°C", group: "diagnostic" },
    useRoomSensor: { register: "40203", entity: "switch.use_room_sensor_climate_system_1_40203", label: "Raumfühlerregelung", group: "diagnostic" },
    supply: { register: "30006", entity: "sensor.supply_line_bt2_30006", label: "Vorlauf", tag: "BT2", unit: "°C", group: "core" },
    return: { register: "30008", entity: "sensor.return_line_bt3_30008", label: "Rücklauf", tag: "BT3", unit: "°C", group: "core" },
    supplyTarget: { register: "31018", entity: "sensor.calculated_supply_climate_system_1_31018", label: "Vorlauf Soll", unit: "°C", group: "recommended" },
    degreeMinutes: { register: "40012", entity: "number.degree_minutes_40012", label: "Gradminuten", unit: "DM", group: "recommended" },
    flow: { register: "30041", entity: "sensor.flow_sensor_bf1_30041", label: "Volumenstrom", tag: "BF1", unit: "L/min", group: "recommended" },
    hpSupply: { register: "31479", entity: "sensor.condenser_sensor_supply_line_eb101_bt12_31479", label: "WP-Vorlauf", tag: "BT12", unit: "°C", group: "recommended" },
    hpReturn: { register: "31476", entity: "sensor.return_line_eb101_bt3_31476", label: "WP-Rücklauf", tag: "BT3", unit: "°C", group: "diagnostic" },
    compressorHz: { register: "31804", entity: "sensor.current_compressor_frequency_eb101_31804", label: "Verdichter", tag: "Ist", unit: "Hz", group: "recommended" },
    requestedHz: { register: "31855", entity: "sensor.requested_compressor_frequency_eb101_31855", label: "Verdichter", tag: "Soll", unit: "Hz", group: "diagnostic" },
    compressorStatus: { register: "31485", entity: "sensor.compressor_status_eb101_31485", label: "Verdichterstatus", group: "core" },
    priority: { register: "31029", entity: "sensor.priority_31029", label: "Betriebspriorität", group: "recommended" },
    electrical: { register: "32306", entity: "sensor.energy_log_current_power_consumption_32306", label: "Elektrische Leistung", unit: "kW", group: "recommended" },
    outdoorPower: { register: "31807", entity: "sensor.power_eb101_ep14_31807", label: "Außeneinheit", unit: "kW", group: "diagnostic" },
    thermal: { register: "30407", entity: "sensor.generated_power_heating_eb101_30407", label: "Heizleistung", unit: "kW", group: "diagnostic" },
    additionalHeat: { register: "31028", entity: "sensor.power_internal_additional_heat_31028", label: "Heizstab", unit: "kW", group: "recommended" },
    hotWaterTop: { register: "30009", entity: "sensor.hot_water_top_bt7_30009", label: "Warmwasser oben", tag: "BT7", unit: "°C", group: "core" },
    hotWaterCharge: { register: "30010", entity: "sensor.hot_water_charging_bt6_30010", label: "Warmwasser Laden", tag: "BT6", unit: "°C", group: "core" },
    hotWaterMode: { register: "31039", entity: "sensor.current_hot_water_mode_without_spa_sc_31039", label: "Warmwassermodus", group: "recommended" },
    moreHotWater: { register: "31079", entity: "sensor.more_hot_water_status_31079", label: "Mehr Warmwasser", group: "recommended" },
    diverter: { register: "32197", entity: "sensor.diverter_valve_hot_water_qn10_32197", label: "Umschaltventil", tag: "QN10", group: "diagnostic" },
    sgMode: { register: "31912", entity: "sensor.operating_mode_sg_ready_31912", label: "SG Ready", group: "recommended" },
    sgA: { register: "31913", entity: "sensor.sg_ready_input_a_31913", label: "SG Eingang A", group: "diagnostic" },
    sgB: { register: "31914", entity: "sensor.sg_ready_input_b_31914", label: "SG Eingang B", group: "diagnostic" },
    defrost: { register: "31806", entity: "sensor.defrosting_eb101_31806", label: "Abtauung", group: "recommended" },
    alarm: { register: "31976", entity: "sensor.alarm_number_31976", label: "Alarmnummer", group: "core" },
    climate: { entity: "climate.vvms320_climate_system_s1", label: "Heizkreis", group: "control" },
    waterHeater: { entity: "water_heater.vvms320_hot_water", label: "Warmwasser", group: "control" },
    evccEnabled: { entity: "binary_sensor.evcc_nibe_enabled", label: "EVCC NIBE", group: "optional" },
    evccCharging: { entity: "binary_sensor.evcc_nibe_charging", label: "EVCC-Anforderung", group: "optional" },
    evccAction: { entity: "sensor.evcc_nibe_pv_action", label: "PV-Aktion", group: "optional" },
    evccActionValue: { entity: "sensor.evcc_nibe_pv_action_value", label: "Anhebung", group: "optional" },
    evccMode: { entity: "select.evcc_nibe_mode", label: "EVCC-Modus", group: "optional" },
    ventilationExtract: { register: "30136", entity: "sensor.fan_speed_az30_gq2_30136", label: "Abluftventilator", tag: "GQ2", unit: "%", group: "recommended" },
    ventilationSupply: { register: "30137", entity: "sensor.fan_speed_az30_gq3_30137", label: "Zuluftventilator", tag: "GQ3", unit: "%", group: "recommended" },
    ventilationMode: { register: "31038", entity: "sensor.fan_mode_1_31038", label: "Lüftermodus (Rohwert)", group: "diagnostic" }
  }
};

export const WRITE_ALLOWLIST = Object.freeze({
  waterHeater: ["water_heater.set_operation_mode"],
  evccMode: ["select.select_option"]
});

export function registerFromUniqueId(uniqueId = "") {
  return String(uniqueId).match(/-(\d{5})$/)?.[1];
}

export function resolveDiscovery(registry=[],overrides={},entryId=null){
 const rows=registry.filter(r=>r.platform==='nibe_heatpump'||(!r.platform&&registerFromUniqueId(r.unique_id)));
 const entries=[...new Set(rows.map(r=>r.config_entry_id).filter(Boolean))];
 const selected=entryId||(entries.length===1?entries[0]:null),ambiguous=[];
 const scope=rows.filter(r=>selected?r.config_entry_id===selected:entries.length===0);
 const mapping={};
 for(const [role,spec] of Object.entries(PROFILE.roles)){
  if(overrides[role]){mapping[role]=overrides[role];continue;}
  if(spec.register){const matches=scope.filter(r=>registerFromUniqueId(r.unique_id)===spec.register);let candidate=matches.length===1?matches[0]:null;
   // Sensor/number aliases are safe only with identical registry identity and device.
   if(matches.length>1&&matches[0].device_id&&matches.every(r=>r.unique_id===matches[0].unique_id&&r.device_id===matches[0].device_id)){
    const enabled=matches.filter(r=>!r.disabled_by),pool=enabled.length?enabled:matches,domain=spec.entity.split('.')[0],preferred=pool.filter(r=>r.entity_id.startsWith(domain+'.'));
    if(preferred.length===1)candidate=preferred[0];else if(pool.length===1)candidate=pool[0];
   }
   if(candidate)mapping[role]=candidate.entity_id;else if(matches.length>1){mapping[role]=null;ambiguous.push(role);}else mapping[role]=entries.length?null:spec.entity;continue;}
  if(spec.group==='optional'){mapping[role]=registry.find(r=>r.entity_id===spec.entity)?.entity_id||spec.entity;continue;}
  const domain=spec.entity.split('.')[0],matches=scope.filter(r=>r.entity_id.startsWith(domain+'.'));
  const exact=matches.find(r=>r.entity_id===spec.entity);
  if(exact)mapping[role]=exact.entity_id;else if(matches.length===1)mapping[role]=matches[0].entity_id;else{mapping[role]=entries.length?null:spec.entity;if(matches.length>1)ambiguous.push(role);}
 }
 if(!overrides.room)mapping.room=mapping.climate;
 return {mapping,entries,selected,ambiguous};
}
export function resolveRoles(registry=[],overrides={},entryId=null){return resolveDiscovery(registry,overrides,entryId).mapping;}

export function usableState(state) {
  return !!state && !["unknown", "unavailable", "none", "null", ""].includes(String(state.state).toLowerCase());
}
