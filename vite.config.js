import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		devtoolsJson()
	],
	server: {
		// Allow localtunnel host for webhook testing
		allowedHosts: [
			'hominio-me.loca.lt',
			'.loca.lt' // Allow all loca.lt subdomains for flexibility
		]
	}
});
