'use strict';

const { ZwaveDevice } = require('homey-zwavedriver');
const supportedModes = ['Off', 'Heat', 'Energy Save Heat', 'MANUFACTURER SPECIFC'];

class CometZwave extends ZwaveDevice {
	async onNodeInit({ node }) {
		//this.printNode();
		this.enableDebug();

		// Register Flows
		this._cometModeChanged = this.homey.flow.getDeviceTriggerCard('comet_euro_mode_changed')
		this._cometManualPosition = this.homey.flow.getDeviceTriggerCard('comet_euro_manual_position');

		this._cometModeChangedTo = this.homey.flow.getDeviceTriggerCard('comet_euro_mode_changed_to').registerRunListener(async (args, state) => {
			if (args.hasOwnProperty('mode') && state.hasOwnProperty('mode')) {
				return (args.mode == state.mode);
			}
			return false;
    });

		this._cometMode = this.homey.flow.getConditionCard('comet_euro_mode').registerRunListener(async (args, state) => {
			const currentMode = await this.getCapabilityValue('eurotronic_mode_comet');

			if (args.hasOwnProperty('mode') && !(currentMode instanceof Error)) {
				return (args.mode == currentMode);
			}
			return false;
    });

		this._cometSetEcoTemperature = this.homey.flow.getActionCard('comet_eco_temperature').registerRunListener(async (args, state) => {
			return await this._sendEconomicTemperature(args.temperature);
    });

		this._cometManualControl = this.homey.flow.getActionCard('comet_manual_control').registerRunListener(async (args, state) => {
			if (!args.hasOwnProperty('value')) return Promise.reject('no_value_given');

			const currentMode = this.getCapabilityValue('eurotronic_mode_comet');

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

		this._cometSetMode = this.homey.flow.getActionCard('comet_set_euro_mode').registerRunListener(async (args, state) => {
			return await this._sendMode(args.euro_mode);
    });

		// Register Capabilities
		this.registerCapability('measure_battery', 'BATTERY', {
			getOpts: {
				getOnStart: false,
			},
		});

		this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL', {
			getOpts: {
				getOnStart: false,
			},
		});

		this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT', {
			getOpts: {
				getOnStart: true,
			},
		});

		this.registerCapability('eurotronic_mode_comet', 'THERMOSTAT_MODE', {
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

					if (this.getCapabilityValue('eurotronic_mode_comet')) {
						this._cometModeChanged.trigger(this, { mode: report.Level.Mode, mode_name: this.homey.__("mode." + report.Level.Mode) }, null);
						this._cometModeChangedTo.trigger(this, null, { mode: report.Level.Mode });
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
					this._cometManualPosition.trigger(this, { value: (report.Value === 'on/enable') ? 1.0 : 0.0 }, null);
					return (report.Value === 'on/enable') ? 1.0 : 0.0;
				}

				if (typeof report.Value === 'number') {
					this._cometManualPosition.trigger(this, { value: report.Value / 99 }, null);
					return report.Value / 99;
				}

				if (typeof report['Value (Raw)'] !== 'undefined') {
					if (report['Value (Raw)'] === 254) return null;

					if (report['Value (Raw)'][0] === 255) {
						this._cometManualPosition.trigger(this, { value: 1.0 }, null);
						return 1.0;
					}

					this._cometManualPosition.trigger(this, { value: report['Value (Raw)'][0] / 99 }, null);
					return report['Value (Raw)'][0] / 99;
				}
				return null;
			}
		});

		// Setting Parsers
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

			this.setCapabilityValue('eurotronic_mode_comet', mode);
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
}

module.exports = CometZwave;
