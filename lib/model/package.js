/**
 * This is a page model for the Wiki example application
 */
var Model = require("perstore/model").Model,
	DefaultStore = require("perstore/stores").DefaultStore,
	promiseModule = require("promised-io/promise"),
	queryRepo = require("./git").queryRepo,
	host = require("commonjs-utils/settings").host || "/",
	print = console.log,
	httpClient = require("promised-io/http-client"),
	when = promiseModule.when,
	fs = require("promised-io/fs"),
	all = promiseModule.all;

var packageStore = DefaultStore(),
	versionsStore = DefaultStore();
versionsStore.setPath("Versions");
// now we create a class, all central model logic is defined here (make Page be a global for convenience) 
PackageModel = exports.Package = Model(packageStore, {
	post: function(object, meta){
		var url = typeof object == "string" ? object : object.url; 
		return when(publish(url, undefined, true), function(packageData){
			if(object.npm){
				if(!packageData.maintainers){
					throw new Error("A list of maintainers must be provided");
				}
				var redirectUrl = "http://packages.dojofoundation.org/" + packageData.name;
				packageData.url = redirectUrl;
				packageData.location = redirectUrl;
				var npmResponse = when(updateVersions(packageData), function(packageData){
					return request({
						url:"http://registry.npmjs.org/" + packageData.name, 
						method:"PUT",
						headers: {
							"content-type": "application/json",
							// we use the dojofoundation login which is dojofoundation:dojorocks
							"authorization": "Basic ZG9qb2ZvdW5kYXRpb246ZG9qb3JvY2tz"	
						}, 
						body: [JSON.stringify(packageData)]
					});
				});
			}else{
				var npmResponse = {status: 200};
			}
			return when(npmResponse, function(npmResponse){
				if(npmResponse.status < 300){
					return {
						__isJSGIResponse__: true,
						status: 302,
						headers: {
							"Location": "/submitted.html"
						},
						body: [""]
					};
				}else{
					npmResponse.__isJSGIResponse__ = true;
					return npmResponse;
				}
			});
		});
	},
	query: function(){
		return packageStore.index;
	},
	get: function(id, meta){
		if(id.indexOf('/') == -1){
			// a package root url
			var pckg = packageStore.get(id);
			if(pckg){
				var versions = versionsStore.get(id);
				pckg.versions = versions;
				//if(pckg.repositories && pckg.mtime < new Date().getTime()){
					// if there are github repositories, we can query them
					return when(updateVersions(pckg), function(){
						return pckg;
					});
				//}
				return pckg;
			}
		}else{
			// a package version url
			var pckgId = id.substring(0, id.indexOf("/"));
			var versionId = id.substring(id.indexOf("/") + 1);
			if(versionId.match(/^\w+:/)){
				// version is a url
				return {
					name: pckgId,
					version: versionId,
					dist:{
						tarball: versionId,
						zip: versionId
					}
				};
			}else{
				return versionsStore.get(pckgId)[versionId];
				return {
					name: pckgId,
					version: versionId,
					dist:{
						tarball: versionId,
						zip: versionId
					}
				};				
			}
		}
	},
	construct: function(page, directives){
		// set initial properties on object instantiation
		page.createdBy = promiseModule.currentContext.currentUser;
		page.status = "published";
		return page;
	},
	
	properties: { // schema definitions for property types (these are optional)
		name: String,
	},

	links: [ // define the link relations with other objects
	]
});

