<?php
/**
 * Plugin Name: HM URL Tabs
 * Description: Allows editors to use the core navigation block to create tab-based navigation with rewrite endpoints for conditional block visibility.
 * Version: __VERSION__
 * Author: Human Made Limited
 * Author URI: https://humanmade.com
 * License: GPL-2.0+
 * License URI: http://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain: hm-url-tabs
 */

namespace HM\URLTabs;

use WP_HTML_Tag_Processor;

/**
 * Get the registered endpoints.
 *
 * @return array Array of endpoint configurations.
 */
function get_endpoints() : array {
	/**
	 * Filter the registered tab endpoints.
	 *
	 * @param array $endpoints Array of endpoints with 'name' and 'mask' keys.
	 */
	return apply_filters( 'hm_url_tabs_endpoints', [
		[
			'name' => 'tab',
			'mask' => \EP_ALL,
		],
	] );
}

/**
 * Register rewrite endpoints.
 */
add_action( 'init', function() : void {
	$endpoints = get_endpoints();
	foreach ( $endpoints as $endpoint ) {
		add_rewrite_endpoint( $endpoint['name'], $endpoint['mask'] ?? \EP_ALL );
	}
} );

/**
 * Enqueue block editor assets.
 */
add_action( 'enqueue_block_editor_assets', function() : void {
	$asset = require __DIR__ . '/build/editor.asset.php';
	wp_enqueue_script(
		'hm-url-tabs-editor',
		plugins_url( 'build/editor.js', __FILE__ ),
		$asset['dependencies'],
		$asset['version']
	);
	wp_enqueue_style(
		'hm-url-tabs-editor',
		plugins_url( 'build/editor.css', __FILE__ ),
		[],
		$asset['version']
	);

	// Pass endpoints and current URL to the editor.
	wp_localize_script(
		'hm-url-tabs-editor',
		'hmUrlTabsData',
		[
			'endpoints' => get_endpoints(),
			'currentUrl' => get_permalink(),
		]
	);
} );

/**
 * Enqueue frontend assets.
 */
add_action( 'wp_enqueue_scripts', function() : void {
	$asset = require __DIR__ . '/build/frontend.asset.php';
	wp_enqueue_script(
		'hm-url-tabs-frontend',
		plugins_url( 'build/frontend.js', __FILE__ ),
		$asset['dependencies'],
		$asset['version'],
		true
	);
	wp_enqueue_style(
		'hm-url-tabs-frontend',
		plugins_url( 'build/frontend.css', __FILE__ ),
		[],
		$asset['version']
	);
} );

/**
 * Get the current endpoint value.
 *
 * @param string $endpoint_name The endpoint name to check.
 * @return string|null The endpoint value or null if not set.
 */
function get_current_endpoint_value( string $endpoint_name = 'tab' ) : ?string {
	return get_query_var( $endpoint_name, null );
}

/**
 * Filter navigation-item block variations.
 *
 * @param array  $variations The existing variations.
 * @param object $block_type The block type object.
 * @return array Modified variations.
 */
add_filter( 'get_block_type_variations', function( array $variations, object $block_type ) : array {
	if ( $block_type->name !== 'core/navigation-link' ) {
		return $variations;
	}

	// Add "Home Tab" variation.
	$variations[] = [
		'name' => 'tab-home',
		'title' => __( 'Home Tab', 'hm-url-tabs' ),
		'description' => __( 'A tab link to the current page without any endpoint value.', 'hm-url-tabs' ),
		'attributes' => [
			'kind' => 'tab-home',
			'tabEndpoint' => '',
			'url' => '',
		],
		'isActive' => [ 'kind' ],
		'scope' => [ 'inserter' ],
	];

	// Add "Base Tab" variation.
	$variations[] = [
		'name' => 'tab-base',
		'title' => __( 'Base Tab', 'hm-url-tabs' ),
		'description' => __( 'A tab link to the endpoint without a value (e.g., /tab/).', 'hm-url-tabs' ),
		'attributes' => [
			'kind' => 'tab-base',
			'tabEndpoint' => 'tab',
			'url' => '',
		],
		'isActive' => [ 'kind' ],
		'scope' => [ 'inserter' ],
	];

	// Add "Tab" variation.
	$variations[] = [
		'name' => 'tab',
		'title' => __( 'Tab', 'hm-url-tabs' ),
		'description' => __( 'A tab link with a rewrite endpoint for conditional content display.', 'hm-url-tabs' ),
		'attributes' => [
			'kind' => 'tab',
			'tabEndpoint' => 'tab',
			'url' => '',
		],
		'isActive' => [ 'kind' ],
		'scope' => [ 'inserter' ],
	];

	return $variations;
}, 10, 2 );

