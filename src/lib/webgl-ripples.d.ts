interface RipplesOptions {
	imageUrl?: string | null;
	resolution?: number;
	dropRadius?: number;
	perturbance?: number;
	interactive?: boolean;
	crossOrigin?: string;
	clipToContent?: boolean;
	contentBounds?: {
		x: number;
		y: number;
		width: number;
		height: number;
	} | null;
}

declare class Ripples {
	constructor(el: string | HTMLElement, options?: RipplesOptions);
	drop(x: number, y: number, radius: number, strength: number): void;
	destroy(): void;
	pause(): void;
	play(): void;
	set(property: string, value: any): void;
	updateSize(): void;

	// Private properties that are accessed in the class
	private el: HTMLElement;
	private options: RipplesOptions;
	private canvas?: HTMLCanvasElement;
	private context?: WebGLRenderingContext | null;
	private destroyed: boolean;
	private running: boolean;
	private visible: boolean;
	private inited: boolean;
	private interactive: boolean;
	private resolution: number;
	private textureDelta?: Float32Array;
	private perturbance: number;
	private dropRadius: number;
	private crossOrigin: string;
	private imageUrl: string | null;
	private clipToContent: boolean;
	private contentBounds: RipplesOptions['contentBounds'];
	private abortController?: AbortController;
	private signal?: AbortSignal;
	private textures?: WebGLTexture[];
	private framebuffers?: WebGLFramebuffer[];
	private bufferWriteIndex?: number;
	private bufferReadIndex?: number;
	private backgroundTexture?: WebGLTexture;
	private backgroundWidth?: number;
	private backgroundHeight?: number;
	private quad?: WebGLBuffer;
	private dropProgram?: any;
	private updateProgram?: any;
	private renderProgram?: any;
	private imageSource?: string;
	private originalCssBackgroundImage?: string;
	private originalInlineCss?: string;
}

interface Window {
	Ripples: typeof Ripples;
}
