'use strict';

const path = require('path');
const ZwaveDriver = require('homey-zwavedriver');

// http://www.pepper1.net/zwavedb/device/858

module.exports = new ZwaveDriver( path.basename(__dirname), {
	capabilities: {
		'measure_battery': {
			'command_class': 'COMMAND_CLASS_BATTERY',
			'command_get': 'BATTERY_GET',
			'command_report': 'BATTERY_REPORT',
			'command_report_parser': report => {
				if (report['Battery Level'] === "battery low warning") return 1;
				
				return report['Battery Level (Raw)'][0];
			}
		},

		'measure_temperature': {
			'command_class': 'COMMAND_CLASS_SENSOR_MULTILEVEL',
			'command_get': 'SENSOR_MULTILEVEL_GET',
			'command_report': 'SENSOR_MULTILEVEL_REPORT',
			'command_report_parser': report => {
				if (report['Sensor Type'] !== 'Temperature (version 1)') return null;
				
				return report['Sensor Value (Parsed)'];
			}
		},

		'target_temperature': {
			'command_class': 'COMMAND_CLASS_THERMOSTAT_SETPOINT',
			'command_get': 'THERMOSTAT_SETPOINT_GET',
			'command_get_parser': () => {
				return {
					'Level': new Buffer([1]), // Reserved = 0 (bits: 000), Setpoint Type = 1 (Heating)(bits: 00001)
				};
			},
			'command_set': 'THERMOSTAT_SETPOINT_SET',
			'command_set_parser': value => {
				// make temperature a whole number
				const temp = Math.round(value*10);
				
				// create 2 byte buffer of the value
				const tempByte1 = Math.floor(temp/255);
				const tempByte2 = Math.round(temp-(255*tempByte1));
				
				return {
					'Level': new Buffer([1]), // Reserved = 0 (bits: 000), Setpoint Type = 1 (Heating)(bits: 00001)
					'Level2': new Buffer([34]), // Precision = 1 (bits: 001), Scale = 0 (bits: 00), Size = 2 (bits: 010)
					'Value': new Buffer([tempByte1, tempByte2]),
				};
			},
			'command_report': 'THERMOSTAT_SETPOINT_REPORT',
			'command_report_parser': report => {
				if (report.hasOwnProperty('Level2') &&
					report.Level2.hasOwnProperty('Precision') &&
					report.Level2.hasOwnProperty('Size')) {
						const scale = 10 * report.Level2['Precision']; //parse value according to precision scale
						return report['Value'].readUIntBE(0, report.Level2['Size']) / scale; 
				} else return null;
			}
		},

		'thermostat_mode': {
			'command_class': 'COMMAND_CLASS_THERMOSTAT_MODE',
			'command_get': 'THERMOSTAT_MODE_GET',
			'command_set': 'THERMOSTAT_MODE_SET',
			'command_set_parser': value => {
				switch (value) {
					case 'cool': // Future Mode: Off
						value = 0;
						break;
					case 'heat': // Future Mode: Comfort
						value = 1;
						break;
					case 'auto': // Future Mode: Economic
						value = 11;
						break;
				}
				if (typeof value !== "number") return null;
				return {
					'Level': new Buffer([value]),
					'Manufacturer Data': new Buffer([0]), // Manufacturer Data = 0
				};
			},
			'command_report': 'THERMOSTAT_MODE_REPORT',
			'command_report_parser': report => {
				if (report.hasOwnProperty('Level')) {
					switch (report.Level['Mode']) {
						case 'Off': 
							return 'cool'; // Future Mode: Off
						case 'Heat': 
							return 'heat'; // Future Mode: Comfort
						case 'Energy Save Heat': 
							return 'auto'; // Future Mode: Economic
						default:
							return null;
					}
				} else return null;
			}
		}
	}
});

Homey.manager('flow').on('action.eco_temperature', (callback, args) => {
	const node = module.exports.nodes[args.device['token']];
	if (node &&
	args.hasOwnProperty("device") &&
	args.hasOwnProperty("temperature")) {
		const node = module.exports.nodes[args.device['token']];
		
		// make temperature a whole number
		const temp = Math.round(args.temperature*10);
		
		// create 2 byte buffer of the value
		const tempByte1 = Math.floor(temp/255);
		const tempByte2 = Math.round(temp-(255*tempByte1));
		
		// Send command to module
		node.instance.CommandClass['COMMAND_CLASS_THERMOSTAT_SETPOINT'].THERMOSTAT_SETPOINT_SET({
			'Level': new Buffer([11]), // Reserved = 0 (bits: 000), Setpoint Type = 11 (Energie Save Heating)(bits: 01011)
			'Level2': new Buffer([34]), // Precision = 1 (bits: 001), Scale = 0 (bits: 00), Size = 2 (bits: 010)
			'Value': new Buffer([tempByte1, tempByte2])
		});
		
		if(temp) {
			callback(null, true);
		}
	} else return null;
});
