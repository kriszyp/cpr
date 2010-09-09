/**
 * This is a page model for the Wiki example application
 */
var Model = require("perstore/model").Model,
	DefaultStore = require("perstore/stores").DefaultStore,
	promiseModule = require("promised-io/promise"),
	when = promiseModule.when;

var packageStore = DefaultStore();
// now we create a class, all central model logic is defined here (make Page be a global for convenience) 
PackageModel = exports.Package = Model(packageStore, {
	post: function(url){
		var contents = getUri(url);
	},
	construct: function(page, directives){
		// set initial properties on object instantiation
		page.createdBy = promiseModule.currentContext.currentUser;
		page.status = "published";
		return page;
	},
	put: function(page, options){ // handle puts to add to history and define attribution
		page.lastModifiedBy = promiseModule.currentContext.currentUser;
		page.status = "published";
		// do the default action of saving to the store
		return when(pageStore.put(page, options) || page.id, function(pageId){
			// create a new change entry in the history log
			new PageChange({
				content: page.content,
				pageId: pageId
			});
		});
	},
	
	properties: { // schema definitions for property types (these are optional)
		name: String,
		versions: {
			type:"object",
			additionalProperties:{
				name: String,
				version: String
			}
		}
	},

	links: [ // define the link relations with other objects
	]
});

