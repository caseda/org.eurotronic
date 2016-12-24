'use strict';

const path = require('path');
const ZwaveDriver = require('homey-zwavedriver');
let deviceMode = "Heat";

// http://www.pepper1.net/zwavedb/device/858

module.exports = new ZwaveDriver( path.basename(__dirname), {
	capabilities: {
		'measure_battery': {
			'getOnWakeUp': true,
			'command_class': 'COMMAND_CLASS_BATTERY',
			'command_get': 'BATTERY_GET',
			'command_report': 'BATTERY_REPORT',
			'command_report_parser': report => {
				if (report['Battery Level'] === "battery low warning") return 1;
				
				if (report.hasOwnProperty('Battery Level (Raw)'))
					return report['Battery Level (Raw)'][0];
				
				return null
			}
		},

		'measure_temperature': {
			'getOnWakeUp': true,
			'command_class': 'COMMAND_CLASS_SENSOR_MULTILEVEL',
			'command_get': 'SENSOR_MULTILEVEL_GET',
			'command_report': 'SENSOR_MULTILEVEL_REPORT',
			'command_report_parser': report => {
				if (report['Sensor Type'] !== 'Temperature (version 1)') return null;
				
				return report['Sensor Value (Parsed)'];
			}
		},

		'target_temperature': {
			'getOnWakeUp': true,
			'command_class': 'COMMAND_CLASS_THERMOSTAT_SETPOINT',
			'command_get': 'THERMOSTAT_SETPOINT_GET',
			'command_get_parser':  () => {
				
				if (deviceMode &&
				deviceMode === "Energy Save Heat") {
					return {
						'Level': { 
							'Setpoint Type': 'Energy Save Heating 2'
						}
					};
				}
				
				return {
					'Level': {
						'Setpoint Type': 'Heating 1'
					}
				};
			},
			'command_set': 'THERMOSTAT_SETPOINT_SET',
			'command_set_parser': value => {
				
				// Create 2 byte buffer of value, with value rounded to xx.5
				let temp = new Buffer(2);
				temp.writeUIntBE((value * 2).toFixed() / 2 * 10, 0, 2);
				
				return {
					'Level': {
						'Setpoint Type': 'Heating 1'
					},
					'Level2': {
						'Precision': 1, // Number has one decimal
						'Scale': 0, // No scale used
						'Size': 2 // Value = 2 Bytes
					},
					'Value': temp
				};
			},
			'command_report': 'THERMOSTAT_SETPOINT_REPORT',
			'command_report_parser': report => {
				if (report.hasOwnProperty('Level2') &&
				report.Level2.hasOwnProperty('Precision') &&
				report.Level2.hasOwnProperty('Size')) {
					
					// Parse value to xx.x according to size and precision
					return report['Value'].readUIntBE(0, report.Level2['Size']) / Math.pow(10, report.Level2['Precision']);
				}
				return null;
			}
		},

		'eurotronic_mode': {
			'getOnWakeUp': true,
			'command_class': 'COMMAND_CLASS_THERMOSTAT_MODE',
			'command_get': 'THERMOSTAT_MODE_GET',
			'command_set': 'THERMOSTAT_MODE_SET',
			'command_set_parser': value => {
				return {
					'Level': {
						'No of Manufacturer Data fields': 0,
						'Mode': value
					},
					'Manufacturer Data': new Buffer([0])
				};
			},
			'command_report': 'THERMOSTAT_MODE_REPORT',
			'command_report_parser': report => {
				if (report.hasOwnProperty('Level')) {
					/* Value: Off - Name: Off
					 * Value: Heat - Name: Comfort
					 * Value: Energy Save Heat - Name: Economic
					 */
					return report.Level['Mode'];
				}
				return null;
			}
		}
	}
});

module.exports.on('initNode', token => {
	const node = module.exports.nodes[token];
	
	if (node) {
		node.instance.on('online', online => {
			// Update device mode variable
			if (online) {
				module.exports.getSettings(node.device_data, (err, settings) => {
					if (!err &&
					settings &&
					settings.hasOwnProperty("eurotronic_mode")) {
						deviceMode = settings.eurotronic_mode;
					}
				});
			}
		});
		
		node.instance.CommandClass['COMMAND_CLASS_THERMOSTAT_MODE'].on('report', (command, report) => {
			if (command &&
			command.hasOwnProperty("name") &&
			command.name === "THERMOSTAT_MODE_REPORT" &&
			report &&
			report.hasOwnProperty("Level") &&
			report.Level.hasOwnProperty("Mode")) {
				const data = {
					"mode": report.Level.Mode
				}
				
				Homey.manager('flow').triggerDevice('comet_euro_mode_changed', data, null, node.device_data);
				Homey.manager('flow').triggerDevice('comet_euro_mode_changed_to', null, data, node.device_data);
			}
		});
	}
});

Homey.manager('flow').on('trigger.comet_euro_mode_changed_to', (callback, args, state) => {
    const node = module.exports.nodes[args.device['token']];
	
	if(args.hasOwnProperty("mode") &&
	state.hasOwnProperty("mode") &&
	args.mode === state.mode)
		return callback(null, true);
		
	return callback(null, false);
});

Homey.manager('flow').on('condition.comet_euro_mode', (callback, args) => {
    const node = module.exports.nodes[args.device['token']];
	
	if (node &&
	node.hasOwnProperty("state") &&
	node.state.hasOwnProperty("eurotronic_mode") &&
	args &&
	args.hasOwnProperty("mode") &&
	node.state.eurotronic_mode === args.mode)
		return callback(null, true);
	
	return callback(null, false);
});

Homey.manager('flow').on('action.comet_eco_temperature', (callback, args) => {
	const node = module.exports.nodes[args.device['token']];
	
	if (node &&
	args.hasOwnProperty("temperature")) {
		
		// Create 2 byte buffer of value, rounded to xx.5
		let temp = new Buffer(2);
		temp.writeUIntBE((args.temperature * 2).toFixed() / 2 * 10, 0, 2);
		
		// send the temperature + arguments to the module
		node.instance.CommandClass['COMMAND_CLASS_THERMOSTAT_SETPOINT']['THERMOSTAT_SETPOINT_SET'] ({
			'Level': {
				'Setpoint Type': 'Energy Save Heating 2'
			},
			'Level2': {
				'Precision': 1, // Number has one decimal
				'Scale': 0, // No scale used
				'Size': 2 // Value = 2 Bytes
			},
			'Value': temp
		}, (err, result) => {
			if (err)
				return callback(null, false);
			
			if(result === "TRANSMIT_COMPLETE_OK")
				return callback(null, true);
			
			return callback(null, false);
		});
	}
	return callback(null, false);
});

Homey.manager('flow').on('action.comet_set_euro_mode', (callback, args) => {
	const node = module.exports.nodes[args.device['token']];
	
	if (node &&
	args.hasOwnProperty("euro_mode")) {
		
		// send the mode + arguments to the module
		node.instance.CommandClass['COMMAND_CLASS_THERMOSTAT_MODE']['THERMOSTAT_MODE_SET'] ({
			'Level': {
				'No of Manufacturer Data fields': 0,
				'Mode': args.euro_mode
			},
			'Manufacturer Data': new Buffer([0])
		}, (err, result) => {
			if (err)
				return callback(null, false);
			
			if(result === "TRANSMIT_COMPLETE_OK")
				return callback(null, true);
			
			return callback(null, false);
		});
	}
	return callback(null, false);
});
