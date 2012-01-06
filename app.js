define(function(require){
	var claApprovedRepos = ["dojo", "ibm", "kriszyp", "jrburke/require"];
	var exceptRepos = ["kriszyp/slick"];
	var claRegex = new RegExp("https://github.com/(" + claApprovedRepos.join("|") + ")");
	var put = require("put-selector/put"); 
	var claRegexExcept = new RegExp(exceptRepos.join("|"));
	var query = require("dojo/query");
	var Compose = require("compose/compose"),
		QueryResults = require("dojo/store/util/QueryResults");
	store = Compose(require("dojo/store/JsonRest"), {
			query: function(id){
				return QueryResults(this.get("").then(function(data){
					// have to reformat because the catalog spec requires an object instead of an array
					var list = [];
					for(var i in data){
						list.push(data[i]);
					}
					return list;
				}));
			},
			get: function(id){
				// Use JSONP to get it from packages.dojofoundation.org
				var deferred = new (require("dojo/_base/Deferred"));
				require(["http://packages.dojofoundation.org/" + id + "?callback=define"], function(data){
					deferred.resolve(data);
				});
				return deferred;
			},
			getChildren: function(){
				return [{id:nextId++, name:"A number " + Math.random()}];
			}
		})({});
/*	require("xstyle!../public/css/app").extend(require("xstyle/widget"), require("xstyle/generate"), require("xstyle/css3")).apply(document.body);*/
	var nextId = 0;
	/*require("remote-console").connectTo("http://192.168.0.6:8181/", "POST");*/
	var list = require("dgrid/OnDemandList")({
		store: store,
/*			data = [];
			for(var i = 0;i < 20000; i++){
				data.push({id:i, name:"A number " + Math.random()});
			};
			this.store = new (require("store/Memory"))({data: data});*/
		renderRow: function(object, options){
			var licenses = [];
			if(object.licenses){
				for(var i = 0; i < object.licenses.length; i++){
					licenses.push(object.licenses[i].type);
				}
			}
			var claApproved = claRegex.test(object.repositories[0].url) && !claRegexExcept.test(object.repositories[0].url);
			var icon = object.icon || "http://dojofoundation.org/images/icons/6.png";
			var row = put('div');
			row.innerHTML = '<img src="' + icon + '" /><div class="name">' + object.name + 
					'</div><div class="license">' + (licenses.join('/') || "&nbsp;") + 
					'</div><div class="cla' + (claApproved ? ' cla-approved' : '') + '"><span>&nbsp;</span>' +
					'</div><div class="description">' + (object.description || '') + '</div>';
			return row;
		},
		layout: [	
				//require("dgrid/Tree")({field:"id", sortable: true, width: "100px"}),
				{field:"name", sortable: true, width: "200px"}
			]
	}, query("#list")[0]);
	var tree = require("dgrid/Tree")({field:"id", sortable: true, width: "100px"});
	tree.table = list;
	list.on("click", function(event){
		var row = list.row(event);
		var object;
		if(row && (object = row.data)){
			row = row.element;
			var packageFull = row.packageFull;
			if(packageFull){
				delete row.packageFull;
				// already expanded
				var parent = event.target;
				while(parent != packageFull){
					if(parent == null){
						put(packageFull, "!");
						return;						
					}
					parent = parent.parentNode;
				}
				return;
			}
			var packageFull = put(row, "+div");
			row.packageFull = packageFull;
			var details = put(packageFull, ".package-full div.details");
			put(details, "a", {
				href: object.repositories[0].url,
				innerHTML: "Go to project repo"
			});
			if(object.dependencies){
				put(details, "div", {
					innerHTML: "Dependencies: " + (function(dependencies){
		    								var asHtml = "";
		    								for(var i in dependencies){
		    									asHtml += i + ' ' + dependencies[i];
		    								}
		    								return asHtml;
		    							})(object.dependencies) 
				});
			}
			require("dojo/on")(put(details, "div", {
				innerHTML: "Older versions"
			}), "click", function(){
				store.get(object.id).then(function(fullPackage){
					var versions = fullPackage.versions;
				    for(var i in versions){
	    				if(i != "id"){
		    				var row = put(packageFull, "div.row");
		    				put(row, "div.branch-name", {
		    					innerHTML: i,
		    					href: "#" + i
		    				});
	    					if(versions[i] && versions[i].dist){
			    				put(row, "div.branch-description",{
			    					innerHTML: '<a href="' + versions[i].dist.zip + '">download zip</a><br>' +
			    							'<a href="' + versions[i].dist.tarball + '">download tarball</a><br>'
			    							
			    				});
			    			}
						}
					}
				});
			});
		}
	});
	query("#list .dgrid-header")[0].innerHTML= "Dojo Foundation Packages";
});