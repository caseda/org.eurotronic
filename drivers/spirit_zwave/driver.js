'use strict';

const path = require('path');
const ZwaveDriver = require('homey-zwavedriver');

// TODO: Error reporting in SDKv2
// https://www.eurotronic.org/fileadmin/user_upload/eurotronic.org/Produktbilder/spirit_z_wave_plus/Spirit_Z-Wave_BAL_web_EN_view_04.pdf

module.exports = new ZwaveDriver(path.basename(__dirname), {
	capabilities: {
		measure_battery: [
			{
				command_class: 'COMMAND_CLASS_BATTERY',
				command_get: 'BATTERY_GET',
				command_report: 'BATTERY_REPORT',
				command_report_parser: report => {
					if (!report) return null;
					if (typeof report['Battery Level'] === 'string' && report['Battery Level'] === 'battery low warning') return 1;
					if (typeof report['Battery Level (Raw)'] !== 'undefined') return report['Battery Level (Raw)'][0];
					return null;
				},
			},
			{
				command_class: 'COMMAND_CLASS_NOTIFICATION',
				command_report: 'NOTIFICATION_REPORT',
				command_report_parser: report => {
					if (report && report['Notification Type'] === 'Power Management') {
						if (report['Event'] === 10) return 25;
						if (report['Event'] === 11) return 15;
					}
					return null;
				},
			},
		],

		measure_temperature: {
			command_class: 'COMMAND_CLASS_SENSOR_MULTILEVEL',
			command_report: 'SENSOR_MULTILEVEL_REPORT',
			command_report_parser: report => {
				if (report['Sensor Type'] === 'Temperature (version 1)' &&
					report.hasOwnProperty('Level') &&
					report.Level.hasOwnProperty('Scale') &&
					report.Level.Scale === 0) {
					return report['Sensor Value (Parsed)'];
				}
				return null;
			},
		},

		target_temperature: {
			command_class: 'COMMAND_CLASS_THERMOSTAT_SETPOINT',
			command_set: 'THERMOSTAT_SETPOINT_SET',
			command_set_parser: value => {
				// Create 2 byte buffer of value, with value rounded to xx.5
				if (!value) value = 18;
				let newTemp = new Buffer(2);
				newTemp.writeUIntBE((value * 2).toFixed() / 2 * 10, 0, 2);

				return {
					Level: {
						'Setpoint Type': 'Heating 1'
					},
					Level2: {
						Precision: 1, // Number has one decimal
						Scale: 0, // No scale used
						Size: 2, // Value = 2 Bytes
					},
					Value: newTemp,
				};
			},
			command_report: 'THERMOSTAT_SETPOINT_REPORT',
			command_report_parser: report => {
				if (report &&
					report.hasOwnProperty('Value') &&
					report.hasOwnProperty('Level2') &&
					typeof report.Level2.Precision === 'number' &&
					typeof report.Level2.Size === 'number') {

					let targetValue;
					try {
						targetValue = report.Value.readUIntBE(0, report.Level2.Size);
					} catch (err) {
						return null;
					}
					if (typeof targetValue === 'number') return targetValue / Math.pow(10, report.Level2.Precision);
					return null;
				}
				return null;
			},
		},

		eurotronic_mode_spirit: {
			command_class: 'COMMAND_CLASS_THERMOSTAT_MODE',
			command_set: 'THERMOSTAT_MODE_SET',
			command_set_parser: value => ({
				Level: {
					'No of Manufacturer Data fields': 0,
					Mode: value,
				},
				'Manufacturer Data': new Buffer([0]),
			}),
			command_report: 'THERMOSTAT_MODE_REPORT',
			command_report_parser: (report, node) => {
				if (!report) return null;
				if (report.hasOwnProperty('Level') && report.Level.hasOwnProperty('Mode')) {
					if (node && typeof node.state.eurotronic_mode_spirit != 'undefined') {
						Homey.manager('flow').triggerDevice('spirit_euro_mode_changed', { mode: report.Level.Mode, mode_name: __("mode." + report.Level.Mode) }, null, node.device_data);
						Homey.manager('flow').triggerDevice('spirit_euro_mode_changed_to', null, { mode: report.Level.Mode }, node.device_data);
					}
					return report.Level.Mode;
				}
				return null;
			},
		},

		eurotronic_manual_value: {
			command_class: 'COMMAND_CLASS_SWITCH_MULTILEVEL',
			command_report: 'SWITCH_MULTILEVEL_REPORT',
			command_report_parser: (report, node) => {
				if (!report) return null;
				if (typeof report.Value === 'string') {
					if (node) Homey.manager('flow').triggerDevice('spirit_euro_manual_position', { value: (report.Value === 'on/enable') ? 1.0 : 0.0 }, null, node.device_data);
					return (report.Value === 'on/enable') ? 1.0 : 0.0;
				}
				if (typeof report.Value === 'number') {
					if (node) Homey.manager('flow').triggerDevice('spirit_euro_manual_position', { value: report.Value / 100 }, null, node.device_data);
					return report.Value / 100;
				}
				if (typeof report['Value (Raw)'] !== 'undefined') {
					if (report['Value (Raw)'] === 254) return null;
					if (report['Value (Raw)'][0] === 255) {
						if (node) Homey.manager('flow').triggerDevice('spirit_euro_manual_position', { value: 1.0 }, null, node.device_data);
						return 1.0;
					}
					if (node) Homey.manager('flow').triggerDevice('spirit_euro_manual_position', { value: report['Value (Raw)'][0] / 100 }, null, node.device_data);
					return report['Value (Raw)'][0] / 100;
				}
				return null;
			},
		},

		eurotronic_protection: {
			command_class: 'COMMAND_CLASS_PROTECTION',
			command_set: 'PROTECTION_SET',
			command_set_parser: value => {
				let newState;
				switch(value) {
					case 'unlockable': newState = 1; break;
					case 'protected': newState = 2; break;
					default: newState = 0;
				}

				return {
					'Protection State': newBuffer([newState])
				}
			},
			command_report: 'PROTECTION_REPORT',
			command_report_parser: (report, node) => {
				if (!report) return null;
				if (typeof report['Protection State'] === 'string') {
					let newState, newSetting;
					switch(report['Protection State']) {
						case "Unprotected": newState = "unprotected"; newSetting = "0"; break;
						case "Protection by sequence": newState = "unlockable"; newSetting = "1"; break;
						case "No operation possible": newState = "protected"; newSetting = "2"; break;
					}
					if (node) Homey.manager('flow').triggerDevice('spirit_protection_changed', { state: newState }, null, node.device_data);
					module.exports.setSettings(node.device_data, {
						protection: newSetting,
					});
					return newState;
				}
				if (typeof report.Value === 'number') {
					let newState;
					switch(report['Protection State (Raw)'][0]) {
						case 1: newState = "unlockable"; break;
						case 2: newState = "protected"; break;
						default: newState = "unprotected"; break;
					}
					if (node) Homey.manager('flow').triggerDevice('spirit_protection_changed', { state: newState }, null, node.device_data);
					module.exports.setSettings(node.device_data, {
						protection: report['Protection State (Raw)'][0].toString(),
					});
					return newState;
				}
				return null;
			},
		},
	},
	settings: {
		flip_screen: {
			index: 1,
			size: 1,
		},
		screen_timeout: {
			index: 2,
			size: 1,
			parser: (newValue, newSettings, deviceData) => {
				if (newValue > 0 && newValue < 5) {
					newValue = 5;
					setTimeout(() => {
						module.exports.setSettings(deviceData, {
							screen_timeout: newValue,
						});
					}, 500);
				}
				return new Buffer([newValue])
			},
		},
		backlight: {
			index: 3,
			size: 1,
		},
		battery_report: {
			index: 4,
			size: 1,
		},
		temperature_threshold: {
			index: 5,
			size: 1,
			parser: newValue => new Buffer([newValue * 10]),
		},
		valve_threshold: {
			index: 6,
			size: 1,
		},
		window_open_detection: {
			index: 7,
			size: 1,
		},
		measure_temperature_calibration: {
			index: 8,
			size: 1,
			parser: (newValue, newSettings, deviceData) => {
				if (newSettings['external_temperature']) return new Buffer([128]);
				return new Buffer([newValue * 10]);
			}
		},
		external_temperature: {
			index: 8,
			size: 1,
			parser: (newValue, newSettings, deviceData) => {
				if (newValue) return new Buffer([128])
				return new Buffer([newSettings['measure_temperature_calibration'] * 10]);
			}
		},
		child_protection: (newValue, newSettings, deviceData) => {
			const node = module.exports.nodes[deviceData.token];
			if (newValue && node && typeof node.instance.CommandClass.COMMAND_CLASS_PROTECTION !== 'undefined') {
				let newState;
				switch(newValue) {
					case '1': newState = 'unlockable'; break;
					case '2': newState = 'protected'; break;
					default: newState = 'unprotected';
				}
				// send the mode + arguments to the module
				node.instance.CommandClass.COMMAND_CLASS_PROTECTION.PROTECTION_SET ({
					'Protection State': new Buffer([newValue])
				}, (err, result) => {
					if (result === 'TRANSMIT_COMPLETE_OK') {
						module.exports.realtime(node.device_data, 'eurotronic_protection', newState);
						Homey.manager('flow').triggerDevice('spirit_protection_changed', { state: newState }, null, node.device_data);
					}
				});
			}
		},
	},
});

