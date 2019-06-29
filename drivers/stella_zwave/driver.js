'use strict';

const Homey = require('homey');

class StellaZwaveDriver extends Homey.Driver {
	onInit() {
		super.onInit();

		this.stellaModeChanged = new Homey.FlowCardTriggerDevice('stella_euro_mode_changed').register();

		this.stellaModeChangedTo = new Homey.FlowCardTriggerDevice('stella_euro_mode_changed_to').register()
			.registerRunListener((args, state) => {
				return args.device.stellaModeChangedRunListener(args, state);
			});

		this.stellaManualPosition = new Homey.FlowCardTriggerDevice('stella_euro_manual_position').register();

		this.stellaMode = new Homey.FlowCardCondition('stella_euro_mode').register()
			.registerRunListener((args, state) => {
				return args.device.stellaModeRunListener(args, state);
			});

		this.stellaSetEcoTemperature = new Homey.FlowCardAction('stella_eco_temperature').register()
			.registerRunListener((args, state) => {
				return args.device.stellaSetEcoTemperatureRunListener(args, state);
			});

		this.stellaManualControl = new Homey.FlowCardAction('stella_manual_control').register()
			.registerRunListener((args, state) => {
				return args.device.stellaManualControlRunListener(args, state);
			});

		this.stellaSetMode = new Homey.FlowCardAction('stella_set_euro_mode').register()
			.registerRunListener((args, state) => {
				return args.device.stellaSetModeRunListener(args, state);
			});
	}
}

module.exports = StellaZwaveDriver;
