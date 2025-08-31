<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { Ripples, type RipplesOptions } from '$lib/webgl-ripples';

	import logoGlow from '$lib/assets/logo-layers/glow.webp';
	import logoLigature from '$lib/assets/logo-layers/ligature.webp';
	import logoShadow from '$lib/assets/logo-layers/shadow.webp';
	import logoSquare from '$lib/assets/logo-layers/square.webp';

	interface Props {
		size?: string;
		ripplesOptions?: RipplesOptions;
	}

	let props: Props = $props();

	let isAnimated = $state(false);

	const size = props.size || 'calc(min(90svh, 90svw))';

	const logoAnimation: Attachment = (element) => {
		const animatedElements = [...element.children].filter((child) =>
			child.classList.contains('animate')
		);
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

		const ripplesOptions = {
			...DEFAULT_RIPPLES_OPTIONS,
			...props.ripplesOptions
		};

		let ripples: Ripples;
		let angle = $state(0);
		let lastDropTime = $state(0);

		if (ripplesElement) {
			try {
				ripples = new Ripples(ripplesElement, ripplesOptions);
			} catch (e) {
				console.log(e);
			}
		}

		let lastTime = 0;
		function animate(time: number) {
			const deltaTime = lastTime ? time - lastTime : 0;
			lastTime = time;

			// Automatic drops
			if (lastDropTime !== null && ripples && ripplesElement) {
				if (time - lastDropTime > 1500) {
					lastDropTime = time;
					const x = Math.random() * ripplesElement.offsetWidth;
					const y = Math.random() * ripplesElement.offsetHeight;
					const strength = 0.1 + Math.random() * 0.04;
					ripples.drop(x, y, ripplesOptions.dropRadius, strength);
				}
			}

			// Animate ligature

			angle = isAnimated ? angle + deltaTime / 100 : 0;
			const dy = !isAnimated ? 0 : 2 + 2 * Math.sin(angle / 5 - Math.PI / 2);
			const dx = !isAnimated ? 0 : 2 + 2 * Math.cos(angle / 13 - Math.PI);

			for (const el of animatedElements) {
				(el as HTMLElement).style.transform = `translate(${dx}%, ${dy}%)`;
			}
			requestAnimationFrame(animate);
		}
		requestAnimationFrame(animate);

		return function () {
			if (ripples) {
				ripples.destroy();
			}
		};
	};

	function onclick() {
		isAnimated = !isAnimated;
	}
</script>

<grid-logo
	{@attach isAnimated ? logoAnimation : undefined}
	style:--size={size}
	{onclick}
	role="none"
>
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

		* {
			width: 100%;
			height: 100%;
			grid-column: 1 / 2;
			grid-row: 1 / 2;
			/* Ensure all grid siblings share same stacking context;
               otherwise shadow is rendered above square. */
			z-index: 0;
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