/**
 * Filter the render output of navigation-link blocks to rewrite URLs.
 *
 * @param string $block_content The block content.
 * @param array  $block The parsed block.
 * @return string The modified block content.
 */
add_filter( 'render_block', function( string $block_content, array $block ) : string {
	// Handle tab navigation links.
	if ( $block['blockName'] === 'core/navigation-link' && ! empty( $block['attrs']['kind'] ) && in_array( $block['attrs']['kind'], [ 'tab', 'tab-home', 'tab-base' ], true ) ) {
		$kind = $block['attrs']['kind'];
		$endpoint = $block['attrs']['tabEndpoint'] ?: 'tab';
		$tab_value = sanitize_title_with_dashes( $block['attrs']['url'] ?? '' );

		// Get the current page URL.
		$current_url = $_SERVER['REQUEST_URI'];
		if ( strpos( $current_url, "/$endpoint/" ) !== false ) {
			$current_url = explode( $endpoint, $current_url )[0];
		}

		// Build the tab URL.
		if ( $kind === 'tab-home' ) {
			// Home tab is just the current URL.
			$tab_url = $current_url;
		} elseif ( $kind === 'tab-base' ) {
			// Base tab is just the endpoint without a value (e.g., /tab/).
			$tab_url = trailingslashit( $current_url ) . trailingslashit( $endpoint );
		} else {
			// Regular tab with endpoint and value (e.g., /tab/tab-name/).
			$tab_url = trailingslashit( $current_url ) . trailingslashit( $endpoint ) . trailingslashit( $tab_value );
		}

		// Use WP_HTML_Tag_Processor to update the href.
		$processor = new WP_HTML_Tag_Processor( $block_content );
		if ( $processor->next_tag( 'li' ) ) {
			// Add active class if current tab matches.
			$current_endpoint_value = get_current_endpoint_value( $endpoint );
			$is_active = false;

			if ( $kind === 'tab-home' && $current_endpoint_value === null ) {
				// Home tab is active when no endpoint is present.
				$is_active = true;
			} elseif ( $kind === 'tab-base' && $current_endpoint_value === '' ) {
				// Base tab is active when endpoint is present but empty.
				$is_active = true;
			} elseif ( $kind === 'tab' && sanitize_title_with_dashes( $current_endpoint_value ) === $tab_value ) {
				// Regular tab is active when endpoint value matches.
				$is_active = true;
			}

			if ( $is_active ) {
				$processor->add_class( 'current-menu-item' );
			}

			$processor->next_tag( 'a' );
			$processor->add_class( 'hm-url-tab-link' );
			$processor->set_attribute( 'href', $tab_url );
		}

		return (string) $processor;
	}

	// Handle tab visibility for all other blocks.
	if ( ! empty( $block['attrs']['hmUrlTabVisibility'] ) ) {
		$visibility = $block['attrs']['hmUrlTabVisibility'];
		$condition = $visibility['condition'] ?? 'always';
		$endpoint = $visibility['endpoint'] ?? 'tab';
		$tab_value = sanitize_title_with_dashes( $visibility['tabUrl'] ?? '' );

		$current_endpoint_value = get_current_endpoint_value( $endpoint );

		$should_hide = false;

		switch ( $condition ) {
			case 'always':
				// Always show.
				break;

			case 'endpoint-empty':
				// Show only when endpoint is in use but with no value (e.g., /tab).
				if ( $current_endpoint_value !== '' ) {
					$should_hide = true;
				}
				break;

			case 'no-endpoint':
				// Show only when endpoint is not in use at all.
				if ( $current_endpoint_value !== null ) {
					$should_hide = true;
				}
				break;

			case 'specific-tab':
				// Show only when specific tab value matches.
				if ( sanitize_title_with_dashes( $current_endpoint_value ) !== $tab_value ) {
					$should_hide = true;
				}
				break;
		}

		if ( $should_hide ) {
			return '';
		}

		// Add data attribute for frontend transitions if visibility is not 'always'.
		if ( $condition !== 'always' ) {
			$processor = new WP_HTML_Tag_Processor( $block_content );
			if ( $processor->next_tag() ) {
				$processor->set_attribute( 'data-hm-tab-visibility', $endpoint );
			}
			$block_content = (string) $processor;
		}
	}

	return $block_content;
}, 10, 2 );