module.exports.on('initNode', token => {
	const node = module.exports.nodes[token];

	if (node) {
		getStates(node);
	}
});

let tries = 0;
let retry = false;

function getStates(node) {
	tries++;

	if (typeof node.state.eurotronic_mode_spirit === 'undefined') {
		if (typeof node.instance.CommandClass.COMMAND_CLASS_THERMOSTAT_MODE != 'undefined') {
			node.instance.CommandClass.COMMAND_CLASS_THERMOSTAT_MODE.THERMOSTAT_MODE_GET();
		}
	}

	else if (typeof node.state.target_temperature === 'undefined') {
		if (typeof node.instance.CommandClass.COMMAND_CLASS_THERMOSTAT_SETPOINT != 'undefined') {
			let mode = 'Heating 1';
			if (node && typeof node.state.eurotronic_mode_spirit !== 'undefined' && node.state.eurotronic_mode_spirit === 'Energy Save Heat') {
				mode = 'Energy Save Heating';
			}
			node.instance.CommandClass.COMMAND_CLASS_THERMOSTAT_SETPOINT.THERMOSTAT_SETPOINT_GET({
				Level: {
					'Setpoint Type': mode,
				},
			});
		}
	}

	else if (typeof node.state.eurotronic_manual_value === 'undefined') {
		if (typeof node.instance.CommandClass.COMMAND_CLASS_SWITCH_MULTILEVEL != 'undefined') {
			node.instance.CommandClass.COMMAND_CLASS_SWITCH_MULTILEVEL.SWITCH_MULTILEVEL_GET();
		}
	}

	else if (typeof node.state.measure_temperature === 'undefined') {
		if (typeof node.instance.CommandClass.COMMAND_CLASS_SENSOR_MULTILEVEL != 'undefined') {
			node.instance.CommandClass.COMMAND_CLASS_SENSOR_MULTILEVEL.SENSOR_MULTILEVEL_GET({
				'Sensor Type': 'Temperature (version 1)',
				Properties1: {
					Scale: 0,
				},
			});
		}
	}

	else if (typeof node.state.eurotronic_protection === 'undefined') {
		if (typeof node.instance.CommandClass.COMMAND_CLASS_PROTECTION != 'undefined') {
			node.instance.CommandClass.COMMAND_CLASS_PROTECTION.PROTECTION_GET();
		}
	}

	if ((typeof node.state.eurotronic_mode_spirit === 'undefined' ||
		typeof node.state.target_temperature === 'undefined' ||
		typeof node.state.eurotronic_manual_value === 'undefined' ||
		typeof node.state.measure_temperature === 'undefined' ||
		typeof node.state.eurotronic_protection === 'undefined') &&
		tries <= 20) {
			setTimeout( ()=> {
				getStates(node);
			}, 2500);
	}

	// If there have been 20 tries, sleep for 10 minutes then retry
	else if (tries > 20 && !retry) {
		setTimeout( ()=> {
			tries = 0;
			retry = true;
			getStates(node);
		}, 10 * 60 * 1000);
	}

	else {
		tries = 0;
		retry = false;
	}
}

