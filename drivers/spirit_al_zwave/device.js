'use strict';

const { ZwaveDevice } = require('homey-zwavedriver');
const supportedModes = ['Off', 'Heat', 'Energy Save Heat', 'FULL POWER', 'MANUFACTURER SPECIFC'];

class SpiritALZwave extends ZwaveDevice {
	async onNodeInit({ node }) {
		//this.printNode();
		this.enableDebug();

		// Register Flows
		this._spiritModeChanged = this.homey.flow.getDeviceTriggerCard('spirit_euro_mode_changed')
		this._spiritManualPosition = this.homey.flow.getDeviceTriggerCard('spirit_euro_manual_position');
		this._spiritProtectionChanged = this.homey.flow.getDeviceTriggerCard('spirit_protection_changed');
		this._spiritErrorOccurred = this.homey.flow.getDeviceTriggerCard('spirit_error_occurred');

		this._spiritModeChangedTo = this.homey.flow.getDeviceTriggerCard('spirit_euro_mode_changed_to').registerRunListener(async (args, state) => {
			if (args.hasOwnProperty('mode') && state.hasOwnProperty('mode')) {
				return (args.mode == state.mode);
			}
			return false;
    });

		this._spiritMode = this.homey.flow.getConditionCard('spirit_euro_mode').registerRunListener(async (args, state) => {
			const currentMode = await this.getCapabilityValue('eurotronic_mode_spirit');

			if (args.hasOwnProperty('mode') && !(currentMode instanceof Error)) {
				return (args.mode == currentMode);
			}
			return false;
    });

		this._spiritProtection = this.homey.flow.getConditionCard('spirit_protection').registerRunListener(async (args, state) => {
			const currentProtection = await this.getCapabilityValue('eurotronic_protection');

			if (args.hasOwnProperty('state') && !(currentProtection instanceof Error)) {
				return (args.state == currentProtection);
			}
			return false;
    });

		this._spiritSetEcoTemperature = this.homey.flow.getActionCard('spirit_eco_temperature').registerRunListener(async (args, state) => {
			return await this._sendEconomicTemperature(args.temperature);
    });

		this._spiritManualControl = this.homey.flow.getActionCard('spirit_manual_control').registerRunListener(async (args, state) => {
			if (!args.hasOwnProperty('value')) return Promise.reject('no_value_given');

			const currentMode = this.getCapabilityValue('eurotronic_mode_spirit');

			if (!currentMode || currentMode !== 'MANUFACTURER SPECIFC')	{
				await this._sendMode('MANUFACTURER SPECIFC');
			}

			await this.getCommandClass('SWITCH_MULTILEVEL').SWITCH_MULTILEVEL_SET({
				Value: Math.ceil(args.value * 99),
				'Dimming Duration': 'Factory default',
			})
			.catch(err => {
				this.error(err);
				return false;
			})
			.then(result => {
				if (result !== 'TRANSMIT_COMPLETE_OK') return Promise.reject(result);

				this.setCapabilityValue('eurotronic_manual_value', args.value);
				return true;
			});
    });

		this._spiritSetMode = this.homey.flow.getActionCard('spirit_set_euro_mode').registerRunListener(async (args, state) => {
			return await this._sendMode(args.euro_mode);
    });

		this._spiritSetProtection = this.homey.flow.getActionCard('spirit_protection').registerRunListener(async (args, state) => {
			return await this._sendProtection(args.state);
    });

		this._spiritSendRoomTemperature = this.homey.flow.getActionCard('spirit_external_temperature').registerRunListener(async (args, state) => {
			if (this.getSetting('external_temperature') === false) return Promise.reject('external_temperature_setting_not_set');
			if (typeof args.value !== 'number') return Promise.reject('no_temperature_given');
			let newTemperature;

			try {
				newTemperature = Buffer.alloc(2);
				newTemperature.writeUIntBE(Math.round(args.value * 100), 0, 2);
			} catch(err) {
				this.error(err);
				return false;
			}

			await this.getCommandClass('SENSOR_MULTILEVEL').SENSOR_MULTILEVEL_REPORT({
				'Sensor Type': 'Temperature (version 1)',
				Level: {
					Precision: 2,
					Scale: 0,
					Size: 2,
				},
				'Sensor Value': newTemperature
			})
			.catch(err => {
				this.error(err);
				return false;
			})
			.then(result => {
				if (result !== 'TRANSMIT_COMPLETE_OK') return Promise.reject(result);

				this.setCapabilityValue('measure_temperature', args.value);
				return true;
			});
    });

		// Register Capabilities
		this.registerCapability('measure_battery', 'BATTERY', {
			getOpts: {
				getOnOnline: false,
				getOnStart: true,
			},
		});

		this.registerCapability('measure_battery', 'NOTIFICATION', {
			report: 'NOTIFICATION_REPORT',
			reportParser: report => {
				if (report.hasOwnProperty('Notification Type') && report.hasOwnProperty('Event') && report['Notification Type'] === 'Power Management') {
						if (report['Event'] === 10) return 25;
						if (report['Event'] === 11) return 15;
				}
				return null;
			},
		});

		this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL', {
			getOpts: {
				getOnOnline: false,
			},
			report: 'SENSOR_MULTILEVEL_REPORT',
			reportParserOverride: true,
			reportParser: report => {
				if (this.getSetting('external_temperature')) return null;

				if (report &&
					report.hasOwnProperty('Sensor Type') &&
					report['Sensor Type'] === 'Temperature (version 1)' &&
					report.hasOwnProperty('Sensor Value (Parsed)') &&
					report.hasOwnProperty('Level') &&
					report.Level.hasOwnProperty('Scale')) {

					// Some devices send this when no temperature sensor is connected
					if (report['Sensor Value (Parsed)'] === -999.9) return null;
					if (report.Level.Scale === 0) return report['Sensor Value (Parsed)']; // Celcius
					if (report.Level.Scale === 1) return (report['Sensor Value (Parsed)'] - 32) / 1.8; // Fahrenheit
				}
				return null;
			},
		});

		this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT', {
			getOpts: {
				getOnStart: true,
			},
		});

		this.registerCapability('eurotronic_mode_spirit', 'THERMOSTAT_MODE', {
			get: 'THERMOSTAT_MODE_GET',
			getOpts: {
				getOnStart: true,
			},
			set: 'THERMOSTAT_MODE_SET',
			setParser: value => ({
				Level: {
					'No of Manufacturer Data fields': 0,
					Mode: value,
				},
				'Manufacturer Data': Buffer.from([0]),
			}),
			report: 'THERMOSTAT_MODE_REPORT',
			reportParser: report => {
				if (typeof report === 'undefined') return null;

				if (report.hasOwnProperty('Level') && report.Level.hasOwnProperty('Mode')) {

					if (this.getCapabilityValue('eurotronic_mode_spirit')) {
						this._spiritModeChanged.trigger(this, { mode: report.Level.Mode, mode_name: this.homey.__("mode." + report.Level.Mode) }, null);
						this._spiritModeChangedTo.trigger(this, null, { mode: report.Level.Mode });
					}

					return report.Level.Mode;
				}
				return null;
			},
		});

		this.registerCapability('eurotronic_manual_value', 'SWITCH_MULTILEVEL', {
			get: 'SWITCH_MULTILEVEL_GET',
			getOpts: {
				getOnStart: true,
			},
			set: 'SWITCH_MULTILEVEL_SET',
			setParser: value => ({
				Value: Math.ceil(value * 99),
				'Dimming Duration': 'Factory default',
			}),
			report: 'SWITCH_MULTILEVEL_REPORT',
			reportParser: report => {
				if (typeof report === 'undefined') return null;

				if (typeof report.Value === 'string') {
					this._spiritManualPosition.trigger(this, { value: (report.Value === 'on/enable') ? 1.0 : 0.0 }, null);
					return (report.Value === 'on/enable') ? 1.0 : 0.0;
				}

				if (typeof report.Value === 'number') {
					this._spiritManualPosition.trigger(this, { value: report.Value / 99 }, null);
					return report.Value / 99;
				}

				if (typeof report['Value (Raw)'] !== 'undefined') {
					if (report['Value (Raw)'] === 254) return null;

					if (report['Value (Raw)'][0] === 255) {
						this._spiritManualPosition.trigger(this, { value: 1.0 }, null);
						return 1.0;
					}

					this._spiritManualPosition.trigger(this, { value: report['Value (Raw)'][0] / 99 }, null);
					return report['Value (Raw)'][0] / 99;
				}
				return null;
			}
		});

		this.registerCapability('eurotronic_protection', 'PROTECTION', {
			get: 'PROTECTION_GET',
			getOpts: {
				getOnStart: true,
			},
			set: 'PROTECTION_SET',
			setParser: value => {
				this.setSettings({ 'child_protection': this._parseProtection(value, 'setting') });

				return {
					'Protection State': Buffer.from([this._parseProtection(value, 'set')]),
				};
			},
			report: 'PROTECTION_REPORT',
			reportParser: report => {
				if (typeof report === 'undefined') return null;

				if (report.hasOwnProperty('Protection State')) {
					this._spiritProtectionChanged.trigger(this, { state: this._parseProtection(report['Protection State'], 'flow') }, null);
					this.setSettings({ 'child_protection': this._parseProtection(report['Protection State'], 'setting') });

					return this._parseProtection(report['Protection State'], 'capability');
				}
				return null;
			},
		});

		// Report listener
		this.registerReportListener('NOTIFICATION', 'NOTIFICATION_REPORT', report => {
			if (report.hasOwnProperty('Notification Type') && report.hasOwnProperty('Event') && report['Notification Type'] === 'System') {
				this._spiritErrorOccurred.trigger(this, { error: this.homey.__('error.valve.' + report.Event.toString()) }, null);
			}
		});

		// Setting Parsers
		this.registerSetting('screen_timeout', value => {
			if (value > 0 && value < 5) {
				value = 5;
				setTimeout(() => {
					this.setSettings({ screen_timeout: value });
				}, 500);
			}
			return value;
		});

		this.registerSetting('temperature_threshold', value => value * 10);

		this.registerSetting('measure_temperature_calibration', value => {
			if (this.getSetting('external_temperature') === false) {
				setTimeout(() => { this.refreshCapabilityValue('measure_temperature', 'SENSOR_MULTILEVEL'); }, 500);
				return value * 10;
			} else {
				this.setCapabilityValue('measure_temperature', 0);
				return Buffer.from([128]);
			}
		});

		this.registerSetting('external_temperature', value => {
			if (value === false) {
				setTimeout(() => { this.refreshCapabilityValue('measure_temperature', 'SENSOR_MULTILEVEL'); }, 500);
				return this.getSetting('measure_temperature_calibration') * 10;
			} else {
				this.setCapabilityValue('measure_temperature', 0);
				return Buffer.from([128]);
			}
		});

		this.registerSetting('child_protection', value => {
			this._sendProtection(value);
			this.setCapabilityValue('eurotronic_protection', this._parseProtection(value, 'capability'));
		});
		this.registerSetting('economic_temperature', value => this._sendEconomicTemperature(value));
	}

	// Basic Functions
	async _sendMode(mode) {
		if (typeof mode === 'undefined') return Promise.reject('no_mode_given')
		if (supportedModes.indexOf(mode) < 0) return Promise.reject('mode_unsupported');

		await this.getCommandClass('THERMOSTAT_MODE').THERMOSTAT_MODE_SET({
			Level: {
				'No of Manufacturer Data fields': 0,
				Mode: mode,
			},
			'Manufacturer Data': Buffer.from([0]),
		})
		.catch(err => {
			this.error(err);
			return Promise.reject(err);
		})
		.then(result => {
			if (result !== 'TRANSMIT_COMPLETE_OK') return Promise.reject(result);

			this.setCapabilityValue('eurotronic_mode_spirit', mode);
			return Promise.resolve(mode);
		});
	}

	async _sendEconomicTemperature(temperature) {
		if (typeof temperature !== 'number') return Promise.reject('no_temperature_given');
		if (temperature < 8 && temperature > 28) return Promise.reject('out_of_range');
		let newTemperature;

		try {
			newTemperature = Buffer.alloc(2);
			newTemperature.writeUIntBE((temperature * 2).toFixed() / 2 * 10, 0, 2);
		} catch(err) {
			this.error(err);
			return Promise.reject(err);
		}

		await this.getCommandClass('THERMOSTAT_SETPOINT').THERMOSTAT_SETPOINT_SET({
			Level: {
				'Setpoint Type': 'Energy Save Heating'
			},
			Level2: {
				Precision: 1, // Number has one decimal
				Scale: 0, // No scale used
				Size: 2, // Value = 2 Bytes
			},
			Value: newTemperature,
		})
		.catch(err => {
			this.error(err);
			return Promise.reject(err);
		})
		.then(result => {
			if (result !== 'TRANSMIT_COMPLETE_OK') return Promise.reject(result);

			this.setSettings({ 'economic_temperature': temperature });
			return Promise.resolve(temperature);
		});
	}

	async _sendProtection(state) {
		if (typeof state === 'undefined') return Promise.reject('no_state_given');

		await this.getCommandClass('PROTECTION').PROTECTION_SET({
			'Protection State': Buffer.from([this._parseProtection(state, 'set')]),
		})
		.catch(err => {
			this.error(err);
			return Promise.reject(err);
		})
		.then(result => {
			if (result !== 'TRANSMIT_COMPLETE_OK') return Promise.reject(result);

			this.setSettings({ 'child_protection': this._parseProtection(state, 'setting') });
			return Promise.resolve(state);
		});
	}

	_parseProtection(value, to) {
		let newValue = null;

		switch(value) {
			case '0':
			case 'unprotected':
			case 'Unprotected':
				newValue = 0;
				break;
			case '1':
			case 'unlockable':
			case 'Protection by sequence':
				newValue = 1;
				break;
			case '2':
			case 'protected':
			case 'No operation possible':
				newValue = 2;
				break;
		}

		if (to === 'capability' || to === 'flow') {
			switch (newValue) {
				case 0: newValue = 'unprotected'; break;
				case 1: newValue = 'unlockable'; break;
				case 2: newValue = 'protected'; break;
			}
		}

		if (to === 'setting') newValue = '' + newValue;

		return newValue;
	}
}

module.exports = SpiritALZwave;
