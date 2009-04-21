/** 
 * Provides YRegion2 Utility definition based on YUI 2.x.
 *
 * YRegion2 allows us to define the functionality of different areas (regions) on the page, 
 * controlling the events, the loading process of its dependencies and setting a secure scope 
 * to define the region functionality in a consistent way. 
 * 
 * It also creates a communication infrastructure layer among the regions on the page. 
 *
 * @module yregion2
 */

/**
 * Provides YRegion2 Utility methods.
 *
 * @class YRegion2
 * @static
 */
YRegion2 = window.YRegion2 || function(){
    var obj = {},
	    _LOADERS = {},
		_MODS = {},
		_PLUGINS = {},
		_HASHTABLE = [],
		_region_class = 'region',
		_reHooks = /(?:^|\s+)(target|hook)([\w-\.]+)(?:\s+|$)/,
		_reTrim = /^\s+|\s+$/g,
		_reURL = {
				key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
				q: {
					name:   "queryKey",
					parser: /(?:^|&)([^&=]*)=?([^&]*)/g
				},
				parser: {
					strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
					loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
				}
		},
		_waiting = [],
		_loaderObj = null,
		_loaderQueue = [],
		_regionAbstraction = null,
		_bd = null;
   	/**
	 * Add a list of files to the hash table with the cachable files.
	 * @method _cache
	 * @private
	 * @static
	 * @param {Array} files An array of files objects.
     * @return void
	 */
	function _cache (files) {
		var i;
		for (i=0; i<files.length; i++) {
		  _HASHTABLE.push ({fullpath: files[i]});
		}
	}
	
	/**
	 * Check if a file object was already cached based in the fullpath
	 * @method _cached
	 * @private
	 * @static
	 * @param {Object} f File object.
     * @return {Boolean} Whether or not the file was cached. 
	 */
	function _cached (f) {
		var i;
		f = f || {};
		if (f.verifier && f.verifier.call()) {
			return true;
		} else {
			for (i=0; i<_HASHTABLE.length; i++) {
			  if (_HASHTABLE[i].fullpath == f.fullpath) {
				return true;
			  }
		    }
		}
		return false;
	}
	/**
	 * Continue with the loading process, removing the first set from the list, 
	 * and continue with the next in line.
	 * @method _loaderNext
	 * @private
	 * @static
	 * @param {Boolean} notify Whether or not the callback method should be called. 
     * @return void
	 */
	function _loaderNext (notify) {
		var i = _loaderQueue.pop();
		/* we want to speed up the loading process, so, the first thing we do
		   is actually starting the loading process for the next region */
		_loaderDispatch();
		if (notify && i) {
			/* notifying thru the callback function that everything was ok */
			i.callback.call();
		}
	}
	/**
	 * Create a message object based on a DOM Event
	 * @method _loaderDispatch
	 * @private
	 * @static
	 * @return void
	 */
	function _loaderDispatch () {
		if (_loaderQueue.length > 0) {
YAHOO.log ('[YRegion2] [Loader Queue] loading... ', _loaderQueue[0].require);
			_loaderObj.require(_loaderQueue[0].require);
			_loaderObj.insert({
				onSuccess: function() {
YAHOO.log ('[YRegion2] [Loader Queue] success...');
					_loaderNext(true);
				},
				onFailure: function () {
YAHOO.log ('[YRegion2] [Loader Queue] failure...');
					_loaderNext();
				},
				onTimeout: function() {
YAHOO.log ('[YRegion2] [Loader Queue] timeout...');
					_loaderNext();
				}
			}, _loaderQueue[0].type);
		}
	}
	/**
	 * Create a message object based on a DOM Event, the message object will be passed
	 * to all the listeners, and can be populated using the signature event.
	 * @method _createMsgObject
	 * @private
	 * @static
	 * @param {Object} e - event reference.
     * @return {Object} the message object with the status and the stopEvent method
	 */
	function _createMsgObject (e) {
		var o = { 
			event: e, 
			flagged: false 
		};
		/* YUI 2.x compatibility layer */
		o.element = YAHOO.util.Event.getTarget(e) || document.body;
		o.target = new YAHOO.util.Element(o.element);
		o.stopEvent = function () { o.flagged = true; YAHOO.util.Event.stopEvent(e); };
		return o;
	}
	/**
	 * Transform the target element into a semantic object
	 * @method _getSemantic
	 * @private
	 * @static
	 * @param {Object} e - DOM Event reference.
     * @return {Object} Semantic object that represents the semantic of the target element
	 */
	function _getSemantic(e) {
	  e = e || {};
	  var o = _createMsgObject (e);
	  /* analyzing the semantic meaning of the target */
	  if (o.event && o.target) {
	  	//o.trigger = obj.getOwnerByTagName(o.target, 'trigger', 5);
		o.anchor = obj.getOwnerByTagName(o.target, 'A', 5);
	  	if (!o.yuibutton && !o.anchor) {
	  		if ((o.target.get('tagName') == 'INPUT') && (o.input = o.target)) {
  			} else if ((o.target.get('tagName') == 'BUTTON') && (o.button = o.target)) {
  			} else {
				o.select = obj.getOwnerByTagName(o.target, 'SELECT', 2);
  				if (o.select) {
  				  o.value = o.select.get('element')[o.select.get('element').selectedIndex].value;
				}
  			}
		}
		/* checking if the target is a yuibutton */
		if ((o.anchor || o.button) && (o.yuibutton = obj.getYUIButton(o.target))) {
			o.value = o.yuibutton.get ('value');
			o.classes = o.yuibutton.get ('className');
		}
		o.trigger = o.trigger || o.anchor || o.yuibutton || o.input || o.select || o.target; /* priority order */
		if (o.trigger) {
			o.value = o.value || o.trigger.get('value');
			o.classes = o.classes || o.trigger.get('className');
		}
	  }
	  return o;
	}
	/**
	 * Parse an string and return the list of hooks
	 * @method _parseHooks
	 * @private
	 * @static
     * @param {String} str The classname of a target DOM element.
     * @return {Array} A collection of hooks.
     */
	function _parseHooks (str) {
	  var m, hooks = [];
	  while ((m = _reHooks.exec(str))) {
	  	hooks.push(m[2].toLowerCase());
		str = str.replace(m[1]+m[2], '');
	  }
	  return hooks;
	}
	/**
	 * Create a new instance of a region.
	 * @method _initRegion
	 * @private
	 * @static
     * @param {String} guid Global Unique ID for a region instance.
     * @param {Object} mod An object that represents an new instance.
     * @return void
     */
	function _initRegion (guid, mod) {
		mod = mod || {};
		mod.guid = guid;
		mod.lazyload = false;
		if (mod.ondomready) {
			mod.ondomready = false;
			/* a region can wait until onDOMReady */
			YAHOO.util.Event.onDOMReady (function(o) {
				YAHOO.log ('[YRegion2] init region on DOMReady: ', guid);
				obj.initRegion(guid, mod);
			});
		} else {
			if (_bd) {
			  mod.parentRegion = mod.parentRegion || _bd;
			  mod.parent = mod.parent || _bd.guid;
			}
			if (mod.guid && mod.ns && !_MODS.hasOwnProperty(mod.guid)) {
				if (_LOADERS.hasOwnProperty(mod.ns)) {
					/* the class already exist */
					_LOADERS[mod.ns].subscribe (mod);
				} else {
					_LOADERS[mod.ns] = new _modLoader (mod.ns);
					_LOADERS[mod.ns].subscribe (mod);
					/* loading the class definition */
					if (mod.region) {
						_LOADERS[mod.ns].load(mod.region);
					} else {
						/* it's an inline region, and there is not need to load anything... */
						_LOADERS[mod.ns].set({});
					}
				}
			}
		}
	}
	/**
	 * Inject a plugin into the global region represented by "document.body".
	 * @method _initPlugin
	 * @private
	 * @static
     * @param {String} name Plugin name.
     * @return void
     */
	function _initPlugin (name) {
		_bd.initPlugin(name);
	}
	/**
	 * Inspecting child regions to determine which region owns the target element.
	 * @method _trickling
	 * @private
	 * @static
     * @param {Object} region A Region object reference.
	 * @param {Node} target A Node instance that represents the target.
     * @return {Object} A Region object reference.
     */
	function _trickling(region, target) {
		var c, el;
		if (target && region.childs) {
			el = target.get ('element');
			for (c in region.childs) {
				/* the childs with the lazyload are not ready yet to receive a message */
				if (region.childs.hasOwnProperty(c) && region.childs[c].guid && (!region.childs[c].lazyload)) {
					/* comparing the event target with the region container or testing if it's a child element */	
					if ((el === region.childs[c].container) || YAHOO.util.Selector.test(el, '#'+region.childs[c].guid+' *')) {
						return _trickling (region.childs[c], target);
					}
				}
			}
		}
		return region; // chain support
	}
	/**
	 * Parsing an url using strict of loose mode.
	 * TODO: modify to use strict mode with an static regex
	 * @method _parseUri
	 * @private
	 * @static
     * @param {String} str URL to be parsed.
	 * @param {Boolean} strictMode Whether or not to use strict mode to parse the url.
     * @return {Object} A object that represent an URL.
     */
	function _parseUri (str, strictMode) {
		var	o = _reURL,
			m   = o.parser[strictMode?"strict":"loose"].exec(str),
			uri = {},
			i   = 14;
	
		while (i--) { 
			uri[o.key[i]] = m[i] || ""; 
		}
		uri[o.q.name] = {};
		uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
			if ($1) { 
				uri[o.q.name][$1] = $2; 
			}
		});
		return uri;
	}
	/**
	 * <p>
	 * Creating an object with the shorthands references.
	 * </p>
	 * @method _getShorthands
	 * @private
	 * @static
     * @return {Object} A object with the default list of shorthands.
     */
	function _getShorthands() {
		/* setting the default shorthands */
		return {
			Lang: YAHOO.lang,
			Event: YAHOO.util.Event,
			Dom: YAHOO.util.Dom,
			Y: {
				Node: {
					/* this.Y.Node.getDOMNode */
					getDOMNode: function (node) {
						return node.get('element');
					}
				},
				Lang: YAHOO.lang,
				Event: YAHOO.util.Event
			}
		};	
	}
	
    /**
 	 * Provides a prototype to control the loading process for an undefined RegionDefinition. A RegionLoader 
 	 * instance controls the loading of a RegionDefinition, and notify to the regions when its definition become available.
 	 * @class RegionLoader2
 	 * @constructor
 	 * @param {String} ns RegionDefinition namespace
 	 * @for YRegion2
 	 * @return {Object} RegionLoader instance
 	 */
 	var _modLoader = function (ns) {
		this.ns = ns;
	};
	_modLoader.prototype = {
		/**
		 * <p>
		 * Load a Region Definition
		 * </p>
		 * @method load
		 * @param {String} uri URL to load a file on demand (js or css)
		 * @param {Object} callback Literal object (success, failure).
		 * @return {Object} Get Utility handler.
		 */
		load: function (uri, callback) {
			callback = callback || {};
			// loading the definition for the region
			if (this._debug) {
				/* YAHOO.log ('this block is for debuging') */
				uri += ((uri.indexOf('?') == -1)?'?':'&') + "rnd=" + new Date().valueOf().toString();
			}
			return YAHOO.util.Get.script(uri, callback);
		},
		/**
		 * <p>
		 * Set a Region Definition, when a new region definition is included in the current page,
		 * these method will be executed to notify to everybody that a new region definition is ready.
		 * </p>
		 * @method set
		 * @param {Object} object with the region definition.
		 * @return void
		 */
		set: function (mod) {
			/* the new region definition should inherit from generic region */
			YAHOO.lang.augmentObject(mod, _regionAbstraction);
			this._mod = mod;
			// finally, notifying everybody that the region definition is ready
		    this.notify();
		},
		/**
		 * <p>
		 * Create a new instance, inheriting the region definition methods.
		 * </p>
		 * @method create
		 * @param {Object} mod Instance of the new region.
		 * @return void
		 */
		create: function (mod) {
			/* mod is an instance of the this._mod */
			// actions will be merged
			mod.actions = mod.actions || {};
			YAHOO.lang.augmentObject(mod.actions, (this._mod.actions || {}));
			// the rest of the properties will be injected. Properties of the instance will not be override
			YAHOO.lang.augmentObject(mod, this._mod);
			// storing the region instance reference
			_MODS[mod.guid] = mod;
			/* initializing the region instance */
			mod.init();
		},
		/**
		 * <p>
		 * Subscribe a new instance to this region definition, when the class become available, the 
		 * subscriber will get a notification.
		 * </p>
		 * @method subscribe
		 * @param {Object} mod Instance of the new region.
		 * @return void
		 */
		subscribe: function (mod) {
			this._instances = this._instances || [];
			/* waiting until the class become available along with the requiredments */
			this._instances.push (mod);
			// if the class is already available, just send the notification
			if (this._mod) {
				this.notify ();
			}
		},
		/**
		 * <p>
		 * Notify to all the subscribers (queue of regions) that the region definition is ready, this process will 
		 * garranty that this region instances will be instantiated after the class become available.
		 * </p>
		 * @method notify
		 * @return void
		 */
		notify: function () {
			var l;
			/* firing each listener */
			if (YAHOO.lang.isArray(this._instances)) {
			  while ((l = this._instances.pop())) {
				this.create (l);
			  }
			}
		}
	};
	
	/**
	 * Provides a set of generic methods that each region instance inherits automatically.
	 * @class RegionDefinition2
	 * @static
	 * @for YRegion2
	 */
	_regionAbstraction = {
		/**
		 * <p>
		 * execute the internal initialization process for the region
		 * </p>
		 * @method init
		 * @return {Object} region reference to support chaining
		 */
		init: function () {
		    YAHOO.log ('[YRegion2] creating: ', this.guid);
			var f, i, files = [], r, l, that = this;
			/* filtering get and post arguments for the server side */
			this.getargs = (this.getargs?this.getargs:{});
			this.postargs = (this.postargs?this.postargs:{});
			YAHOO.log ('[YRegion2] decoding server (get and post) arguments: ', this.getargs, this.postargs);
		    // starting the loading routine for the dependencies...
			// loading the requiredments
		    r = Array.prototype.slice.call((this.require || []), 0);
			// injecting the default list of requirements 
			r.push("event", "dom", "element", "selector", "connection");
			// checking cache for the includes
			this.dependencies = this.dependencies || [];
			// cheching the uri in the hashtable
			for (i=0; i<this.dependencies.length; i++) {
				f = this.dependencies[i];
				if (typeof f === 'string') {
					f = {fullpath: f};
					this.dependencies[i] = f;
				}
				if (f.fullpath && (!_cached(f))) {
					if (this._debug) {
						/* YAHOO.log ('this block is for debuging') */
						f.fullpath += ((f.fullpath.indexOf('?') == -1)?'?':'&') + "rnd=" + new Date().valueOf().toString();
					}
					files.push (f.fullpath);
				}
			}
			YAHOO.log ('[YRegion2] loading the requirements: ', this.guid, r);
			f = function () {
				var el = this;
				that.container = el;
				YAHOO.log ('[YRegion2] the DOM element for the region is ready: ', el);
				/* if the region have a wrapper, we can assume that we need to create the container within that wrapper */
				if (that.wrapper) {
					YAHOO.log ('[YRegion2] creating the container for the area: ', that.guid, el);
					this.addToBody({
						attributes: {
							id: that.guid
						}
					}, el);
					that.container = YAHOO.util.Selector.query('#'+that.guid, el, true);
				}
				/* if the region is an AJAX region, it shoult be loaded dynamically using YUI Connection Manager */
				if (that.ajax) {
					YAHOO.log ('[YRegion2] init an AJAX region');
					/* we shoudl use ajax to load the content of the region */
					YAHOO.lang.augmentObject(that, _getShorthands());
					that.execute('render', {}, function(o) {
						that.container.innerHTML = o.response;
						that.ready();
					});
				} else {
					that.ready();
				}
			};
			/* creating the loader object for this region */
			l = this._loader = this._loader || {};
			l.combine = (l.hasOwnProperty('combine')?l.combine:true); /* using the Combo Handle */
			l.combine = !this._debug;
		    l.filter = l.filter || 'min';  /* you can switch between YUI branch */
			l.filter = (this._debug?'debug':l.filter);
			
			_loaderObj = _loaderObj || new YAHOO.util.YUILoader(l);
			
			// finally, executing the ready method
			this.include(r, files, function () {
				that.onAvailable (f);
			});
			return this; /* chaining */
		},
		/**
		 * <p>
		 * Waiting until the DOM element that represents the region become available
		 * </p>
		 * @method onAvailable
		 * @param {Function} f a function to call when the DOM element that represent the region become available
		 * @return {Object} region reference to support chaining
		 */
		onAvailable: function (f) {
			/* no wrapper or the wrapper is an ID, we should wait until the guid or the wrapper become available */
			var c = this.wrapper || this.guid, el;
			YAHOO.log ('[YRegion2] the dependencies are ready, now we need to wait for the DOM element: ', this.guid, c);
			if (YAHOO.util.Dom.inDocument(c) && (el = YAHOO.util.Dom.get(c))) {
			  YAHOO.log ('[YRegion2] [onAvailable] the element is already in the DOM', c);
			  f.apply (el, []);
			} else {
			  YAHOO.log ('[YRegion2] [onAvailable] Using YUI Event onAvailable to wait for the element', c);
			  YAHOO.util.Event.onAvailable (c, f);
			}
			return this; /* chaining */
		},
		/**
		 * <p>
		 * get the region ready when all the requiredment, dependencies and DOM element available
		 * </p>
		 * @method ready
		 * @return {Object} region reference to support chaining
		 */
		ready: function () {
			var c, i, that = this;
			if (this.guid=='yregion') {
				this.container = document.body;
				this.container.id = this.guid;
			}
			/* expending with the shorthands */
			YAHOO.lang.augmentObject(this, _getShorthands());
			/* checking for the plugins: installing them if needed */
			this.install (this.actions);
			if (YAHOO.lang.isArray(this.plugins)) {
				for (i=0;i<this.plugins.length;i++) {
				  this.initPlugin (this.plugins[i]);
				}
			}
			/* if the region have a parent, it should notify that it's ready */
			if (this.parentRegion) {
				this.parentRegion.setChild (this);
			}
			this.node = new YAHOO.util.Element(this.container);
			this.node.addClass (_region_class);
			/* initializing the child regions */
			if (this.childs) {
				for (c in this.childs) {
					if (this.childs.hasOwnProperty(c) && (!this.childs[c].lazyload)) {
						/* the childs with the lazyload should be loaded manually */
						this.initChild (c, this.childs[c]);
					}
				}
			}
			this.fire('region:ready');
			YAHOO.util.Event.onContentReady (this.guid, function () {
				YAHOO.log ('[YRegion2] region is ready to be expanded: ', that.guid);
				that.fire('region:contentready');
				/* also, yregion support integration with unit test */
				that.fire('test:ready');
			});
			return this; /* chaining */
		},
		/**
		 * <p>
		 * plug all the actions defined by a plugin within the region
		 * </p>
		 * @method install
		 * @param {Object} plugin a object with the plugin definition
		 * @return {Object} region reference to support chaining
		 */
		install: function (plugin) {
			var a;
			if (plugin) {
				for (a in plugin) {
					if (plugin.hasOwnProperty(a)) {
						this.on(a, plugin[a]);
						YAHOO.log ('[YRegion2] adding a new message: ', this.guid, a);
					}
				}
			}
			return this; /* chaining */
		},
		/**
		 * <p>
		 * inject a plugin within the region
		 * </p>
		 * @method initPlugin
		 * @param {String} name the plugin that should be injected within the region
		 * @return {Object} region reference to support chaining
		 */
		initPlugin: function (name) {
			if (_PLUGINS.hasOwnProperty(name)) {
			  this.install(_PLUGINS[name]);
		    } else {
			  YAHOO.log ('[YRegion2] error adopting a unknown plugin:', name);
		    }
			return this; /* chaining */
		}, 
		/**
		 * <p>
		 * insert a set of YUI Modules and execute a callback method. The last argument in the list is the callback function
		 * </p>
		 * @method use
		 * @param {Array} Arguments
		 * @return {Object} region reference to support chaining
		 */
		use: function () {
			var a=Array.prototype.slice.call(arguments, 0),
				callback = a.pop ();
			if (callback) {
			  if (a && a.length > 0) {
				  // using the YUI loader utility to load the requirements...
				  _loaderQueue.push ({
					  require: a, 
					  callback: callback,
					  type: 'js' /*TODO: this._loader.type*/
				  });
				  if (_loaderQueue.length == 1) {
					  _loaderDispatch();
				  }
			  } else {
				  callback.call ();
			  }
			}
			return this; /* chaining */
		},
		/**
		 * <p>
		 * include a set or requirements and dependencies before intanciate the region
		 * </p>
		 * @method include
		 * @param {Array} mods set of YUI modules that most be included in the current page
		 * @param {Array} files set of files that should be included in the current page
		 * @param {Function} callback a function to call when the YUI modules and the files get loaded
		 * @return {Object} region reference to support chaining
		 */
		include: function (mods, files, callback) {
			var f = Array.prototype.slice.call(files, 0),
				that = this;
			if (callback) {
			  mods.push (function(M) {
				// loading the inclusions
				YAHOO.log ('[YRegion2] the requirements are ready, now we need to load the dependencies: ', f );
				if (YAHOO.lang.isArray(f) && (f.length > 0)) {
					YAHOO.util.Get.script(f, { 
					  onSuccess: function(o) {
						_cache(files);
						o.purge(); //removes the script node immediately after executing;
						// everything is ready...
						callback.apply (that, []);
					  },
					  onFailure: {}
					});
					} else {
						// everything is ready...
						callback.apply (that, []);
					} 
			  });
			  this.use.apply (that, mods);
			}
			return this; /* chaining */
		},
		/**
		 * <p>
		 * Set a new content for node element within the region
		 * </p>
		 * @method setContent
		 * @param {String} xpath a selector to localize an node element within the region
		 * @param {String|Object} bd the string to be set as a content of the node
		 * @return {Object} region reference to support chaining
		 */
		setContent: function (xpath, bd) {
			// {@caridy: TODO: apply the guid filter to this selector as well}
			var el = YAHOO.util.Selector.query(xpath, this.container, true); 
			if (el) {
				// purge the child elements and the events attached...
				for (var i=0;i<el.childNodes.length;i++) {
				  this.Event.purgeElement ( el.childNodes[i], true );
				}
				el.innerHTML = bd;
				this.bubbling ('region', 'contentchange', {
					node: this.node
				});
			}
			else { 
				YAHOO.log ('[YRegion2] Invalid Selector: ', xpath); 
			}
			return this; /* chaining */
		},
		/**
		 * <p>
		 * Set a new content for the region
		 * </p>
		 * @method setBody
		 * @param {String|Object} bd the string to be set as a content of the region
		 * @return {Object} region reference to support chaining
		 */
		setBody: function (bd) {
			var el = this.container, i;
			if (el && this.Dom.inDocument(el)) {
				// purge the child elements and the events attached...
				for (i=0;i<el.childNodes.length;i++) {
				  this.Event.purgeElement ( el.childNodes[i], true );
				}
				this.node.set('innerHTML', bd);
				this.bubbling ('region', 'contentchange', {
					node: this.node
				});
			}
			return this; /* chaining */
		},
		/**
		 * <p>
		 * Add a new DOM structure (content or DOM representation) into the region or a node element within the region
		 * </p>
		 * @method addToBody
		 * @param {String|Object} bd an string or a object that represent a DOM element thru a literal
		 * @param {Node} mod configuration object for the child region that should be initialized.
		 * @return {Object} region reference to support chaining
		 */
		addToBody: function (bd, n) {
			var o, a;
			if (this.Lang.isString(bd)) {
				bd = {innerHTML: bd};
			}
			n = n || this.node;
			this.Lang.augmentObject(bd, {type: 'div', attributes: {}, innerHTML: ''});
			if (bd) {
				o = document.createElement(bd.type);
				/* adding attributes */
				for (a in bd.attributes) {
					if (bd.attributes.hasOwnProperty(a)) {
						o.setAttribute(a, bd.attributes[a]);
					}
				}
				o.innerHTML = bd.innerHTML;
				n.appendChild(o);
				this.bubbling ('region', 'contentchange', {
					node: this.node
				});
			}
			return this; /* chaining */
		},
		/**
		 * <p>
		 * Init a child region instance
		 * </p>
		 * @method initChild
		 * @param {String} guid the global unique identifier for a child region
		 * @param {Object} mod configuration object for the child region that should be initialized.
		 * @return {Object} region reference to support chaining
		 */
		initChild: function (guid, mod) {
			mod = mod || {};
			mod.parentRegion = this;
			mod.parent = this.guid;
			obj.initRegion (guid, mod);
			return this; /* chaining support */
		},
		/**
		 * <p>
		 * Wake a child region, initializing a lazyload region instance
		 * </p>
		 * @method wakeChild
		 * @param {String} guid the global unique identifier for a child region
		 * @return {Object} region reference to support chaining
		 */
		wakeChild: function (guid) {
			if (guid && this.childs.hasOwnProperty(guid) && this.childs[guid].lazyload) {
				this.initChild (guid, this.childs[guid]);
			}
			return this; /* chaining support */
		},
		/**
		 * <p>
		 * Set a new child for the current region.
		 * </p>
		 * @method setChild
		 * @param {Object} mod configuration object for a new child region.
		 * @return {Object} region reference to support chaining
		 */
		setChild: function (mod) {
			this.childs = this.childs || {};
			if (mod && mod.guid) {
				this.childs[mod.guid] = mod;
			}
			return this; /* chaining support */
		},
		/**
		 * <p>
		 * getting a child region based on the GUID.
		 * </p>
		 * @method getChild
		 * @param {String} guid for a child region.
		 * @return {Object} a reference to a child region
		 */
		getChild: function (guid) {
			return ((this.childs && this.childs.hasOwnProperty(guid))?this.child[guid]:null);
		},
		/**
		 * <p>
		 * getting a node element based on the CSS selector.
		 * </p>
		 * @method get
		 * @param {String} xpath for the desired element.
		 * @param {Node} node only if you want to be more specific, using this node as the root element for the search.
		 * @return {Node} the first node element for the specific query
		 */
		get: function (xpath, node) {
			node = node || this.node;
			var el = YAHOO.util.Selector.query(xpath, node.get('element'), true); 
			return (el?new YAHOO.util.Element(el):null);
		},
		/**
		 * Return the visualization properties for the current region
		 *
		 * The viewport obj looks like this: 
		 * <p>
		 * {x:10, y:10, width: 10, height: 10, ... }
		 * </p>
		 * 
		 * @method getViewport
		 * @return {Object} the literal object with the viewport properties 
		 */
		getViewport: function () {
			var el = this.container,
				r = this.Dom.getRegion (el) || null;
			if (r) {
				r.width = r.right - r.left;
				r.height = r.bottom - r.top;
				r.scrollWidth = parseInt(el.scrollWidth,10);
				r.scrollHeight = parseInt(el.scrollHeight,10);
				r.position = this.Dom.getStyle ('position') || '';
				r.overflow = this.Dom.getStyle ('overflow') || '';
			}
			return r;
		},
		/**
		 * Set new dimention properties for the current region
		 *
		 * The viewport o configuration looks like this: 
		 * <p>
		 * {width: 10, height: 10, ... }
		 * </p>
		 * 
		 * @method setViewport
		 * @param {Object} o literal object with the new configuration for the viewport
		 * @return {object} region reference to support chaining
		 */
		setViewport: function (o) {
			var f = this.Dom.setStyle, s;
			o = o || {};
			for (s in o) {
				if (o.hasOwnProperty(s)) {
					f (s, o[s]);
				}
			}
			return this; /* chaining support */
		},
		/**
		 * Set a new listener for an specific message
		 * @method on
		 * @param {String} layer the name of the message to listen for
		 * @param {Function} listener callback function
		 * @param {Object} args literal object that you want to use when this listener get executed
		 * @return {object} region reference to support chaining
		 */
		on: function (layer, listener, args) {
			this.listeners = this.listeners || {};
			if (!this.listeners.hasOwnProperty(layer)) {
				this.listeners[layer] = new YAHOO.util.CustomEvent(layer, this);
			}
			this.listeners[layer].subscribe (listener, args);
			return this; /* chaining */
		},
		/**
		 * Fire a message across the region
		 * @method fire
		 * @param {String} layer the name of the message to fire
		 * @param {Object} o literal object to attach to the message
		 * @return {boolean} the execution result, true if a listener stop the execution.
		 */
		fire: function (layer, o) {
			o = o || {};
			if (this.listeners && this.listeners.hasOwnProperty(layer)) {
if (layer.indexOf('mouse') !== 0) { YAHOO.log ('[YRegion2] Firing a message: ', this.guid, layer, o); }
				this.listeners[layer].fire (o);
			}
			return o.flagged;
		},
		/**
		 * <p>
		 * Sign a set of arguments based on a flagged property. If another listener had claim the message,
		 * setting the flagged to true, which means that no other listener should consume this message.
		 * </p>
		 * @method signature
		 * @param {Object} args literal object to sign
		 * @return {Object} the literal object with the signed arguments, null if the signing process fail.
		 */
		signature: function (args) {
			var a = (args[1]?args[1][0]:null);
			/* checking the current status for this event, it's the event was already stopped, the response is null */
			return ((a && a.flagged)?null:{layer: args[0], args: a, obj: args[2]});
		},
		inject: obj.inject,
		notify: obj.notify,
		/**
		 * <p>
		 * Process a list of messages, and bubble up those messages all the way up thru the parents
		 * </p>
		 * @method bubbling
		 * @param {String} layer the name of the event
		 * @param {Array|String} msgs The collection of messages.
		 * @param {Object} o Literal object to pass thru all the actions.
		 * @param {Boolean} flag if true only bubble up the event, not local confirmation.
		 * @return {Boolean} Whether or not a listener stop the execution or return false.
		 */
		bubbling: function (layer, msgs, o, flag) {
			o = o || {};
			o.layer = layer;
			msgs = (this.Lang.isArray(msgs)?msgs:[msgs]);
			if (!flag) { /* there is not need to send the messages for the current region */
			  for (var i=0; i<msgs.length; i++) {
				if (layer != 'mouse') {
				  YAHOO.log ('[YRegion2] new bubbling up message: ', this.guid, layer + ":" + msgs[i], o);
				}
				this.fire(layer + ":" + msgs[i], o);
			  }
			}
			if (this.parentRegion && !o.flagged) {
				this.parentRegion.bubbling(layer, msgs, o);
			}
			return o.flagged;
		},
		/**
		 * <p>
		 * Process a message, and broadcasting the message to all the child regions
		 * </p>
		 * @method broadcast
		 * @param {String} message the name of the message
		 * @param {Object} o Literal object to pass thru all the actions.
		 * @param {Boolean} flag if true only broadcast the event, not local confirmation.
		 * @return {Boolean} Whether or not a listener stop the execution or return false.
		 */
		broadcast: function (layer, msg, o, flag) {
			var c;
			o = o || {};
			o.layer = layer;
			o.flagged = false; /* you can't stop a broadcast message */
			if (!flag) { /* there is not need to send the messages for the current region */
			  this.fire(layer + ":" + msg, o);
			  YAHOO.log ('[YRegion2] new broadcast message: ', this.guid, layer + ":" + msg, o);
			}
			/* initializing the child regions */
			if (this.childs) {
				for (c in this.childs) {
					/* the childs with the lazyload are not ready yet */
					if (this.childs.hasOwnProperty(c) && (!this.childs[c].lazyload)) {
						o.flagged = false; /* you can't stop a broadcast message */
						this.childs[c].broadcast(layer, msg, o);
					}
				}
			}
			return o.flagged;
		},
		/**
		 * <p>
		 * Execute an AJAX command, sending a request to the server, and calling the corresponding callback
		 * </p>
		 * @method execute
		 * @param {String} command the value for the command object passed thru the AJAX request as GET (command=value)
		 * @param {Object} args Literal object with a set of post argument to send thru the AJAX request.
		 * @param {Object} callback a function or an object that represent a callback for the AJAX request.
		 * @return {Object} a YUI Connection Manager handle object.
		 */
		execute: function (command, args, callback) {
			var query = '', a,
				uri = '/ajax/'+this.ns+'/ws',
				that = this, 
				postargs = {},
				getargs = {},
				c, h;
			/* builing the get arguments */
			this.Lang.augmentObject(getargs, this.getargs, true);
			getargs.guid = this.guid; /* adding the guid as a get argument */
			getargs.command = command; /* adding the command as a get argument */
			/* using a custom ws url */
			if (this.ws) {
				uri = this.ws;
			}
			uri = obj.augmentURI (uri, getargs);
			/* builing the post arguments */
			args = args || {};
			this.Lang.augmentObject(postargs, this.postargs, true);
			this.Lang.augmentObject(postargs, args, true);
			for (a in postargs) {
				if (postargs.hasOwnProperty(a)) {
					query += (query===''?'':'&')+a+'='+postargs[a];
				}
			}
			if (YAHOO.util.Connect) {
				YAHOO.log ('[YRegion2] executing: ', uri, query);
				/* defining the default behavior */
				c = {
					success: function(o) {
						that.fire ('region:executed', {
							type: 'ajax',
							o: o,
							command: command,
							args: args
						});
					},
					failure: function(o) {
						that.fire ('region:error', {
							type: 'ajax',
							o: o,
							command: command,
							args: args
						});
					}
				};
				if (this.Lang.isFunction(callback)) {
					c.success = function(o) {
						callback.apply (that, [o]);
					};
				} else if (this.Lang.isObject(callback) && callback) {
					/* the callback is an object */
					c = callback;
				}			
				/* if there is not POST arguments, the request should be GET */
				h = YAHOO.util.Connect.asyncRequest((query===''?'GET':'POST'), uri, c, query);
				/* sending the executing message */
				that.bubbling ('region', 'loading', {
					type: 'ajax',
					node: that.node,
					handle: h,
					command: command,
					args: args
				});
				/* returning the transaction ID */
				return h;
			}
			return null;
		},
		/**
		 * <p>
		 * Destroy the region object. Only the parent, the application layer, a region that knows this region, or the region itself 
		 * can destroy the region. 
		 * </p>
		 * @method destroy
		 * @param {Object} arg Literal object with more information about the destroy action.
		 * @return void
		 */
		destroy: function (args) {
			args = args || {};
			this.fire('region:destroy', args);
			if (this.container) {
				this.Event.purgeElement ( this.container, true );
				/* removing the DOM structure if needed */
				if (!args.partial) {
					this.container.parentNode.removeChild (this.container);
				}
			}
			/* child regions should be destroyed as well */
			if (this.childs) {
				for (var c in this.childs) {
					if (this.childs.hasOwnProperty(c) && (!this.childs[c].lazyload)) {
						// the childs with the lazyload don't need to be destroyed 
						this.destroy (args);
					}
				}
			}
			/* destroying the region itself */
			obj.destroyRegion (this);
		}
	};
	
	/**
	 * <p>
	 * Fire a notification message to a region
	 * </p>
	 * @method notify
	 * @for YRegion2
	 * @param {String} guid the global unique identifier for a region that should receive the message
	 * @param {String} layer the name of the message to fire
	 * @param {Object} o literal object to attach to the message
	 * @return {boolean} the execution result, true if a listener stop the execution.
	 */
	obj.notify = function (guid, layer, o) {
		if (guid && _MODS.hasOwnProperty(guid)) {
			return _MODS[guid].fire(layer, o);
		}
	};
	/**
	 * <p>
	 * Fire a broadcast message across all the application
	 * </p>
	 * @method broadcast
	 * @param {String} msg the name of the message to fire
	 * @param {Object} o literal object to attach to the message
	 * @return {boolean} the execution result, true if a listener stop the execution.
	 */
	obj.broadcast = function (msg, o) {
		if (_bd) {
		  return _bd.broadcast('broadcast', msg, o);
		}
	};
	/**
	 * <p>
	 * Register a new region definition in the current page
	 * </p>
	 * @method setRegionDefinition
	 * @param {String} ns namespace for the region definition
	 * @param {Object} c region definition
	 * @return void
	 */
	obj.setRegionDefinition = function (ns, c) {
		if (!_LOADERS.hasOwnProperty(ns)) {
			// registering the new region
			_LOADERS[ns] = new _modLoader (ns);
		}
		if (c) {
			c.ns = ns;
			_LOADERS[ns].set(c);
		}
	};
	/**
	 * <p>
	 * Check if a region definition was already registered
	 * </p>
	 * @method isRegion
	 * @param {String} ns namespace for the region definition
	 * @return {Boolean} Whether or not the region definition was registered.
	 */
	obj.isRegion = function (ns) {
		return _LOADERS.hasOwnProperty(ns);
	};
	/**
	 * <p>
	 * Create a new instance of a region definition based on a configuration object
	 * </p>
	 * @method initRegion
	 * @param {String} guid global unique identifier (div->id) for the new region instance
	 * @param {Object} conf a region instance configuration object
	 * @return void
	 */
	obj.initRegion = function (guid, conf) {
		_waiting.push ({
			method: 'initRegion',
			args: [guid, o]
		});
	};
	/**
	 * <p>
	 * Destroy a instance of a region definition based on a configuration object
	 * </p>
	 * @method destroyRegion
	 * @param {Object} conf a region instance configuration object
	 * @return void
	 */
	obj.destroyRegion = function (conf) {
		if (conf && conf.guid && conf.ns && _MODS.hasOwnProperty(conf.guid) && (conf === _MODS[conf.guid])) {
		  delete _MODS[conf.guid];
		} else {
		  // error: someone is trying the remove a region (only the region itself can do this call)
		  YAHOO.log ('[YRegion2] Someone is trying the remove a region', conf);
		}
	};
	/**
	 * <p>
	 * Clear a instance of a region definition based on a guid
	 * </p>
	 * @method clearRegion
	 * @param {String} guid global unique identifier (div->id) for the region instance
	 * @return void
	 */
	obj.clearRegion = function (guid) {
		if (_MODS.hasOwnProperty(guid)) {
			YAHOO.log ('[YRegion2] removing the region manually.', guid);
			_MODS[guid].destroy ({partial: true});
		}
	};
	/**
	 * <p>
	 * Register a new plugin definition in the current page
	 * </p>
	 * @method setPluginDefinition
	 * @param {String} name the name of the plugin
	 * @param {Object} plugin an object with the plugin definition
	 * @return void
	 */
	obj.setPluginDefinition = function (name, plugin) {
		if (!_PLUGINS.hasOwnProperty(name)) {
			// registering the new plugin
			_PLUGINS[name] = plugin;
		}		
	};
	/**
	 * <p>
	 * Check if a plugin definition was already registered
	 * </p>
	 * @method isPlugin
	 * @param {String} name the name of the plugin to verify
	 * @return {Boolean} Whether or not the plugin definition was registered.
	 */
	obj.isPlugin = function (name) {
		return _PLUGINS.hasOwnProperty(name);
	};
	/**
	 * <p>
	 * Inject/Instantiate a plugin into a global region definition (document.body)
	 * </p>
	 * @method initPlugin
	 * @param {String} name the name of the plugin to be injected into the global region
	 * @return void
	 */
	obj.initPlugin = function (name) {
		_waiting.push ({
			method: 'initPlugin',
			args: [name]
		});
	};
	
	//--------------------------------------
   	//  Begin public interface definition
   	//--------------------------------------	
	/**
     * <p>
     * Searching for an event owner based on the classname, it's similar to the ancestor method but applying the same routine to the node itself
     * </p>
     * @method getOwnerByClassName
     * @param {Node} node The Node element.
     * @param {String} className the class name to search for
     * @param {Integer} level the analyzis level, for performance you should try to find the ancestor within a range of levels
     * @return {Node} The matching DOM node or null if none found.
     */
	obj.getOwnerByClassName = function(node, className, level) {
		var el;
		if (!node) { return null; }
		if (!node.hasClass(className)) {
			el = YAHOO.util.Dom.getAncestorByClassName (node.get('element'), className);
			node = (el?new YAHOO.util.Element(el):null);
		}
		return node;
    };
    /**
     * <p>
     * Searching for an event owner based on the tagMame, it's similar to the ancestor method but applying the same routine to the node itself
     * </p>
     * @method getOwnerByTagName
     * @param {Node} node The Node element.
     * @param {String} tagName the tagName to search for
     * @param {Integer} level the analyzis level, for performance you should try to find the ancestor within a range of levels
     * @return {Node} The matching DOM node or null if none found.
     */
	obj.getOwnerByTagName = function(node, tagName, level) {
		tagName = tagName.toUpperCase();
		if (!node) { return null; }
		var el, t = node.get('tagName');
		if (t.toUpperCase() != tagName) {
			el = YAHOO.util.Dom.getAncestorByTagName (node.get('element'), tagName);
			node = (el?new YAHOO.util.Element(el):null);
		}
		return node;
	};
	obj.strictMode = true; /* default mode for the URIs in your website */
	/**
     * <p>
     * Augment an url with more parameters, overriding...
     * </p>
     * @public
     * @param {string} url 
     * @param {string|array} m   an string like a query string or an json object
     * @return string
     */
    obj.augmentURI = function( url, m ) {
		m = m || {};
	    var o = _parseUri(url, this.strictMode),
	        u = '';
		o.queryKey = o.queryKey || {};
		YAHOO.lang.augmentObject(o.queryKey, m, true);
		if (o.protocol) { u += o.protocol + ':'; }
		if (this.strictMode) {
			if (/^(?:[^:\/?#]+:)?\/\//.test(o.source)) { u += '//'; }
		} else {
			if (/^(?:(?![^:@]+:[^:@\/]*@)[^:\/?#.]+:)?\/\//.test(o.source)) { u += '//'; }
		}
		if (o.authority) {
			if (o.userInfo) {
				if (o.user) { u += o.user; }
				if (o.userInfo.indexOf(':') > -1) { u += ':'; }
				if (o.password) { u += o.password; }
				u += '@';
			}
			if (o.host) { u += o.host; }
			if (o.port) { u += ':' + o.port; }
		}
		if (o.relative) {
			if (o.path) {
				if (o.directory) { u += o.directory; }
				if (o.file) { u += o.file; }
			}
			u += '?';// + o.query;
			for (var sName in o.queryKey) {
				if (o.queryKey.hasOwnProperty(sName)) {
					u += sName+'='+o.queryKey[sName]+'&';
				}
			}
			if (o.anchor) { u += '#' + o.anchor; }
		}
		return u;
    };
	/**
     * <p>
     * Analyze all the classes for the node, and getting the list of hooks.
     * </p>
     * @method getHooks
     * @param {Node} node A node element to get the className and return the hooks list.
     * @return {Array} The collection of hooks (string).
     */
	obj.getHooks = function (node) {
		var hooks;
		if (node) {
			hooks = _parseHooks(node.get('className'));
		}
	  	return hooks;
	};
	/**
     * <p>
     * get the real YUI Button reference from a node element, usually the target for a certain event
     * </p>
     * @method getYUIButton
     * @param {Node} node The Node element.
     * @return {Object} A reference to a real YUI Button object.
     */
	obj.getYUIButton = function (node) {
		node = this.getOwnerByClassName( node, 'yui-button' );
		return ((node && YAHOO.widget.Button)?YAHOO.widget.Button.getButton(node.get('id')):null);
	};
	/**
     * <p>
     * Inject JS and/or CSS blocks in the current page
     * </p>
     * @method inject
     * @param {Object} conf a literal object with the configuration of the JS and CSS that you want to insert in the page dynamically
     * @return void
     */
	obj.inject = function (conf) {
		var h = document.getElementsByTagName('head')[0] || document.documentElement, s;
		conf = conf || {};
		if (conf.css) {
			// injecting css
			s = document.createElement("style");
			s.type = "text/css";
			if (s.styleSheet && (typeof s.styleSheet === 'object')) {
			  s.styleSheet.cssText = conf.css;
			} else {
			  s.appendChild(document.createTextNode(conf.css));
			}
			h.appendChild(s);
		}
		if (conf.js) {
			// injecting js
			s = document.createElement('script');
			conf.js = conf.js.replace (_reTrim, '');
			s.type = "text/javascript";
			/* hack: IE doesn't support appendChild+document.createTextNode, using .text instead */
			if (YAHOO.env.ua.ie) {
				s.text = conf.js;
			} else {
				s.appendChild( document.createTextNode( conf.js ) );
			}
			h.insertBefore(s, h.firstChild);
			h.removeChild(s);
		}
	};
	
	var c = window.YRegion2_config || {},
		root = {
			ns: 'yregion',
			require: c.require || [],
			_debug: c._debug,
			_loader: c._loader,
			dependencies: c.dependencies,
			plugins: c.plugins,
			actions: {
				'region:ready': function () {
					var i, m, k;
					/* the general infrastrucure is ready */
					_bd = this;
					/* setting the listeners */
					
					// clicks events...
					this.node.on('click', function(e) {
						var o = _getSemantic(e),
							m = _parseHooks ( o.classes ), 
							r = _trickling(_bd, o.target);
						m.push('click');
						if (o.target && r) {
							r.bubbling ('click', m, o);
						}
					});
					
					// mouse events
					m =  function(e) {
						var o = _createMsgObject (e),
							r = _trickling(_bd, o.target), t;
						if (o.target && r) {
							// checking for region:mouseenter
							if ((o.target.get('element') == r.node.get('element')) && (t = _bd.Event.getRelatedTarget (e)) && !_bd.Dom.isAncestor(r.container, t)) {
								r.fire ('region:'+e.type, o);
							}
							// default mouse over message
							r.bubbling ('mouse', e.type, o);
						}
					};
					this.node.on("mouseover", m);
	    			this.node.on("mouseout", m);
					
					// keyboard events...
					k = function(e) {
						_bd.broadcast ('key', e.type, _createMsgObject (e));
					};
					this.Event.on(document, "keyup", k);
					this.Event.on(document, "keydown", k);
					
					// window events...
					this.Event.on(window, "resize", function(e) {
						_bd.broadcast ('window', 'resize', _createMsgObject (e));
					});
					
					/* transforming the region initialization mechanism */
					obj.initRegion = _initRegion;
					/* transforming the plugins mechanism */
					obj.initPlugin = _initPlugin;
					/* dispatching the waiting line */
					if (_waiting.length > 0) {
						while ((i = _waiting.pop())) {
							obj[i.method].apply(obj, i.args);
						}
					}
					/* extending the global region */
					if (c.actions && this.Lang.isFunction(c.actions['region:ready'])) {
						c.actions['region:ready'].apply (this, []);
					}
					this.install ((c.actions || {}));
				},
				'click:click': function () {
					YAHOO.log ('[YRegion2] global "click:click": ', arguments);
				}
			},
			onAvailable: function (f) {
				var that = this;
				/* waiting for the document.body element */
				YAHOO.log ('[YRegion2] waiting for the document.body element');
				if (!document.body) {
					that._handle = setInterval(function() {
						try {
							// throws an error if document.body is not exist
							if (YAHOO.lang.isObject(document.body)) {
								clearInterval(that._handle);
								f.apply (document.body, []);
							}
						} catch (e) {
						}
					}, YAHOO.util.Event.POLL_INTERVAL);
				} else {
					f.apply (document.body, []);
				}
			},
			args: {}
		};

	/* global region definition: document.body */
	_initRegion((c.guid?c.guid:'yregion'), root);
	
	return obj;
}();