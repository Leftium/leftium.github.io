// Based on https://github.com/sirxemic/jquery.ripples.
// Modified to handle images with transparent borders

var gl;

function isPercentage(str) {
	return str[str.length - 1] === '%';
}

/**
 *  Load a configuration of GL settings which the browser supports.
 */
function loadConfig() {
	var canvas = document.createElement('canvas');
	gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

	if (!gl) {
		// Browser does not support WebGL.
		return null;
	}

	// Load extensions
	var extensions = {};
	[
		'OES_texture_float',
		'OES_texture_half_float',
		'OES_texture_float_linear',
		'OES_texture_half_float_linear'
	].forEach(function (name) {
		var extension = gl.getExtension(name);
		if (extension) {
			extensions[name] = extension;
		}
	});

	// If no floating point extensions are supported we can bail out early.
	if (!extensions.OES_texture_float) {
		return null;
	}

	var configs = [];

	function createConfig(type, glType, arrayType) {
		var name = 'OES_texture_' + type,
			nameLinear = name + '_linear',
			linearSupport = nameLinear in extensions,
			configExtensions = [name];

		if (linearSupport) {
			configExtensions.push(nameLinear);
		}

		return {
			type: glType,
			arrayType: arrayType,
			linearSupport: linearSupport,
			extensions: configExtensions
		};
	}

	configs.push(createConfig('float', gl.FLOAT, Float32Array));

	if (extensions.OES_texture_half_float) {
		configs.push(
			createConfig('half_float', extensions.OES_texture_half_float.HALF_FLOAT_OES, null)
		);
	}

	// Setup the texture and framebuffer
	var texture = gl.createTexture();
	var framebuffer = gl.createFramebuffer();

	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	// Check for each supported texture type if rendering to it is supported
	var config = null;

	for (var i = 0; i < configs.length; i++) {
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 32, 32, 0, gl.RGBA, configs[i].type, null);

		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
		if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
			config = configs[i];
			break;
		}
	}

	return config;
}

function createImageData(width, height) {
	try {
		return new ImageData(width, height);
	} catch (e) {
		// Fallback for IE
		var canvas = document.createElement('canvas');
		return canvas.getContext('2d').createImageData(width, height);
	}
}

function translateBackgroundPosition(value) {
	var parts = value.split(' ');

	if (parts.length === 1) {
		switch (value) {
			case 'center':
				return ['50%', '50%'];
			case 'top':
				return ['50%', '0'];
			case 'bottom':
				return ['50%', '100%'];
			case 'left':
				return ['0', '50%'];
			case 'right':
				return ['100%', '50%'];
			default:
				return [value, '50%'];
		}
	} else {
		return parts.map(function (part) {
			switch (value) {
				case 'center':
					return '50%';
				case 'top':
				case 'left':
					return '0';
				case 'right':
				case 'bottom':
					return '100%';
				default:
					return part;
			}
		});
	}
}

function createProgram(vertexSource, fragmentSource) {
	function compileSource(type, source) {
		var shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			throw new Error('compile error: ' + gl.getShaderInfoLog(shader));
		}
		return shader;
	}

	var program = {};

	program.id = gl.createProgram();
	gl.attachShader(program.id, compileSource(gl.VERTEX_SHADER, vertexSource));
	gl.attachShader(program.id, compileSource(gl.FRAGMENT_SHADER, fragmentSource));
	gl.linkProgram(program.id);
	if (!gl.getProgramParameter(program.id, gl.LINK_STATUS)) {
		throw new Error('link error: ' + gl.getProgramInfoLog(program.id));
	}

	// Fetch the uniform and attribute locations
	program.uniforms = {};
	program.locations = {};
	gl.useProgram(program.id);
	gl.enableVertexAttribArray(0);
	var match,
		name,
		regex = /uniform (\w+) (\w+)/g,
		shaderCode = vertexSource + fragmentSource;
	while ((match = regex.exec(shaderCode)) != null) {
		name = match[2];
		program.locations[name] = gl.getUniformLocation(program.id, name);
	}

	return program;
}

function bindTexture(texture, unit) {
	gl.activeTexture(gl.TEXTURE0 + (unit || 0));
	gl.bindTexture(gl.TEXTURE_2D, texture);
}

