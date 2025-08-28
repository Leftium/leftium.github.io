export interface RipplesOptions {
	imageUrl?: string | null;
	resolution?: number;
	dropRadius?: number;
	perturbance?: number;
	interactive?: boolean;
	crossOrigin?: string;
	contentBounds?: {
		x: number;
		y: number;
		width: number;
		height: number;
	} | null;
}

export declare class Ripples {
	constructor(el: string | HTMLElement, options?: RipplesOptions);
	drop(x: number, y: number, radius: number, strength: number): void;
	destroy(): void;
	pause(): void;
	play(): void;
	set(property: string, value: any): void;
	updateSize(): void;
}

export default Ripples;

export declare function isWebGLSupported(): boolean;