Homey.manager('flow').on('trigger.spirit_euro_mode_changed_to', (callback, args, state) => {
	if (!args) return callback('arguments_error', false);
	else if (!state) return callback('state_error', false);

	else if(typeof args.mode !== 'undefined' && typeof state.mode !== 'undefined' && args.mode === state.mode) return callback(null, true);
	else return callback('unknown_error', false);
});

Homey.manager('flow').on('condition.spirit_euro_mode', (callback, args) => {
	const node = module.exports.nodes[args.device.token];
	if (!node) return callback('device_unavailable', false);
	else if (!args) return callback('arguments_error', false);

	else if (typeof node.state.eurotronic_mode_spirit !== 'undefined' && typeof args.mode !== 'undefined') {
		if (node.state.eurotronic_mode_spirit === args.mode) return callback(null, true);
		else return callback(null, false);
	}

	else return callback('unknown_error', false);
});

Homey.manager('flow').on('condition.spirit_protection', (callback, args) => {
	const node = module.exports.nodes[args.device.token];
	if (!node) return callback('device_unavailable', false);
	else if (!args) return callback('arguments_error', false);

	else if (typeof node.state.eurotronic_protection !== 'undefined' && typeof args.state !== 'undefined') {
		if (node.state.eurotronic_protection === args.state) return callback(null, true);
		else return callback(null, false);
	}

	else return callback('unknown_error', false);
});

