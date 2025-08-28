<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}

<style>
	:global(body) {
		margin: 0;
		overflow: hidden;

		background-color: white;
		color: black;
	}

	@media (prefers-color-scheme: dark) {
		:global(body) {
			background-color: #121212;
			color: #e0e0e0;
		}
	}
</style>
