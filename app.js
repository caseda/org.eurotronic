"use strict";

const Homey = require('homey');

class EurotronicApp extends Homey.App {
	onInit() {
		this.log('App Started.');
	}
}

module.exports = EurotronicApp;