Homey.manager('flow').on('action.spirit_eco_temperature', (callback, args) => {
	const node = module.exports.nodes[args.device.token];
	if (!node) return callback('device_unavailable', false);
	else if (!args) return callback('arguments_error', false);

	else if (args.hasOwnProperty('temperature') && typeof node.instance.CommandClass.COMMAND_CLASS_THERMOSTAT_SETPOINT !== 'undefined') {
		// Create 2 byte buffer of value, rounded to xx.5
		let temp = new Buffer(2);
		temp.writeUIntBE((args.temperature * 2).toFixed() / 2 * 10, 0, 2);
		// send the temperature + arguments to the module
		node.instance.CommandClass.COMMAND_CLASS_THERMOSTAT_SETPOINT.THERMOSTAT_SETPOINT_SET ({
			Level: {
				'Setpoint Type': 'Energy Save Heating'
			},
			Level2: {
				Precision: 1, // Number has one decimal
				Scale: 0, // No scale used
				Size: 2, // Value = 2 Bytes
			},
			Value: temp,
		}, (err, result) => {
			if (err) return callback(err, false);
			else if (result === 'TRANSMIT_COMPLETE_OK') {
				module.exports.realtime(node.device_data, 'target_temperature', args.temperature);
				module.exports.realtime(node.device_data, 'eurotronic_mode_spirit', 'Energy Save Heat');
				return callback(null, true);
			} else return callback(result, false);
		});
	} else return callback('unknown_error', false);
});

Homey.manager('flow').on('action.spirit_manual_control', (callback, args) => {
	const node = module.exports.nodes[args.device.token];
	let timeout = 0;
	if (!node) return callback('device_unavailable', false);
	else if (!args) return callback('arguments_error', false);

	else if ((typeof node.state.eurotronic_mode_spirit === 'undefined' ||
		node.state.eurotronic_mode_spirit !== 'MANUFACTURER SPECIFC') &&
		node.instance.CommandClass.COMMAND_CLASS_THERMOSTAT_MODE !== 'undefined') {
		// Change the mode to Manufacturer Specific
		timeout = 300;
		node.instance.CommandClass.COMMAND_CLASS_THERMOSTAT_MODE.THERMOSTAT_MODE_SET ({
			Level: {
				'No of Manufacturer Data fields': 0,
				Mode: 'MANUFACTURER SPECIFC',
			},
			'Manufacturer Data': new Buffer([0]),
		}, (err, result) => {
			if (err) return callback('mode_set_' + err, false);
			else if (result === 'TRANSMIT_COMPLETE_OK') {
				module.exports.realtime(node.device_data, 'eurotronic_mode_spirit', 'MANUFACTURER SPECIFC');
			} else return callback('mode_set_' + result, false);
		});
	}

	setTimeout(() => {
		if (args.hasOwnProperty('value') && typeof node.instance.CommandClass.COMMAND_CLASS_SWITCH_MULTILEVEL !== 'undefined') {
			// Send the manual control value to the module
			node.instance.CommandClass.COMMAND_CLASS_SWITCH_MULTILEVEL.SWITCH_MULTILEVEL_SET ({
				Value: Math.round(args.value * 100),
				'Dimming Duration': 'Factory default',
			}, (err, result) => {
				if (err) return callback('value_set_' + err, false);
				else if (result === 'TRANSMIT_COMPLETE_OK') {
					module.exports.realtime(node.device_data, 'eurotronic_manual_value', args.value);
					if (node) Homey.manager('flow').triggerDevice('spirit_euro_manual_position', { value: args.value }, null, node.device_data);
					return callback(null, true);
				}
				else return callback('value_set_' + result, false);
			});
		} else return callback('unknown_error', false);
	}, timeout);
});

