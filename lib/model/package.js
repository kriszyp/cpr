/**
 * This is a page model for the Wiki example application
 */
var Model = require("perstore/model").Model,
	DefaultStore = require("perstore/stores").DefaultStore,
	promiseModule = require("promised-io/promise"),
	queryRepo = require("./git").queryRepo,
	print = require("sys").puts,
	request = require("promised-io/http-client").request,
	when = promiseModule.when,
	fs = require("promised-io/fs"),
	all = promiseModule.all;

var packageStore = DefaultStore(),
	versionsStore = DefaultStore();
versionsStore.setPath("Versions");
// now we create a class, all central model logic is defined here (make Page be a global for convenience) 
PackageModel = exports.Package = Model(packageStore, {
	post: function(url){
		return publish(url);
	},
	query: function(){
		return packageStore.index;
	},
	get: function(id){
		if(id.indexOf('/') == -1){
			// a package root url
			var pckg = packageStore.get(id);
			if(pckg){
				var versions = versionsStore.get(id);
				pckg.versions = versions;
				//if(pckg.repositories && pckg.mtime < new Date().getTime()){
					// if there are github repositories, we can query them
					return when(updateVersions(pckg), function(){
						print("get done");
						return pckg;
					});
				//}
				return pckg;
			}
		}else{
			// a package version url
			var pckgId = id.substring(0, id.indexOf("/'"));
			var versionId = id.substring(id.indexOf("/'") + 1);
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

function updateVersions(pckg){
	var versions = pckg.versions || (pckg.versions = {});
	var versionRequests = [];
	var wasUpdated;
	versionRequests.concat(pckg.repositories.map(function(repo, i){
		var firstRepo = i == 0;
		var repoName = repo.url.substring(repo.url.indexOf('/',10) + 1);
		print(" querying repo " + repoName);
		return queryRepo(repoName).forEach(function(version, type){
			print("add version " + version);
			try{ 
				if(version.match(/^v\d+\.\d+/)){
					// following semver v-prefixing for tags, strip it off
					version = version.substring(1);
				}
				if(firstRepo && !versions[version]){
					update();
				}
				var owner = repoName.substring(0, repoName.indexOf("/"));
				version = owner + '-' + version;
				// add the owner name based version
				if(!versions[version]){
					update();
				}
				function update(){
					print("adding version " + version);
					versions[version] = {
						name: pckg.name,
						version: version,
						dist:type == "heads" ?
						{
							tarball: repo.url + '/tarball/' + version,
							zip: repo.url + '/zipball/' + version
						} :
						{
							tarball: cacheArchive(repo.url + '/tarball/' + version),
							zip: cacheArchive(repo.url + '/zipball/' + version),
						}
					};
					wasUpdated = true;
				}
			}catch(e){
				print("Error setting version " + e.stack);
			}
		});
	}));
	return all(versionRequests).then(function(){
		print("finished updating " + versions)
		versions.$expires = now + (now - versions.$mtime || 10000) / 5;
		if(wasUpdated){
			var now = new Date().getTime();
			versions.$mtime = new Date().getTime();
		}
		versions.id = pckg.name;
		versionsStore.put(versions);
		return pckg;
	});
	
}

function publish(url, asName){
	// TODO: convert zipball references to repositories as well
	url = url.replace(/\/$|(\.git$)/, '');
	if(url.match(/https?:\/\/github\.com\/[^\/]+\/[^\/]+\/\w+ball\/[^\/]+/)){
		if(url.substring(0,4) == "jar:"){
			url = url.substring(4).replace(/!.*/,'');
		}
		url = url.replace(/\/\w+ball\/[^\/]+/,'');
	}
	print("publishing repositor " + url);
	var isAlreadyPublished = false;
	if(isAlreadyPublished){
		if(asName && notPublishedAsName){
			linkToExistingPackage();
		}
		return "already published";
	}
	if(url.match(/github/)){
		require("sys").puts("url" + url);
		var packageJson = request({url:url + "/raw/master/package.json"}).then(function(response){
			return response.body.join("");
		});
	}else{
		// an archive, need to download the archive, extract the package.json
	}
	return packageJson.then(function(packageJson){
		var packageData = JSON.parse(packageJson);
		var existing = packageStore.get(packageData.name);
		if(existing){
			packageData = existing;
		}else{
			delete packageData.version;
		}
		// add this repository to the list of repositories if it doesn't exist yet
		if(!packageData.repositories || packageData.repositories.every(function(repo){
			print("comparing " + repo.url + " " + url);
				return repo.url != url; 	
			})){
			(packageData.repositories || (packageData.repositories = [])).push({
				type: "git",
				url: url
			});				
			packageData.id = packageData.name;
			packageStore.put(packageData);
			// if mappings are there, go through and publish any dependent projects
			if(packageData.mappings){
				for(var mapping in packageData.mappings){
					var target = packageData.mappings[mapping];
					publish(target.archive || target, mapping).then(null, print);
				}
			}
			updateVersions(packageData).then(null, function(error){
				print("Error " + error);
			});
		}
	});
	
}
var maxSize = 10000000;
exports.cacheArchive = function cacheArchive(url){
	// download the archive into our local mirror
	var cachedUrl = "/archives/" + url.replace(/[^\w\.]/g,'_');
	function fetchArchive(){
		request({url:url, encoding:"binary"}).then(function(response){
			if(response.status == 302){
				url = response.headers.location;
				return fetchArchive();
			}
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
			}).then(file.close);
		}).then(null, function(e){
			print(e.stack);
		});
	}
	fetchArchive();
	return cachedUrl;
}