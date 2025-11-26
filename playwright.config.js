const { defineConfig, devices } = require( '@playwright/test' );

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig( {
	testDir: './tests',
	fullyParallel: true,
	forbidOnly: !! process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: [
		[ 'html', { open: process.env.CI ? 'never' : 'on-failure' } ],
		[ 'json', { outputFile: 'test-results/results.json' } ],
		[ 'list' ],
	],
	use: {
		baseURL: process.env.WP_BASE_URL || 'http://localhost:9400',
		trace: 'on-first-retry',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices[ 'Desktop Chrome' ] },
		},
	],
	webServer: process.env.CI
		? undefined
		: {
				command: 'npm run playground:start',
				url: 'http://localhost:9400',
				reuseExistingServer: ! process.env.CI,
				timeout: 120 * 1000,
		  },
} );
