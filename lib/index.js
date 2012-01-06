// helpful for debugging
print = require("promised-io/process").print;
var pinturaApp,
	settings = require("perstore/util/settings"),
	Static = require("pintura/jsgi/static").Static,
	pinturaApp = require("pintura/pintura").app;
require("./app");
try{
var listener = require("jsgi-node").Listener(
		// uncomment this to enable compression with node-compress
		//require("pintura/jsgi/compress").Compress(
			require("pintura/jsgi/cascade").Cascade([ 
			// cascade from static to pintura REST handling
				Static({urls:["/packages"], root: ".."}),
				Static({urls:["/packages/dojo"], root: "/c/dev/dojo-toolkit/dojo"}),
				require("./jsgi/archive"),
				pinturaApp
			])
		);
}catch(e){
console.log("a",e);
}
/*var nodes = multiNode.listen({port: settings.port || 8080, nodes: settings.processes || 1}, 
		require("http").createServer(listener));

nodes.addListener("node", function(stream){
	pinturaApp.addConnection(multiNode.frameStream(stream));
});*/
require("http").createServer(listener).listen(7080);
console.log("a2");
try{
var sslOptions = {
  key: require('fs').readFileSync('privkey.pem'),
  cert: require('fs').readFileSync('cacert.pem')
};
require("https").createServer(sslOptions, listener).listen(443);
}catch(e){
	console.log(e);
}
// having a REPL is really helpful
/*if(nodes.isMaster){
	require("https").createServer(sslOptions, listener).listen(443);
	require("pintura/util/repl").start();	
}

// this is just to ensure the static analysis preloads the explorer package
false&&require("persevere-client/explorer/explorer.js");
*/ 
