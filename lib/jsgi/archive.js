var Static = require("pintura/jsgi/static").Static,
	when = require("promised-io/promise").when,
	fs = require("promised-io/fs"),
	httpClient = require("promised-io/http-client"),
	staticApp = Static({urls:[""], root: "public"});

module.exports = function(request){
	return when(staticApp(request), function(response){
		if(request.pathInfo.substring(0,10) == "/archives/"){
			if(response.status == 404){
				return when(cacheArchive(decodeURIComponent(request.pathInfo.substring(10).replace(/$/g,'%'))), function(){
					return when(staticApp(request), function(response){
						console.log("setting content type");
						if(request.pathInfo.match(/zipball/)){
							response.headers["content-type"] = "application/zip";
							response.headers["content-disposition"] = "attachment; filename=package.zip"
						}
						if(request.pathInfo.match(/tarball/)){
							response.headers["content-type"] = "application/x-gzip";
							response.headers["content-disposition"] = "attachment; filename=package.tar.gz"
						}						
						return response;
						
					});
				});
			}
			if(request.pathInfo.match(/zipball/)){
				response.headers["content-type"] = "application/zip";
				response.headers["content-disposition"] = "attachment; filename=package.zip"
			}
			if(request.pathInfo.match(/tarball/)){
				response.headers["content-type"] = "application/x-gzip";
				response.headers["content-disposition"] = "attachment; filename=package.tar.gz"
			}						
		}	
		return response;
	});
};
var maxSize = 10000000;
function cacheArchive(url){
	var cachedUrl = "/archives/" + encodeURIComponent(url).replace(/%/g,'$');
	// download the archive into our local mirror
	try{
		var exists = fs.statSync("public/" + cachedUrl).mtime.getTime();
	}catch(e){
	}
	if(exists){
		return "http://" + host + cachedUrl;	
	}
	return request({url:url, encoding:"binary"}).then(function(response){
			var file = fs.open("public/" + cachedUrl, "w");	
			var size = 0;
			return response.body.forEach(function(part){
				size += part.length;
				if(size > maxSize){
					file.close();
					fs.open("public/" + cachedUrl, "w");
					file.write("redirect to: " + url);
					return true;
				}
				file.write(part, null, "binary");
			}).then(function(){
				file.close();
			});
		}).then(null, function(e){
			print(e.stack);
		});
}

function request(args, tries){
	tries = tries || 1;
	print("Downloading " + args.url + (tries > 1 ? " attempt #" + tries : ""));
	return httpClient.request(args).then(function(response){
		if(response.status == 302 || response.status == 301){
			args.url = response.headers.location;
			print("response.status " + response.status);
			return request(args);
		}
		if(response.status < 300){
			return response;
		}
		if(response.status == 404){
			return null;
		}
		throw new Error(response.status);
	}, function(error){
		tries++;
		if(tries > 3){
			throw error;
		}
		// try again
		return request(args, tries);
	});
}
