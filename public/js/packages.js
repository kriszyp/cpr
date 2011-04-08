require({"packages":[
{"name":"d-list","location":"/packages/d-list", "lib":"."},
{"name":"compose","location":"/packages/compose", "main":"./compose"},
{"name":"cssx","location":"/packages/cssx", "lib":"src/cssx", "main":"./src/cssx/cssx"},
{"name":"lightning","location":"/packages/lightning", "lib":".", "main":"./lightning"},
{"name":"dojo","location":"/packages/dojo", "lib":".", "main": "./lib/main-browser"},
{"name":"dojox","location":"/dojox", "lib":"."},
{"name":"sizzle","location":"/packages/sizzle", "main": "./sizzle"},
{"name":"slick","location":"/packages/slick", "lib":"./Source", "main": "./Slick.Finder"}
]});
define('packages',[],{load: function(id, parentRequire, onLoad){require([id], onLoad);}});