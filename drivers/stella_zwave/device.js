'use strict';

const Homey = require('homey');
const ZwaveDevice = require('homey-meshdriver').ZwaveDevice;
const supportedModes = ['Off', 'Heat', 'Energy Save Heat', 'MANUFACTURER SPECIFC'];

class StellaZwave extends ZwaveDevice {
	async onMeshInit() {
		//this.printNode();
		//this.enableDebug();

		// Registering Flows
		this._stellaModeChanged = this.getDriver().stellaModeChanged;
		this._stellaModeChangedTo = this.getDriver().stellaModeChangedTo;
		this._stellaManualPosition = this.getDriver().stellaManualPosition;
		this._stellaMode = this.getDriver().stellaMode;
		this._stellaSetEcoTemperature = this.getDriver().stellaSetEcoTemperature;
		this._stellaManualControl = this.getDriver().stellaManualControl;
		this._stellaSetMode = this.getDriver().stellaSetMode;

		// Capabilities
		this.registerCapability('measure_battery', 'BATTERY');

		this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL', {
			getOpts: {
				getOnStart: false,
			},
		});

		this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT', {
			getOpts: {
				getOnOnline: true,
			},
		});

		this.registerCapability('eurotronic_mode', 'THERMOSTAT_MODE', {
			get: 'THERMOSTAT_MODE_GET',
			getOpts: {
				getOnOnline: true,
			},
			set: 'THERMOSTAT_MODE_SET',
			setParser: value => ({
				Level: {
					'No of Manufacturer Data fields': 0,
					Mode: value,
				},
				'Manufacturer Data': new Buffer([0]),
			}),
			report: 'THERMOSTAT_MODE_REPORT',
			reportParser: report => {
				if (report.hasOwnProperty('Level') && report.Level.hasOwnProperty('Mode')) {

					if (this.getCapabilityValue('eurotronic_mode')) {
						this._stellaModeChanged.trigger(this, { mode: report.Level.Mode, mode_name: Homey.__("mode." + report.Level.Mode) }, null);
						this._stellaModeChangedTo.trigger(this, null, { mode: report.Level.Mode });
					}

					return report.Level.Mode;
				}
				return null;
			},
		});

		this.registerCapability('eurotronic_manual_value', 'SWITCH_MULTILEVEL', {
			get: 'SWITCH_MULTILEVEL_GET',
			getOpts: {
				getOnOnline: true,
			},
			set: 'SWITCH_MULTILEVEL_SET',
			setParser: value => ({
				Value: Math.ceil(value * 99),
				'Dimming Duration': 'Factory default',
			}),
			report: 'SWITCH_MULTILEVEL_REPORT',
			reportParser: report => {
				if (typeof report.Value === 'string') {
					this._stellaManualPosition.trigger(this, { value: (report.Value === 'on/enable') ? 1.0 : 0.0 }, null);
					return (report.Value === 'on/enable') ? 1.0 : 0.0;
				}

				if (typeof report.Value === 'number') {
					this._stellaManualPosition.trigger(this, { value: report.Value / 99 }, null);
					return report.Value / 99;
				}

				if (typeof report['Value (Raw)'] !== 'undefined') {
					if (report['Value (Raw)'] === 254) return null;

					if (report['Value (Raw)'][0] === 255) {
						this._stellaManualPosition.trigger(this, { value: 1.0 }, null);
						return 1.0;
					}

					this._stellaManualPosition.trigger(this, { value: report['Value (Raw)'][0] / 99 }, null);
					return report['Value (Raw)'][0] / 99;
				}
				return null;
			}
		});

		// Setting Parsers
		this.registerSetting('economic_temperature', value => this._sendEconomicTemperature(value));
	}

	// Parsing Flows
	stellaModeChangedRunListener(args, state) {
		if (args.hasOwnProperty('mode') && state.hasOwnProperty('mode')) {
			return Promise.resolve(args.mode === state.mode);
		}
		return Promise.resolve(false);
	}

	stellaModeRunListener(args) {
		const currentMode = this.getCapabilityValue('eurotronic_mode');

		if (args.hasOwnProperty('mode')) {
			return Promise.resolve(args.mode === currentMode);
		}
		return Promise.resolve(false);
	}

	async stellaSetEcoTemperatureRunListener(args) {
		return await this._sendEconomicTemperature(args.value);
	}

	async stellaManualControlRunListener(args) {
		if (!args.hasOwnProperty('value')) return Promise.reject('no_value_given');

		const currentMode = this.getCapabilityValue('eurotronic_mode');

		if (!currentMode || currentMode !== 'MANUFACTURER SPECIFC')	{
			await this._sendMode('MANUFACTURER SPECIFC');
		}

		await this.getCommandClass('SWITCH_MULTILEVEL').SWITCH_MULTILEVEL_SET({
			Value: Math.ceil(args.value * 99),
			'Dimming Duration': 'Factory default',
		})
		.catch(err => {
			this.error(err);
			return Promise.reject(err);
		})
		.then(result => {
			if (result !== 'TRANSMIT_COMPLETE_OK') return Promise.reject(result);

			this.setCapabilityValue('eurotronic_manual_value', args.value);
			return Promise.resolve();
		});
	}

	async stellaSetModeRunListener(args, state) {
		if (!args.hasOwnProperty('euro_mode')) return Promise.reject('no_mode_given');

		return await this._sendMode(args.euro_mode);
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
			'Manufacturer Data': new Buffer([0]),
		})
		.catch(err => {
			this.error(err);
			return Promise.reject(err);
		})
		.then(result => {
			if (result !== 'TRANSMIT_COMPLETE_OK') return Promise.reject(result);

			this.setCapabilityValue('eurotronic_mode', mode);
			return Promise.resolve(mode);
		});
	}

	async _sendEconomicTemperature(temperature) {
		if (typeof temperature !== 'number') return Promise.reject('no_temperature_given');
		if (temperature < 8 && temperature > 28) return Promise.reject('out_of_range');
		let newTemperature;

		try {
			newTemperature = new Buffer(2);
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
}

module.exports = StellaZwave;
