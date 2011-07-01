var Media = require("pintura/media").Media,
	Static = require("pintura/jsgi/static").Static,
	publicStatic = Static({urls:[""], root: "public"});
Media({
	mediaType: "text/html",
	getQuality: function(object){
		return 1;
	},
	serialize: function(object, parameters, request, response){
		if(response.status == 200){
			var response = publicStatic({pathInfo:"/list.html", headers:{}, method: "GET"});
			return {
				forEach: function(callback){
					return response.then(function(response){
						return response.body.forEach(callback);
					});
				}
			};
		}else{
			return response.body;
		}
	}
});

