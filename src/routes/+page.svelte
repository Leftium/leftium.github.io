<script lang="ts">
	import logoGlow from '$lib/assets/logo-layers/glow.webp';
	import logoLigature from '$lib/assets/logo-layers/ligature.webp';
	import logoShadow from '$lib/assets/logo-layers/shadow.webp';
	import logoSquare from '$lib/assets/logo-layers/square.webp';
</script>

<grid-logo>
	<img src={logoGlow} alt="" />
	<img src={logoShadow} alt="" />
	<img src={logoSquare} alt="" />
	<img src={logoLigature} alt="" />
</grid-logo>

<grid-logo class="dark">
	<img src={logoGlow} alt="" />
	<img src={logoShadow} alt="" />
	<img src={logoSquare} alt="" />
	<img src={logoLigature} alt="" />
</grid-logo>

<style>
	grid-logo {
		display: grid;
		place-items: center;

		img {
			grid-column: 1 / 2;
			grid-row: 1 / 2;
			height: 50vh;
		}

		&.dark {
			background-color: black;
		}
	}
</style>
