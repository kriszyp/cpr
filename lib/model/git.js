/**
 * Use the git protocol to query the git repo for tags and heads
 */
var defer = require("promised-io/promise").defer;
exports.queryRepo = function(repo){// repo is like kriszyp/pintura
	return {
		forEach: function(callback){
			var connection = require("net").createConnection(9418, "github.com"),
				deferred = defer();
			var response = "";
			
			connection.on("data", function(data){
				var versions = [];
				response += data.toString();
				if(response.substring(response.length - 5) == "\n0000"){
					response.replace(/[0-9a-z]+ refs\/([\w]+)\/([^\n]+)/g, function(t, type, version){
						if(version.substring(version.length - 3, version.length) != "^{}"){
							callback(version, type);
						}
					});
					deferred.resolve();
					connection.end();
				}
			});
			connection.on("connect", function(data){
				var command = "git-upload-pack /" + repo + ".git\0host=github.com\0";
				var length = command.length.toString(16);
				command = new Array(5 - length.length).join("0") + length + command;
				connection.write(command);
			});
			connection.on("error", function(error){
				deferred.reject(error);
			});
			connection.on("timeout", function(error){
				deferred.reject(error);
			});
			return deferred.promise;
		}
	}
}
