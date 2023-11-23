/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"com/generalgoods/mm/gtwo/receiveproducts/receiveproducts/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});