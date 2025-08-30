<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { Ripples } from '$lib/webgl-ripples';

	import logoGlow from '$lib/assets/logo-layers/glow.webp';
	import logoLigature from '$lib/assets/logo-layers/ligature.webp';
	import logoShadow from '$lib/assets/logo-layers/shadow.webp';
	import logoSquare from '$lib/assets/logo-layers/square.webp';

	const logoAnimation: Attachment = (element) => {
		const ripplesElement = element.getElementsByClassName('ripples')[0] as HTMLElement | undefined;
		const dropRadius = 20;
		const animatedElements = [...element.children].filter((child) =>
			child.classList.contains('animate')
		);

		let ripples: Ripples;
		let angle = $state(0);
		let lastDropTime = $state(0);

		if (ripplesElement) {
			try {
				// Apply ripples to the container but confine them to the content area
				const resolution = Math.min(512, ripplesElement.offsetWidth / 2);
				ripples = new Ripples(ripplesElement, {
					resolution,
					dropRadius,
					perturbance: 0.01,
					// contentBounds tells the library where the actual content is
					// (in case of image with transparent margins)
					contentBounds: {
						x: 14.5,
						y: 17,
						width: 66.5,
						height: 66
					}
				});
			} catch (e) {
				console.log(e);
			}
		}

		function animate(time: number) {
			// Automatic drops

			if (lastDropTime !== null && ripples && ripplesElement) {
				if (time - lastDropTime > 1500) {
					lastDropTime = time;
					const x = Math.random() * ripplesElement.offsetWidth;
					const y = Math.random() * ripplesElement.offsetHeight;
					const strength = 0.1 + Math.random() * 0.04;
					ripples.drop(x, y, dropRadius, strength);
				}
			}

			// Animate ligature
			angle = time / 100;
			const dy = 2 + 2 * Math.sin(angle / 5);
			const dx = 2 + 2 * Math.cos(angle / 13);

			for (const el of animatedElements) {
				(el as HTMLElement).style.transform = `translate(${dx}%, ${dy}%)`;
			}
			requestAnimationFrame(animate);
		}
		requestAnimationFrame(animate);
	};
</script>

<grid-logo {@attach logoAnimation}>
	<img src={logoShadow} class="animate" alt="" />
	<img src={logoGlow} alt="" />
	<div class="ripples" style:background-image="url({logoSquare})"></div>
	<img src={logoLigature} class="animate no-pointer" alt="" />
</grid-logo>

<center>View the <a href="https://github.com/Leftium/leftium.github.io">source code</a>!</center>

<div hidden>
	<grid-logo class="dark" {@attach logoAnimation}>
		<img src={logoShadow} class="animate" alt="" />
		<img src={logoGlow} alt="" />
		<div class="ripples" style:background-image="url({logoSquare})"></div>
		<img src={logoLigature} class="animate no-pointer" alt="" />
	</grid-logo>
</div>

<style>
	grid-logo {
		display: grid;
		place-items: center;

		* {
			grid-column: 1 / 2;
			grid-row: 1 / 2;
			width: calc(min(90svh, 90svw));
			height: calc(min(90svh, 90svw));
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

		&.dark {
			background-color: black;
		}
	}

	center {
		font-family: sans-serif;
	}
</style>
