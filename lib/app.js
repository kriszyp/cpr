/**
 * This is an example Wiki web application written on Pintura
 */
var admins = require("commonjs-utils/settings").security.admins,
	copy = require("commonjs-utils/copy").copy,
	Package = require("./model/package").Package,
	Restrictive = require("perstore/facet").Restrictive,
	FileSystem = require("perstore/store/filesystem").FileSystem, 
	File = require("pintura/media").getFileModel(),
	Notifying = require("perstore/store/notifying").Notifying,
	pinturaConfig = require("pintura/pintura").config,
	User = pinturaConfig.security.getAuthenticationFacet();

// Defines the data model for the given user by request
pinturaConfig.getDataModel = function(request){
	return Package; 
}
// initialize the data model
require("perstore/model").initializeRoot(Package);
