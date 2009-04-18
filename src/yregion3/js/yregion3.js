/*
 * Provides YRegion Utility definition based on YUI 3.x.
 *
 * YRegion allows us to define the functionality of different areas (regions) on the page, 
 * controlling the events, the loading process of its dependencies and setting a secure scope 
 * to define the region functionality in a consistent way. 
 * 
 * It also creates a communication infrastructure layer among the regions on the page. 
 * 
 * @module YRegion
 * @static
 */
YRegion = window.YRegion || function(){
    var obj = {},
	    _Y = null,
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
		_loaderQueue = [],
		_bd = null;

	/*
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
	/*
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
	/*
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
	/*
	 * Create a message object based on a DOM Event
	 * @method _loaderDispatch
	 * @private
	 * @static
	 * @return void
	 */
	function _loaderDispatch () {
		var r;
		if (_loaderQueue.length > 0) {
			_Y.log ('[YRegion] [Loader Queue] loading... ', 'info', _loaderQueue[0]);
			r = Array.prototype.slice.call(_loaderQueue[0].require, 0);
			
			/* inserting the requirements (Y.use) */
			r.push(function(Y) {
				_Y.log ('[YRegion] [Loader Queue] success...', 'info');
				_loaderNext(true);
			});
			_Y.use.apply(_Y, r);
		}
	}
	/*
	 * Create a message object based on a DOM Event, the message object will be passed
	 * to all the listeners, and can be populated using the signature event.
	 * @method _createMsgObject
	 * @private
	 * @static
	 * @param {Object} e - YUI Event Object.
     * @return {Object} the message object with the status and the stopEvent method
	 */
	function _createMsgObject (e) {
		var o = { 
			event: e, 
			flagged: false 
		};
		o.target = e.target || _bd.node;
		o.stopEvent = function () { 
			o.flagged = true; 
			e.halt(); // equivalent to: e.stopPropagation() plus e.preventDefault() 
		};
		return o;
	}
	/*
	 * Transform the target element into a semantic object
	 * @method _getSemantic
	 * @private
	 * @static
	 * @param {Object} e - DOM Event reference.
     * @return {Object} Semantic object that represents the semantic of the target element
	 */
	function _getSemantic(e) {
	  e = e || {};
	  var o = _createMsgObject (e), el;
	  /* analyzing the semantic meaning of the target */
	  if (o.event && o.target) {
	  	//o.trigger = obj.getOwnerByTagName(o.target, 'trigger', 5);
		o.anchor = obj.getOwnerByTagName(o.target, 'A', 5);
	  	if (!o.yuibutton && !o.anchor) {
	  		if ((o.target.getAttribute('tagName') == 'INPUT') && (o.input = o.target)) {
  			} else if ((o.target.getAttribute('tagName') == 'BUTTON') && (o.button = o.target)) {
  			} else {
				o.select = obj.getOwnerByTagName(o.target, 'SELECT', 2);
  				if (o.select) {
				  el = _Y.Node.getDOMNode(o.select);
  				  o.value = el[el.selectedIndex].value;
				}
  			}
		}
		/* checking if the target is a yuibutton */
		if ((o.anchor || o.button) && (o.yuibutton = obj.getYUIButton(o.target))) {
			o.value = o.yuibutton.get ('value');
			o.classes = o.yuibutton.getAttribute ('className');
		}
		o.trigger = o.trigger || o.anchor || o.yuibutton || o.input || o.select || o.target; /* priority order */
		if (o.trigger) {
			o.value = o.value || o.trigger.get('value');
			o.classes = o.classes || o.trigger.getAttribute('className');
		}
	  }
	  return o;
	}
	/*
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
	/*
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
			_Y.on ('domready', function(o) {
				_Y.log ('[YRegion] init region on DOMReady: '+guid, 'info');
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
	/*
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
	/*
	 * Inspecting child regions to determine which region owns the target element.
	 * @method _trickling
	 * @private
	 * @static
     * @param {Object} region A Region object reference.
	 * @param {Node|Object} target A Node instance that represents the target HTMLElement.
     * @return {Object} A Region object reference.
     */
	function _trickling(region, target) {
		var c, el = target;
		if (target) {
			_Y.Object.each(region.childs, function(v, i) {
				/* the childs with the lazyload are not ready yet to receive a message */
				if (!v.lazyload && ((el === v.node) || v.node.test('#'+v.guid+' *'))) {
					/* comparing the event target with the region container or testing if it's a child element */	
					return _trickling (v, target);
				}
			}, obj, false);
		}
		return region; // chain support
	}
	/*
	 * Parsing an url using strict of loose mode.
	 * TODO: modify to use strict mode with an static regex
	 * @method _trickling
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
	/*
	 * Creating an object with the shorthands references.
	 * @method _getShorthands
	 * @return {Object} A object with the default list of shorthands.
     */
	function _getShorthands(r) {
		/* setting the default shorthands */
		var Y = YUI();
		return Y.use.apply(Y, r);
	}
	
	/* Regions Loader */
	_modLoader = function (ns) {
		this.ns = ns;
	};

	/*
	 * <p>
	 * Definiting an object to control the loading process for the Region Definitions, everytime you 
	 * try to initialize a region, the new region instance needs to load the region definition 
	 * on demand.
	 * </p>
	 * @method _modLoader
	 * @param {String} uri the uri to load a file on demand (js or css)
	 * @param {Object} callback Literal object (success, failure).
	 * @return {Object} Get Utility handler.
	 */
	_modLoader.prototype = {
		/*
		 * <p>
		 * loading the Region Definition
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
					uri += ((uri.indexOf('?') == -1)?'?':'&') + "rnd=" + new Date().valueOf().toString();
				}
				return _Y.io.script(uri, callback);
			},
			/*
			 * <p>
			 * setting the Region Definition, when a new region definition is included in the current page,
			 * these method will be executed to notify to everybody that a new region definition is ready.
			 * </p>
			 * @method set
			 * @param {Object} object with the region definition.
			 * @return void
			 */
			set: function (mod) {
				/* the new region definition should inherit from generic region */
				_Y.aggregate(mod, _regionAbstraction);
				this._mod = mod;
				// finally, notifying everybody that the region definition is ready
			    this.notify();
			},
			/*
			 * <p>
			 * creating a new instance, inheriting the region definition methods.
			 * </p>
			 * @method create
			 * @param {Object} mod Instance of the new region.
			 * @return void
			 */
			create: function (mod) {
				/* mod is an instance of the this._mod */
				_Y.aggregate(mod, this._mod);
				// storing the region instance reference
				_MODS[mod.guid] = mod;
				/* initializing the region instance */
				mod.init();
			},
			/*
			 * <p>
			 * subscribing a new instance to this region definition, when the class become available, the 
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
			/*
			 * <p>
			 * notifying to all the subscribers that the region definition is ready, this process will 
			 * garranty that this region instances will be instantiated after the class become available.
			 * </p>
			 * @method notify
			 * @return void
			 */
			notify: function () {
				var l;
				/* firing each listener */
				if (_Y.Lang.isArray(this._instances)) {
				  while ((l = this._instances.pop())) {
					this.create (l);
				  }
				}
			}
		};
		
		/* Generic Region */
		_regionAbstraction = {
			init: function () {
			    _Y.log ('[YRegion] creating: '+this.guid, 'info');
				var f, i, files = [], r, l, that = this;
				/* filtering get and post arguments for the server side */
				this.getargs = (this.getargs?this.getargs:{});
				this.postargs = (this.postargs?this.postargs:{});
				_Y.log ('[YRegion] decoding server (get and post) arguments: '+this.guid, 'info', this);
			    // starting the loading routine for the dependencies...
				// loading the requiredments
			    this.require = this.require || [];
				// getting the official list to load
				r = Array.prototype.slice.call(this.require, 0);
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
							f.fullpath += ((f.fullpath.indexOf('?') == -1)?'?':'&') + "rnd=" + new Date().valueOf().toString();
						}
						files.push (f.fullpath);
					}
				}
