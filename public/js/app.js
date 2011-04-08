define(function(require){
	var claApprovedRepos = ["dojo", "ibm", "kriszyp", "jrburke/require"];
	var exceptRepos = ["kriszyp/slick"];
	var claRegex = new RegExp("https://github.com/(" + claApprovedRepos.join("|") + ")");
	var claRegexExcept = new RegExp(exceptRepos.join("|"));
	var query = require("dojo/query");
	var Compose = require("compose"),
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
	require("cssx/css!../css/app.css");//.apply(document.body);
	require("cssx/css!../css/layout.css");
/*	require("xstyle!../public/css/app").extend(require("xstyle/widget"), require("xstyle/generate"), require("xstyle/css3")).apply(document.body);*/
	var nextId = 0;
	/*require("remote-console").connectTo("http://192.168.0.6:8181/", "POST");*/
	var list = require("d-list/OnDemandList")({
		store: store,
/*			data = [];
			for(var i = 0;i < 20000; i++){
				data.push({id:i, name:"A number " + Math.random()});
			};
			this.store = new (require("store/Memory"))({data: data});*/
		renderRow: function(row, object, options){
			var licenses = [];
			if(object.licenses){
				for(var i = 0; i < object.licenses.length; i++){
					licenses.push(object.licenses[i].type);
				}
			}
			var claApproved = claRegex.test(object.repositories[0].url) && !claRegexExcept.test(object.repositories[0].url);
			var icon = object.icon || "http://dojofoundation.org/images/icons/6.png";
			row.innerHTML = '<img src="' + icon + '" /><div class="name">' + object.name + 
					'</div><div class="license">' + (licenses.join('/') || "&nbsp;") + 
					'</div><div class="cla' + (claApproved ? ' cla-approved' : '') + '"><span>&nbsp;</span>' +
					'</div><div class="description">' + (object.description || '') + '</div>';
		},
		layout: [	
				//require("d-list/Tree")({field:"id", sortable: true, width: "100px"}),
				{field:"name", sortable: true, width: "200px"}
			]
	}, query("#list")[0]);
	var tree = require("d-list/Tree")({field:"id", sortable: true, width: "100px"});
	tree.table = list;
	list.on("click", function(event){
		var object = list.getObject(event);
		if(object){
			var row = list.getRowNode(object);
			var packageFull = query(".package-full", row)[0];
			if(packageFull){
				// already expanded
				var parent = event.target;
				while(parent != packageFull){
					if(parent == null){
						row.removeChild(packageFull);
						return;						
					}
					parent = parent.parentNode;
				}
				return;
			}
			var packageFull = row.appendChild(document.createElement("div"));
			packageFull.className = "package-full";
			store.get(object.id).then(function(fullPackage){
				var versions = fullPackage.versions;
			    for(var i in versions){
    				if(i != "id"){
	    				var row = dojo.create("div",{
	    					className: "row"
	    				},packageFull);
	    				dojo.create("div",{
	    					className: "branch-name",
	    					innerHTML: i,
	    					href: "#" + i
	    				}, row);
    					if(versions[i] && versions[i].dist){
		    				dojo.create("div",{
		    					className: "branch-description",
		    					innerHTML: '<a href="' + versions[i].dist.zip + '">download zip</a><br>' +
		    							'<a href="' + versions[i].dist.tarball + '">download tarball</a><br>' +
		    							(versions[i].dependencies ? 'Dependencies: ' + (function(dependencies){
		    								var asHtml = "";
		    								for(var i in dependencies){
		    									asHtml += i + ' ' + dependencies[i];
		    								}
		    								return asHtml;
		    							})(versions[i].dependencies) : '')
		    				}, row);
		    			}
					}
				}
			});
		}
	});
	query("#list .d-list-header")[0].innerHTML= "Dojo Foundation Packages";
});