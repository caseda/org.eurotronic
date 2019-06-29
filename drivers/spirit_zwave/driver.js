'use strict';

const Homey = require('homey');

class SpiritZwaveDriver extends Homey.Driver {
	onInit() {
		super.onInit();

		this.spiritModeChanged = new Homey.FlowCardTriggerDevice('spirit_euro_mode_changed').register();

		this.spiritModeChangedTo = new Homey.FlowCardTriggerDevice('spirit_euro_mode_changed_to').register()
			.registerRunListener((args, state) => {
				return args.device.spiritModeChangedRunListener(args, state);
			});

		this.spiritManualPosition = new Homey.FlowCardTriggerDevice('spirit_euro_manual_position').register();
		this.spiritProtectionChanged = new Homey.FlowCardTriggerDevice('spirit_protection_changed').register();
		this.spiritErrorOccurred = new Homey.FlowCardTriggerDevice('spirit_error_occurred').register();

		this.spiritMode = new Homey.FlowCardCondition('spirit_euro_mode').register()
			.registerRunListener((args, state) => {
				return args.device.spiritModeRunListener(args, state);
			});

		this.spiritProtection = new Homey.FlowCardCondition('spirit_protection').register()
			.registerRunListener((args, state) => {
				return args.device.spiritProtectionRunListener(args, state);
			});

		this.spiritSetEcoTemperature = new Homey.FlowCardAction('spirit_eco_temperature').register()
			.registerRunListener((args, state) => {
				return args.device.spiritSetEcoTemperatureRunListener(args, state);
			});

		this.spiritManualControl = new Homey.FlowCardAction('spirit_manual_control').register()
			.registerRunListener((args, state) => {
				return args.device.spiritManualControlRunListener(args, state);
			});

		this.spiritSetMode = new Homey.FlowCardAction('spirit_set_euro_mode').register()
			.registerRunListener((args, state) => {
				return args.device.spiritSetModeRunListener(args, state);
			});

		this.spiritSetProtection = new Homey.FlowCardAction('spirit_protection').register()
			.registerRunListener((args, state) => {
				return args.device.spiritSetProtectionRunListener(args, state);
			});

		this.spiritSendRoomTemperature = new Homey.FlowCardAction('spirit_external_temperature').register()
			.registerRunListener((args, state) => {
				return args.device.spiritSendRoomTemperatureRunListener(args, state);
			});
	}
}

module.exports = SpiritZwaveDriver;
