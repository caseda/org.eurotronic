'use strict';

const path = require('path');
const ZwaveDriver = require('homey-zwavedriver');

// http://static.hashop.nl/Files/5/18000/18005/Attachments/Product/475M93yv078PGsEm699G23wj9i84D4Mj.pdf

module.exports = new ZwaveDriver(path.basename(__dirname), {
	capabilities: {
		measure_battery: {
			getOnWakeUp: true,
			command_class: 'COMMAND_CLASS_BATTERY',
			command_get: 'BATTERY_GET',
			command_report: 'BATTERY_REPORT',
			command_report_parser: report => {
				if (typeof report['Battery Level'] === 'string' && report['Battery Level'] === 'battery low warning') return 1;
				if (typeof report['Battery Level (Raw)'] !== 'undefined') return report['Battery Level (Raw)'][0];
				return null;
			},
		},

		measure_temperature: {
			getOnWakeUp: true,
			command_class: 'COMMAND_CLASS_SENSOR_MULTILEVEL',
			command_get: 'SENSOR_MULTILEVEL_GET',
			command_report: 'SENSOR_MULTILEVEL_REPORT',
			command_report_parser: report => {
				if (report['Sensor Type'] === 'Temperature (version 1)') return report['Sensor Value (Parsed)'];
				return null;
			},
		},

		target_temperature: {
			getOnWakeUp: true,
			command_class: 'COMMAND_CLASS_THERMOSTAT_SETPOINT',
			command_get: 'THERMOSTAT_SETPOINT_GET',
			command_get_parser: node => {
				let mode = 'Heating 1';
				if (node && typeof node.state.eurotronic_mode !== 'undefined' && node.state.eurotronic_mode === 'Energy Save Heat') {
					mode = 'Energy Save Heating 2';
				}
				return {
					Level: {
						'Setpoint Type': mode,
					},
				};
			},
			command_set: 'THERMOSTAT_SETPOINT_SET',
			command_set_parser: value => {
				// Create 2 byte buffer of value, with value rounded to xx.5
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

		eurotronic_mode: {
			getOnWakeUp: true,
			command_class: 'COMMAND_CLASS_THERMOSTAT_MODE',
			command_get: 'THERMOSTAT_MODE_GET',
			command_set: 'THERMOSTAT_MODE_SET',
			command_set_parser: value => ({
				Level: {
					'No of Manufacturer Data fields': 0,
					Mode: value,
				},
				'Manufacturer Data': new Buffer([0]),
			}),
			command_report: 'THERMOSTAT_MODE_REPORT',
			command_report_parser: report => {
				if (report.hasOwnProperty('Level') && report.Level.hasOwnProperty('Mode')) return report.Level.Mode;
				return null;
			},
		},

		eurotronic_manual_value: {
			getOnWakeUp: true,
			command_class: 'COMMAND_CLASS_SWITCH_MULTILEVEL',
			command_get: 'SWITCH_MULTILEVEL_GET',
			command_report: 'SWITCH_MULTILEVEL_REPORT',
			command_report_parser: (report, node) => {
				if (!report || !node) return null;
				if (typeof report.Value === 'string') {
					Homey.manager('flow').triggerDevice('stella_euro_manual_position', { value: (report.Value === 'on/enable') ? 1.0 : 0.0 }, null, node.device_data);
					return (report.Value === 'on/enable') ? 1.0 : 0.0;
				}
				if (typeof report.Value === 'number') {
					Homey.manager('flow').triggerDevice('stella_euro_manual_position', { value: report.Value / 99 }, null, node.device_data);
					return report.Value / 99;
				}
				if (typeof report['Value (Raw)'] !== 'undefined') {
					if (report['Value (Raw)'] === 254) return null;
					if (report['Value (Raw)'][0] === 255) {
						Homey.manager('flow').triggerDevice('stella_euro_manual_position', { value: 1.0 }, null, node.device_data);
						return 1.0;
					}
					Homey.manager('flow').triggerDevice('stella_euro_manual_position', { value: report['Value (Raw)'][0] / 99 }, null, node.device_data);
					return report['Value (Raw)'][0] / 99;
				}
				return null;
			},
		},
	},
});

module.exports.on('initNode', token => {
	const node = module.exports.nodes[token];

	if (node && typeof node.instance.CommandClass.COMMAND_CLASS_THERMOSTAT_MODE !== 'undefined') {
		node.instance.CommandClass.COMMAND_CLASS_THERMOSTAT_MODE.on('report', (command, report) => {
			if (command.name === 'THERMOSTAT_MODE_REPORT' && report && report.hasOwnProperty('Level') && report.Level.hasOwnProperty('Mode')) {
				Homey.manager('flow').triggerDevice('stella_euro_mode_changed', { mode: report.Level.Mode, mode_name: __(mode[report.Level.Mode]) }, null, node.device_data);
				Homey.manager('flow').triggerDevice('stella_euro_mode_changed_to', null, { mode: report.Level.Mode }, node.device_data);
			}
		});
	}
});

Homey.manager('flow').on('trigger.stella_euro_mode_changed_to', (callback, args, state) => {
	if (!args) return callback('arguments_error', false);
	if (!state) return callback('state_error', false);

	if(typeof args.mode !== 'undefined' && typeof state.mode !== 'undefined' && args.mode === state.mode) return callback(null, true);
	return callback('unknown_error', false);
});

Homey.manager('flow').on('condition.stella_euro_mode', (callback, args) => {
	const node = module.exports.nodes[args.device.token];
	if (!node) return callback('device_unavailable', false);
	if (!args) return callback('arguments_error', false);

	if (typeof node.state.eurotronic_mode !== 'undefined' && typeof args.mode !== 'undefined' && node.state.eurotronic_mode === args.mode) return callback(null, true);
	return callback('unknown_error', false);
});

Homey.manager('flow').on('action.stella_eco_temperature', (callback, args) => {
	const node = module.exports.nodes[args.device.token];
	if (!node) return callback('device_unavailable', false);
	if (!args) return callback('arguments_error', false);

	if (args.hasOwnProperty('temperature') && typeof node.instance.CommandClass.COMMAND_CLASS_THERMOSTAT_SETPOINT !== 'undefined') {
		// Create 2 byte buffer of value, rounded to xx.5
		let temp = new Buffer(2);
		temp.writeUIntBE((args.temperature * 2).toFixed() / 2 * 10, 0, 2);
		// send the temperature + arguments to the module
		node.instance.CommandClass.COMMAND_CLASS_THERMOSTAT_SETPOINT.THERMOSTAT_SETPOINT_SET ({
			Level: {
				'Setpoint Type': 'Energy Save Heating 2'
			},
			Level2: {
				Precision: 1, // Number has one decimal
				Scale: 0, // No scale used
				Size: 2, // Value = 2 Bytes
			},
			Value: temp,
		}, (err, result) => {
			if (err) return callback(err, false);
			if (result === 'TRANSMIT_COMPLETE_OK') {
				module.exports.realtime(node.device_data, 'target_temperature', args.temperature);
				module.exports.realtime(node.device_data, 'eurotronic_mode', 'Energy Save Heat');
				return callback(null, true);
			}
			return callback(result, false);
		});
	}
	return callback('unknown_error', false);
});

Homey.manager('flow').on('action.stella_manual_control', (callback, args) => {
	const node = module.exports.nodes[args.device.token];
	let timeout = 0;
	if (!node) return callback('device_unavailable', false);
	else if (!args) return callback('arguments_error', false);

	if ((typeof node.state.eurotronic_mode === 'undefined' ||
		node.state.eurotronic_mode !== 'MANUFACTURER SPECIFC') &&
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
				node.state.eurotronic_mode = 'MANUFACTURER SPECIFC';
				module.exports.realtime(node.device_data, 'eurotronic_mode', 'MANUFACTURER SPECIFC');
			}
			else return callback('mode_set_' + result, false);
		});
	}

	setTimeout(() => {
		if (args.hasOwnProperty('value') && typeof node.instance.CommandClass.COMMAND_CLASS_SWITCH_MULTILEVEL !== 'undefined') {
			// Send the manual control value to the module
			node.instance.CommandClass.COMMAND_CLASS_SWITCH_MULTILEVEL.SWITCH_MULTILEVEL_SET ({
				Value: Math.round(args.value * 99),
				'Dimming Duration': 'Factory default',
			}, (err, result) => {
				if (err) return callback('value_set_' + err, false);
				else if (result === 'TRANSMIT_COMPLETE_OK') return callback(null, true);
				else return callback('value_set_' + result, false);
			});
		} else return callback('unknown_error', false);
	}, timeout);
});

Homey.manager('flow').on('action.stella_set_euro_mode', (callback, args) => {
	const node = module.exports.nodes[args.device.token];
	if (!node) return callback('device_unavailable', false);
	if (!args) return callback('arguments_error', false);

	if (args.hasOwnProperty('euro_mode') && typeof node.instance.CommandClass.COMMAND_CLASS_THERMOSTAT_MODE !== 'undefined') {
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
				module.exports.realtime(node.device_data, 'target_temperature', args.euro_mode);
				return callback(null, true);
			}
			else return callback(result, false);
		});
	} else return callback('unknown_error', false);
});