function extractUrl(value) {
	var urlMatch = /url\(["']?([^"']*)["']?\)/.exec(value);
	if (urlMatch == null) {
		return null;
	}

	return urlMatch[1];
}

function isDataUri(url) {
	return url.match(/^data:/);
}

var config = loadConfig();
var transparentPixels = createImageData(32, 32);

let DEFAULTS = {
	imageUrl: null,
	resolution: 256,
	dropRadius: 20,
	perturbance: 0.03,
	interactive: true,
	crossOrigin: '',
	// NEW: Options for handling transparent margins
	clipToContent: false, // Whether to clip ripples to visible content
	contentBounds: null // Manual override for content bounds {x, y, width, height} as percentages
};

// RIPPLES CLASS DEFINITION
// =============================================================

class Ripples {
	constructor(el, options) {
		var that = this;

		// Resolve the element from a string selector or use the direct element
		this.el = typeof el === 'string' ? document.querySelector(el) : el;
		if (!this.el) {
			console.error('Ripples: Element not found.', el);
			return;
		}

		// Merge default options with user-provided options
		this.options = { ...DEFAULTS, ...options };

		// Init properties from options
		this.interactive = this.options.interactive;
		this.resolution = this.options.resolution;
		this.textureDelta = new Float32Array([1 / this.resolution, 1 / this.resolution]);

		this.perturbance = this.options.perturbance;
		this.dropRadius = this.options.dropRadius;

		this.crossOrigin = this.options.crossOrigin;
		this.imageUrl = this.options.imageUrl;

		// NEW: Store content clipping options
		this.clipToContent = this.options.clipToContent;
		this.contentBounds = this.options.contentBounds;

		// Init WebGL canvas
		var canvas = document.createElement('canvas');
		canvas.width = this.el.clientWidth;
		canvas.height = this.el.clientHeight;
		this.canvas = canvas;
		this.canvas.style.position = 'absolute';

		// NEW: If content bounds are specified, adjust canvas position and size
		if (this.contentBounds) {
			const bounds = this.contentBounds;
			canvas.style.left = bounds.x + '%';
			canvas.style.top = bounds.y + '%';
			canvas.style.width = bounds.width + '%';
			canvas.style.height = bounds.height + '%';
			// Recalculate actual canvas dimensions
			canvas.width = (this.el.clientWidth * bounds.width) / 100;
			canvas.height = (this.el.clientHeight * bounds.height) / 100;
		} else {
			this.canvas.style.inset = 0;
		}

		this.el.append(canvas);
		this.context = gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

		// Check if WebGL context was successfully obtained
		if (!this.context) {
			console.error('Ripples: WebGL is not supported by your browser or is disabled.');
			this.destroyed = true;
			return;
		}

		// Load extensions
		if (config && config.extensions) {
			config.extensions.forEach(function (name) {
				gl.getExtension(name);
			});
		}

		this.abortController = new AbortController();
		let signal = (this.signal = this.abortController.signal);

		// Auto-resize when window size changes.
		this.updateSize = this.updateSize.bind(this);
		window.addEventListener('resize', this.updateSize, { signal });

		// Init rendertargets for ripple data.
		this.textures = [];
		this.framebuffers = [];
		this.bufferWriteIndex = 0;
		this.bufferReadIndex = 1;

		var arrayType = config ? config.arrayType : null;
		var textureData = arrayType ? new arrayType(this.resolution * this.resolution * 4) : null;

		for (var i = 0; i < 2; i++) {
			var texture = gl.createTexture();
			var framebuffer = gl.createFramebuffer();

			gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texParameteri(
				gl.TEXTURE_2D,
				gl.TEXTURE_MIN_FILTER,
				config && config.linearSupport ? gl.LINEAR : gl.NEAREST
			);
			gl.texParameteri(
				gl.TEXTURE_2D,
				gl.TEXTURE_MAG_FILTER,
				config && config.linearSupport ? gl.LINEAR : gl.NEAREST
			);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texImage2D(
				gl.TEXTURE_2D,
				0,
				gl.RGBA,
				this.resolution,
				this.resolution,
				0,
				gl.RGBA,
				(config && config.type) || gl.UNSIGNED_BYTE,
				textureData
			);

			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

			this.textures.push(texture);
			this.framebuffers.push(framebuffer);
		}

		// Init GL stuff
		this.quad = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, +1, -1, +1, +1, -1, +1]),
			gl.STATIC_DRAW
		);

		this.initShaders();
		this.initTexture();
		this.setTransparentTexture();

		// Store original background CSS
		this.originalCssBackgroundImage = getComputedStyle(this.el).backgroundImage;
		this.originalInlineCss = this.el.style.backgroundImage;

		// Load the image either from the options or CSS rules
		this.loadImage();

		// Set correct clear color and blend mode (regular alpha blending)
		gl.clearColor(0, 0, 0, 0);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		// Plugin is successfully initialized!
		this.visible = true;
		this.running = true;
		this.inited = true;
		this.destroyed = false;

		this.setupPointerEvents();

		// Init animation
		function step() {
			if (!that.destroyed) {
				that.step();
				requestAnimationFrame(step);
			}
		}

		requestAnimationFrame(step);

		return this;
	}

	// Set up pointer (mouse + touch) events
	setupPointerEvents() {
		var that = this;

		function dropAtPointerMouseMove(e) {
			if (that.visible && that.running && that.interactive) {
				that.dropAtPointer(e, that.dropRadius * 1, 0.01);
			}
		}

		function dropAtPointerTouch(e) {
			if (that.visible && that.running && that.interactive) {
				var touches = e.changedTouches;
				for (var i = 0; i < touches.length; i++) {
					that.dropAtPointer(touches[i], that.dropRadius * 1, 0.01);
				}
			}
		}

		function dropAtPointerMouseDown(e) {
			if (that.visible && that.running && that.interactive) {
				that.dropAtPointer(e, that.dropRadius * 1.5, 0.14);
			}
		}

		let signal = this.signal;
		this.el.addEventListener('mousemove', dropAtPointerMouseMove, { signal });
		this.el.addEventListener('touchmove', dropAtPointerTouch, { signal, passive: false });
		this.el.addEventListener('touchstart', dropAtPointerTouch, { signal, passive: true });
		this.el.addEventListener('mousedown', dropAtPointerMouseDown, { signal });
	}

	// Load the image either from the options or the element's CSS rules.
	loadImage() {
		var that = this;

		gl = this.context;

		var newImageSource =
			this.imageUrl ||
			extractUrl(this.originalCssBackgroundImage) ||
			extractUrl(getComputedStyle(this.el).backgroundImage);

		// If image source is unchanged, don't reload it.
		if (newImageSource == this.imageSource) {
			return;
		}

		this.imageSource = newImageSource;

		// Falsy source means no background.
		if (!this.imageSource) {
			this.setTransparentTexture();
			return;
		}

		// Load the texture from a new image.
		var image = new Image();
		image.onload = function () {
			gl = that.context;

			// Only textures with dimensions of powers of two can have repeat wrapping.
			function isPowerOfTwo(x) {
				return (x & (x - 1)) === 0;
			}

			var wrapping =
				isPowerOfTwo(image.width) && isPowerOfTwo(image.height) ? gl.REPEAT : gl.CLAMP_TO_EDGE;

			gl.bindTexture(gl.TEXTURE_2D, that.backgroundTexture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapping);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapping);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

			that.backgroundWidth = image.width;
			that.backgroundHeight = image.height;
		};

		// Fall back to a transparent texture when loading the image failed.
		image.onerror = function () {
			gl = that.context;
			that.setTransparentTexture();
		};

		// Disable CORS when the image source is a data URI.
		image.crossOrigin = isDataUri(this.imageSource) ? null : this.crossOrigin;

		image.src = this.imageSource;
	}

	step() {
		gl = this.context;

		// Ensure GL context is available before proceeding
		if (!gl) return;

		if (!this.visible) {
			return;
		}

		this.computeTextureBoundaries();

		if (this.running) {
			this.update();
		}

		this.render();
	}

	drawQuad() {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
	}

	render() {
		if (!gl) return;

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

		gl.viewport(0, 0, this.canvas.width, this.canvas.height);

		gl.enable(gl.BLEND);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		gl.useProgram(this.renderProgram.id);

		bindTexture(this.backgroundTexture, 0);
		bindTexture(this.textures[0], 1);

		gl.uniform1f(this.renderProgram.locations.perturbance, this.perturbance);
		gl.uniform2fv(this.renderProgram.locations.topLeft, this.renderProgram.uniforms.topLeft);
		gl.uniform2fv(
			this.renderProgram.locations.bottomRight,
			this.renderProgram.uniforms.bottomRight
		);
		gl.uniform2fv(
			this.renderProgram.locations.containerRatio,
			this.renderProgram.uniforms.containerRatio
		);
		gl.uniform1i(this.renderProgram.locations.samplerBackground, 0);
		gl.uniform1i(this.renderProgram.locations.samplerRipples, 1);

		this.drawQuad();
		gl.disable(gl.BLEND);
	}

	update() {
		if (!gl) return;

		gl.viewport(0, 0, this.resolution, this.resolution);

		gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[this.bufferWriteIndex]);
		bindTexture(this.textures[this.bufferReadIndex]);
		gl.useProgram(this.updateProgram.id);

		this.drawQuad();

		this.swapBufferIndices();
	}

	swapBufferIndices() {
		this.bufferWriteIndex = 1 - this.bufferWriteIndex;
		this.bufferReadIndex = 1 - this.bufferReadIndex;
	}

	computeTextureBoundaries() {
		var elStyle = getComputedStyle(this.el);
		var backgroundSize = elStyle.backgroundSize;
		var backgroundAttachment = elStyle.backgroundAttachment;
		var backgroundPosition = translateBackgroundPosition(elStyle.backgroundPosition);

		// Here the 'container' is the element which the background adapts to
		// (either the chrome window or some element, depending on attachment)
		var container;
		if (backgroundAttachment == 'fixed') {
			container = { left: window.pageXOffset, top: window.pageYOffset };
			container.width = window.innerWidth;
			container.height = window.innerHeight;
		} else {
			var elRect = this.el.getBoundingClientRect();
			container = {
				left: elRect.left + window.pageXOffset,
				top: elRect.top + window.pageYOffset
			};
			container.width = this.el.clientWidth;
			container.height = this.el.clientHeight;
		}

		// TODO: background-clip
		if (backgroundSize == 'cover') {
			var scale = Math.max(
				container.width / this.backgroundWidth,
				container.height / this.backgroundHeight
			);

			var backgroundWidth = this.backgroundWidth * scale;
			var backgroundHeight = this.backgroundHeight * scale;
		} else if (backgroundSize == 'contain') {
			var scale = Math.min(
				container.width / this.backgroundWidth,
				container.height / this.backgroundHeight
			);

			var backgroundWidth = this.backgroundWidth * scale;
			var backgroundHeight = this.backgroundHeight * scale;
		} else {
			backgroundSize = backgroundSize.split(' ');
			var backgroundWidth = backgroundSize[0] || '';
			var backgroundHeight = backgroundSize[1] || backgroundWidth;

			if (isPercentage(backgroundWidth)) {
				backgroundWidth = (container.width * parseFloat(backgroundWidth)) / 100;
			} else if (backgroundWidth != 'auto') {
				backgroundWidth = parseFloat(backgroundWidth);
			}

			if (isPercentage(backgroundHeight)) {
				backgroundHeight = (container.height * parseFloat(backgroundHeight)) / 100;
			} else if (backgroundHeight != 'auto') {
				backgroundHeight = parseFloat(backgroundHeight);
			}

			if (backgroundWidth == 'auto' && backgroundHeight == 'auto') {
				backgroundWidth = this.backgroundWidth;
				backgroundHeight = this.backgroundHeight;
			} else {
				if (backgroundWidth == 'auto') {
					backgroundWidth = this.backgroundWidth * (backgroundHeight / this.backgroundHeight);
				}

				if (backgroundHeight == 'auto') {
					backgroundHeight = this.backgroundHeight * (backgroundWidth / this.backgroundWidth);
				}
			}
		}

		// Compute backgroundX and backgroundY in page coordinates
		var backgroundX = backgroundPosition[0];
		var backgroundY = backgroundPosition[1];

		if (isPercentage(backgroundX)) {
			backgroundX =
				container.left + ((container.width - backgroundWidth) * parseFloat(backgroundX)) / 100;
		} else {
			backgroundX = container.left + parseFloat(backgroundX);
		}

		if (isPercentage(backgroundY)) {
			backgroundY =
				container.top + ((container.height - backgroundHeight) * parseFloat(backgroundY)) / 100;
		} else {
			backgroundY = container.top + parseFloat(backgroundY);
		}

		var elementRect = this.el.getBoundingClientRect();
		var elementOffset = {
			left: elementRect.left + window.pageXOffset,
			top: elementRect.top + window.pageYOffset
		};

		// NEW: If content bounds are specified, adjust the texture coordinates
		if (this.contentBounds) {
			const bounds = this.contentBounds;
			const adjustedLeft = elementOffset.left + (this.el.clientWidth * bounds.x) / 100;
			const adjustedTop = elementOffset.top + (this.el.clientHeight * bounds.y) / 100;
			const adjustedWidth = (this.el.clientWidth * bounds.width) / 100;
			const adjustedHeight = (this.el.clientHeight * bounds.height) / 100;

			this.renderProgram.uniforms.topLeft = new Float32Array([
				(adjustedLeft - backgroundX) / backgroundWidth,
				(adjustedTop - backgroundY) / backgroundHeight
			]);
			this.renderProgram.uniforms.bottomRight = new Float32Array([
				this.renderProgram.uniforms.topLeft[0] + adjustedWidth / backgroundWidth,
				this.renderProgram.uniforms.topLeft[1] + adjustedHeight / backgroundHeight
			]);
		} else {
			this.renderProgram.uniforms.topLeft = new Float32Array([
				(elementOffset.left - backgroundX) / backgroundWidth,
				(elementOffset.top - backgroundY) / backgroundHeight
			]);
			this.renderProgram.uniforms.bottomRight = new Float32Array([
				this.renderProgram.uniforms.topLeft[0] + this.el.clientWidth / backgroundWidth,
				this.renderProgram.uniforms.topLeft[1] + this.el.clientHeight / backgroundHeight
			]);
		}

		var maxSide = Math.max(this.canvas.width, this.canvas.height);

		this.renderProgram.uniforms.containerRatio = new Float32Array([
			this.canvas.width / maxSide,
			this.canvas.height / maxSide
		]);
	}

	initShaders() {
		// Ensure GL context is available before creating shaders
		if (!gl) return;

		var vertexShader = [
			'attribute vec2 vertex;',
			'varying vec2 coord;',
			'void main() {',
			'coord = vertex * 0.5 + 0.5;',
			'gl_Position = vec4(vertex, 0.0, 1.0);',
			'}'
		].join('\n');

		this.dropProgram = createProgram(
			vertexShader,
			[
				'precision highp float;',

				'const float PI = 3.141592653589793;',
				'uniform sampler2D texture;',
				'uniform vec2 center;',
				'uniform float radius;',
				'uniform float strength;',

				'varying vec2 coord;',

				'void main() {',
				'vec4 info = texture2D(texture, coord);',

				'float drop = max(0.0, 1.0 - length(center * 0.5 + 0.5 - coord) / radius);',
				'drop = 0.5 - cos(drop * PI) * 0.5;',

				'info.r += drop * strength;',

				'gl_FragColor = info;',
				'}'
			].join('\n')
		);

		this.updateProgram = createProgram(
			vertexShader,
			[
				'precision highp float;',

				'uniform sampler2D texture;',
				'uniform vec2 delta;',

				'varying vec2 coord;',

				'void main() {',
				'vec4 info = texture2D(texture, coord);',

				'vec2 dx = vec2(delta.x, 0.0);',
				'vec2 dy = vec2(0.0, delta.y);',

				'// Detect edges and apply boundary conditions',
				'float edgeFactor = 1.0;',
				'if (coord.x <= delta.x || coord.x >= 1.0 - delta.x ||',
				'    coord.y <= delta.y || coord.y >= 1.0 - delta.y) {',
				'    edgeFactor = 0.95; // Dampen waves near edges more aggressively',
				'}',

				'float average = (',
				'texture2D(texture, coord - dx).r +',
				'texture2D(texture, coord - dy).r +',
				'texture2D(texture, coord + dx).r +',
				'texture2D(texture, coord + dy).r',
				') * 0.25;',

				'info.g += (average - info.r) * 2.0;',
				'info.g *= 0.995 * edgeFactor;', // Apply edge dampening
				'info.r += info.g;',

				'// Clamp values to prevent overflow artifacts',
				'info.r = clamp(info.r, -1.0, 1.0);',
				'info.g = clamp(info.g, -1.0, 1.0);',

				'gl_FragColor = info;',
				'}'
			].join('\n')
		);
		gl.uniform2fv(this.updateProgram.locations.delta, this.textureDelta);

		this.renderProgram = createProgram(
			[
				'precision highp float;',

				'attribute vec2 vertex;',
				'uniform vec2 topLeft;',
				'uniform vec2 bottomRight;',
				'uniform vec2 containerRatio;',
				'varying vec2 ripplesCoord;',
				'varying vec2 backgroundCoord;',
				'void main() {',
				'backgroundCoord = mix(topLeft, bottomRight, vertex * 0.5 + 0.5);',
				'backgroundCoord.y = 1.0 - backgroundCoord.y;',
				'ripplesCoord = vec2(vertex.x, -vertex.y) * containerRatio * 0.5 + 0.5;',
				'gl_Position = vec4(vertex.x, -vertex.y, 0.0, 1.0);',
				'}'
			].join('\n'),
			[
				'precision highp float;',

				'uniform sampler2D samplerBackground;',
				'uniform sampler2D samplerRipples;',
				'uniform vec2 delta;',

				'uniform float perturbance;',
				'varying vec2 ripplesCoord;',
				'varying vec2 backgroundCoord;',

				'void main() {',
				'float height = texture2D(samplerRipples, ripplesCoord).r;',
				'// Sample neighboring pixels for calculating normals',
				'vec2 texelSize = delta;',
				'float heightX = texture2D(samplerRipples, clamp(ripplesCoord + vec2(texelSize.x, 0.0), 0.0, 1.0)).r;',
				'float heightY = texture2D(samplerRipples, clamp(ripplesCoord + vec2(0.0, texelSize.y), 0.0, 1.0)).r;',
				'vec3 dx = vec3(texelSize.x, heightX - height, 0.0);',
				'vec3 dy = vec3(0.0, heightY - height, texelSize.y);',
				'vec2 offset = -normalize(cross(dy, dx)).xz;',
				'// Apply edge fading to reduce artifacts at boundaries',
				'float edgeFade = 1.0;',
				'float edgeDistance = 0.05;', // Distance from edge to start fading
				'edgeFade *= smoothstep(0.0, edgeDistance, ripplesCoord.x);',
				'edgeFade *= smoothstep(0.0, edgeDistance, ripplesCoord.y);',
				'edgeFade *= smoothstep(0.0, edgeDistance, 1.0 - ripplesCoord.x);',
				'edgeFade *= smoothstep(0.0, edgeDistance, 1.0 - ripplesCoord.y);',
				'float specular = pow(max(0.0, dot(offset, normalize(vec2(-0.6, 1.0)))), 4.0) * edgeFade;',
				'gl_FragColor = texture2D(samplerBackground, backgroundCoord + offset * perturbance * edgeFade) + specular;',
				'}'
			].join('\n')
		);
		gl.uniform2fv(this.renderProgram.locations.delta, this.textureDelta);
	}

	initTexture() {
		if (!gl) return;
		this.backgroundTexture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.backgroundTexture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	}

	setTransparentTexture() {
		if (!gl) return;
		gl.bindTexture(gl.TEXTURE_2D, this.backgroundTexture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, transparentPixels);
	}

	dropAtPointer(pointer, radius, strength) {
		// Get the canvas element's bounding rect for accurate position
		var canvasRect = this.canvas.getBoundingClientRect();

		// Calculate position relative to canvas
		// Use clientX/clientY if available (mouse events), otherwise use pageX/pageY (touch events)
		var x, y;
		if (pointer.clientX !== undefined) {
			x = pointer.clientX - canvasRect.left;
			y = pointer.clientY - canvasRect.top;
		} else {
			// For touch events that might only have pageX/pageY
			x = pointer.pageX - (canvasRect.left + window.pageXOffset);
			y = pointer.pageY - (canvasRect.top + window.pageYOffset);
		}

		// Check if click is within canvas bounds
		if (x < 0 || x > canvasRect.width || y < 0 || y > canvasRect.height) {
			return;
		}

		// Scale coordinates to canvas pixel dimensions if needed
		if (this.canvas.width !== canvasRect.width || this.canvas.height !== canvasRect.height) {
			x = x * (this.canvas.width / canvasRect.width);
			y = y * (this.canvas.height / canvasRect.height);
		}

		this.drop(x, y, radius, strength);
	}

	/**
	 *  Public methods
	 */
	drop(x, y, radius, strength) {
		gl = this.context;
		if (!gl) return;

		var elWidth = this.contentBounds
			? (this.el.clientWidth * this.contentBounds.width) / 100
			: this.el.clientWidth;
		var elHeight = this.contentBounds
			? (this.el.clientHeight * this.contentBounds.height) / 100
			: this.el.clientHeight;
		var longestSide = Math.max(elWidth, elHeight);

		radius = radius / longestSide;

		var dropPosition = new Float32Array([
			(2 * x - elWidth) / longestSide,
			(elHeight - 2 * y) / longestSide
		]);

		gl.viewport(0, 0, this.resolution, this.resolution);

		gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[this.bufferWriteIndex]);
		bindTexture(this.textures[this.bufferReadIndex]);

		gl.useProgram(this.dropProgram.id);
		gl.uniform2fv(this.dropProgram.locations.center, dropPosition);
		gl.uniform1f(this.dropProgram.locations.radius, radius);
		gl.uniform1f(this.dropProgram.locations.strength, strength);

		this.drawQuad();

		this.swapBufferIndices();
	}

	updateSize() {
		var newWidth = this.el.clientWidth;
		var newHeight = this.el.clientHeight;

		// NEW: Adjust for content bounds if specified
		if (this.contentBounds) {
			newWidth = (newWidth * this.contentBounds.width) / 100;
			newHeight = (newHeight * this.contentBounds.height) / 100;
		}

		if (newWidth !== this.canvas.width || newHeight !== this.canvas.height) {
			this.canvas.width = newWidth;
			this.canvas.height = newHeight;
		}
	}

	destroy() {
		// Remove event listeners
		this.abortController.abort();

		this.canvas.remove();

		// Clean up WebGL resources
		if (gl) {
			gl.deleteBuffer(this.quad);
			gl.deleteProgram(this.dropProgram.id);
			gl.deleteProgram(this.updateProgram.id);
			gl.deleteProgram(this.renderProgram.id);
			gl.deleteTexture(this.backgroundTexture);
			this.textures.forEach((tex) => gl.deleteTexture(tex));
			this.framebuffers.forEach((fb) => gl.deleteFramebuffer(fb));
			gl = null;
		}

		this.destroyed = true;
	}

	pause() {
		if (this.destroyed) return;
		this.running = false;
	}

	play() {
		if (this.destroyed) return;
		this.running = true;
	}

	set(property, value) {
		if (this.destroyed) return;
		switch (property) {
			case 'dropRadius':
			case 'perturbance':
			case 'interactive':
			case 'crossOrigin':
				this[property] = value;
				this.options[property] = value;
				break;
			case 'imageUrl':
				this.imageUrl = value;
				this.options.imageUrl = value;
				this.loadImage();
				break;
			case 'contentBounds':
				this.contentBounds = value;
				this.options.contentBounds = value;
				this.updateSize();
				break;
			case 'resolution':
				console.warn(
					"Ripples: Changing 'resolution' dynamically is not supported. Please re-initialize the Ripples instance."
				);
				break;
			default:
				console.warn(`Ripples: Property "${property}" is not a settable option.`);
		}
	}
}

// Expose the constructor globally
window.Ripples = Ripples;

// Initial check for WebGL support
if (!config) {
	console.error(
		'Ripples.js: Your browser does not support WebGL, the OES_texture_float extension or rendering to floating point textures. Ripples will not initialize.'
	);
	window.Ripples = function () {
		console.error('Ripples.js: WebGL not supported. Cannot create Ripples instance.');
	};
}