Homey.manager('flow').on('action.spirit_set_euro_mode', (callback, args) => {
	const node = module.exports.nodes[args.device.token];
	if (!node) return callback('device_unavailable', false);
	else if (!args) return callback('arguments_error', false);

	else if (args.hasOwnProperty('euro_mode') && typeof node.instance.CommandClass.COMMAND_CLASS_THERMOSTAT_MODE !== 'undefined') {
		// send the mode + arguments to the module
		node.instance.CommandClass.COMMAND_CLASS_THERMOSTAT_MODE.THERMOSTAT_MODE_SET ({
			Level: {
				'No of Manufacturer Data fields': 0,
				Mode: args.euro_mode,
			},
			'Manufacturer Data': new Buffer([0]),
		}, (err, result) => {
			if (err) return callback(err, false);
			else if (result === 'TRANSMIT_COMPLETE_OK') {
				module.exports.realtime(node.device_data, 'eurotronic_mode_spirit', args.euro_mode);
				return callback(null, true);
			} else return callback(result, false);
		});
	} else return callback('unknown_error', false);
});

Homey.manager('flow').on('action.spirit_protection', (callback, args) => {
	const node = module.exports.nodes[args.device.token];
	if (!node) return callback('device_unavailable', false);
	else if (!args) return callback('arguments_error', false);

	else if (args.hasOwnProperty('state') && typeof node.instance.CommandClass.COMMAND_CLASS_PROTECTION !== 'undefined') {
		let newState;
		switch(args.state) {
			case 'unlockable': newState = 1; break;
			case 'protected': newState = 2; break;
			default: newState = 0;
		}
		// send the protection state to the module
		node.instance.CommandClass.COMMAND_CLASS_PROTECTION.PROTECTION_SET ({
			'Protection State': new Buffer([newState])
		}, (err, result) => {
			if (err) return callback(err, false);
			else if (result === 'TRANSMIT_COMPLETE_OK') {
				module.exports.realtime(node.device_data, 'eurotronic_protection', args.state);
				module.exports.setSettings(node.device_data, {
					protection: newState.toString(),
				});
				return callback(null, true);
			} else return callback(result, false);
		});
	} else return callback('unknown_error', false);
});

Homey.manager('flow').on('action.spirit_external_temperature', (callback, args) => {
	const node = module.exports.nodes[args.device.token];
	if (!node) return callback('device_unavailable', false);
	else if (!args) return callback('arguments_error', false);

	else if (args.hasOwnProperty('value') && typeof node.instance.CommandClass.COMMAND_CLASS_SENSOR_MULTILEVEL !== 'undefined') {
		let newTemp = new Buffer(2);
		newTemp.writeUIntBE(Math.round(args.value * 100), 0, 2);
		node.instance.CommandClass.COMMAND_CLASS_SENSOR_MULTILEVEL.SENSOR_MULTILEVEL_REPORT ({
			'Sensor Type': 'Temperature (version 1)',
			'Level': {
				'Precision': 2,
				'Scale': 0,
				'Size': 2,
			},
			'Sensor Value': newTemp
		}, (err, result) => {
			if (err) return callback(err, false);
			else if (result === 'TRANSMIT_COMPLETE_OK') {
				return callback(null, true);
			} else return callback(result, false);
		});
	} else return callback('unknown_error', false);
});
