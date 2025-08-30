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

	:global(a) {
		color: #0066cc;
		text-decoration: underline;
	}

	:global(a:hover) {
		color: #0052a3;
	}

	:global(a:visited) {
		color: #663399;
	}

	@media (prefers-color-scheme: dark) {
		:global(body) {
			background-color: #121212;
			color: #e0e0e0;
		}

		:global(a) {
			color: #66b3ff;
		}

		:global(a:hover) {
			color: #99ccff;
		}

		:global(a:visited) {
			color: #cc99ff;
		}
	}
</style>
