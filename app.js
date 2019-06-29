"use strict";

const Homey = require('homey');

class EurotronicApp extends Homey.App {
	onInit() {
		this.log(`${Homey.manifest.id} running...`);
	}
}

module.exports = EurotronicApp;
