<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { Ripples, type RipplesOptions } from '$lib/webgl-ripples';

	import logoGlow from '$lib/assets/logo-layers/glow.webp';
	import logoLigature from '$lib/assets/logo-layers/ligature.webp';
	import logoShadow from '$lib/assets/logo-layers/shadow.webp';
	import logoSquare from '$lib/assets/logo-layers/square.webp';

	interface Props {
		size?: string;
		animated?: boolean;
		toggleAnimationWithShift?: boolean;
		ripplesOptions?: RipplesOptions;
	}

	let {
		size = 'calc(min(90svh, 90svw))',
		animated = true,
		toggleAnimationWithShift = false,
		ripplesOptions: ripplesOptionsProp = {}
	}: Props = $props();

	let ripples: Ripples | null;
	let animatedElements: Element[];
	let animate: (time: number) => void;

	const logoAnimation: Attachment = (element) => {
		animatedElements = [...element.children].filter((child) => child.classList.contains('animate'));
		const ripplesElement = element.getElementsByClassName('ripples')[0] as HTMLElement | undefined;
		const resolution = !ripplesElement ? 512 : Math.min(512, ripplesElement.offsetWidth / 2); // Apply ripples to the container but confine them to the content area
		const DEFAULT_RIPPLES_OPTIONS = {
			resolution,
			dropRadius: 20,
			perturbance: 0.01,
			// contentBounds tells the library where the actual content is
			// (in case of image with transparent margins)
			contentBounds: {
				x: 14.5,
				y: 17,
				width: 66.5,
				height: 66
			}
		};
		const rippleOptions = { ...DEFAULT_RIPPLES_OPTIONS, ...ripplesOptionsProp };

		// Set up ResizeObserver to handle component resizing
		let resizeObserver: ResizeObserver | null = null;
		let lastWidth = ripplesElement?.offsetWidth;
		let lastHeight = ripplesElement?.offsetHeight;

		if (ripplesElement && typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(() => {
				const currentWidth = ripplesElement.offsetWidth;
				const currentHeight = ripplesElement.offsetHeight;

				// Only recreate if size actually changed
				if (currentWidth !== lastWidth || currentHeight !== lastHeight) {
					lastWidth = currentWidth;
					lastHeight = currentHeight;

					if (ripples && animated) {
						// Destroy old instance
						ripples.destroy();
						ripples = null;

						// Recreate with new resolution based on new size
						const newResolution = Math.min(512, currentWidth / 2);
						const newRippleOptions = {
							...rippleOptions,
							resolution: newResolution
						};

						try {
							ripples = new Ripples(ripplesElement, newRippleOptions);
						} catch (e) {
							console.log(e);
						}
					}
				}
			});
			resizeObserver.observe(ripplesElement);
		}

		let angle = $state(0);
		let lastDropTime = $state(0);
		let lastTime = 0;

		animate = (time: number) => {
			// Exit if we shouldn't be running
			if (!animated) {
				return;
			}
			const deltaTime = lastTime ? time - lastTime : 0;
			lastTime = time;

			// Create ripples if needed
			if (animated && !ripples && ripplesElement) {
				try {
					ripples = new Ripples(ripplesElement, rippleOptions);
				} catch (e) {
					console.log(e);
				}
			}

			// Automatic drops (only when animated)
			if (animated && lastDropTime !== null && ripples && ripplesElement) {
				if (time - lastDropTime > 1500) {
					lastDropTime = time;
					const x = Math.random() * ripplesElement.offsetWidth;
					const y = Math.random() * ripplesElement.offsetHeight;
					const strength = 0.1 + Math.random() * 0.04;
					ripples.drop(x, y, rippleOptions.dropRadius, strength);
				}
			}

			// Animate ligature
			angle += deltaTime;

			// Original movement in 0-4 range
			const origX = 2 + 2 * Math.cos(angle / 971 - Math.PI);
			const origY = 2 + 2 * Math.sin(angle / 601 - Math.PI / 2);

			// Rotate -45 degrees: transform the 4x4 square into a diamond
			const dx = animated ? ((origX + origY) * Math.sqrt(2)) / 2 : 0;
			const dy = animated ? ((-origX + origY) * Math.sqrt(2)) / 2 : 0;

			for (const el of animatedElements) {
				(el as HTMLElement).style.transform = `translate(${dx}%, ${dy}%)`;
			}

			// Only continue animation if animated
			if (animated) {
				requestAnimationFrame(animate);
			}
		};

		// Start animation if initially animated
		if (animated) {
			requestAnimationFrame(animate);
		}

		return function () {
			if (ripples) {
				ripples.destroy();
			}
			if (resizeObserver) {
				resizeObserver.disconnect();
			}
		};
	};

	function onclick(event: MouseEvent) {
		// Shift key controls whether click drops or toggles animation.
		if (toggleAnimationWithShift !== event.shiftKey) {
			return;
		}

		animated = !animated;

		if (animated) {
			// Remove transitions before starting animation
			for (const el of animatedElements) {
				(el as HTMLElement).style.transition = '';
			}
			// Start animation
			if (animate) {
				requestAnimationFrame(animate);
			}
		} else {
			// Stop animation - destroy ripples and reset transforms
			if (ripples) {
				ripples.destroy();
				ripples = null;
			}

			// Reset transforms with smooth transition
			for (const el of animatedElements) {
				(el as HTMLElement).style.transition = 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
				(el as HTMLElement).style.transform = 'translate(0%, 0%)';
			}
		}
	}
</script>

<grid-logo {@attach logoAnimation} style:--size={size} {onclick} role="none">
	<img src={logoShadow} class="animate" alt="" />
	<img src={logoGlow} alt="" />
	<div class="ripples" style:background-image="url({logoSquare})"></div>
	<img src={logoLigature} class="animate no-pointer" alt="" />
</grid-logo>

<style>
	grid-logo {
		display: grid;
		place-items: center;
		width: var(--size);
		height: var(--size);
		contain: layout style paint;

		* {
			width: 100%;
			height: 100%;
			grid-column: 1 / 2;
			grid-row: 1 / 2;
			/* Ensure all grid siblings share same stacking context;
               otherwise shadow is rendered above square. */
			z-index: 0;
			will-change: auto;
		}

		div {
			position: relative;
			background-size: 100% 100%;
			background-position: center;
			background-repeat: no-repeat;
		}

		.no-pointer {
			pointer-events: none;
		}
	}
</style>
