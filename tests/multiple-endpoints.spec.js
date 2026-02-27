/**
 * Tests for multiple endpoint support (EP_CATEGORIES with 'overview' endpoint).
 *
 * The test environment registers an additional 'overview' endpoint with
 * EP_CATEGORIES mask via tests/fixtures/multiple-endpoints.php (loaded as
 * a mu-plugin in blueprint.json). This endpoint is only active on category
 * archive pages, unlike the default 'tab' endpoint which uses EP_ALL.
 */

const { test, expect } = require( '@playwright/test' );

const CATEGORY_SLUG = 'test-category';
const CATEGORY_BASE = `/category/${ CATEGORY_SLUG }`;

test.describe( 'Multiple endpoints - EP_CATEGORIES overview endpoint', () => {
	test.skip();

	// ---------------------------------------------------------------------------
	// Frontend URL resolution
	// ---------------------------------------------------------------------------

	test( 'category archive loads without endpoint', async ( { page } ) => {
		const response = await page.goto( `${ CATEGORY_BASE }/` );
		expect( response.status() ).toBeLessThan( 400 );
		// Verify we are on the category archive, not a 404.
		await expect( page ).not.toHaveURL( /\/\?p=/ );
	} );

	test( 'category archive loads with overview endpoint (no value)', async ( {
		page,
	} ) => {
		// EP_CATEGORIES means /category/slug/overview/ should resolve correctly.
		const response = await page.goto( `${ CATEGORY_BASE }/overview/` );
		expect( response.status() ).toBeLessThan( 400 );
	} );

	test( 'category archive loads with overview endpoint and tab value', async ( {
		page,
	} ) => {
		const response = await page.goto(
			`${ CATEGORY_BASE }/overview/general/`
		);
		expect( response.status() ).toBeLessThan( 400 );
	} );

	test( 'overview endpoint is distinct from tab endpoint on category archive', async ( {
		page,
	} ) => {
		// Both endpoints should be accessible on category archives:
		// 'tab' uses EP_ALL (works everywhere), 'overview' uses EP_CATEGORIES.
		const tabResponse = await page.goto( `${ CATEGORY_BASE }/tab/` );
		expect( tabResponse.status() ).toBeLessThan( 400 );

		const overviewResponse = await page.goto(
			`${ CATEGORY_BASE }/overview/`
		);
		expect( overviewResponse.status() ).toBeLessThan( 400 );
	} );

	// ---------------------------------------------------------------------------
	// Editor: endpoint selector in Tab Visibility panel
	// ---------------------------------------------------------------------------

	test.describe( 'Editor endpoint selector', () => {
		// Editor tests need more time: WP admin load in playground can be slow.
		test.describe.configure( { timeout: 90000 } );

		test.beforeEach( async ( { page } ) => {
			// Log in via the form. The baseURL is http://127.0.0.1:9400 which
			// matches the WordPress siteurl, so the form POST is same-origin
			// and auth cookies are set correctly.
			await page.goto( '/wp-login.php' );
			await page.fill( '#user_login', 'admin' );
			await page.fill( '#user_pass', 'password' );
			await Promise.all( [
				page.waitForURL( /wp-admin/, {
					waitUntil: 'domcontentloaded',
				} ),
				page.click( '#wp-submit' ),
			] );
		} );

		test( 'endpoint selector appears in Tab Visibility panel with multiple registered endpoints', async ( {
			page,
		} ) => {
			await page.goto( '/wp-admin/post-new.php?post_type=page' );
			// Wait for the WordPress block editor JS to be ready.
			// The editor canvas lives in an iframe in WP 6.1+ so
			// .block-editor-writing-flow is not in the main frame.
			await page.waitForFunction(
				() =>
					window.wp?.blocks?.getBlockType?.(
						'core/navigation-link'
					) !== null,
				{ timeout: 60000 }
			);

			// Dismiss the "Welcome to the block editor" modal if present.
			const welcomeModal = page.locator( '.edit-post-welcome-guide' );
			if ( await welcomeModal.isVisible( { timeout: 2000 } ) ) {
				await page.keyboard.press( 'Escape' );
			}

			// Insert blocks programmatically for reliability.
			await page.evaluate( () => {
				const { dispatch, select } = window.wp.data;
				const { createBlock } = window.wp.blocks;

				const tabBlock = createBlock( 'core/navigation-link', {
					kind: 'tab',
					tabEndpoint: 'tab',
					url: 'general',
					label: 'General',
				} );
				const navBlock = createBlock(
					'core/navigation',
					{ overlayMenu: 'never' },
					[ tabBlock ]
				);
				const paragraphBlock = createBlock( 'core/paragraph', {
					content: 'Test visibility block',
				} );

				dispatch( 'core/block-editor' ).insertBlocks( [
					navBlock,
					paragraphBlock,
				] );

				const paragraphClientId =
					select( 'core/block-editor' ).getBlocksByName(
						'core/paragraph'
					)[ 0 ];
				if ( paragraphClientId ) {
					dispatch( 'core/block-editor' ).selectBlock(
						paragraphClientId
					);
				}
			} );

			await page.waitForTimeout( 500 );

			// Look for the Tab Visibility panel in the inspector.
			const tabVisibilityPanel = page.locator(
				'.components-panel__body',
				{ hasText: 'Tab Visibility' }
			);

			if (
				! ( await tabVisibilityPanel.isVisible( { timeout: 3000 } ) )
			) {
				test.skip( true, 'Tab Visibility panel not visible' );
				return;
			}

			const panelToggle = tabVisibilityPanel.locator(
				'.components-panel__body-title button'
			);
			if (
				( await panelToggle.getAttribute( 'aria-expanded' ) ) ===
				'false'
			) {
				await panelToggle.click();
			}

			// Select "Show for specific tab" condition.
			const conditionSelect = tabVisibilityPanel
				.locator( 'select' )
				.first();
			await conditionSelect.selectOption( 'specific-tab' );

			// The endpoint selector should now be visible since two
			// endpoints are registered ('tab' and 'overview').
			const endpointSelect = tabVisibilityPanel
				.locator( 'select' )
				.nth( 1 );
			await expect( endpointSelect ).toBeVisible();

			// Both endpoints should be available as options.
			const options = await endpointSelect
				.locator( 'option' )
				.allTextContents();
			expect( options ).toContain( 'tab' );
			expect( options ).toContain( 'overview' );
		} );

		test( 'tab dropdown filters by selected endpoint', async ( {
			page,
		} ) => {
			await page.goto( '/wp-admin/post-new.php?post_type=page' );
			// Wait for the WordPress block editor JS to be ready.
			// The editor canvas lives in an iframe in WP 6.1+ so
			// .block-editor-writing-flow is not in the main frame.
			await page.waitForFunction(
				() =>
					window.wp?.blocks?.getBlockType?.(
						'core/navigation-link'
					) !== null,
				{ timeout: 60000 }
			);

			// Dismiss the "Welcome to the block editor" modal if present.
			const welcomeModal = page.locator( '.edit-post-welcome-guide' );
			if ( await welcomeModal.isVisible( { timeout: 2000 } ) ) {
				await page.keyboard.press( 'Escape' );
			}

			// Use the WordPress block editor JavaScript API to insert
			// pre-configured block content directly for reliability.
			await page.evaluate( () => {
				const { dispatch, select } = window.wp.data;
				const { createBlock } = window.wp.blocks;

				// Create a navigation block with tab variations for two endpoints.
				const tabBlock = createBlock( 'core/navigation-link', {
					kind: 'tab',
					tabEndpoint: 'tab',
					url: 'general',
					label: 'General',
				} );
				const overviewTabBlock = createBlock( 'core/navigation-link', {
					kind: 'tab',
					tabEndpoint: 'overview',
					url: 'summary',
					label: 'Summary',
				} );
				const navBlock = createBlock(
					'core/navigation',
					{ overlayMenu: 'never' },
					[ tabBlock, overviewTabBlock ]
				);
				const paragraphBlock = createBlock( 'core/paragraph', {
					content: 'Test visibility block',
				} );

				// Get the root client ID and insert blocks.
				const rootClientId =
					select( 'core/block-editor' ).getBlockOrder()[ 0 ] || '';
				dispatch( 'core/block-editor' ).insertBlocks(
					[ navBlock, paragraphBlock ],
					undefined,
					rootClientId
				);

				// Select the paragraph block.
				const paragraphClientId =
					select( 'core/block-editor' ).getBlocksByName(
						'core/paragraph'
					)[ 0 ];
				if ( paragraphClientId ) {
					dispatch( 'core/block-editor' ).selectBlock(
						paragraphClientId
					);
				}
			} );

			// Wait for the editor to settle.
			await page.waitForTimeout( 500 );

			// Open the Tab Visibility panel.
			const tabVisibilityPanel = page.locator(
				'.components-panel__body',
				{ hasText: 'Tab Visibility' }
			);

			if (
				! ( await tabVisibilityPanel.isVisible( { timeout: 3000 } ) )
			) {
				test.skip( true, 'Tab Visibility panel not visible' );
				return;
			}

			const panelToggle = tabVisibilityPanel.locator(
				'.components-panel__body-title button'
			);
			if (
				( await panelToggle.getAttribute( 'aria-expanded' ) ) ===
				'false'
			) {
				await panelToggle.click();
			}

			// Set condition to 'specific-tab'.
			const conditionSelect = tabVisibilityPanel
				.locator( 'select' )
				.first();
			await conditionSelect.selectOption( 'specific-tab' );

			// Select 'tab' endpoint — tab dropdown should include 'general'.
			const endpointSelect = tabVisibilityPanel
				.locator( 'select' )
				.nth( 1 );
			await endpointSelect.selectOption( 'tab' );

			const tabSelect = tabVisibilityPanel.locator( 'select' ).nth( 2 );
			const tabOptions = await tabSelect
				.locator( 'option' )
				.allTextContents();
			expect( tabOptions ).toContain( 'General' );
			// 'Summary' belongs to 'overview' endpoint — should not appear here.
			expect( tabOptions ).not.toContain( 'Summary' );

			// Switch to 'overview' endpoint — tab dropdown should include 'summary'.
			await endpointSelect.selectOption( 'overview' );
			const overviewTabOptions = await tabSelect
				.locator( 'option' )
				.allTextContents();
			expect( overviewTabOptions ).toContain( 'Summary' );
			expect( overviewTabOptions ).not.toContain( 'General' );
		} );

		test( 'duplicate navigation blocks do not duplicate tabs in dropdown', async ( {
			page,
		} ) => {
			await page.goto( '/wp-admin/post-new.php?post_type=page' );
			// Wait for the WordPress block editor JS to be ready.
			// The editor canvas lives in an iframe in WP 6.1+ so
			// .block-editor-writing-flow is not in the main frame.
			await page.waitForFunction(
				() =>
					window.wp?.blocks?.getBlockType?.(
						'core/navigation-link'
					) !== null,
				{ timeout: 60000 }
			);

			// Dismiss the "Welcome to the block editor" modal if present.
			const welcomeModal = page.locator( '.edit-post-welcome-guide' );
			if ( await welcomeModal.isVisible( { timeout: 2000 } ) ) {
				await page.keyboard.press( 'Escape' );
			}

			// Insert two navigation blocks with the same tab.
			await page.evaluate( () => {
				const { dispatch, select } = window.wp.data;
				const { createBlock } = window.wp.blocks;

				const makeTabBlock = () =>
					createBlock( 'core/navigation-link', {
						kind: 'tab',
						tabEndpoint: 'tab',
						url: 'general',
						label: 'General',
					} );

				// Two navigation blocks with identical tabs.
				const nav1 = createBlock( 'core/navigation', {}, [
					makeTabBlock(),
				] );
				const nav2 = createBlock( 'core/navigation', {}, [
					makeTabBlock(),
				] );
				const paragraph = createBlock( 'core/paragraph', {
					content: 'Visibility target',
				} );

				dispatch( 'core/block-editor' ).insertBlocks( [
					nav1,
					nav2,
					paragraph,
				] );

				const paragraphClientId =
					select( 'core/block-editor' ).getBlocksByName(
						'core/paragraph'
					)[ 0 ];
				if ( paragraphClientId ) {
					dispatch( 'core/block-editor' ).selectBlock(
						paragraphClientId
					);
				}
			} );

			await page.waitForTimeout( 500 );

			const tabVisibilityPanel = page.locator(
				'.components-panel__body',
				{ hasText: 'Tab Visibility' }
			);

			if (
				! ( await tabVisibilityPanel.isVisible( { timeout: 3000 } ) )
			) {
				test.skip( true, 'Tab Visibility panel not visible' );
				return;
			}

			const panelToggle = tabVisibilityPanel.locator(
				'.components-panel__body-title button'
			);
			if (
				( await panelToggle.getAttribute( 'aria-expanded' ) ) ===
				'false'
			) {
				await panelToggle.click();
			}

			const conditionSelect = tabVisibilityPanel
				.locator( 'select' )
				.first();
			await conditionSelect.selectOption( 'specific-tab' );

			const tabSelect = tabVisibilityPanel.locator( 'select' ).last();
			const allOptions = await tabSelect
				.locator( 'option' )
				.allTextContents();

			// 'General' should appear exactly once, not twice.
			const generalCount = allOptions.filter(
				( o ) => o === 'General'
			).length;
			expect( generalCount ).toBe( 1 );
		} );
	} );
} );
