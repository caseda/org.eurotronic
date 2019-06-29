'use strict';

const Homey = require('homey');

class CometZwaveDriver extends Homey.Driver {
	onInit() {
		super.onInit();

		this.cometModeChanged = new Homey.FlowCardTriggerDevice('comet_euro_mode_changed').register();

		this.cometModeChangedTo = new Homey.FlowCardTriggerDevice('comet_euro_mode_changed_to').register()
			.registerRunListener((args, state) => {
				return args.device.cometModeChangedRunListener(args, state);
			});

		this.cometManualPosition = new Homey.FlowCardTriggerDevice('comet_euro_manual_position').register();

		this.cometMode = new Homey.FlowCardCondition('comet_euro_mode').register()
			.registerRunListener((args, state) => {
				return args.device.cometModeRunListener(args, state);
			});

		this.cometSetEcoTemperature = new Homey.FlowCardAction('comet_eco_temperature').register()
			.registerRunListener((args, state) => {
				return args.device.cometSetEcoTemperatureRunListener(args, state);
			});

		this.cometManualControl = new Homey.FlowCardAction('comet_manual_control').register()
			.registerRunListener((args, state) => {
				return args.device.cometManualControlRunListener(args, state);
			});

		this.cometSetMode = new Homey.FlowCardAction('comet_set_euro_mode').register()
			.registerRunListener((args, state) => {
				return args.device.cometSetModeRunListener(args, state);
			});
	}
}

module.exports = CometZwaveDriver;
