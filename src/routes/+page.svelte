<script lang="ts">
	import type { Attachment } from 'svelte/attachments';

	import logoGlow from '$lib/assets/logo-layers/glow.webp';
	import logoLigature from '$lib/assets/logo-layers/ligature.webp';
	import logoShadow from '$lib/assets/logo-layers/shadow.webp';
	import logoSquare from '$lib/assets/logo-layers/square.webp';

	const logoAnimation: Attachment = (element) => {
		const animatedElements = [...element.children].filter((child) =>
			child.classList.contains('animate')
		);

		let angle = $state(0);

		function animate(time: number) {
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
	<img src={logoSquare} alt="" />
	<img src={logoLigature} class="animate" alt="" />
</grid-logo>

<grid-logo class="dark" {@attach logoAnimation}>
	<img src={logoShadow} class="animate" alt="" />
	<img src={logoGlow} alt="" />
	<img src={logoSquare} alt="" />
	<img src={logoLigature} class="animate" alt="" />
</grid-logo>

<style>
	grid-logo {
		display: grid;
		place-items: center;

		img {
			grid-column: 1 / 2;
			grid-row: 1 / 2;
			height: 50vh;

			/* Ensure all grid siblings share same stacking context;
               otherwise shadow is rendered above square. */
			z-index: 0;
		}

		&.dark {
			background-color: black;
		}
	}
</style>