_Y.log ('[YRegion] loading the requirements: '+this.guid, 'info', r);
				f = function () {
					_Y.log ('[YRegion] the DOM element for the region is ready: '+that.guid, 'info', that);
					/* if the region have a wrapper, we can assume that we need to create the container within that wrapper */
					if (that.wrapper) {
_Y.log ('[YRegion] creating the container for the area: '+that.guid, 'info', that);
						that.addToBody({
							attributes: {
								id: that.guid
							}
						}, this);
					}
					/* if the region is an AJAX region, it shoult be loaded dynamically using YUI Connection Manager */
					if (that.ajax) {
_Y.log ('[YRegion] init an AJAX region', 'info');
						/* we shoudl use ajax to load the content of the region */
						//_Y.aggregate(that, _getShorthands(that.require));
						that.execute('render', {}, function(o) {
							that.node.set('innerHTML', o.response);
							that.ready();
						});
					} else {
						that.ready();
					}
				};
				
				// finally, executing the ready method
				this.include(r, files, function () {
					that.available (f);
				});
				return this; /* chaining */
			},
			available: function (f) {
				var that = this;
				/* inserting the default requirements (Y.use) */
				that.require.push("event", "node", function() {
					/* waiting until the body element become available, probably we should wait until domready instead  */
					that.waiting(f);
				});
				/* creating the custom loader object. 
				 * - In theory this initialization process doesn't need to load any file, because
				 *   the files were already loaded, so the intension is to create Y obj with the custom requirements, 
				 *   instead of using the whole set of available components. so _Y <> Y 
				 */
				that.Y = YUI();
				console.log (that.require);
				that.Y.use.apply(that.Y, that.require);
				return that; /* chaining */
			},
			waiting: function (f) {
				this.node = this.get ('#'+this.guid);
				/* if the wrapper exists, we should wait until the wrapper become available */
				var n = (this.wrapper?this.get('#'+this.wrapper):this.node);
				_Y.log ('[YRegion] the dependencies are ready, now we need to wait for the DOM element: '+ this.guid, 'info', n);
				if (n) {
					n.on('available', f);
				}
			},
			ready: function () {
				var c, i, that = this;
				this.node.setAttribute('id', this.guid);
				/* expending with the shorthands */
				//_Y.aggregate(this, _getShorthands(this.require));
				/* checking for the plugins: installing them if needed */
				this.install (this.actions);
				if (_Y.Lang.isArray(this.plugins)) {
					for (i=0;i<this.plugins.length;i++) {
					  this.initPlugin (this.plugins[i]);
					}
				}
				/* if the region have a parent, it should notify that it's ready */
				if (this.parentRegion) {
					this.parentRegion.setChild (this);
				}
				this.node.addClass (_region_class);
				/* initializing the child regions */
				
				_Y.Object.each(that.childs, function(v, i) {
					/* the childs with the lazyload should be loaded manually */
					if (!v.lazyload) {
						that.initChild(i, v);
					}
				}, that, false);
				
				this.fire('region:ready');
				
				_Y.on('contentready', function () {
					_Y.log ('[YRegion] region is ready to be expanded: '+ that.guid, 'info');
					that.fire('region:contentready');
					/* also, yregion support integration with unit test */
					that.fire('test:ready');
				}, '#'+this.guid, this);
				
				return this; /* chaining */
			},
			install: function (plugin) {
				var that = this;
				_Y.Object.each(plugin, function(v, i) {
					that.on(i, v);
					_Y.log ('[YRegion] adding a new message: '+ that.guid, 'info', i);
				}, that, false);
				return this; /* chaining */
			},
			initPlugin: function (name) {
				if (_PLUGINS.hasOwnProperty(name)) {
				  this.install(_PLUGINS[name]);
			    } else {
				  _Y.log ('[YRegion] error adopting a unknown plugin: '+name, 'info');
			    }
				return this; /* chaining */
			}, 
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
			include: function (mods, files, callback) {
				var f = Array.prototype.slice.call(files, 0),
					that = this;
				if (callback) {
				  mods.push (function(M) {
					// loading the inclusions
					_Y.log ('[YRegion] the requirements are ready, now we need to load the dependencies: '+that.guid, 'info', f );
					if (_Y.Lang.isArray(f) && (f.length > 0)) {
						_Y.Get.script(f, { 
						  onSuccess: function(o) {
							_cache(files);
							// everything is ready...
							callback.apply (that, []);
						  },
						  onFailure: {},
						  autopurge: true //removes the script node immediately after executing;
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
			setContent: function (xpath, bd) {
				/* by default we should use the node element for the region */
				bd = bd || this.node;
				var el =  _Y.Selector.query(xpath, _Y.Node.getDOMNode(_Y.get(bd)), true); 
				if (el) {
					// purge the child elements and the events attached...
					for (var i=0;i<el.childNodes.length;i++) {
					  _Y.Event.purgeElement ( el.childNodes[i], true );
					}
					el.innerHTML = bd;
					this.bubbling ('region', 'contentchange', {
						node: this.node
					});
				}
				else { 
					_Y.log ('[YRegion] Invalid Selector: ', 'info', xpath); 
				}
				return this; /* chaining */
			},
			setBody: function (bd) {
				var el = _Y.Node.getDOMNode(this.node);
				if (el) {
					// purge the child elements and the events attached...
					for (i=0;i<el.childNodes.length;i++) {
					  _Y.Event.purgeElement ( el.childNodes[i], true );
					}
					this.node.set('innerHTML', bd);
					this.bubbling ('region', 'contentchange', {
						node: this.node
					});
				}
				return this; /* chaining */
			},
			addToBody: function (bd, n) {
				var o, a;
				if (_Y.Lang.isString(bd)) {
					bd = {innerHTML: bd};
				}
				n = n || this.node;
				_Y.aggregate(bd, {type: 'div', attributes: {}, innerHTML: ''});
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
			initChild: function (guid, mod) {
				mod = mod || {};
				mod.parentRegion = this;
				mod.parent = this.guid;
				obj.initRegion (guid, mod);
				return this; /* chaining support */
			},
			wakeChild: function (guid) {
				if (guid && this.childs.hasOwnProperty(guid) && this.childs[guid].lazyload) {
					this.initChild (guid, this.childs[guid]);
				}
				return this; /* chaining support */
			},
			/*
			 * <p>
			 * setting a new child for the current region.
			 * </p>
			 * @method setChild
			 * @param {Object} mod reference to a certain region.
			 * @return {Object}
			 */
			setChild: function (mod) {
				this.childs = this.childs || {};
				if (mod && mod.guid) {
					this.childs[mod.guid] = mod;
				}
				return this; /* chaining support */
			},
			/*
			 * <p>
			 * getting a child region based on the GUID.
			 * </p>
			 * @method getChild
			 * @param {String} guid for a child region.
			 * @return {Object}
			 */
			getChild: function (guid) {
				return ((this.childs && this.childs.hasOwnProperty(guid))?this.child[guid]:null);
			},
			/*
			 * <p>
			 * getting a node element based on the CSS selector.
			 * </p>
			 * @method get
			 * @param {String} xpath for the desired element.
			 * @param {Object} node only if you want to be more specific, using this node as the root element for the search.
			 * @return {Object}
			 */
			get: function (xpath, node) {
				node = node || this.node;
				var el = _Y.Selector.query(xpath, _Y.Node.getDOMNode(node), true); 
				return (el?_Y.get(el):null);
			},
			/*
			 * Return the visualization properties for the current region
			 * @return {object} the literal object with the par {x:10, y:10, width: 10, height: 10, .... }
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
			setViewport: function (o) {
				var f = _Y.Dom.setStyle, s;
				o = o || {};
				for (s in o) {
					if (o.hasOwnProperty(s)) {
						f (s, o[s]);
					}
				}
				return this; /* chaining support */
			},
			on: function (layer, listener, args) {
				this._actions = this._actions || new this.Y.Event.Target();
				this._actions.publish(layer);
				this._actions.subscribe(layer, listener, this, args);
				return this; /* chaining */
			},
			fire: function (layer, o) {
				o = o || {};
				if (this._actions) {
					this._actions.fire (layer, o);
				}
				return o.flagged;
			},
			signature: function (args) {
				var a = (args[1]?args[1][0]:null);
				/* checking the current status for this event, it's the event was already stopped, the response is null */
				return ((a && a.flagged)?null:{layer: args[0], args: a, obj: args[2]});
			},
			inject: obj.inject,
			notify: obj.notify,
			/*
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
				msgs = (_Y.Lang.isArray(msgs)?msgs:[msgs]);
				if (!flag) { /* there is not need to send the messages for the current region */
				  for (var i=0; i<msgs.length; i++) {
					if (layer != 'mouse') {
					  _Y.log ('[YRegion] new bubbling up message: '+ layer + ":" + msgs[i], 'info', {
							msg: o,
							emisor: this
						});
					}
					this.fire(layer + ":" + msgs[i], o);
				  }
				}
				if (this.parentRegion && !o.flagged) {
					this.parentRegion.bubbling(layer, msgs, o);
				}
				return o.flagged;
			},
			/*
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
				  	_Y.log ('[YRegion] new broadcast message: '+layer + ":" + msg, 'info', {
						msg: o,
						emisor: this
					});
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
			execute: function (command, args, callback) {
				var query = '', a,
					uri = '/ajax/'+this.ns+'/ws',
					that = this, 
					postargs = {},
					getargs = {},
					c, h;
				/* builing the get arguments */
				_Y.Lang.augmentObject(getargs, this.getargs, true);
				getargs.guid = this.guid; /* adding the guid as a get argument */
				getargs.command = command; /* adding the command as a get argument */
				/* using a custom ws url */
				if (this.ws) {
					uri = this.ws;
				}
				uri = obj.augmentURI (uri, getargs);
				/* builing the post arguments */
				args = args || {};
				_Y.Lang.augmentObject(postargs, this.postargs, true);
				_Y.Lang.augmentObject(postargs, args, true);
				for (a in postargs) {
					if (postargs.hasOwnProperty(a)) {
						query += (query===''?'':'&')+a+'='+postargs[a];
					}
				}
				if (YAHOO.util.Connect) {
					_Y.log ('[YRegion] executing: '+ uri, 'info', {
						msg: o,
						emisor: this
					});
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
					if (_Y.Lang.isFunction(callback)) {
						c.success = function(o) {
							callback.apply (that, [o]);
						};
					} else if (_Y.Lang.isObject(callback) && callback) {
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
				return false;
			},
			destroy: function (args) {
				// TODO:
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
		
		/* global methods */
		obj.notify = function (guid, msg, args) {
			if (guid && _MODS.hasOwnProperty(guid)) {
				return _MODS[guid].fire(msg, args);
			}
		};
		obj.broadcast = function (msg, o) {
			if (_bd) {
			  return _bd.broadcast('broadcast', msg, o);
			}
		};
		/* regions */
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
		obj.isRegion = function (ns) {
			return _LOADERS.hasOwnProperty(ns);
		};
		obj.initRegion = function (guid, mod) {
			_waiting.push ({
				method: 'initRegion',
				args: [guid, mod]
			});
		};
		obj.destroyRegion = function (mod) {
			if (mod && mod.guid && mod.ns && _MODS.hasOwnProperty(mod.guid) && (mod === _MODS[mod.guid])) {
				delete _MODS[mod.guid];
			} else {
			  // error: someone is trying the remove a region (only the region itself can do this call)
			  return;
			}
		};
		
		obj.clearRegion = function (guid) {
			if (_MODS.hasOwnProperty(guid)) {
				_Y.log ('[YRegion] removing the region manually.', 'info');
				_MODS[guid].destroy ({partial: true});
			}
		};
		/* plugins */
		obj.setPluginDefinition = function (name, plugin) {
			if (!_PLUGINS.hasOwnProperty(name)) {
				// registering the new plugin
				_PLUGINS[name] = plugin;
			}		
		};
		obj.isPlugin = function (name) {
			return _PLUGINS.hasOwnProperty(name);
		};
		obj.initPlugin = function (name) {
			_waiting.push ({
				method: 'initPlugin',
				args: [name]
			});
		};
		
		//--------------------------------------
	   	//  Begin public interface definition
	   	//--------------------------------------	
		/*
	     * <p>
	     * Searching for an event owner based on the classname, it's similar to the ancestor method but applying the same routine to the node itself
	     * </p>
	     * @method getOwnerByClassName
	     * @param {HTMLElement} node The html element.
	     * @param {String} className the class name to search for
	     * @param {String} level the analyzis level, for performance you should try to find the ancestor within a range of levels
	     * @return {HTMLElement | null} The matching DOM node or null if none found.
	     */
		obj.getOwnerByClassName = function(node, className, level) {
			var fn = function(n) { 
				return n.hasClass(className); 
			};
			if (node && !node.hasClass(className)) {
				return node.ancestor( fn );
			}
			return node;
	    };
	    /*
	     * <p>
	     * Searching for an event owner based on the tagMame, it's similar to the ancestor method but applying the same routine to the node itself
	     * </p>
	     * @method getOwnerByTagName
	     * @param {HTMLElement} node The html element.
	     * @param {String} tagName the tagName to search for
	     * @param {String} level the analyzis level, for performance you should try to find the ancestor within a range of levels
	     * @return {HTMLElement | null} The matching DOM node or null if none found.
	     */
		obj.getOwnerByTagName = function(node, tagName, level) {
			tagName = tagName.toUpperCase();
			var fn = function(n) { 
				return (n.get('tagName').toUpperCase()==tagName); 
			};
			if (node && !fn(node)) {
				return node.ancestor( fn );
			}
			return node;
		};
	    /*
	     * <p>
	     * Testing is the node element is child of ancestor element
	     * </p>
	     * @method getOwnerByTagName
	     * @param {HTMLElement} node The html element.
	     * @param {HTMLElement} ancestor The ancestor html element.
	     * @param {String} level the analyzis level, for performance you should try to find the ancestor within a range of levels
	     * @return {HTMLElement | null} The matching DOM node or null if none found.
	     */
		obj.isAncestor = function(node, ancestor, level) {
			var fn = function(n) { 
				return (n===ancestor); 
			};
			if (node && ancestor) {
				return node.ancestor( fn );
			}
			return false;
		};
		obj.strictMode = true; /* default mode for the URIs in your website */
		/*
	    * augment an url with more parameters, overriding...
	    * @public
	    * @param {string} url 
	    * @param {string|array} m   an string like this 'param1=value1&param2=value2' or an array like this: {'param1':'value1','param2':'value2'}
	    * @return string
	    */
	    obj.augmentURI = function( url, m ) {
			m = m || {};
		    var o = _parseUri(url, this.strictMode),
		        u = '';
			o.queryKey = o.queryKey || {};
			_Y.aggregate(o.queryKey, m, true);
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
		
		
		/*
	     * <p>
	     * Analizing all the classes for the node, and getting the hooks.
	     * </p>
	     * @method getHooks
	     * @param {HTMLElement} node A node reference to get the className and return the hooks list.
	     * @return {Array} The collection of hooks (string).
	     */
		obj.getHooks = function (node) {
			var hooks;
			if (node) {
				hooks = _parseHooks(node.get('className'));
			}
		  	return hooks;
		};
		/*
	     * <p>
	     * getting the real YUI Button reference from a dom element, usually the target for a certain event
	     * </p>
	     * @method getYUIButton
	     * @param {HTMLElement} node The html element.
	     * @return {Object} A reference to a real YUI Button object.
	     */
		obj.getYUIButton = function (node) {
			// we don't have support for YUI Buttons so far.
			return null;
		};
		/*
	     * <p>
	     * inserting a CSS or JS block (inline block) in the current document
	     * </p>
	     * @method inject
	     * @param {HTMLElement} node The html element.
	     * @return {Object} conf literal object with the configuration of the block to load.
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
				if (_Y.UA.ie) {
					s.text = conf.js;
				} else {
					s.appendChild( document.createTextNode( conf.js ) );
				}
				h.insertBefore(s, h.firstChild);
				h.removeChild(s);
			}
		};
		
		var c = window.YRegion_config || {},
			r = c.require || [],
			l = c._loader || {},
			root = {
				ns: 'yregion',
				_debug: c._debug,
				_loader: l,
				dependencies: c.dependencies,
				plugins: c.plugins,
				actions: {
					'region:ready': function () {
						var i, m, k;
						/* the general infrastrucure is ready */
						_bd = this;
						/* debug console */
						if (this._debug) {
							new Y.Console().render(); 
						}

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
						}, this);
						
						// focus and blur...
						// http://developer.yahoo.com/yui/3/event/#focusblur
						this.node.on('focus', function(e) {
							var o = _getSemantic(e),
								m = _parseHooks ( o.classes ), 
								r = _trickling(_bd, o.target);
							m.push('focus');
							if (o.target && r) {
								r.bubbling ('focus', m, o);
							}
						}, this);
						this.node.on('blur', function(e) {
							var o = _getSemantic(e),
								m = _parseHooks ( o.classes ), 
								r = _trickling(_bd, o.target);
							m.push('focus');
							if (o.target && r) {
								r.bubbling ('focus', m, o);
							}
						}, this);
						
						// mouse events
						m =  function(e) {
							var o = _createMsgObject (e),
								r = _trickling(_bd, o.target), t;
							if (o.target && r) {
								// checking for region:mouseenter
								if (!e.relatedTarget || !obj.isAncestor(r.node, e.relatedTarget)) {
									r.fire ('region:'+e.type, o);
								}
								// default mouse over message
								r.bubbling ('mouse', e.type, o);
							}
						};
						this.node.on("mouseover", m, this);
		    			this.node.on("mouseout", m, this);
						
						// keyboard events...
						// http://developer.yahoo.com/yui/3/event/#keylistener
						k = function(e) {
							_bd.broadcast ('key', e.type, _createMsgObject (e));
						};
						_Y.on('keypress', k, 'document');
						_Y.on('keyup', k, 'document');
						_Y.on('keydown', k, 'document');
						
						// window events... pending
						_Y.on('window', "resize", function(e) {
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
						if (c.actions && _Y.Lang.isFunction(c.actions['region:ready'])) {
							c.actions['region:ready'].apply (this, []);
						}
						this.install ((c.actions || {}));
					},
					'click:click': function () {
						_Y.log ('[YRegion] global "click:click": ', 'info', arguments);
					}
				},
				waiting: function (f) {
					var that = this;
					/* waiting until the body element become available, probably we should wait until domready instead  */
					_Y.on("domready", function() {
						that.node = that.Y.get('body');
						f.apply(that.node, []);
					});
					return this; /* chaining */
				},
				args: {}
			};
	
		// injecting the default list of requirements 
		r.push("yui", "oop", "event", "dom", "node", "io-base", "io-queue");

		// default filter based on the debug flag
		if (c._debug) {
			l.filter = 'debug';	
			r.push('console');
		}
		
		/* saving the requirements list */
		root.require = Array.prototype.slice.call(r, 0);

		/* creating the global loader object */
		_Y = YUI(l);
		/* inserting the default requirements (Y.use) */
		r.push(function(Y) {
			/* global region definition: document.body */
			_initRegion((c.guid?c.guid:'yregion'), root);
		});
		_Y.use.apply(_Y, r);
	
		return obj;
	}();