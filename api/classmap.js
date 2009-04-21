YAHOO.env.classMap = {"RegionDefinition2": "yregion2", "RegionDefinition3": "yregion3", "RegionLoader2": "yregion2", "RegionLoader3": "yregion3", "YRegion3": "yregion3", "YRegion2": "yregion2"};

YAHOO.env.resolveClass = function(className) {
    var a=className.split('.'), ns=YAHOO.env.classMap;

    for (var i=0; i<a.length; i=i+1) {
        if (ns[a[i]]) {
            ns = ns[a[i]];
        } else {
            return null;
        }
    }

    return ns;
};