function updateVersions(pckg, force){
	var versions = pckg.versions || (pckg.versions = {});
	var wasUpdated;
	var versionRequests = pckg.repositories.map(function(repo, i){
		var firstRepo = i == 0;
		var repoName = repo.url.substring(repo.url.indexOf('/',10) + 1);
		print(" querying repo " + repoName);
		var packageUpdates = [];
		var latestVersion;
		return when(queryRepo(repoName).forEach(function(version, type){
			try{
				if(type == "pull"){
					return;
				}
				var gitVersion = version;
				if(version.match(/^v\d+\.\d+/)){
					// following semver v-prefixing for tags, strip it off
					version = version.substring(1);
				}
				if(firstRepo && (!versions[version] || force)){
					update();
					latestVersion = version;
				}
				var owner = repoName.substring(0, repoName.indexOf("/"));
				version = owner + '-' + version;
				// add the owner name based version
				if(!versions[version] || force){
					update();
				}
				function update(){
					var descriptorForVersion = versions[version] = {
						name: pckg.name,
						version: version,
						dist:type == "heads" ?
						{
							tarball: repo.url + '/tarball/' + gitVersion,
							zip: repo.url + '/zipball/' + gitVersion
						} :
						{
							tarball: cacheArchive(repo.url + '/tarball/' + gitVersion),
							zip: cacheArchive(repo.url + '/zipball/' + gitVersion),
						}
					};
					packageUpdates.push(request({url:repo.url + "/raw/" + gitVersion + "/package.json"}).then(function(response){
						return response && response.body.join("");
					}).then(function(packageJson){
						if(packageJson == null){
							return;
						}
						try{
							var packageData = JSON.parse(packageJson);
							var dependencies = {};
							// if mappings are there, go through and publish any dependent projects
							if(packageData && packageData.mappings){
								for(var mapping in packageData.mappings){
									var target = packageData.mappings[mapping];
									if(target.replace){
										dependencies[mapping] = target.replace(/.*\/v?/,'');
										when(publish(target.archive || target, mapping), null, print);
									}
								}
							}
							// TODO: Once my packages are fixed, uncomment
							descriptorForVersion.dependencies = /*packageData.dependencies || */dependencies; 
						}catch(e){
							e.message += " in package.json: " + packageJson;
							throw e;
						}
					}));
					
					wasUpdated = true;
				}
			}catch(e){
				print("Error setting version " + e.stack);
			}
		}).then(null, print), function(){
			if(latestVersion && (!pckg["dist-tags"] || pckg["dist-tags"] != latestVersion)){
				pckg["dist-tags"] = {"latest": latestVersion};
				packageStore.put(pckg); 
			}
			return all(packageUpdates);
		});
	});
	var deferred = promiseModule.defer();
	var finished;
	function finish(){
		if(!finished){
			finished = true;
			deferred.resolve(pckg);
		}
	}
	setTimeout(finish, 5000);
	all(versionRequests).then(afterUpdate, function(e){
		print(e.stack);
		afterUpdate(); // if there is an error, still continue with download
	});  
	function afterUpdate(){
		//versions.$expires = now + (now - versions.$mtime || 10000) / 5;
		if(wasUpdated){
			var now = new Date().getTime();
			//versions.$mtime = new Date().getTime();
		}
		versions.id = pckg.name;
		delete versions.$expires;
		versionsStore.put(versions);
		finish();
	}
	return deferred.promise;
}

function publish(url, asName, force){
	// TODO: convert zipball references to repositories as well
	url = url.replace(/\/$|(\.git$)/, '');
	if(url.match(/https?:\/\/github\.com\/[^\/]+\/[^\/]+\/\w+ball\/[^\/]+/)){
		if(url.substring(0,4) == "jar:"){
			url = url.substring(4).replace(/!.*/,'');
		}
		url = url.replace(/\/\w+ball\/[^\/]+/,'');
	}
	var isAlreadyPublished = packageStore.get(asName);
	if(isAlreadyPublished && !force){
		/*if(asName && notPublishedAsName){
			linkToExistingPackage();
		}*/
		return isAlreadyPublished;
	}
	if(url.match(/github/)){
		require("sys").puts("url" + url);
		var packageJson = request({url:url + "/raw/master/package.json"}).then(function(response){
			return response && response.body.join("");
		});
	}else{
		// an archive, need to download the archive, extract the package.json
	}
	return packageJson.then(function(packageJson){
		if(packageJson == null){
			var packageData = {name: asName || url.match(/https?:\/\/github\.com\/[^\/]+\/([^\/]+)/)[1]};
		}else{
			try{
				// fix trailing commas
				packageJson = packageJson.replace(/,\s*}/g, ']');
				var packageData = JSON.parse(packageJson);
			}catch(e){
				e.message += " in package.json: " + packageJson;
				throw e;
			}
		}
		var existing = packageStore.get(packageData.name);
		if(existing){
			var pckg = existing;
		}else{
			var pckg = packageData;
			delete pckg.version;
		}
		// add this repository to the list of repositories if it doesn't exist yet
		if(!pckg.repositories || pckg.repositories.every(function(repo){
				print("comparing " + repo.url + " " + url);
				return repo.url != url; 	
			})){
			(pckg.repositories || (pckg.repositories = [])).push({
				type: "git",
				url: url
			});
			pckg.id = pckg.name;
			updateVersions(pckg).then(null, function(error){
				print("Error " + error);
			});
		}else if(force){
			if(pckg.repositories[0].url == url){
				// copy the latest info from the package.json if it is the primary repo
				for(var i in packageData){
					pckg[i] = packageData[i];
				}
			}
			updateVersions(pckg, true).then(null, function(error){
				print("Error " + error);
			});
		}
		packageStore.put(pckg);
		return packageData;
	});
	
}
var maxSize = 10000000;
exports.cacheArchive = cacheArchive;
function cacheArchive(url){
	// download the archive into our local mirror
	return host + "archives/" + encodeURIComponent(url).replace(/%/g,'$');
}

function request(args, tries){
	tries = tries || 1;
//	(args.headers = args.headers || {})["user-agent"] = "CommonJS Package Repository 0.1"; 
	print("Downloading " + args.url + (tries > 1 ? " attempt #" + tries : ""));
	return httpClient.request(args).then(function(response){
		if(response.status == 302 || response.status == 301){
			args.url = response.headers.location;
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
